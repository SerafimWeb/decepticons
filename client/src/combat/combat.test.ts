import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { weapon } from './weapons';
import { beforeAll, describe, expect, it } from 'vitest';
import { VECTOR09_STATS, Vector09 } from '../entities/Vector09';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { CombatSystem } from './CombatSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { Respawner } from './Respawner';

const MAX = VECTOR09_STATS.maxModuleHealth;
// Efeitos visuais não importam aqui: só a regra (o ParticleSystem precisa de DOM).
const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false } as unknown as Destructibles;

async function arena(targetYaw: number) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(200, 2, 200));
  const combat = new CombatSystem(destructibles, debris, particles);
  const target = new Vector09();
  target.spawn(physics, new THREE.Vector3(0, 0, 0));
  target.applyFacing(targetYaw, 0);
  combat.register(target);
  const projectiles = new ProjectileSystem(new THREE.Scene(), physics, particles);
  projectiles.onHit = (hit, dir, dmg) => combat.onProjectileHit(hit, dir, dmg);
  physics.step(); // colisores entram na árvore de consulta
  const shoot = (from: THREE.Vector3, dir: THREE.Vector3, ticks = 30) => {
    projectiles.fire(from, dir.clone().normalize());
    for (let i = 0; i < ticks; i++) {
      projectiles.fixedUpdate(FIXED_DT);
      physics.step();
    }
  };
  return { physics, combat, target, shoot };
}

describe('combate: projétil → parte do Mech', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('tiro na altura da canela, do lado direito do alvo, acerta a perna direita', async () => {
    // Alvo com yaw 0 olha para -Z; a direita dele é +X. Atirador à frente dele (em -Z).
    const { target, shoot } = await arena(0);
    shoot(new THREE.Vector3(0.5, 1.0, -20), new THREE.Vector3(0, 0, 1));
    expect(target.modules.rightLeg).toBe(MAX.rightLeg - weapon('plasma').damage);
    expect(target.modules.leftLeg).toBe(MAX.leftLeg);
  });

  it('a parte segue a rotação do alvo (virado ao contrário, o mesmo lado vira a perna esquerda)', async () => {
    const { target, shoot } = await arena(Math.PI);
    shoot(new THREE.Vector3(0.5, 1.0, 20), new THREE.Vector3(0, 0, -1));
    expect(target.modules.leftLeg).toBe(MAX.leftLeg - weapon('plasma').damage);
    expect(target.modules.rightLeg).toBe(MAX.rightLeg);
  });

  it('o tiro atravessa destroço (só cosmético) e acerta o Mech atrás', async () => {
    const { physics, target, shoot } = await arena(0);
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 3.5, -8));
    physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1, 1, 1), body);
    physics.step();
    shoot(new THREE.Vector3(0, 3.5, -20), new THREE.Vector3(0, 0, 1));
    expect(target.modules.torso).toBe(MAX.torso - weapon('plasma').damage);
  });

  it('braço direito destruído desliga o plasma; torso zerado mata e desliga a colisão', async () => {
    const { target, shoot } = await arena(0);
    target.damagePart('rightArm', MAX.rightArm);
    expect(target.canFirePrimary).toBe(false);
    expect(target.canFireSecondary).toBe(true);

    const r = target.damagePart('torso', MAX.torso);
    expect(r.killed).toBe(true);
    expect(target.alive).toBe(false);
    expect(target.collider.isEnabled()).toBe(false);
    // Morto não é mais acertado: o tiro passa.
    shoot(new THREE.Vector3(0, 3.5, -20), new THREE.Vector3(0, 0, 1));
    expect(target.modules.head).toBe(MAX.head);
  });
});

describe('Respawner', () => {
  it('renasce depois do tempo, inteiro, no ponto mais longe de quem está vivo', async () => {
    await RAPIER.init();
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(200, 2, 200));
    const respawner = new Respawner([
      [0, 0],
      [50, 0],
      [-50, 0],
    ]);
    const survivor = new Vector09();
    survivor.spawn(physics, new THREE.Vector3(45, 0, 0));
    const victim = new Vector09();
    victim.spawn(physics, new THREE.Vector3(0, 0, 0));
    respawner.track(survivor, 3);
    let respawned = 0;
    respawner.track(victim, 3, () => respawned++);

    victim.damagePart('leftLeg', 999);
    victim.damagePart('torso', 999);
    expect(victim.alive).toBe(false);

    const ticks = Math.ceil(3 / FIXED_DT);
    for (let i = 0; i < ticks - 2; i++) respawner.fixedUpdate(FIXED_DT);
    expect(victim.alive).toBe(false); // ainda contando
    expect(respawner.timeLeft(victim)).toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) respawner.fixedUpdate(FIXED_DT);
    expect(victim.alive).toBe(true);
    expect(respawned).toBe(1);
    expect(victim.modules).toEqual(MAX);
    expect(victim.collider.isEnabled()).toBe(true);
    // O sobrevivente está em x=45: o ponto mais longe dele é x=-50.
    expect(victim.simPosition.x).toBe(-50);
    expect(respawner.timeLeft(victim)).toBeNull();
  });
});
