import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { Vector09 } from '../entities/Vector09';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ZoneSystem, type ZoneDef } from './Zone';

const HEAL: ZoneDef = { x: 0, z: 0, radius: 10, kind: 'heal' };
const COOL: ZoneDef = { x: 100, z: 100, radius: 10, kind: 'cool' };

describe('ZoneSystem: cura e resfriamento', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function makeMech(feet: THREE.Vector3): Promise<{ physics: PhysicsWorld; mech: Vector09 }> {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(800, 2, 800));
    const mech = new Vector09();
    mech.spawn(physics, feet);
    return { physics, mech };
  }

  it('cura a parte mais avariada de quem está dentro do raio', async () => {
    const { mech } = await makeMech(new THREE.Vector3(0, 0, 0));
    mech.damagePart('leftArm', 100);
    const before = mech.modules.leftArm;
    new ZoneSystem([HEAL]).fixedUpdate(1, [mech]);
    expect(mech.modules.leftArm).toBeGreaterThan(before);
  });

  it('não cura quem está fora do raio', async () => {
    const { mech } = await makeMech(new THREE.Vector3(500, 0, 500));
    mech.damagePart('leftArm', 100);
    const before = mech.modules.leftArm;
    new ZoneSystem([HEAL]).fixedUpdate(1, [mech]);
    expect(mech.modules.leftArm).toBe(before);
  });

  it('não cura quem já morreu', async () => {
    const { mech } = await makeMech(new THREE.Vector3(0, 0, 0));
    mech.damagePart('torso', 100000);
    expect(mech.alive).toBe(false);
    expect(() => new ZoneSystem([HEAL]).fixedUpdate(1, [mech])).not.toThrow();
  });

  it('ventila o calor de quem está na zona de resfriamento, mesmo atirando', async () => {
    const { mech } = await makeMech(new THREE.Vector3(100, 0, 100));
    mech.onFire();
    const heatWithShot = mech.heat;
    new ZoneSystem([COOL]).fixedUpdate(1 / 60, [mech]);
    expect(mech.heat).toBeLessThan(heatWithShot);
  });

  it('não ventila quem está fora do raio da zona de resfriamento', async () => {
    const { mech } = await makeMech(new THREE.Vector3(0, 0, 0));
    mech.onFire();
    const heatWithShot = mech.heat;
    new ZoneSystem([COOL]).fixedUpdate(1 / 60, [mech]);
    expect(mech.heat).toBe(heatWithShot);
  });

  it('aplica a duas listas de Mechs (jogadores e bots) sem se misturarem', async () => {
    const { mech: player } = await makeMech(new THREE.Vector3(0, 0, 0));
    const { mech: bot } = await makeMech(new THREE.Vector3(0, 0, 1));
    player.damagePart('leftArm', 100);
    bot.damagePart('leftArm', 100);
    const zones = new ZoneSystem([HEAL]);
    zones.fixedUpdate(1, [player]);
    zones.fixedUpdate(1, [bot]);
    expect(player.modules.leftArm).toBeGreaterThan(0);
    expect(bot.modules.leftArm).toBeGreaterThan(0);
  });
});
