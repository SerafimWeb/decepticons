import { describe, expect, it } from 'vitest';
import { PROPORCAO_VERTICAL, recorteVertical, recorteVerticalEm } from './recorte';

describe('o recorte vertical do clipe (P309)', () => {
  it('a tela de jogo (16:9) mantém a altura e corta a largura até 9:16, centrada', () => {
    const r = recorteVertical(1280, 720);
    expect(r.sh).toBe(720);
    expect(r.sw).toBe(405);
    expect(r.sx).toBe(438);
    expect(r.sy).toBe(0);
    expect(r.sw / r.sh).toBeCloseTo(PROPORCAO_VERTICAL, 2);
  });

  it('a tela 1080p cabe o mesmo corte, proporcional', () => {
    const r = recorteVertical(1920, 1080);
    expect(r.sh).toBe(1080);
    expect(r.sw / r.sh).toBeCloseTo(PROPORCAO_VERTICAL, 2);
    expect(r.sx).toBe(656);
  });

  it('o corte segue a ação: com o robô à esquerda (25% da tela), o recorte fica à esquerda do centro', () => {
    const r = recorteVertical(1280, 720, 0.25);
    expect(r.sw).toBe(405);
    expect(r.sx).toBe(118);
    // O robô (25% de 1280 = 320 px) continua dentro do recorte.
    expect(320).toBeGreaterThanOrEqual(r.sx);
    expect(320).toBeLessThanOrEqual(r.sx + r.sw);
  });

  it('a ação perto da borda não faz o recorte sair da fonte', () => {
    const direita = recorteVertical(1280, 720, 0.95);
    expect(direita.sx + direita.sw).toBe(1280);
    const esquerda = recorteVertical(1280, 720, 0.02);
    expect(esquerda.sx).toBe(0);
  });

  it('um ponto fora de 0 a 1 (ou não finito) cai no centro, sem sair da fonte', () => {
    expect(recorteVertical(1280, 720, 7)).toEqual(recorteVertical(1280, 720, 1));
    expect(recorteVertical(1280, 720, Number.NaN)).toEqual(recorteVertical(1280, 720, 0.5));
  });

  it('uma cena já vertical (9:16) fica inteira', () => {
    expect(recorteVertical(720, 1280)).toEqual({ sx: 0, sy: 0, sw: 720, sh: 1280 });
  });

  it('uma cena mais estreita que 9:16 (500 × 1000 = 0,5) mantém a largura e corta a altura, centrada', () => {
    const r = recorteVertical(500, 1000);
    expect(r.sw).toBe(500);
    expect(r.sx).toBe(0);
    expect(r.sh).toBe(Math.round(500 / PROPORCAO_VERTICAL));
    expect(r.sy).toBe(Math.round((1000 - r.sh) / 2));
  });

  it('o recorte cabe sempre dentro da fonte, em qualquer proporção', () => {
    for (const [w, h] of [[1280, 720], [1920, 1080], [1000, 1000], [800, 1200], [2560, 1080], [1, 1]]) {
      const r = recorteVertical(w, h);
      expect(r.sx + r.sw, `${w}x${h}`).toBeLessThanOrEqual(w);
      expect(r.sy + r.sh, `${w}x${h}`).toBeLessThanOrEqual(h);
    }
  });

  it('entradas inválidas (zero, negativas, não finitas) devolvem o recorte vazio, sem lançar', () => {
    for (const [w, h] of [[0, 720], [1280, 0], [-1, 720], [NaN, 720], [1280, Infinity]]) {
      expect(recorteVertical(w!, h!), `${w}x${h}`).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
    }
  });

  it('o quadro reusa um só objeto: recorteVerticalEm grava no mesmo recorte, sem alocar (G4)', () => {
    const saida = { sx: 0, sy: 0, sw: 0, sh: 0 };
    expect(recorteVerticalEm(1280, 720, 0.25, saida)).toBe(saida);
    expect(saida).toEqual(recorteVertical(1280, 720, 0.25));
  });
});
