import { describe, expect, it } from 'vitest';
import { distBucketOf, hpBucketOf } from './Nameplates';

/** A plaqueta só redesenha a textura quando a vida cruza um degrau de 5% ou a distância um de 5 m. */
describe('degraus da plaqueta (frente 2)', () => {
  describe('hpBucketOf', () => {
    it('vida cheia é o degrau máximo e vida zerada o mínimo', () => {
      expect(hpBucketOf(1)).toBe(20);
      expect(hpBucketOf(0)).toBe(0);
    });

    it('arredonda ao degrau de 5% (a barra salta de degrau em degrau)', () => {
      expect(hpBucketOf(0.5)).toBe(10);
      expect(hpBucketOf(0.49)).toBe(10);
      expect(hpBucketOf(0.48)).toBe(10); // 9.6 → 10
      expect(hpBucketOf(0.47)).toBe(9); // 9.4 → 9
      expect(hpBucketOf(0.03)).toBe(1);
    });

    it('corta fora da faixa e trata número inválido como destruída', () => {
      expect(hpBucketOf(1.7)).toBe(20);
      expect(hpBucketOf(-0.4)).toBe(0);
      expect(hpBucketOf(Number.NaN)).toBe(0);
      expect(hpBucketOf(Number.POSITIVE_INFINITY)).toBe(0);
    });
  });

  describe('distBucketOf', () => {
    it('arredonda para o múltiplo de 5 m mais próximo', () => {
      expect(distBucketOf(0)).toBe(0);
      expect(distBucketOf(2.4)).toBe(0);
      expect(distBucketOf(2.6)).toBe(5);
      expect(distBucketOf(37)).toBe(35);
      expect(distBucketOf(38)).toBe(40);
    });

    it('não vai a negativo com número estranho', () => {
      expect(distBucketOf(-10)).toBe(0);
      expect(distBucketOf(Number.NaN)).toBe(0);
    });
  });
});
