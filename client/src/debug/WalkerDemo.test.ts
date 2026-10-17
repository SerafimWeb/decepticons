import { describe, expect, it } from 'vitest';
import { AMAZONIA_ALDEIA, AMAZONIA_DRAGA_INICIO_X } from '../environment/AmazoniaLayout';
import { diferencaDeAngulo, rumoDe, X_DA_PARADA_DO_DRAGA, xDoDragaNoRio } from './WalkerDemo';
import { walkerFromSearch } from './walkerLink';

describe('a demonstração do Draga-01 (P180, parte A): o link e a geometria do passeio', () => {
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

describe('o Draga-01 no rio da Amazônia (P180, parte B): o passeio rio acima pelo leito', () => {
  it('começa onde o mapa diz (rio abaixo da aldeia) e anda rio acima a 2,6 m/s: o x só diminui', () => {
    expect(xDoDragaNoRio(0)).toBe(AMAZONIA_DRAGA_INICIO_X);
    expect(xDoDragaNoRio(10)).toBeCloseTo(AMAZONIA_DRAGA_INICIO_X - 26, 9);
    let anterior = xDoDragaNoRio(0);
    for (let t = 1; t < 400; t += 7) {
      const x = xDoDragaNoRio(t);
      expect(x).toBeLessThanOrEqual(anterior);
      anterior = x;
    }
  });

  it('para antes da aldeia e nunca entra nela (a missão protege a aldeia: o Draga nunca a alcança nesta demonstração)', () => {
    expect(xDoDragaNoRio(1e6)).toBe(X_DA_PARADA_DO_DRAGA);
    expect(X_DA_PARADA_DO_DRAGA - (AMAZONIA_ALDEIA.x + AMAZONIA_ALDEIA.raio)).toBeGreaterThan(150);
    // o tempo que leva até parar: ~9 minutos (1.400 m a 2,6 m/s), uma demonstração longa o bastante para o Comandante ver o rio mudar
    const quando = (AMAZONIA_DRAGA_INICIO_X - X_DA_PARADA_DO_DRAGA) / 2.6;
    expect(xDoDragaNoRio(quando - 1)).toBeGreaterThan(X_DA_PARADA_DO_DRAGA);
    expect(xDoDragaNoRio(quando)).toBeCloseTo(X_DA_PARADA_DO_DRAGA, 9);
  });

  it('tempo torto (negativo, NaN, infinito) não leva o Draga para fora do leito: vale o instante da largada', () => {
    expect(xDoDragaNoRio(-5)).toBe(AMAZONIA_DRAGA_INICIO_X);
    expect(xDoDragaNoRio(NaN)).toBe(AMAZONIA_DRAGA_INICIO_X);
    expect(xDoDragaNoRio(Infinity)).toBe(AMAZONIA_DRAGA_INICIO_X);
  });
});
