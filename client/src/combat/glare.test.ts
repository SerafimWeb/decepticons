import { describe, expect, it } from 'vitest';
import { GLOW } from '../core/palette';

/**
 * Dono, 11/10: "os tiros normais geram muita luz na tela e prejudicam a visibilidade". A regra que ficou: o tiro do jogador acende
 * **menos** que o do inimigo (o do inimigo é o aviso e precisa saltar aos olhos; o do jogador o jogador já sabe onde está).
 */
const maximo = (c: { r: number; g: number; b: number }) => Math.max(c.r, c.g, c.b);

describe('brilho dos tiros', () => {
  it('cada tiro do jogador acende menos que o equivalente do inimigo', () => {
    expect(maximo(GLOW.friendlyPlasma)).toBeLessThan(maximo(GLOW.hostilePlasma));
    expect(maximo(GLOW.friendlyArc)).toBeLessThan(maximo(GLOW.hostileArc));
    expect(maximo(GLOW.friendlyIce)).toBeLessThan(maximo(GLOW.hostileIce));
  });

  it('o tiro do jogador ainda passa do limiar do bloom (0,9): some a luz que cega, não o rastro que mostra para onde foi', () => {
    for (const c of [GLOW.friendlyPlasma, GLOW.friendlyArc, GLOW.friendlyIce]) expect(maximo(c)).toBeGreaterThan(0.9);
  });

  it('o clarão do cano e as faíscas do impacto ficam abaixo dos 3,0 de antes', () => {
    expect(maximo(GLOW.playerMuzzle)).toBeLessThan(3);
    expect(maximo(GLOW.spark)).toBeLessThan(3);
  });
});
