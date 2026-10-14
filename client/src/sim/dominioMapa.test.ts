import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { ARENA_ZONES } from '../combat/Zone';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { DOMINIO_RAIO } from './Dominio';
import { NASCIMENTOS_DO_DOMINIO, PONTOS_DO_DOMINIO } from './dominioMapa';
import { LIMITES_DO_ESQUADRAO } from './esquadrao';
import { Match } from './Match';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const dist = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('o mapa do Domínio (a Arena)', () => {
  it('são cinco pontos, A a E, cada um no seu lugar, e longe um do outro (de um só lugar não se pega dois)', () => {
    expect(PONTOS_DO_DOMINIO.map((p) => p.letra)).toEqual(['A', 'B', 'C', 'D', 'E']);
    for (const [i, p] of PONTOS_DO_DOMINIO.entries()) {
      for (const q of PONTOS_DO_DOMINIO.slice(i + 1)) expect(dist([p.x, p.z], [q.x, q.z]), `${p.letra} e ${q.letra}`).toBeGreaterThanOrEqual(2 * DOMINIO_RAIO + 25);
    }
  });

  it('são simétricos pelo centro (o que está a x,z tem o par em -x,-z): nenhum lado começa em vantagem', () => {
    const p = PONTOS_DO_DOMINIO;
    for (const [a, b] of [[0, 4], [1, 3]] as const) {
      expect(p[a]!.x).toBe(-p[b]!.x);
      expect(p[a]!.z).toBe(-p[b]!.z);
    }
    expect([p[2]!.x, p[2]!.z]).toEqual([0, 0]);
  });

  it('os pontos de nascimento: o suficiente para o maior esquadrão, únicos, a 6 m ou mais um do outro, e o azul é o vermelho de cabeça para baixo', () => {
    const { blue, red } = NASCIMENTOS_DO_DOMINIO;
    expect(red.length).toBeGreaterThanOrEqual(LIMITES_DO_ESQUADRAO.inimigos);
    expect(blue.length).toBeGreaterThanOrEqual(LIMITES_DO_ESQUADRAO.aliados + 1); // + o jogador
    expect(blue).toHaveLength(red.length);
    for (const [i, [x, z]] of red.entries()) {
      expect(blue[i]).toEqual([-x, -z]);
      for (const q of red.slice(i + 1)) expect(dist([x, z], q), `${x},${z} e ${q}`).toBeGreaterThanOrEqual(6);
      expect(Math.abs(x)).toBeLessThanOrEqual(90);
      expect(Math.abs(z)).toBeLessThanOrEqual(90);
    }
  });

  it('cada lado nasce na sua metade e perto do seu ponto de base (A para o azul, E para o vermelho); nenhum nasce numa zona de cura ou resfriamento', () => {
    const [a, , , , e] = PONTOS_DO_DOMINIO;
    expect(dist(NASCIMENTOS_DO_DOMINIO.blue[0]!, [a!.x, a!.z])).toBeLessThanOrEqual(DOMINIO_RAIO);
    expect(dist(NASCIMENTOS_DO_DOMINIO.red[0]!, [e!.x, e!.z])).toBeLessThanOrEqual(DOMINIO_RAIO);
    for (const p of NASCIMENTOS_DO_DOMINIO.red) expect(p[0] + (-p[1]) > 0).toBe(true); // x e -z do mesmo sinal: canto de baixo à direita
    for (const lado of ['blue', 'red'] as const) {
      for (const p of NASCIMENTOS_DO_DOMINIO[lado]) for (const z of ARENA_ZONES) expect(dist(p, [z.x, z.z]), `${lado} ${p}`).toBeGreaterThan(z.radius);
    }
  });

  describe('contra a arena de verdade (física)', () => {
    beforeAll(async () => {
      await RAPIER.init();
    });

    it('cabe um Mech grande em pé em cada ponto de controle e em cada ponto de nascimento, sem encostar em prédio, barricada, rampa, plataforma nem na torre', async () => {
      const physics = await PhysicsWorld.create();
      try {
        const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false });
        physics.step();
        const raio = 3.6;
        const altura = 5.3;
        const base = 0.5;
        const forma = new RAPIER.Cylinder((altura - base) / 2, raio);
        const fixo = (c: RAPIER.Collider) => {
          const corpo = c.parent();
          return !corpo || corpo.isFixed();
        };
        const bate = (x: number, z: number) =>
          match.physics.world.intersectionWithShape({ x, y: base + (altura - base) / 2, z }, { x: 0, y: 0, z: 0, w: 1 }, forma, undefined, undefined, undefined, undefined, fixo);
        for (const p of PONTOS_DO_DOMINIO) expect(bate(p.x, p.z), `o ponto ${p.letra} encosta em algo da arena`).toBeNull();
        for (const lado of ['blue', 'red'] as const) {
          for (const [x, z] of NASCIMENTOS_DO_DOMINIO[lado]) expect(bate(x, z), `o nascimento ${lado} ${x},${z} encosta em algo da arena`).toBeNull();
        }
        // E o teste enxerga: dentro do prédio do canto (−28, −35) bate.
        expect(bate(-28, -35)).not.toBeNull();
      } finally {
        physics.world.free();
      }
    });
  });
});
