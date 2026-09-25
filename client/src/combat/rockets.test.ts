import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { VECTOR09_STATS, Vector09 } from '../entities/Vector09';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { CombatSystem } from './CombatSystem';
import { BLAST_RADIUS, ROCKET_AMMO, ROCKET_DAMAGE, ROCKET_INTERVAL, ROCKET_RELOAD, RocketLauncher, RocketSystem, splashDamage } from './RocketSystem';

const MAX = VECTOR09_STATS.maxModuleHealth;
const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false, damageInRadius: () => {} } as unknown as Destructibles;
const FWD = new THREE.Vector3(0, 0, 1);

describe('foguetes: regras puras', () => {
  it('dano em área: máximo no centro, metade no meio do raio, zero na borda', () => {
    expect(splashDamage(0)).toBe(ROCKET_DAMAGE);
    expect(splashDamage(BLAST_RADIUS / 2)).toBe(Math.round(ROCKET_DAMAGE / 2));
    expect(splashDamage(BLAST_RADIUS)).toBe(0);
    expect(splashDamage(BLAST_RADIUS * 3)).toBe(0);
  });

  it('carregador: 4 foguetes com intervalo entre eles; vazio não atira', () => {
    const l = new RocketLauncher();
    let fired = 0;
    for (let t = 0; t < 2; t += FIXED_DT) {
      if (l.tryFire()) fired++;
      l.fixedUpdate(FIXED_DT);
    }
    // Em 2 s cabem mais de 4 intervalos, mas o carregador só tem 4 (a recarga leva 2,2 s).
    expect(fired).toBe(ROCKET_AMMO);
    expect(l.ammo).toBe(0);
    expect(l.tryFire()).toBe(false);
    // Intervalo: dois disparos seguidos no mesmo tick não saem.
    const l2 = new RocketLauncher();
    expect(l2.tryFire()).toBe(true);
    expect(l2.tryFire()).toBe(false);
    for (let t = 0; t < ROCKET_INTERVAL + FIXED_DT; t += FIXED_DT) l2.fixedUpdate(FIXED_DT);
    expect(l2.tryFire()).toBe(true);
  });

  it('recarga: um foguete a cada ROCKET_RELOAD segundos, até encher', () => {
    const l = new RocketLauncher();
    while (l.tryFire()) for (let t = 0; t < ROCKET_INTERVAL + FIXED_DT; t += FIXED_DT) l.fixedUpdate(FIXED_DT);
    const empty = l.ammo;
    for (let t = 0; t < ROCKET_RELOAD + FIXED_DT; t += FIXED_DT) l.fixedUpdate(FIXED_DT);
    expect(l.ammo).toBe(empty + 1);
    for (let t = 0; t < ROCKET_RELOAD * ROCKET_AMMO; t += FIXED_DT) l.fixedUpdate(FIXED_DT);
    expect(l.ammo).toBe(ROCKET_AMMO);
    expect(l.reloadProgress).toBe(1);
  });
});

async function arena() {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(200, 2, 200));
  const combat = new CombatSystem(destructibles, debris, particles);
  const target = new Vector09();
  target.spawn(physics, new THREE.Vector3(0, 0, 0));
  target.applyFacing(0, 0); // olha para -Z; a direita dele é +X
  combat.register(target);
  const shooter = new Vector09();
  shooter.spawn(physics, new THREE.Vector3(0, 0, -40));
  combat.register(shooter);
  physics.step();
  return { physics, combat, target, shooter };
}

describe('foguetes: explosão no Mech', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('explosão no chão, na frente do pé direito: acerta a perna direita, não a cabeça', async () => {
    const { combat, target } = await arena();
    combat.explode(new THREE.Vector3(0.6, 0.3, -2.5), FWD);
    expect(target.modules.rightLeg).toBeLessThan(MAX.rightLeg);
    expect(target.modules.head).toBe(MAX.head);
  });

  it('explosão na altura do peito, colada: dano cheio no torso', async () => {
    const { combat, target } = await arena();
    combat.explode(new THREE.Vector3(0, 3.2, -VECTOR09_STATS.radius), FWD);
    expect(target.modules.torso).toBe(MAX.torso - ROCKET_DAMAGE);
  });

  it('longe demais não fere; quem disparou nunca se fere', async () => {
    const { combat, target, shooter } = await arena();
    combat.explode(new THREE.Vector3(0, 1, -(VECTOR09_STATS.radius + BLAST_RADIUS + 1)), FWD);
    expect(target.modules).toEqual(MAX);
    combat.explode(new THREE.Vector3(0, 1, -40 + 1.5), FWD, shooter.collider);
    expect(shooter.modules).toEqual(MAX);
  });

  it('foguete disparado voa, acerta o Mech e explode nele', async () => {
    const { physics, combat, target, shooter } = await arena();
    const rockets = new RocketSystem(new THREE.Scene(), physics, particles);
    rockets.onExplode = (at, dir, owner) => combat.explode(at, dir, owner);
    rockets.fire(new THREE.Vector3(0, 3.2, -36), FWD.clone(), shooter.collider);
    for (let i = 0; i < 60; i++) {
      rockets.fixedUpdate(FIXED_DT);
      physics.step();
    }
    expect(target.modules.torso).toBeLessThan(MAX.torso);
    expect(shooter.modules).toEqual(MAX);
  });
});
