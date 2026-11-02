import { describe, expect, it } from 'vitest';
import { BAIXO, BUMBO, CAIXA, CHIMBAL, acordeDoCompasso, frequenciaDaNota, padraoDoPasso, raizDoCompasso, segundosPorPasso } from './padraoDaMusica';

describe('o padrão da música de combate (P315)', () => {
  it('no calmo não há batida nem baixo em nenhum passo: só o colchão do pad', () => {
    for (let p = 0; p < 16; p++) expect(padraoDoPasso(0, p)).toBe(0);
  });

  it('na tensão: bumbo nos tempos 1 e 3, e o baixo nas semínimas; sem caixa nem chimbal', () => {
    const passos = Array.from({ length: 16 }, (_, p) => padraoDoPasso(1, p));
    expect(passos.map((b, p) => (b & BUMBO ? p : -1)).filter((p) => p >= 0)).toEqual([0, 8]);
    expect(passos.map((b, p) => (b & BAIXO ? p : -1)).filter((p) => p >= 0)).toEqual([0, 4, 8, 12]);
    expect(passos.every((b) => (b & (CAIXA | CHIMBAL)) === 0)).toBe(true);
  });

  it('no combate: chimbal em todas as colcheias, caixa nos tempos 2 e 4, e o baixo nas colcheias', () => {
    const passos = Array.from({ length: 16 }, (_, p) => padraoDoPasso(2, p));
    expect(passos.map((b, p) => (b & CHIMBAL ? p : -1)).filter((p) => p >= 0)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(passos.map((b, p) => (b & CAIXA ? p : -1)).filter((p) => p >= 0)).toEqual([4, 12]);
    expect(passos.map((b, p) => (b & BAIXO ? p : -1)).filter((p) => p >= 0)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(passos.map((b, p) => (b & BUMBO ? p : -1)).filter((p) => p >= 0)).toEqual([0, 8, 10]);
  });

  it('o padrão se repete a cada compasso (o passo 17 é o passo 1)', () => {
    for (const nivel of [0, 1, 2] as const) for (let p = 0; p < 16; p++) expect(padraoDoPasso(nivel, p + 16)).toBe(padraoDoPasso(nivel, p));
  });

  it('a harmonia é lá menor, fá, dó, sol, e volta ao começo a cada quatro compassos', () => {
    expect(acordeDoCompasso(0)).toEqual([57, 60, 64]);
    expect(acordeDoCompasso(1)).toEqual([53, 57, 60]);
    expect(acordeDoCompasso(2)).toEqual([48, 52, 55]);
    expect(acordeDoCompasso(3)).toEqual([55, 59, 62]);
    expect(acordeDoCompasso(4)).toEqual(acordeDoCompasso(0));
    expect(acordeDoCompasso(-1)).toEqual(acordeDoCompasso(3));
  });

  it('o baixo toca a raiz do acorde, uma oitava abaixo', () => {
    expect([raizDoCompasso(0), raizDoCompasso(1), raizDoCompasso(2), raizDoCompasso(3)]).toEqual([45, 41, 36, 43]);
  });

  it('a nota A4 (MIDI 69) é 440 Hz, e cada oitava dobra a frequência', () => {
    expect(frequenciaDaNota(69)).toBeCloseTo(440, 6);
    expect(frequenciaDaNota(81)).toBeCloseTo(880, 6);
    expect(frequenciaDaNota(57)).toBeCloseTo(220, 6);
  });

  it('a 108 BPM, um passo de 16 avos dura pouco mais de 0,14 s', () => {
    expect(segundosPorPasso()).toBeCloseTo(60 / 108 / 4, 9);
    expect(segundosPorPasso()).toBeGreaterThan(0.13);
    expect(segundosPorPasso()).toBeLessThan(0.15);
  });
});
