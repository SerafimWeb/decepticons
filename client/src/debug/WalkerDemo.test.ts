import { describe, expect, it } from 'vitest';
import { diferencaDeAngulo, rumoDe, walkerFromSearch } from './WalkerDemo';

describe('a demonstração do Draga-01 (P178, parte A): o link e a geometria do passeio', () => {
  it('só liga com ?walker no link (sozinho ou entre outros parâmetros)', () => {
    expect(walkerFromSearch('')).toBe(false);
    expect(walkerFromSearch('?mapa=praia')).toBe(false);
    expect(walkerFromSearch('?walker')).toBe(true);
    expect(walkerFromSearch('?modo=survival&walker=1&mapa=praia')).toBe(true);
  });

  it('o rumo segue a convenção do Mech: frente -Z é 0; virar para a esquerda (-X) é positivo', () => {
    expect(rumoDe(0, -1)).toBeCloseTo(0, 12); // para a frente
    expect(rumoDe(-1, 0)).toBeCloseTo(Math.PI / 2, 12); // para a esquerda
    expect(rumoDe(1, 0)).toBeCloseTo(-Math.PI / 2, 12); // para a direita
    expect(Math.abs(rumoDe(0, 1))).toBeCloseTo(Math.PI, 12); // para trás
  });

  it('a diferença de ângulos fica em (-π, π] pelo caminho curto', () => {
    expect(diferencaDeAngulo(0.3, 0.1)).toBeCloseTo(0.2, 12);
    expect(diferencaDeAngulo(0.1, 0.3)).toBeCloseTo(-0.2, 12);
    expect(diferencaDeAngulo(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(-0.2, 12); // atravessa o ±π
    expect(diferencaDeAngulo(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(0.2, 12);
    expect(diferencaDeAngulo(7 * Math.PI, 0)).toBeCloseTo(Math.PI, 9);
    for (const a of [-9, -3.2, 0, 2.2, 8.5]) {
      const d = diferencaDeAngulo(a, 0);
      expect(d).toBeGreaterThan(-Math.PI - 1e-9);
      expect(d).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
  });

  it('apontar para um alvo à esquerda do rumo dá deckYaw positivo (o convés vira a frente para a esquerda)', () => {
    const rumo = rumoDe(0, -1); // andando para a frente
    const paraAEsquerda = rumoDe(-5, -5); // alvo à frente e à esquerda
    expect(diferencaDeAngulo(paraAEsquerda, rumo)).toBeGreaterThan(0);
    const paraADireita = rumoDe(5, -5);
    expect(diferencaDeAngulo(paraADireita, rumo)).toBeLessThan(0);
  });
});
