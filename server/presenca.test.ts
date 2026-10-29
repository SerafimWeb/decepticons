import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiarioDePresenca, PRESENCA_ABERTA_NO_MAXIMO_MS, PRESENCA_ARQUIVO, PRESENCA_JUNTA_RECONEXAO_MS, PRESENCA_MAX_CONTAS, PRESENCA_MAX_CONVIDADOS, PRESENCA_RETENCAO_DIAS } from './presenca';

const pasta = resolve('.tmp', 'presenca-teste');
afterAll(() => rmSync(pasta, { recursive: true, force: true }));
const limpar = () => {
  rmSync(pasta, { recursive: true, force: true });
  mkdirSync(pasta, { recursive: true });
};
const DIA = 24 * 60 * 60 * 1000;
/** Um relógio de mentira que anda quando o teste manda. */
const relogio = (inicio = 1_800_000_000_000) => {
  let t = inicio;
  return { agora: () => t, anda: (ms: number) => (t += ms) };
};
const quem = (apelido: string, conta: number | null = null, sala = 'ARENA') => ({ apelido, conta, sala, mapa: 'arena' });

describe('o diário de presença: quem entrou nas salas e quando (P275)', () => {
  it('guarda quem entrou e quando saiu; as visitas voltam das mais novas para as mais velhas, e quem está dentro ainda não tem saída', () => {
    const r = relogio();
    const d = new DiarioDePresenca(null, r.agora);
    const a = {};
    const b = {};
    d.entrou(a, quem('ALFA', 7));
    r.anda(60_000);
    d.entrou(b, quem('BRAVO'));
    r.anda(30_000);
    d.saiu(a);
    const lista = d.recentes();
    expect(lista.map((v) => v.apelido)).toEqual(['BRAVO', 'ALFA']);
    expect(lista[0]).toMatchObject({ apelido: 'BRAVO', conta: null, sala: 'ARENA', mapa: 'arena', saiu: null });
    expect(lista[1]).toMatchObject({ apelido: 'ALFA', conta: 7 });
    expect(lista[1]!.saiu! - lista[1]!.entrou).toBe(90_000);
    expect(d.dentroAgora()).toBe(1);
  });

  it('sair sem ter entrado não faz nada, e sair duas vezes não muda a hora da primeira saída', () => {
    const r = relogio();
    const d = new DiarioDePresenca(null, r.agora);
    d.saiu({});
    expect(d.recentes()).toEqual([]);
    const a = {};
    d.entrou(a, quem('ALFA'));
    r.anda(1000);
    d.saiu(a);
    const saida = d.recentes()[0]!.saiu;
    r.anda(5000);
    d.saiu(a);
    expect(d.recentes()[0]!.saiu).toBe(saida);
  });

  it('o que sai de recentes é cópia: mexer nela não muda o diário', () => {
    const d = new DiarioDePresenca(null);
    d.entrou({}, quem('ALFA'));
    d.recentes()[0]!.apelido = 'FORJADO';
    expect(d.recentes()[0]!.apelido).toBe('ALFA');
  });

  it('o diário guarda 30 dias: a visita que saiu há mais que isso sai do arquivo na próxima mudança (a que ninguém fechou vale 12 h e envelhece igual)', () => {
    const r = relogio();
    const d = new DiarioDePresenca(null, r.agora);
    const velho = {};
    const dentro = {};
    d.entrou(velho, quem('VELHO'));
    d.entrou(dentro, quem('DENTRO'));
    r.anda(1000);
    d.saiu(velho);
    r.anda((PRESENCA_RETENCAO_DIAS - 1) * DIA);
    d.entrou({}, quem('NOVO'));
    expect(d.recentes().map((v) => v.apelido)).toEqual(['NOVO', 'DENTRO', 'VELHO']); // ainda no prazo
    r.anda(2 * DIA);
    d.entrou({}, quem('OUTRO'));
    expect(d.recentes().map((v) => v.apelido)).toEqual(['OUTRO', 'NOVO']); // VELHO e DENTRO (aberta, vale 12 h) passaram de 30 dias
  });

  it('o teto dos convidados: passando dele, os mais velhos saem primeiro', () => {
    const r = relogio();
    const d = new DiarioDePresenca(null, r.agora);
    for (let i = 0; i < PRESENCA_MAX_CONVIDADOS + 5; i++) {
      const c = {};
      d.entrou(c, quem(`P${i}`));
      d.saiu(c);
      r.anda(10);
    }
    const todas = d.recentes(PRESENCA_MAX_CONVIDADOS + 100);
    expect(todas).toHaveLength(PRESENCA_MAX_CONVIDADOS);
    expect(todas[0]!.apelido).toBe(`P${PRESENCA_MAX_CONVIDADOS + 4}`);
    expect(todas.at(-1)!.apelido).toBe('P5');
  });

  it('quem inunda o diário de convidados (entrar e sair em loop com apelidos inventados) não apaga as entradas de quem estava logado', () => {
    const r = relogio();
    const d = new DiarioDePresenca(null, r.agora);
    for (let i = 0; i < 10; i++) {
      const c = {};
      d.entrou(c, quem(`CONTA${i}`, 100 + i));
      d.saiu(c);
      r.anda(10);
    }
    for (let i = 0; i < PRESENCA_MAX_CONVIDADOS * 2; i++) {
      const c = {};
      d.entrou(c, quem(`SPAM${i}`));
      d.saiu(c);
      r.anda(10);
    }
    const todas = d.recentes(PRESENCA_MAX_CONVIDADOS + PRESENCA_MAX_CONTAS);
    expect(todas.filter((v) => v.conta !== null)).toHaveLength(10);
    expect(todas.filter((v) => v.conta === null)).toHaveLength(PRESENCA_MAX_CONVIDADOS);
  });

  it('o teto das contas vale por si: as mais velhas das contas saem, os convidados não são tocados', () => {
    const r = relogio();
    const d = new DiarioDePresenca(null, r.agora);
    d.entrou({}, quem('CONVIDADO'));
    for (let i = 0; i < PRESENCA_MAX_CONTAS + 3; i++) {
      const c = {};
      d.entrou(c, quem(`C${i}`, i + 1));
      d.saiu(c);
      r.anda(10);
    }
    const todas = d.recentes(PRESENCA_MAX_CONVIDADOS + PRESENCA_MAX_CONTAS);
    expect(todas.filter((v) => v.conta !== null)).toHaveLength(PRESENCA_MAX_CONTAS);
    expect(todas.some((v) => v.apelido === 'CONVIDADO')).toBe(true);
    expect(todas.some((v) => v.apelido === 'C0')).toBe(false);
  });

  it('a mesma pessoa que sai e volta à mesma sala em 2 minutos (a rede oscilou) continua na MESMA entrada; depois disso, ou outra pessoa, ou outra sala, ou a aba aberta ao lado, é entrada nova', () => {
    const r = relogio();
    const d = new DiarioDePresenca(null, r.agora);
    const a = {};
    d.entrou(a, quem('ALFA', 7));
    r.anda(60_000);
    d.saiu(a);
    r.anda(30_000);
    const b = {};
    d.entrou(b, quem('ALFA', 7)); // voltou em 30 s
    expect(d.recentes()).toHaveLength(1);
    expect(d.recentes()[0]).toMatchObject({ apelido: 'ALFA', saiu: null });
    expect(d.dentroAgora()).toBe(1);
    d.saiu(b);
    expect(d.recentes()[0]!.saiu).not.toBeNull(); // a conexão nova fecha a entrada reaberta
    r.anda(PRESENCA_JUNTA_RECONEXAO_MS + 1);
    d.entrou({}, quem('ALFA', 7)); // voltou tarde
    expect(d.recentes()).toHaveLength(2);
    const c = {};
    d.saiu(c);
    d.entrou({}, quem('ALFA', 8)); // outra conta com o mesmo apelido
    d.entrou({}, quem('ALFA', 7, 'OUTRA')); // outra sala
    d.entrou({}, quem('ALFA', 7)); // outra aba, com a entrada de antes ainda aberta
    expect(d.recentes()).toHaveLength(5);
  });

  it('uma visita que ninguém fechou (a rede sumiu sem aviso) para de contar 12 h depois da entrada, e a conexão que fechar depois não a reescreve', () => {
    const r = relogio();
    const d = new DiarioDePresenca(null, r.agora);
    const sumida = {};
    d.entrou(sumida, quem('SUMIDA'));
    const entrou = d.recentes()[0]!.entrou;
    r.anda(PRESENCA_ABERTA_NO_MAXIMO_MS + 60_000);
    d.entrou({}, quem('OUTRO'));
    expect(d.recentes().find((v) => v.apelido === 'SUMIDA')!.saiu).toBe(entrou + PRESENCA_ABERTA_NO_MAXIMO_MS);
    expect(d.dentroAgora()).toBe(1);
    d.saiu(sumida);
    expect(d.recentes().find((v) => v.apelido === 'SUMIDA')!.saiu).toBe(entrou + PRESENCA_ABERTA_NO_MAXIMO_MS);
  });

  it('as visitas de uma conta, as mais novas primeiro e só as dela (o que ela recebe ao baixar os próprios dados)', () => {
    const d = new DiarioDePresenca(null);
    d.entrou({}, quem('A1', 1));
    d.entrou({}, quem('B', 2));
    d.entrou({}, quem('A2', 1));
    d.entrou({}, quem('CONVIDADO'));
    expect(d.daConta(1).map((v) => v.apelido)).toEqual(['A2', 'A1']);
    expect(d.daConta(3)).toEqual([]);
  });

  it('apagar a conta apaga as visitas dela (e só as dela): o convidado e as outras contas ficam', () => {
    const d = new DiarioDePresenca(null);
    d.entrou({}, quem('A1', 1));
    d.entrou({}, quem('A2', 1));
    d.entrou({}, quem('B', 2));
    d.entrou({}, quem('CONVIDADO'));
    expect(d.apagarDaConta(1)).toBe(2);
    expect(d.recentes().map((v) => v.apelido).sort()).toEqual(['B', 'CONVIDADO']);
    expect(d.apagarDaConta(1)).toBe(0);
  });
});

describe('o arquivo do diário de presença', () => {
  beforeEach(limpar);
  afterEach(() => vi.useRealTimers());

  it('o que vai ao disco é só o necessário: apelido, conta (o número), sala, mapa e as horas; nada de IP, país nem e-mail', () => {
    const r = relogio();
    const d = new DiarioDePresenca(pasta, r.agora);
    d.entrou({}, quem('ALFA', 7));
    d.fechar();
    const bruto = JSON.parse(readFileSync(resolve(pasta, PRESENCA_ARQUIVO), 'utf8')) as { v: number; visitas: Record<string, unknown>[] };
    expect(bruto.v).toBe(1);
    expect(Object.keys(bruto.visitas[0]!).sort()).toEqual(['apelido', 'conta', 'entrou', 'id', 'mapa', 'saiu', 'sala']);
    expect(JSON.stringify(bruto)).not.toMatch(/@|\bip\b|pais/i);
  });

  it('um diário novo lê o que o outro gravou; quem estava dentro quando o servidor caiu saiu, no máximo, na última gravação; os números das visitas seguem em frente', () => {
    const r = relogio();
    const a = new DiarioDePresenca(pasta, r.agora);
    a.entrou({}, quem('ALFA', 7));
    r.anda(120_000);
    a.fechar(); // a última gravação, com o ALFA ainda dentro
    r.anda(10 * 60_000); // o servidor ficou fora do ar
    const b = new DiarioDePresenca(pasta, r.agora);
    const lida = b.recentes()[0]!;
    expect(lida).toMatchObject({ apelido: 'ALFA', conta: 7 });
    expect(lida.saiu).not.toBeNull();
    expect(lida.saiu! - lida.entrou).toBe(120_000);
    expect(b.dentroAgora()).toBe(0);
    b.entrou({}, quem('NOVO'));
    expect(b.recentes()[0]!.id).toBe(lida.id + 1);
  });

  it('arquivo estragado, de outra versão ou com visita torta não derruba o servidor: o diário começa vazio', () => {
    for (const ruim of ['{isto não é json', JSON.stringify({ v: 9, atualizadoEm: 1, visitas: [] }), JSON.stringify({ v: 1, atualizadoEm: 1, visitas: [{ id: 'x' }] })]) {
      writeFileSync(resolve(pasta, PRESENCA_ARQUIVO), ruim);
      expect(new DiarioDePresenca(pasta).recentes()).toEqual([]);
    }
  });

  it('entrar e sair em rajada regrava o arquivo uma vez só (no máximo a cada 5 s), e o fechar grava o que faltar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const d = new DiarioDePresenca(pasta);
    const cs = [{}, {}, {}];
    for (const [i, c] of cs.entries()) d.entrou(c, quem(`P${i}`));
    expect(() => readFileSync(resolve(pasta, PRESENCA_ARQUIVO))).toThrow(); // nada gravado ainda: a rajada espera
    vi.advanceTimersByTime(6000);
    const gravado = JSON.parse(readFileSync(resolve(pasta, PRESENCA_ARQUIVO), 'utf8')) as { visitas: unknown[] };
    expect(gravado.visitas).toHaveLength(3);
    d.saiu(cs[0]!);
    d.fechar();
    const depois = JSON.parse(readFileSync(resolve(pasta, PRESENCA_ARQUIVO), 'utf8')) as { visitas: { saiu: number | null }[] };
    expect(depois.visitas.filter((v) => v.saiu !== null)).toHaveLength(1);
  });
});
