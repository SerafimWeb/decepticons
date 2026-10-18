import { describe, expect, it } from 'vitest';
import { avisoDoEscudo, ESCUDO_DO_DRAGA, EscudoDoDraga } from './EscudoDoDraga';

describe('o escudo do Draga-01 (P180, parte D)', () => {
  it('começa de pé, com os três geradores, e o Draga leva 10% do dano', () => {
    const e = new EscudoDoDraga();
    expect(e.total).toBe(3);
    expect(e.geradoresVivos).toBe(3);
    expect(e.ativo).toBe(true);
    expect(e.fator).toBeCloseTo(0.1, 10);
    expect(ESCUDO_DO_DRAGA.fatorComEscudo).toBeLessThan(0.2); // "90% menos dano": o número é decisão do Comandante, mas nunca vira um escudo que não protege
  });

  it('um ou dois geradores caídos não derrubam o escudo: ele só cai com o último', () => {
    const e = new EscudoDoDraga();
    expect(e.quebrar(0)).toBe(false);
    expect(e.geradoresVivos).toBe(2);
    expect(e.ativo).toBe(true);
    expect(e.fator).toBeCloseTo(0.1, 10);
    expect(e.quebrar(2)).toBe(false);
    expect(e.geradoresVivos).toBe(1);
    expect(e.ativo).toBe(true);
    expect(e.derrubadoNoTick).toBe(false);
    expect(e.quebrar(1)).toBe(true);
    expect(e.ativo).toBe(false);
    expect(e.fator).toBe(1);
    expect(e.derrubadoNoTick).toBe(true);
  });

  it('o aviso da queda vale uma vez só (quem o leu limpa), e o escudo não volta sozinho', () => {
    const e = new EscudoDoDraga();
    for (let i = 0; i < 3; i++) e.quebrar(i);
    expect(e.derrubadoNoTick).toBe(true);
    e.consumirQueda();
    expect(e.derrubadoNoTick).toBe(false);
    expect(e.ativo).toBe(false);
  });

  it('quebrar o mesmo gerador duas vezes, ou um índice que não existe, não conta nem derruba o escudo', () => {
    const e = new EscudoDoDraga();
    e.quebrar(0);
    expect(e.quebrar(0)).toBe(false);
    expect(e.geradoresVivos).toBe(2);
    expect(e.quebrar(7)).toBe(false);
    expect(e.quebrar(-1)).toBe(false);
    expect(e.quebrar(1.5)).toBe(false);
    expect(e.quebrar(Number.NaN)).toBe(false);
    expect(e.geradoresVivos).toBe(2);
    expect(e.ativo).toBe(true);
  });

  it('rodada nova devolve os geradores e o escudo', () => {
    const e = new EscudoDoDraga();
    for (let i = 0; i < 3; i++) e.quebrar(i);
    e.reiniciar();
    expect(e.geradoresVivos).toBe(3);
    expect(e.ativo).toBe(true);
    expect(e.fator).toBeCloseTo(0.1, 10);
    expect(e.derrubadoNoTick).toBe(false);
    expect([0, 1, 2].every((i) => e.vivo(i))).toBe(true);
  });
});

describe('o aviso do escudo', () => {
  it('cada gerador que cai avisa quantos restam; o último avisa a queda do escudo; sem mudança, nada', () => {
    expect(avisoDoEscudo(3, 2)).toBe('GERADOR CAIU · RESTAM 2');
    expect(avisoDoEscudo(2, 1)).toBe('GERADOR CAIU · RESTAM 1');
    expect(avisoDoEscudo(1, 0)).toBe('ESCUDO DO DRAGA CAIU');
    expect(avisoDoEscudo(3, 3)).toBeNull();
    expect(avisoDoEscudo(0, 0)).toBeNull();
    expect(avisoDoEscudo(2, 3)).toBeNull(); // a rodada nova os devolveu: não é queda
  });
});
