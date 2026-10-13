import { describe, expect, it } from 'vitest';
import { CAMPANHA_VERSAO, campanhaPadrao, campanhasDeFabrica, LIMITES_DA_CAMPANHA, sanearCampanha, type CampanhaSpec } from '../sim/campanha';
import { esquadraoPadrao, excessosDoEsquadrao } from '../sim/esquadrao';
import {
  adicionarEtapa,
  modosOferecidos,
  moverEtapa,
  novaEtapa,
  podeAdicionar,
  removerEtapa,
  renomear,
  resumoDoEsquadraoDaEtapa,
  tituloDaCampanha,
  trocarAbates,
  trocarEsquadrao,
  trocarMapa,
  trocarModo,
} from './campanhaEditor';

const op = (): CampanhaSpec => campanhasDeFabrica()[1]!; // Bunker DM · Cidade Neon DM · Bandeira · Sobrevivência

describe('o editor de campanha: cada ação devolve outra campanha válida, nunca muda a recebida', () => {
  it('adicionar acrescenta no fim e para no teto; a recebida fica como estava', () => {
    const c = campanhaPadrao();
    const antes = JSON.stringify(c);
    let n = adicionarEtapa(c, novaEtapa(esquadraoPadrao()));
    expect(JSON.stringify(c)).toBe(antes);
    expect(n.etapas).toHaveLength(2);
    while (podeAdicionar(n)) n = adicionarEtapa(n, novaEtapa(esquadraoPadrao()));
    expect(n.etapas).toHaveLength(LIMITES_DA_CAMPANHA.etapas);
    expect(adicionarEtapa(n, novaEtapa(esquadraoPadrao()))).toBe(n); // no teto: a mesma campanha
  });

  it('a etapa nova pede um modo que o mapa tenha: Sobrevivência no Bunker vira Deathmatch com a meta padrão', () => {
    expect(novaEtapa(esquadraoPadrao(), 'bunker', 'survival')).toMatchObject({ mapa: 'bunker', modo: 'deathmatch', abates: LIMITES_DA_CAMPANHA.abatesPadrao });
    expect(novaEtapa(esquadraoPadrao(), 'arena', 'ctf')).toEqual({ mapa: 'arena', modo: 'ctf', esquadrao: esquadraoPadrao() });
    expect(novaEtapa(esquadraoPadrao()).modo).toBe('survival');
  });

  it('remover tira a etapa; a última não sai (campanha sem etapa não existe); índice fora não faz nada', () => {
    const c = op();
    const r = removerEtapa(c, 1);
    expect(r.etapas).toHaveLength(3);
    expect(r.etapas.map((e) => e.modo)).toEqual(['deathmatch', 'ctf', 'survival']);
    expect(removerEtapa(campanhaPadrao(), 0).etapas).toHaveLength(1);
    expect(removerEtapa(c, 9)).toBe(c);
    expect(removerEtapa(c, -1)).toBe(c);
  });

  it('mover troca com a vizinha; na ponta não faz nada', () => {
    const c = op();
    const abaixo = moverEtapa(c, 0, 1);
    expect(abaixo.etapas.map((e) => e.mapa)).toEqual(['arena', 'bunker', 'arena', 'arena']);
    expect(moverEtapa(c, 0, -1)).toBe(c);
    expect(moverEtapa(c, 3, 1)).toBe(c);
    expect(moverEtapa(moverEtapa(c, 0, 1), 1, -1)).toEqual(c);
  });

  it('trocar para o Bunker: o modo que ele não tem vira Deathmatch e o esquadrão é cortado para caber; voltar à Cidade Neon mantém o que sobrou', () => {
    const c = op();
    const bunker = trocarMapa(c, 3, 'bunker'); // a Sobrevivência de fechamento
    expect(bunker.etapas[3]).toMatchObject({ mapa: 'bunker', modo: 'deathmatch', abates: LIMITES_DA_CAMPANHA.abatesPadrao });
    expect(excessosDoEsquadrao(bunker.etapas[3]!.esquadrao, 'bunker')).toEqual([]);
    expect(trocarMapa(c, 3, 'arena')).toBe(c); // já é a Cidade Neon
    expect(trocarMapa(c, 9, 'bunker')).toBe(c);
  });

  it('trocar o modo: entrar no Deathmatch põe a meta padrão, sair a apaga, e o mapa que não tem o modo recusa', () => {
    const c = op();
    const dm = trocarModo(c, 3, 'deathmatch');
    expect(dm.etapas[3]).toMatchObject({ modo: 'deathmatch', abates: LIMITES_DA_CAMPANHA.abatesPadrao });
    const sv = trocarModo(dm, 3, 'survival');
    expect(sv.etapas[3]!.abates).toBeUndefined();
    expect(trocarModo(c, 0, 'survival')).toBe(c); // o Bunker não tem Sobrevivência
    expect(trocarModo(c, 0, 'ctf')).toBe(c);
    expect(trocarModo(c, 3, 'survival')).toBe(c); // já é
  });

  it('a meta de abates vai para os limites e só vale no Deathmatch', () => {
    const c = op();
    expect(trocarAbates(c, 0, 1).etapas[0]!.abates).toBe(LIMITES_DA_CAMPANHA.abatesMin);
    expect(trocarAbates(c, 0, 500).etapas[0]!.abates).toBe(LIMITES_DA_CAMPANHA.abatesMax);
    expect(trocarAbates(c, 0, 20).etapas[0]!.abates).toBe(20);
    expect(trocarAbates(c, 2, 20)).toBe(c); // Bandeira não tem meta
  });

  it('trocar o esquadrão da etapa: o do editor entra e é cortado ao que o mapa comporta', () => {
    const grande = { v: 1 as const, inimigos: Array.from({ length: 24 }, () => ({ papel: 'android' as const })), aliados: [] };
    const c = trocarEsquadrao(op(), 0, grande); // etapa 0 é o Bunker
    expect(c.etapas[0]!.esquadrao.inimigos.length).toBeLessThan(24);
    expect(excessosDoEsquadrao(c.etapas[0]!.esquadrao, 'bunker')).toEqual([]);
    const c2 = trocarEsquadrao(op(), 1, grande); // a Cidade Neon comporta
    expect(c2.etapas[1]!.esquadrao.inimigos).toHaveLength(24);
  });

  it('renomear limpa o nome; vazio apaga e a tela usa o título automático', () => {
    const c = renomear(op(), '  Minha   <b>Noite</b>  ');
    expect(c.nome).toBe('Minha bNoite/b');
    const sem = renomear(c, '   ');
    expect(sem.nome).toBeUndefined();
    expect(tituloDaCampanha(sem)).toBe('CAMPANHA · 4 ETAPAS');
    expect(tituloDaCampanha(campanhaPadrao())).toBe('SOBREVIVÊNCIA');
    expect(tituloDaCampanha({ v: CAMPANHA_VERSAO, etapas: [campanhaPadrao().etapas[0]!] })).toBe('CAMPANHA · 1 ETAPA');
  });

  it('toda ação deixa a campanha canônica (passa pelo saneamento sem mudar)', () => {
    let c = op();
    c = trocarMapa(c, 1, 'bunker');
    c = trocarModo(c, 2, 'deathmatch');
    c = moverEtapa(c, 2, -1);
    c = adicionarEtapa(c, novaEtapa(esquadraoPadrao(), 'arena', 'ctf'));
    c = removerEtapa(c, 0);
    expect(sanearCampanha(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });

  it('os modos oferecidos e o resumo do esquadrão da etapa', () => {
    expect(modosOferecidos('bunker')).toEqual(['deathmatch']);
    expect(modosOferecidos('arena')).toEqual(['deathmatch', 'survival', 'ctf']);
    expect(resumoDoEsquadraoDaEtapa(campanhaPadrao().etapas[0]!)).toBe('4 inimigos · 2 aliados');
    expect(resumoDoEsquadraoDaEtapa(op().etapas[0]!)).toBe('3 inimigos · 0 aliados');
  });
});
