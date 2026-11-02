import { describe, expect, it } from 'vitest';
import { EnergiaDeCombate, LIMIAR_COMBATE, LIMIAR_TENSAO, PESO_ABATE, PESO_ACERTO } from './energiaDeCombate';

describe('a energia do combate, que escolhe a camada da música (P315)', () => {
  it('começa calma: sem acontecer nada, o nível é 0', () => {
    const e = new EnergiaDeCombate();
    expect(e.valorAtual).toBe(0);
    expect(e.nivel).toBe(0);
  });

  it('um abate do jogador leva a música ao combate de uma vez', () => {
    const e = new EnergiaDeCombate();
    e.registrar(PESO_ABATE);
    expect(e.nivel).toBe(2);
  });

  it('acertos soltos sobem a tensão sem chegar ao combate; muitos acertos chegam ao combate', () => {
    const e = new EnergiaDeCombate();
    for (let i = 0; i < 4; i++) e.registrar(PESO_ACERTO);
    expect(e.valorAtual).toBeGreaterThanOrEqual(LIMIAR_TENSAO);
    expect(e.nivel).toBe(1);
    for (let i = 0; i < 6; i++) e.registrar(PESO_ACERTO);
    expect(e.valorAtual).toBeGreaterThanOrEqual(LIMIAR_COMBATE);
    expect(e.nivel).toBe(2);
  });

  it('a energia cai pela metade a cada meia-vida, e o nível desce junto', () => {
    const e = new EnergiaDeCombate(4);
    e.registrar(8);
    e.avancar(4);
    expect(e.valorAtual).toBeCloseTo(4, 5);
    expect(e.nivel).toBe(2);
    e.avancar(4);
    expect(e.valorAtual).toBeCloseTo(2, 5);
    expect(e.nivel).toBe(1);
    e.avancar(40);
    expect(e.nivel).toBe(0);
    expect(e.valorAtual).toBeLessThan(0.01);
  });

  it('o tempo nunca soma energia, e um valor negativo ou zero não muda nada', () => {
    const e = new EnergiaDeCombate();
    e.registrar(-5);
    e.registrar(0);
    expect(e.valorAtual).toBe(0);
    e.registrar(3);
    e.avancar(0);
    e.avancar(-1);
    expect(e.valorAtual).toBe(3);
  });

  it('zerar leva a energia a zero, de uma vez', () => {
    const e = new EnergiaDeCombate();
    e.registrar(PESO_ABATE);
    e.zerar();
    expect(e.nivel).toBe(0);
  });
});
