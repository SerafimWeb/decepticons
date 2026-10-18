import { describe, expect, it } from 'vitest';
import { EVENTO_MAX_BYTES, EVENTOS, EVENTOS_SERVIDOR, PAIS_DESCONHECIDO, parseEvento, parseMetricas, parsePais, parseResumo, resumoVazio } from './telemetry';

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

describe('parseEvento: o contexto da audiência (P188)', () => {
  const visita = { canal: 'social', host: 'instagram.com', disp: 'mobile', nav: 'chrome', so: 'android', lang: 'pt', ret: 'novo' };
  it('a visita em landing_view e boot_ok, o canal nos passos do funil', () => {
    expect(parseEvento({ nome: 'landing_view', aba: 'abcd1234', o: visita })?.ctx).toEqual({ tipo: 'visita', visita });
    expect(parseEvento({ nome: 'boot_ok', aba: 'abcd1234', o: visita })?.ctx).toEqual({ tipo: 'visita', visita });
    expect(parseEvento({ nome: 'partida_iniciada', aba: 'abcd1234', o: { canal: 'busca', conta: 'logado' } })?.ctx).toEqual({ tipo: 'funil', funil: { canal: 'busca', conta: 'logado' } });
  });
  it('contexto torto é descartado e o evento continua valendo (o clique conta, só não entra na audiência)', () => {
    for (const o of [{ ...visita, canal: 'inventado' }, 'texto', 5, null, { ...visita, host: 'Tem Espaço' }]) {
      const e = parseEvento({ nome: 'landing_view', aba: 'abcd1234', o });
      expect(e, JSON.stringify(o)).not.toBeNull();
      expect(e).not.toHaveProperty('ctx');
    }
  });
  it('evento que não leva contexto ignora o que vier em "o"; sem "o" o evento é o de sempre', () => {
    expect(parseEvento({ nome: 'hangar_aberto', aba: 'abcd1234', o: { canal: 'busca' } })).toEqual({ nome: 'hangar_aberto', aba: 'abcd1234' });
    expect(parseEvento({ nome: 'boot_ok', aba: 'abcd1234' })).toEqual({ nome: 'boot_ok', aba: 'abcd1234' });
  });
  it('o teto do corpo cobre a visita mais cheia (site de origem e as três marcas de campanha)', () => {
    const cheia = { nome: 'boot_ok', aba: 'a'.repeat(40), seq: 2147483647, o: { canal: 'campanha', host: 'a'.repeat(59) + 'b', us: 'u'.repeat(32), um: 'm'.repeat(32), uc: 'c'.repeat(32), disp: 'tablet', nav: 'samsung', so: 'chromeos', lang: 'outro', ret: 'd8-30' } };
    expect(parseEvento(cheia)?.ctx).toBeDefined();
    expect(JSON.stringify(cheia).length).toBeLessThan(EVENTO_MAX_BYTES);
  });
});
