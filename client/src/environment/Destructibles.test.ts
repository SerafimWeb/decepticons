import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { DebrisSystem } from './DebrisSystem';
import { Destructibles } from './Destructibles';

const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const DIR = new THREE.Vector3(0, 0, 1);

describe('Destructibles: rodada nova', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('a quebrada volta, a inteira não duplica, e as duas voltam com a vida cheia', async () => {
    const physics = await PhysicsWorld.create();
    const d = new Destructibles(new THREE.Scene(), physics, debris, particles);
    d.add({ x: 0, z: -10, w: 4, d: 1, h: 2, accent: 0xff6a00, hp: 100 });
    d.add({ x: 20, z: -10, w: 4, d: 1, h: 2, accent: 0xff6a00, hp: 100 });
    physics.step();
    const hit = (x: number) => physics.raycast(new THREE.Vector3(x, 1, 0), new THREE.Vector3(0, 0, -1), 50);

    // Quebra a primeira; a segunda só toma dano.
    expect(d.damage(hit(0)!.collider, 100, DIR)).toBe(true);
    d.damage(hit(20)!.collider, 60, DIR);
    physics.step();
    expect(hit(0)).toBeNull();
    const before = physics.world.colliders.len();

    d.restoreAll();
    physics.step();
    expect(hit(0)).not.toBeNull();
    expect(physics.world.colliders.len()).toBe(before + 1); // só a quebrada foi recriada

    // Vida cheia: 99 de dano não quebra nenhuma das duas.
    d.damage(hit(0)!.collider, 99, DIR);
    d.damage(hit(20)!.collider, 99, DIR);
    physics.step();
    expect(hit(0)).not.toBeNull();
    expect(hit(20)).not.toBeNull();
  });
});
