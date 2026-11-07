import { describe, expect, it } from 'vitest';
import { avancaMola, frequenciaDoCorpo, novaMola } from './molejo';

describe('molejo (mola amortecida)', () => {
  it('assenta no alvo depois de um tempo, sem ficar oscilando', () => {
    const m = novaMola();
    for (let i = 0; i < 180; i++) avancaMola(m, 1, 10, 0.45, 1 / 60);
    expect(Math.abs(m.x - 1)).toBeLessThan(0.01);
  });

  it('com amortecimento menor que 1 passa do alvo antes de voltar (é o que dá o molejo)', () => {
    const m = novaMola();
    let maximo = 0;
    for (let i = 0; i < 180; i++) maximo = Math.max(maximo, avancaMola(m, 1, 10, 0.45, 1 / 60));
    expect(maximo).toBeGreaterThan(1.05);
  });

  it('um intervalo enorme (aba que volta do fundo) não faz a mola explodir', () => {
    const m = novaMola();
    const x = avancaMola(m, 1, 10, 0.45, 1000);
    expect(Number.isFinite(x)).toBe(true);
    expect(Math.abs(x)).toBeLessThan(5);
    expect(Number.isFinite(m.v)).toBe(true);
  });

  it('com intervalo zero a mola não se mexe', () => {
    const m = { x: 0.3, v: 0.2 };
    expect(avancaMola(m, 1, 10, 0.45, 0)).toBe(0.3);
    expect(m.v).toBe(0.2);
  });

  it('o corpo mais alto balança mais devagar (frequência cai com a altura)', () => {
    expect(frequenciaDoCorpo(14)).toBeLessThan(frequenciaDoCorpo(5.3));
    expect(frequenciaDoCorpo(5.3)).toBeCloseTo(10, 6);
    expect(frequenciaDoCorpo(0)).toBeCloseTo(frequenciaDoCorpo(0.5), 6);
  });
});
