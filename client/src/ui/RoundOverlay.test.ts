import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMBATE_NA_TELA_MS, numeroDaContagem, RoundOverlay } from './RoundOverlay';

// O ambiente de teste é o Node (sem DOM): o overlay vira só a conta (`currentText`, os sons e as falas), e é essa conta que se confere aqui.
afterEach(() => {
  vi.useRealTimers();
});

describe('RoundOverlay (abertura da rodada e resumo)', () => {
  it('nasce sem resumo de estatísticas', () => {
    const overlay = new RoundOverlay();
    expect(overlay.lastStats).toBeNull();
  });

  it('armazena e exibe o resumo de estatísticas no fim da rodada', () => {
    const overlay = new RoundOverlay();
    const stats = {
      kills: 5,
      damage: 1420,
      streak: 3,
      survivalSeconds: 120,
    };
    overlay.showSummary(stats);
    expect(overlay.lastStats).toEqual(stats);
  });
});

describe('a contagem de abertura lê o relógio do intervalo', () => {
  it('só os últimos 3 s viram número: 3, 2, 1; fora disso, nada', () => {
    expect(numeroDaContagem(10)).toBeNull();
    expect(numeroDaContagem(3.01)).toBeNull();
    expect(numeroDaContagem(3)).toBe(3);
    expect(numeroDaContagem(2.4)).toBe(3);
    expect(numeroDaContagem(2)).toBe(2);
    expect(numeroDaContagem(1.2)).toBe(2);
    expect(numeroDaContagem(1)).toBe(1);
    expect(numeroDaContagem(0.01)).toBe(1);
    for (const fora of [0, -1, NaN, Infinity]) expect(numeroDaContagem(fora), String(fora)).toBeNull();
  });

  it('cada número soa uma vez, por mais quadros que passem; a rodada que vem é falada no primeiro', () => {
    const o = new RoundOverlay();
    const bipes: number[] = [];
    const falas: string[] = [];
    o.som = { contagem: (n) => bipes.push(n), combate: () => undefined };
    o.anunciar = (e) => falas.push(`${e.tipo}:${e.rodada}`);
    for (const t of [9, 5, 3, 2.9, 2.5, 2.01, 1.9, 1.5, 1.0, 0.5, 0.01]) o.contar(t, 4);
    expect(bipes).toEqual([3, 2, 1]);
    expect(falas).toEqual(['rodada:4']);
    expect(o.currentText).toBe('1');
  });

  it('se o intervalo foi cortado (o relógio passou de 3 s de novo), a contagem some e a próxima começa do zero', () => {
    const o = new RoundOverlay();
    const bipes: number[] = [];
    o.som = { contagem: (n) => bipes.push(n), combate: () => undefined };
    o.contar(2.5, 2);
    expect(o.currentText).toBe('3');
    o.contar(9, 2);
    expect(o.currentText).toBe('');
    o.contar(2.5, 3);
    expect(bipes).toEqual([3, 3]);
  });

  it('COMBATE! aparece com som e fala, e some sozinho', () => {
    vi.useFakeTimers();
    const o = new RoundOverlay();
    let toques = 0;
    const falas: string[] = [];
    o.som = { contagem: () => undefined, combate: () => toques++ };
    o.anunciar = (e) => falas.push(`${e.tipo}:${e.rodada}`);
    o.combate(2);
    expect(o.currentText).toBe('COMBATE!');
    expect(toques).toBe(1);
    expect(falas).toEqual(['combate:2']);
    vi.advanceTimersByTime(COMBATE_NA_TELA_MS + 1);
    expect(o.currentText).toBe('');
  });

  it('um COMBATE! logo depois do outro renova o tempo (o primeiro cronômetro não apaga o segundo)', () => {
    vi.useFakeTimers();
    const o = new RoundOverlay();
    o.combate(1);
    vi.advanceTimersByTime(COMBATE_NA_TELA_MS - 100);
    o.combate(2);
    vi.advanceTimersByTime(200);
    expect(o.currentText).toBe('COMBATE!');
    vi.advanceTimersByTime(COMBATE_NA_TELA_MS);
    expect(o.currentText).toBe('');
  });

  it('sem som nem locução ligados, a abertura segue em silêncio, sem falhar', () => {
    const o = new RoundOverlay();
    expect(() => {
      o.contar(2, 1);
      o.combate(1);
      o.parar();
      o.hide();
    }).not.toThrow();
  });
});
