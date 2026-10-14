import { describe, expect, it } from 'vitest';
import { ARENA_ZONES } from '../combat/Zone';
import { type PontoMapa, RAIO_M, paraMinimapa, plantaComZonas } from './Minimapa';

const novo = (): PontoMapa => ({ x: 0, y: 0, borda: false });
/** Um minimapa de 150 px: 0,42 de raio útil e 75 m de alcance. */
const K = (150 * 0.42) / RAIO_M;
const R = 150 * 0.42;

describe('minimapa de frente-para-cima', () => {
  it('quem está na frente do Mech sobe, qualquer que seja o rumo (a frente é (-sen yaw, -cos yaw))', () => {
    for (const yaw of [0, 0.7, Math.PI / 2, Math.PI, -2.1, 5.5]) {
      const frente = { dx: -Math.sin(yaw) * 20, dz: -Math.cos(yaw) * 20 };
      const p = novo();
      paraMinimapa(frente.dx, frente.dz, yaw, K, R, p);
      expect(p.x).toBeCloseTo(0, 6);
      expect(p.y).toBeCloseTo(-20 * K, 6);
      expect(p.borda).toBe(false);
    }
  });

  it('quem está à direita do Mech vai para a direita, e quem está atrás desce', () => {
    // yaw 0: a frente é -z; a direita é +x.
    const dir = novo();
    paraMinimapa(10, 0, 0, K, R, dir);
    expect(dir.x).toBeCloseTo(10 * K, 6);
    expect(dir.y).toBeCloseTo(0, 6);
    const tras = novo();
    paraMinimapa(0, 10, 0, K, R, tras);
    expect(tras.y).toBeCloseTo(10 * K, 6);
    // Virou 90° (yaw = π/2, a frente passa a ser -x): a direita do Mech é agora -z.
    const girado = novo();
    paraMinimapa(0, -10, Math.PI / 2, K, R, girado);
    expect(girado.x).toBeCloseTo(10 * K, 6);
  });

  it('além do alcance, o ponto fica preso na borda, na mesma direção, e marcado como borda', () => {
    const p = novo();
    paraMinimapa(0, -200, 0, K, R, p);
    expect(p.borda).toBe(true);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(R, 6);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeLessThan(0);
  });

  it('quem está exatamente em cima de você não vira NaN', () => {
    const p = novo();
    paraMinimapa(0, 0, 1.3, K, R, p);
    expect(Number.isNaN(p.x) || Number.isNaN(p.y)).toBe(false);
    expect(p.borda).toBe(false);
  });

  it('o alcance do radar é o do jogo: 75 m, e o limite exato ainda cabe dentro', () => {
    const p = novo();
    paraMinimapa(0, -RAIO_M, 0, K, R, p);
    expect(p.borda).toBe(false);
    expect(p.y).toBeCloseTo(-R, 6);
  });

  it('a planta da Arena leva as duas zonas (cura e resfriamento); a do Bunker, nenhuma', () => {
    const caixas = [{ x0: 0, z0: 0, x1: 4, z1: 4 }];
    expect(plantaComZonas(caixas, true).zonas).toBe(ARENA_ZONES);
    expect(plantaComZonas(caixas, false).zonas).toEqual([]);
    expect(plantaComZonas(caixas, true).caixas).toBe(caixas);
  });
});
