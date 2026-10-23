import { describe, expect, it } from 'vitest';
import { CameraPath } from './CameraPath';

describe('CameraPath (puro, sem THREE)', () => {
  it('recusa menos de 2 quadros-chave', () => {
    expect(() => new CameraPath([{ t: 0, position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } }])).toThrow();
  });

  it('recusa quadros-chave fora de ordem', () => {
    const kf = [
      { t: 0, position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
      { t: 0, position: { x: 1, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
    ];
    expect(() => new CameraPath(kf)).toThrow();
  });

  it('a amostra em t=0 é o primeiro quadro-chave', () => {
    const path = new CameraPath([
      { t: 0, position: { x: -10, y: 5, z: 2 }, lookAt: { x: 0, y: 0, z: 0 }, fov: 50 },
      { t: 10, position: { x: 10, y: 5, z: 2 }, lookAt: { x: 20, y: 0, z: 0 }, fov: 40 },
    ]);
    const s = path.sample(0);
    expect(s.position).toEqual({ x: -10, y: 5, z: 2 });
    expect(s.fov).toBe(50);
  });

  it('a amostra em t >= duração é o último quadro-chave (e não extrapola)', () => {
    const path = new CameraPath([
      { t: 0, position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 }, fov: 50 },
      { t: 5, position: { x: 10, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 }, fov: 40 },
    ]);
    expect(path.sample(5)).toEqual(path.sample(999));
    expect(path.sample(999).position).toEqual({ x: 10, y: 0, z: 0 });
  });

  it('a amostra em t negativo não extrapola antes do início', () => {
    const path = new CameraPath([
      { t: 0, position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
      { t: 5, position: { x: 10, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
    ]);
    expect(path.sample(-3)).toEqual(path.sample(0));
  });

  it('no meio do segmento, a posição fica entre os dois quadros-chave (suavizada, não linear)', () => {
    const path = new CameraPath([
      { t: 0, position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
      { t: 10, position: { x: 100, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
    ]);
    const meio = path.sample(5);
    // smoothstep(0.5) = 0.5: no ponto médio exato, suavizado e linear coincidem.
    expect(meio.position.x).toBeCloseTo(50, 5);
    // perto da ponta, a suavização anda mais devagar que a reta (derivada ~0 no início).
    expect(path.sample(1).position.x).toBeLessThan(10);
  });

  it('atravessa vários quadros-chave na ordem certa', () => {
    const path = new CameraPath([
      { t: 0, position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
      { t: 5, position: { x: 10, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
      { t: 10, position: { x: 10, y: 20, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
    ]);
    expect(path.duration).toBe(10);
    expect(path.sample(5).position).toEqual({ x: 10, y: 0, z: 0 });
    expect(path.sample(7.5).position.y).toBeGreaterThan(0);
    expect(path.sample(7.5).position.x).toBeCloseTo(10, 5);
  });

  it('o FOV de um quadro-chave sem fov próprio herda o do vizinho', () => {
    const path = new CameraPath([
      { t: 0, position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 }, fov: 60 },
      { t: 5, position: { x: 0, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
    ]);
    expect(path.sample(5).fov).toBe(60);
  });

  it('é determinística: a mesma amostra do mesmo t sempre dá o mesmo resultado', () => {
    const path = new CameraPath([
      { t: 0, position: { x: 1, y: 2, z: 3 }, lookAt: { x: 4, y: 5, z: 6 } },
      { t: 8, position: { x: 7, y: 8, z: 9 }, lookAt: { x: 10, y: 11, z: 12 } },
    ]);
    expect(path.sample(3.333)).toEqual(path.sample(3.333));
  });
});
