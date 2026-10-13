import { describe, expect, it } from 'vitest';
import { JANELA_DA_SEQUENCIA_S, SequenciaDeAbates } from './killStreak';

describe('a sequência de abates', () => {
  it('abates dentro da janela somam: 1, 2, 3, 4', () => {
    const s = new SequenciaDeAbates();
    expect([s.abate(10), s.abate(12), s.abate(15), s.abate(19.9)]).toEqual([1, 2, 3, 4]);
    expect(s.atual).toBe(4);
  });

  it('o abate depois da janela começa outra sequência (1), e o recorde guarda a maior', () => {
    const s = new SequenciaDeAbates();
    s.abate(0);
    s.abate(2);
    s.abate(4);
    expect(s.abate(4 + JANELA_DA_SEQUENCIA_S + 0.01)).toBe(1);
    expect(s.melhor).toBe(3);
  });

  it('o limite da janela é inclusivo: exatamente na janela continua', () => {
    const s = new SequenciaDeAbates();
    s.abate(0);
    expect(s.abate(JANELA_DA_SEQUENCIA_S)).toBe(2);
  });

  it('morrer zera a sequência mas não o recorde; reiniciar zera tudo', () => {
    const s = new SequenciaDeAbates();
    s.abate(0);
    s.abate(1);
    s.zerar();
    expect(s.atual).toBe(0);
    expect(s.abate(2)).toBe(1); // o abate logo depois de morrer não herda a sequência
    expect(s.melhor).toBe(2);
    s.reiniciar();
    expect(s.melhor).toBe(0);
    expect(s.atual).toBe(0);
  });

  it('o primeiro abate de todos é 1, mesmo com o relógio em zero', () => {
    expect(new SequenciaDeAbates().abate(0)).toBe(1);
  });
});
