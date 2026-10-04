import { describe, expect, it } from 'vitest';
import { Telemetria } from './telemetria';

const HORA = 3_600_000;

describe('agregador de métricas', () => {
  it('começa zerado e cresce a cada registro', () => {
    const t = new Telemetria(0);
    expect(t.resumo(0).total.boot_ok).toBe(0);
    t.registrar('boot_ok', '1.1.1.1', 0);
    t.registrar('boot_ok', '2.2.2.2', 0);
    expect(t.resumo(0).total.boot_ok).toBe(2);
    expect(t.resumo(0).janela24h.boot_ok).toBe(2);
    expect(t.resumo(0).total.click_cockpit).toBe(0);
  });

  it('taxa por IP: além do balde, recusa sem contar', () => {
    const t = new Telemetria(0);
    let aceitos = 0;
    for (let i = 0; i < 40; i++) if (t.registrar('boot_ok', '9.9.9.9', 0) === 'ok') aceitos++;
    expect(aceitos).toBe(30); // teto do balde
    expect(t.resumo(0).total.boot_ok).toBe(30);
  });

  it('a ficha recarrega com o tempo', () => {
    const t = new Telemetria(0);
    for (let i = 0; i < 30; i++) t.registrar('boot_ok', '9.9.9.9', 0);
    expect(t.registrar('boot_ok', '9.9.9.9', 0)).toBe('taxa');
    // 2 segundos depois: recarregou 1 ficha (0,5/s).
    expect(t.registrar('boot_ok', '9.9.9.9', 2000)).toBe('ok');
  });

  it('janela de 24h cai fora depois de 25h, mas o total nunca cai', () => {
    const t = new Telemetria(0);
    t.registrar('boot_ok', '1.1.1.1', 0);
    expect(t.resumo(0).janela24h.boot_ok).toBe(1);
    expect(t.resumo(25 * HORA).janela24h.boot_ok).toBe(0);
    expect(t.resumo(25 * HORA).total.boot_ok).toBe(1);
  });

  it('um evento novo numa hora nova não apaga o das horas ainda dentro da janela', () => {
    const t = new Telemetria(0);
    t.registrar('boot_ok', '1.1.1.1', 0);
    t.registrar('boot_ok', '2.2.2.2', 5 * HORA);
    const r = t.resumo(5 * HORA);
    expect(r.janela24h.boot_ok).toBe(2);
    expect(r.total.boot_ok).toBe(2);
  });

  it('servidor "dormindo" muitas horas não trava num loop proporcional ao tempo parado', () => {
    const t = new Telemetria(0);
    t.registrar('boot_ok', '1.1.1.1', 0);
    const inicio = Date.now();
    const r = t.resumo(1000 * HORA); // ~41 dias de uma vez
    expect(Date.now() - inicio).toBeLessThan(50);
    expect(r.janela24h.boot_ok).toBe(0);
    expect(r.total.boot_ok).toBe(1);
  });
});

describe('agregador de métricas: por dia e por país (04/10)', () => {
  const T0 = Date.parse('2026-10-04T12:00:00Z'); // 09:00 em Brasília
  const pais = (i: number) => String.fromCharCode(65 + Math.floor(i / 26), 65 + (i % 26));

  it('conta por evento, dia e país; sem país, vai para ??', () => {
    const t = new Telemetria(T0);
    t.registrar('boot_ok', '1.1.1.1', T0, 'BR');
    t.registrar('boot_ok', '2.2.2.2', T0, 'BR');
    t.registrar('boot_ok', '3.3.3.3', T0, 'US');
    t.registrar('boot_ok', '4.4.4.4', T0);
    const m = t.metricas(T0);
    expect(m.dias).toHaveLength(1);
    expect(m.dias[0]).toMatchObject({ dia: '2026-10-04', eventos: { boot_ok: { BR: 2, US: 1, '??': 1 } } });
    expect(m.total.boot_ok).toBe(4);
  });

  it('o dia é o de Brasília: 23h30 e 00h30 caem em dias diferentes', () => {
    const t = new Telemetria(T0);
    t.registrar('boot_ok', '1.1.1.1', Date.parse('2026-10-04T02:30:00Z'), 'BR'); // 23:30 do dia 03 em Brasília
    t.registrar('boot_ok', '2.2.2.2', Date.parse('2026-10-04T03:30:00Z'), 'BR'); // 00:30 do dia 04
    expect(t.metricas(T0).dias.map((d) => d.dia)).toEqual(['2026-10-03', '2026-10-04']);
  });

  it('eventos do servidor contam por país, sem taxa por IP, e não aparecem no resumo público', () => {
    const t = new Telemetria(T0);
    for (let i = 0; i < 50; i++) t.contar('conexao_online', 'BR', T0);
    t.contar('recusa_versao', 'US', T0);
    const m = t.metricas(T0);
    expect(m.dias[0]!.eventos.conexao_online).toEqual({ BR: 50 });
    expect(m.dias[0]!.eventos.recusa_versao).toEqual({ US: 1 });
    expect(Object.keys(t.resumo(T0).total).sort()).toEqual(Object.keys(t.resumo(T0).janela24h).sort());
    expect('recusa_versao' in t.resumo(T0).total).toBe(false);
  });

  it('evento recusado pela taxa do IP não entra na contagem por dia', () => {
    const t = new Telemetria(T0);
    for (let i = 0; i < 40; i++) t.registrar('boot_ok', '9.9.9.9', T0, 'BR');
    expect(t.metricas(T0).dias[0]!.eventos.boot_ok).toEqual({ BR: 30 });
  });

  it('guarda o maior número de jogadores ao mesmo tempo no dia', () => {
    const t = new Telemetria(T0);
    t.pico(2, T0);
    t.pico(5, T0 + 1000);
    t.pico(3, T0 + 2000);
    expect(t.metricas(T0).dias[0]!.pico).toBe(5);
    t.pico(1, T0 + 24 * HORA);
    expect(t.metricas(T0 + 24 * HORA).dias.map((d) => d.pico)).toEqual([5, 1]);
  });

  it('guarda no máximo 120 dias; o mais antigo sai', () => {
    const t = new Telemetria(T0);
    for (let i = 0; i < 130; i++) t.registrar('boot_ok', `ip${i}`, T0 + i * 24 * HORA, 'BR');
    const dias = t.metricas(T0 + 130 * 24 * HORA).dias;
    expect(dias).toHaveLength(120);
    expect(dias[0]!.dia).toBe('2026-10-14'); // os 10 primeiros dias saíram
  });

  it('país demais no mesmo evento e dia vira ??: o mapa não cresce com lixo', () => {
    const t = new Telemetria(T0);
    for (let i = 0; i < 100; i++) t.registrar('boot_ok', `ip${i}`, T0, pais(i));
    const porPais = t.metricas(T0).dias[0]!.eventos.boot_ok!;
    expect(Object.keys(porPais).length).toBeLessThanOrEqual(81);
    expect(porPais['??']).toBeGreaterThan(0);
    expect(Object.values(porPais).reduce((a, b) => a + b, 0)).toBe(100); // nada se perde, só se junta
  });

  it('sobrevive ao reinício: o arquivo volta com os mesmos números, a janela de 24 h inclusive', () => {
    const a = new Telemetria(T0);
    a.registrar('boot_ok', '1.1.1.1', T0, 'BR');
    a.registrar('hangar_aberto', '1.1.1.1', T0, 'BR');
    a.contar('recusa_versao', 'US', T0);
    a.pico(4, T0);
    const arquivo = JSON.parse(JSON.stringify(a.exportar()));
    const b = new Telemetria(T0 + 2 * HORA);
    b.carregar(arquivo, T0 + 2 * HORA);
    expect(b.metricas(T0 + 2 * HORA).dias).toEqual(a.metricas(T0 + 2 * HORA).dias);
    expect(b.metricas(T0).total).toEqual(a.metricas(T0).total);
    expect(b.resumo(T0 + 2 * HORA).total).toEqual(a.resumo(T0 + 2 * HORA).total);
    expect(b.resumo(T0 + 2 * HORA).janela24h.boot_ok).toBe(1);
    expect(b.resumo(T0 + 30 * HORA).janela24h.boot_ok).toBe(0); // a janela continua andando depois do reinício
    expect(b.sujo).toBe(false); // recém-carregado: nada novo para gravar
    b.registrar('boot_ok', '2.2.2.2', T0 + 2 * HORA, 'BR');
    expect(b.sujo).toBe(true);
  });

  it('o arquivo não guarda IP nem nada que identifique alguém', () => {
    const t = new Telemetria(T0);
    t.registrar('boot_ok', '203.0.113.77', T0, 'BR');
    t.registrar('boot_ok', '2001:db8::1', T0, 'BR');
    const texto = JSON.stringify(t.exportar()) + JSON.stringify(t.metricas(T0));
    expect(texto).not.toContain('203.0.113.77');
    expect(texto).not.toContain('2001:db8');
  });

  it('nunca confia no arquivo: lixo é jogado fora e o que presta fica', () => {
    const t = new Telemetria(T0);
    t.carregar(
      JSON.parse(`{
        "v": 1, "desde": "2026-10-01T00:00:00.000Z",
        "total": { "boot_ok": 7, "evento_inventado": 99, "hangar_aberto": -3, "partida_iniciada": "muitos" },
        "horaEpoch": 1.5, "porHora": {},
        "dias": {
          "2026-10-02": { "boot_ok": { "BR": 4, "brasil": 9, "US": -1, "__proto__": 5 }, "evento_inventado": { "BR": 1 } },
          "ontem": { "boot_ok": { "BR": 1 } }
        },
        "picos": { "2026-10-02": 3, "2026-13-99x": 9, "2026-10-03": "x" }
      }`),
      T0,
    );
    const m = t.metricas(T0);
    expect(m.total.boot_ok).toBe(7);
    expect(m.total.hangar_aberto).toBe(0);
    expect('evento_inventado' in m.total).toBe(false);
    expect(m.dias).toHaveLength(1);
    expect(m.dias[0]).toMatchObject({ dia: '2026-10-02', pico: 3, eventos: { boot_ok: { BR: 4 } } });
    expect(({} as Record<string, unknown>).BR).toBeUndefined(); // __proto__ não poluiu nada
    t.carregar(null, T0);
    t.carregar({ v: 2 }, T0);
    t.carregar('texto', T0);
    expect(t.metricas(T0).total.boot_ok).toBe(7);
  });
});
