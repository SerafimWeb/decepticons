import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { ANDROID_PROFILE, MECH_PROFILE } from '../combat/BotController';
import { weapon } from '../combat/weapons';
import { BotSystem } from '../combat/BotSystem';
import { CombatSystem } from '../combat/CombatSystem';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { Respawner } from '../combat/Respawner';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Android, ANDROID_STATS } from './Android';
import { PILOT_ANDROID_STATS } from './chassis';
import type { MechInput } from './MechBase';
import { VECTOR09_STATS, Vector09 } from './Vector09';

const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false, damageInRadius: () => {} } as unknown as Destructibles;
const PLASMA = weapon('plasma');
const FORWARD: MechInput = { moveX: 0, moveZ: 1, moveYaw: 0, yaw: 0, jump: false, dash: false };

async function world() {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(400, 2, 400));
  return physics;
}

describe('andróide rebelde (escala 1)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('é pequeno (1,6 m, menos de um terço do Mech) e mais ágil: corre mais, arranca mais rápido, dash mais frequente', () => {
    expect(ANDROID_STATS.height).toBeLessThan(VECTOR09_STATS.height / 3);
    expect(ANDROID_STATS.moveSpeed).toBeGreaterThan(VECTOR09_STATS.moveSpeed);
    expect(ANDROID_STATS.groundAccel).toBeGreaterThan(VECTOR09_STATS.groundAccel);
    expect(ANDROID_STATS.dashCooldown).toBeLessThan(VECTOR09_STATS.dashCooldown);
    expect(ANDROID_STATS.loadout.primary.damage).toBeLessThan(VECTOR09_STATS.loadout.primary.damage);
  });

  it('o modelo tem a altura da cápsula (o tiro acerta o que se vê): Mech, andróide rebelde e o do jogador', () => {
    const size = new THREE.Vector3();
    for (const [mech, height] of [
      [new Vector09(), VECTOR09_STATS.height],
      [new Android(), ANDROID_STATS.height],
      [new Android({ stats: PILOT_ANDROID_STATS, tool: 'pilot' }), PILOT_ANDROID_STATS.height],
    ] as const) {
      mech.root.updateMatrixWorld(true);
      new THREE.Box3().setFromObject(mech.root).getSize(size);
      expect(size.y / height).toBeGreaterThan(0.85);
      expect(size.y / height).toBeLessThan(1.15);
    }
  });

  it('o Mech pesa: leva ~0,3 s para chegar na velocidade máxima; o andróide, uns 0,1 s', async () => {
    const physics = await world();
    const a = new Android();
    const m = new Vector09();
    a.spawn(physics, new THREE.Vector3(-20, 0, 0));
    m.spawn(physics, new THREE.Vector3(20, 0, 0));
    physics.step();
    const top = (mech: Android | Vector09) => Math.hypot(mech.velocity.x, mech.velocity.z) >= mech.stats.moveSpeed * 0.95;
    let aT = -1;
    let mT = -1;
    for (let i = 1; i <= 60; i++) {
      a.fixedUpdate(FORWARD, FIXED_DT);
      m.fixedUpdate(FORWARD, FIXED_DT);
      physics.step();
      if (aT < 0 && top(a)) aT = i * FIXED_DT;
      if (mT < 0 && top(m)) mT = i * FIXED_DT;
    }
    expect(aT).toBeGreaterThan(0);
    expect(aT).toBeLessThan(0.15);
    expect(mT).toBeGreaterThan(0.25);
    expect(mT).toBeLessThan(0.4);
  });

  it('anda na velocidade dele, sem sair do chão, e chega nela mais rápido que o Mech', async () => {
    const physics = await world();
    const a = new Android();
    const m = new Vector09();
    a.spawn(physics, new THREE.Vector3(-20, 0, 0));
    m.spawn(physics, new THREE.Vector3(20, 0, 0));
    physics.step();
    const speedAt = (mech: Android | Vector09) => Math.hypot(mech.velocity.x, mech.velocity.z) / mech.stats.moveSpeed;
    let aFrac = 0;
    let mFrac = 0;
    for (let i = 0; i < 6; i++) {
      a.fixedUpdate(FORWARD, FIXED_DT);
      m.fixedUpdate(FORWARD, FIXED_DT);
      physics.step();
    }
    aFrac = speedAt(a);
    mFrac = speedAt(m);
    expect(aFrac).toBeGreaterThan(mFrac); // em 0,1 s o andróide já está mais perto da velocidade máxima
    for (let i = 0; i < 60; i++) {
      a.fixedUpdate(FORWARD, FIXED_DT);
      physics.step();
    }
    expect(speedAt(a)).toBeCloseTo(1, 1);
    expect(a.grounded).toBe(true);
  });

  it('tiro de plasma na canela, do lado direito, acerta a perna direita da cápsula pequena', async () => {
    const physics = await world();
    const combat = new CombatSystem(destructibles, debris, particles);
    const a = new Android();
    a.spawn(physics, new THREE.Vector3(0, 0, 0));
    a.applyFacing(0, 0); // olha para -Z; a direita dele é +X
    combat.register(a);
    const projectiles = new ProjectileSystem(new THREE.Scene(), physics, particles);
    projectiles.onHit = (hit, dir, dmg, owner) => combat.onProjectileHit(hit, dir, dmg, owner);
    physics.step();
    projectiles.fire(new THREE.Vector3(0.2, 0.4, -20), new THREE.Vector3(0, 0, 1), undefined, false, PLASMA);
    for (let i = 0; i < 20; i++) {
      projectiles.fixedUpdate(FIXED_DT);
      physics.step();
    }
    expect(a.modules.rightLeg).toBe(ANDROID_STATS.maxModuleHealth.rightLeg - PLASMA.damage);
    expect(a.modules.head).toBe(ANDROID_STATS.maxModuleHealth.head);
  });

  it('é frágil e mais chato do que perigoso: 2 tiros de plasma derrubam; o tiro dele tira pouco', async () => {
    const physics = await world();
    const combat = new CombatSystem(destructibles, debris, particles);
    const a = new Android();
    a.spawn(physics, new THREE.Vector3(0, 0, 0));
    combat.register(a);
    const chest = new THREE.Vector3(0, 1.4, -ANDROID_STATS.radius);
    a.takeHit(chest, PLASMA.damage);
    expect(a.alive).toBe(true);
    a.takeHit(chest, PLASMA.damage);
    expect(a.alive).toBe(false);
    // Precisa de mais de 70 tiros para derrubar o torso de um Mech.
    expect(VECTOR09_STATS.maxModuleHealth.torso / ANDROID_STATS.loadout.primary.damage).toBeGreaterThan(70);
  });

  it('o BotSystem põe Mechs e andróides na arena, cada um com o seu jeito de lutar', async () => {
    const physics = await world();
    const combat = new CombatSystem(destructibles, debris, particles);
    const bots = new BotSystem({
      scene: new THREE.Scene(),
      physics,
      combat,
      projectiles: new ProjectileSystem(new THREE.Scene(), physics, particles),
      particles,
      respawner: new Respawner([[0, 90]]),
      spawns: [[0, 0]],
      androidSpawns: [
        [30, 0],
        [-30, 0],
      ],
      waypoints: [
        [0, 80],
        [10, 80],
      ],
    });
    expect(bots.mechs).toHaveLength(3);
    const [mech, a1, a2] = bots.mechs;
    expect(mech).toBeInstanceOf(Vector09);
    expect(a1).toBeInstanceOf(Android);
    expect(bots.nameOf(a1!)).toBe('KUEN');
    expect(bots.nameOf(a2!)).toBe('DIPSIK');
    expect(bots.brainOf(mech!)!.profile).toBe(MECH_PROFILE);
    expect(bots.brainOf(a1!)!.profile).toBe(ANDROID_PROFILE);
  });
});
