import { describe, expect, it, vi } from 'vitest';
import { LIMITES_DAS_REGRAS, REGRAS_PADRAO, type RegrasOnline } from '../../../shared/regras';
import type { Resposta } from '../net/admin';
import { ESQUADRAO_VERSAO, type EsquadraoSpec } from '../sim/esquadrao';
import { esquadraoDasRegras, type RespostaDoEsquadrao } from '../sim/esquadraoOnline';
import { EsquadraoEditor, PREDEFINIDOS, PREDEFINIDOS_ONLINE } from './esquadraoEditor';
import { criarSquadOnline, type ClienteDoEsquadrao } from './squadOnline';

const ok = <T>(dados: T): Resposta<T> => ({ ok: true, dados });
const salvoCom = (nomes: string[]): EsquadraoSpec => ({ v: ESQUADRAO_VERSAO, inimigos: nomes.map((nome) => ({ papel: 'mech' as const, nome })), aliados: [] });

/** Um servidor de mentira: guarda as regras e o esquadrão como o de verdade (o teto e o puxão aos limites são do servidor, testados lá). */
function servidor(regras: RegrasOnline = { ...REGRAS_PADRAO }, salvo: EsquadraoSpec | null = null) {
  const estado = { regras, salvo };
  const cliente = {
    esquadrao: vi.fn(async () => ok<RespostaDoEsquadrao>({ salvo: estado.salvo !== null, esquadrao: estado.salvo ?? esquadraoDasRegras(estado.regras) })),
    regras: vi.fn(async () => ok({ ...estado.regras })),
    gravarRegras: vi.fn(async (r: RegrasOnline) => {
      const L = LIMITES_DAS_REGRAS.atacantes;
      estado.regras = { ...r, atacantes: Math.max(L.min, Math.min(L.max, r.atacantes)) };
      return ok({ ...estado.regras });
    }),
    gravarEsquadrao: vi.fn(async (e: EsquadraoSpec | null) => {
      estado.salvo = e;
      return ok<RespostaDoEsquadrao>({ salvo: e !== null, esquadrao: e ?? esquadraoDasRegras(estado.regras) });
    }),
  };
  return { estado, cliente: cliente as unknown as ClienteDoEsquadrao, chamadas: cliente };
}

describe('a janela ESQUADRÃO falando com o servidor (P270)', () => {
  it('carregar junta o esquadrão e a pressão das regras: sem esquadrão salvo vale o das regras, e o preset PADRÃO é esse', async () => {
    const s = servidor({ dificuldade: 'dificil', mechs: 3, androides: 2, atacantes: 2 });
    const r = await criarSquadOnline(s.cliente).carregar();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estado).toMatchObject({ salvo: false, atacantes: 2, dificuldade: 'dificil' });
    expect(r.estado.esquadrao).toEqual(esquadraoDasRegras(s.estado.regras));
    expect(r.estado.padrao).toEqual(esquadraoDasRegras(s.estado.regras));
    expect(r.estado.esquadrao.inimigos.filter((b) => b.papel === 'mech')).toHaveLength(3);
  });

  it('com esquadrão salvo, ele vale e o padrão continua sendo o das regras (o "voltar às regras")', async () => {
    const s = servidor(undefined, salvoCom(['ALFA', 'BETA']));
    const r = await criarSquadOnline(s.cliente).carregar();
    expect(r.ok && r.estado.salvo).toBe(true);
    expect(r.ok && r.estado.esquadrao.inimigos.map((b) => b.nome)).toEqual(['ALFA', 'BETA']);
    expect(r.ok && r.estado.padrao).toEqual(esquadraoDasRegras(REGRAS_PADRAO));
  });

  it('gravar manda o esquadrão e, só se mudou, a pressão (dentro dos limites); devolve o que ficou valendo', async () => {
    const s = servidor();
    const r = await criarSquadOnline(s.cliente).gravar(salvoCom(['ALFA']), 3);
    expect(s.chamadas.gravarRegras).toHaveBeenCalledWith({ ...REGRAS_PADRAO, atacantes: 3 });
    expect(s.chamadas.gravarEsquadrao).toHaveBeenCalledWith(salvoCom(['ALFA']));
    expect(r.ok && r.estado).toMatchObject({ salvo: true, atacantes: 3 });

    const igual = servidor();
    await criarSquadOnline(igual.cliente).gravar(salvoCom(['A']), REGRAS_PADRAO.atacantes);
    expect(igual.chamadas.gravarRegras).not.toHaveBeenCalled(); // a pressão não mudou: as regras ficam como estão

    const alem = servidor();
    const puxada = await criarSquadOnline(alem.cliente).gravar(null, 99);
    expect(alem.chamadas.gravarRegras).toHaveBeenCalledWith({ ...REGRAS_PADRAO, atacantes: LIMITES_DAS_REGRAS.atacantes.max }); // nunca pede o impossível
    expect(puxada.ok && puxada.estado.atacantes).toBe(LIMITES_DAS_REGRAS.atacantes.max);
  });

  it('`null` volta às regras: o esquadrão salvo some e a janela passa a mostrar o das regras', async () => {
    const s = servidor(undefined, salvoCom(['ALFA', 'BETA']));
    const r = await criarSquadOnline(s.cliente).gravar(null, REGRAS_PADRAO.atacantes);
    expect(s.estado.salvo).toBeNull();
    expect(r.ok && r.estado).toMatchObject({ salvo: false });
    expect(r.ok && r.estado.esquadrao).toEqual(esquadraoDasRegras(REGRAS_PADRAO));
  });

  it('cada falha vira uma frase em português (sem chave, chave recusada, servidor fora do ar) e nada é gravado pela metade', async () => {
    const falha = (motivo: 'sem-token' | 'token' | 'fora-do-ar'): Resposta<never> => ({ ok: false, motivo });
    for (const [motivo, trecho] of [['sem-token', 'chave do dono'], ['token', 'recusou a chave'], ['fora-do-ar', 'não respondeu']] as const) {
      const s = servidor();
      (s.chamadas.esquadrao as ReturnType<typeof vi.fn>).mockResolvedValue(falha(motivo));
      const r = await criarSquadOnline(s.cliente).carregar();
      expect(r.ok, motivo).toBe(false);
      expect(!r.ok && r.motivo, motivo).toContain(trecho);
      const g = servidor();
      (g.chamadas.regras as ReturnType<typeof vi.fn>).mockResolvedValue(falha(motivo));
      const gravou = await criarSquadOnline(g.cliente).gravar(salvoCom(['X']), 3);
      expect(gravou.ok, motivo).toBe(false);
      expect(g.chamadas.gravarEsquadrao, motivo).not.toHaveBeenCalled(); // sem ler as regras, nem tenta gravar o esquadrão
    }
    // Uma falha ao gravar a pressão para antes de gravar o esquadrão.
    const meio = servidor();
    (meio.chamadas.gravarRegras as ReturnType<typeof vi.fn>).mockResolvedValue(falha('token'));
    expect((await criarSquadOnline(meio.cliente).gravar(salvoCom(['X']), 3)).ok).toBe(false);
    expect(meio.chamadas.gravarEsquadrao).not.toHaveBeenCalled();
  });
});

describe('o editor do esquadrão das salas online (P270)', () => {
  const online = (inicial: EsquadraoSpec = salvoCom([])) => new EsquadraoEditor(inicial, 'arena', () => esquadraoDasRegras(REGRAS_PADRAO), true);

  it('o teto é o da sala: 6 Mechs, 6 andróides, 1 técnico, e o que já passava do teto entra cortado', () => {
    const e = online();
    for (let i = 0; i < 9; i++) e.adicionar('inimigo', 'mech');
    for (let i = 0; i < 9; i++) e.adicionar('inimigo', 'android');
    for (let i = 0; i < 3; i++) e.adicionar('inimigo', 'technician');
    expect(e.lista('inimigo').filter((b) => b.papel === 'mech')).toHaveLength(6);
    expect(e.lista('inimigo').filter((b) => b.papel === 'android')).toHaveLength(6);
    expect(e.lista('inimigo').filter((b) => b.papel === 'technician')).toHaveLength(1);
    expect(e.podeAdicionar('inimigo', 'mech')).toMatch(/no máximo 6 mechs/);
    expect(e.podeAdicionar('inimigo', 'technician')).toMatch(/no máximo 1 técnico/);
    const grande = salvoCom(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
    expect(online(grande).lista('inimigo')).toHaveLength(6);
  });

  it('não há aliados nem titãs: o botão recusa com o motivo, e o robô que viraria titã fica como estava', () => {
    const e = online(salvoCom(['A']));
    expect(e.podeAdicionar('aliado', 'mech')).toBe('online não há aliados');
    expect(e.adicionar('aliado', 'mech')).toBe(-1);
    expect(e.limites).toMatchObject({ aliados: 0, titas: 0, inimigos: 13, total: 13 });
    const recusa = e.editar('inimigo', 0, { chassi: 'colossus01' });
    expect(recusa).toMatch(/não há titãs/);
    expect(e.lista('inimigo')[0]!.chassi).toBeUndefined();
  });

  it('só os prontos que servem a uma sala existem (PADRÃO, PESADOS, DUELO); o resto é recusado', () => {
    for (const id of PREDEFINIDOS_ONLINE) expect(PREDEFINIDOS.some((p) => p.id === id), id).toBe(true);
    const pesados = online();
    pesados.usarPredefinido('pesados');
    expect(pesados.lista('inimigo')).toHaveLength(6); // os 6 Mechs cabem (até o P273 o teto era 3 e o pronto entrava cortado)
    expect(pesados.lista('aliado')).toEqual([]); // os 3 escoteiros aliados ficam de fora
    expect(online().usarPredefinido('cerco')).toBeNull();
    expect(online().usarPredefinido('aliados')).toBeNull();
    const padrao = online();
    padrao.usarPredefinido('padrao');
    expect(padrao.esquadrao).toEqual(esquadraoDasRegras(REGRAS_PADRAO));
  });

  it('o editor offline segue como sempre: aliados, titãs e o teto do mapa', () => {
    const e = new EsquadraoEditor(salvoCom(['A']));
    expect(e.podeAdicionar('aliado', 'mech')).toBeNull();
    expect(e.limites.porPapel).toBeUndefined();
    expect(e.limites.inimigos).toBeGreaterThan(7);
  });
});
