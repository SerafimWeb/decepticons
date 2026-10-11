import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ICE_TRAIL_EVERY, IMPACT_FX } from '../fx/impactFx';
import type { BurstOptions } from '../fx/ParticleSystem';
import { SHAPE } from '../fx/particleShapes';
import { ProjectileSystem } from './ProjectileSystem';
import { weapon, type WeaponId } from './weapons';

/** O que o tiro faz com as partículas, medido por um espião no lugar do `ParticleSystem` e uma física que acerta (ou não). */
function palco(acerta: boolean) {
  const rajadas: BurstOptions[] = [];
  const particles = { burst: (_o: THREE.Vector3, _n: THREE.Vector3, o: BurstOptions) => rajadas.push(o) };
  let primeiro = true;
  const fisica = {
    raycast: (origem: THREE.Vector3, _d: THREE.Vector3, dist: number) =>
      acerta && primeiro && ((primeiro = false), true)
        ? { point: origem.clone(), normal: new THREE.Vector3(0, 1, 0), distance: Math.min(dist, 0.5), collider: {} }
        : null,
  };
  const system = new ProjectileSystem(new THREE.Scene(), fisica as never, particles as never, 1);
  system.onHit = () => {};
  return { system, rajadas };
}
const voa = (system: ProjectileSystem, id: WeaponId, ticks: number) => {
  system.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, weapon(id));
  for (let i = 0; i < ticks; i++) system.fixedUpdate(1 / 60);
};

describe('o que cada tiro faz onde bate (impacto por família, dentro do ProjectileSystem)', () => {
  it('cada arma de projétil entrega ao sistema de partículas o impacto da sua família, e nenhum outro', () => {
    for (const id of ['plasma', 'arc', 'cryo', 'emp', 'railgun', 'rotary'] as const) {
      const { system, rajadas } = palco(true);
      voa(system, id, 3);
      expect(rajadas, id).toEqual(IMPACT_FX[id]);
    }
  });

  it('o gelo bate com flocos e o plasma não: o mesmo código, famílias diferentes', () => {
    const gelo = palco(true);
    voa(gelo.system, 'cryo', 3);
    expect(gelo.rajadas.some((o) => o.shape === SHAPE.flake)).toBe(true);
    const plasma = palco(true);
    voa(plasma.system, 'plasma', 3);
    expect(plasma.rajadas.some((o) => o.shape === SHAPE.flake)).toBe(false);
  });
});

describe('o rastro de flocos do tiro de gelo', () => {
  it('voando sem bater, o gelo deixa um floco a cada 1,6 m (e o plasma, nenhum)', () => {
    const gelo = palco(false);
    voa(gelo.system, 'cryo', 60); // 1 s a 70 m/s = 70 m
    const flocos = gelo.rajadas.filter((o) => o.shape === SHAPE.flake);
    expect(flocos.length).toBe(Math.floor(70 / ICE_TRAIL_EVERY));
    expect(gelo.rajadas.length).toBe(flocos.length); // só o rastro: sem impacto nenhum

    const plasma = palco(false);
    voa(plasma.system, 'plasma', 60);
    expect(plasma.rajadas).toHaveLength(0);
  });

  it('o rastro gira (os flocos giram, para não parecerem pontos de neve parados)', () => {
    const gelo = palco(false);
    voa(gelo.system, 'cryo', 20);
    expect(gelo.rajadas.every((o) => (o.spin ?? 0) > 0)).toBe(true);
  });
});
