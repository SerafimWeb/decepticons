import { describe, expect, it } from 'vitest';
import { EVENTOS, EVENTOS_SERVIDOR, PAIS_DESCONHECIDO, parseEvento, parseMetricas, parsePais, parseResumo, resumoVazio } from './telemetry';

describe('telemetria de produto: só a lista fechada passa', () => {
  it('aceita um evento conhecido com aba válida', () => {
    expect(parseEvento({ nome: 'click_cockpit', aba: 'a1b2c3d4' })).toEqual({ nome: 'click_cockpit', aba: 'a1b2c3d4' });
  });

  it('recusa nome fora da lista — ninguém injeta contagem inventada no painel', () => {
    expect(parseEvento({ nome: 'coisa_qualquer', aba: 'a1b2c3d4' })).toBeNull();
    expect(parseEvento({ nome: '__proto__', aba: 'a1b2c3d4' })).toBeNull();
  });

  it('recusa aba ausente, curta demais, longa demais ou com caractere estranho', () => {
    expect(parseEvento({ nome: 'boot_ok' })).toBeNull();
    expect(parseEvento({ nome: 'boot_ok', aba: 'abc' })).toBeNull();
    expect(parseEvento({ nome: 'boot_ok', aba: 'x'.repeat(41) })).toBeNull();
    expect(parseEvento({ nome: 'boot_ok', aba: 'tem espaço' })).toBeNull();
    expect(parseEvento({ nome: 'boot_ok', aba: '<script>' })).toBeNull();
  });

  it('recusa lixo estrutural sem lançar', () => {
    expect(parseEvento(null)).toBeNull();
    expect(parseEvento('texto')).toBeNull();
    expect(parseEvento(42)).toBeNull();
    expect(parseEvento([])).toBeNull();
  });

  it('a lista de eventos não tem duplicata (cada um é um contador só)', () => {
    expect(new Set(EVENTOS).size).toBe(EVENTOS.length);
  });
});

describe('resumo público: só números agregados', () => {
  it('o resumo vazio tem todo evento zerado', () => {
    const r = resumoVazio('2026-09-28T00:00:00.000Z');
    for (const nome of EVENTOS) {
      expect(r.janela24h[nome]).toBe(0);
      expect(r.total[nome]).toBe(0);
    }
  });

  it('lê de volta o que foi mandado', () => {
    const r = resumoVazio('2026-09-28T00:00:00.000Z');
    r.total.boot_ok = 12;
    expect(parseResumo(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });

  it('recusa resumo fora do contrato: campo faltando, evento faltando, número negativo', () => {
    expect(parseResumo(null)).toBeNull();
    expect(parseResumo({})).toBeNull();
    const incompleto = { desde: 'x', janela24h: { boot_ok: 1 }, total: resumoVazio('x').total };
    expect(parseResumo(incompleto)).toBeNull();
    const negativo = resumoVazio('x');
    (negativo.total as Record<string, number>).boot_ok = -1;
    expect(parseResumo(negativo)).toBeNull();
  });
});

describe('origem das conexões: país, e só país', () => {
  it('lê o código ISO da Cloudflare em maiúsculas; sem informação, Tor e lixo', () => {
    expect(parsePais('br')).toBe('BR');
    expect(parsePais(' Us ')).toBe('US');
    expect(parsePais(['PT', 'BR'])).toBe('PT'); // cabeçalho repetido: vale o primeiro
    expect(parsePais('T1')).toBe('T1'); // rede Tor
    expect(parsePais('XX')).toBe(PAIS_DESCONHECIDO); // a Cloudflare não soube
  });

  it('nada que não seja um código de 2 caracteres vira ??: nem IP, nem cidade, nem HTML', () => {
    for (const lixo of [undefined, null, 42, '', 'BRASIL', 'B', '1.2.3.4', '<script>', 'B R', 'BR\nUS', { toString: () => 'BR' }]) {
      expect(parsePais(lixo)).toBe(PAIS_DESCONHECIDO);
    }
  });

  it('o cliente não pode mandar os eventos que só o servidor conta', () => {
    for (const nome of EVENTOS_SERVIDOR) {
      expect(parseEvento({ nome, aba: 'a1b2c3d4' })).toBeNull();
      expect((EVENTOS as readonly string[]).includes(nome)).toBe(false);
    }
  });
});

describe('parseMetricas: o painel não confia nem no servidor dele', () => {
  const boa = () => ({
    desde: '2026-10-04T00:00:00.000Z',
    geradoEm: '2026-10-04T12:00:00.000Z',
    fuso: 'UTC-03:00',
    total: { boot_ok: 3 },
    dias: [{ dia: '2026-10-04', eventos: { boot_ok: { BR: 2, '??': 1 } }, pico: 2 }],
  });

  it('aceita o formato do contrato', () => {
    const m = parseMetricas(boa());
    expect(m?.dias[0]?.eventos.boot_ok).toEqual({ BR: 2, '??': 1 });
    expect(m?.total.boot_ok).toBe(3);
  });

  it('recusa o que não é objeto, ou vem sem os campos', () => {
    for (const x of [null, undefined, 'texto', 7, [], { ...boa(), dias: 'nada' }, { ...boa(), fuso: 3 }, { ...boa(), total: null }]) {
      expect(parseMetricas(x)).toBeNull();
    }
  });

  it('recusa dia que não é data, contagem negativa ou que não é número, e pico inválido', () => {
    const dia = (d: object) => ({ ...boa(), dias: [{ ...boa().dias[0], ...d }] });
    expect(parseMetricas(dia({ dia: 'ontem' }))).toBeNull();
    expect(parseMetricas(dia({ dia: '2026-10-4' }))).toBeNull();
    expect(parseMetricas(dia({ eventos: { boot_ok: { BR: -1 } } }))).toBeNull();
    expect(parseMetricas(dia({ eventos: { boot_ok: { BR: 'muitos' } } }))).toBeNull();
    expect(parseMetricas(dia({ eventos: null }))).toBeNull();
    expect(parseMetricas(dia({ pico: 'x' }))).toBeNull();
    expect(parseMetricas({ ...boa(), total: { boot_ok: Number.POSITIVE_INFINITY } })).toBeNull();
  });

  it('arredonda para inteiro e não deixa pico negativo', () => {
    const m = parseMetricas({ ...boa(), total: { boot_ok: 2.9 }, dias: [{ ...boa().dias[0], pico: -4 }] });
    expect(m?.total.boot_ok).toBe(2);
    expect(m?.dias[0]?.pico).toBe(0);
  });
});
