import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { Android } from '../entities/Android';
import type { MechInput, MechModules } from '../entities/MechBase';
import { VECTOR09_STATS, Vector09 } from '../entities/Vector09';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { damageFraction, REPAIR_RANGE, REPAIR_RATE, repairModules } from './repair';
import { TechnicianController } from './TechnicianController';

const MAX = VECTOR09_STATS.maxModuleHealth;
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };

describe('conserto: regra', () => {
  it('conserta a parte mais avariada que ainda existe, sem passar do máximo', () => {
    const m: MechModules = { ...MAX, torso: 150, leftLeg: 30 }; // perna em 20%, torso em 50%
    expect(repairModules(m, MAX, 10)).toBe(10);
    expect(m.leftLeg).toBe(40);
    expect(m.torso).toBe(150);
    const almost: MechModules = { ...MAX, head: MAX.head - 3 };
    expect(repairModules(almost, MAX, 10)).toBe(3);
    expect(almost.head).toBe(MAX.head);
  });

  it('parte arrancada não volta, Mech morto não conserta, inteiro não gasta nada', () => {
    const lost: MechModules = { ...MAX, rightArm: 0 };
    expect(repairModules(lost, MAX, 50)).toBe(0);
    expect(lost.rightArm).toBe(0);
    expect(repairModules({ ...MAX, torso: 0, leftLeg: 10 }, MAX, 50)).toBe(0);
    expect(repairModules({ ...MAX }, MAX, 50)).toBe(0);
  });

  it('avaria do Mech inteiro, contando só as partes que existem', () => {
    expect(damageFraction({ ...MAX }, MAX)).toBe(0);
    expect(damageFraction({ ...MAX, torso: MAX.torso / 2 }, MAX)).toBeGreaterThan(0);
  });
});

async function scene(playerAt: [number, number]) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(400, 2, 400));
  const ally = new Vector09();
  ally.spawn(physics, new THREE.Vector3(0, 0, 0));
  ally.takeHit(new THREE.Vector3(0, 3.2, -VECTOR09_STATS.radius), 120); // torso avariado
  const tech = new Android();
  tech.spawn(physics, new THREE.Vector3(20, 0, 0));
  const player = new Vector09();
  player.spawn(physics, new THREE.Vector3(playerAt[0], 0, playerAt[1]));
  physics.step();
  const brain = new TechnicianController(tech, [ally]);
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += FIXED_DT) {
      tech.fixedUpdate(brain.think(FIXED_DT, [player]), FIXED_DT);
      if (brain.repairTarget) brain.repairTarget.repair(REPAIR_RATE * FIXED_DT);
      ally.fixedUpdate(IDLE, FIXED_DT);
      player.fixedUpdate(IDLE, FIXED_DT);
      physics.step();
    }
  };
  const dist = (a: Android | Vector09, b: Android | Vector09) => Math.hypot(a.simPosition.x - b.simPosition.x, a.simPosition.z - b.simPosition.z);
  return { ally, tech, player, brain, run, dist };
}

describe('técnico (andróide de apoio)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('vai até o Mech avariado, fica no alcance e conserta', async () => {
    const s = await scene([0, 150]); // jogador longe
    const before = s.ally.modules.torso;
    s.run(5);
    expect(s.dist(s.tech, s.ally)).toBeLessThan(REPAIR_RANGE);
    expect(s.brain.state).toBe('repair');
    expect(s.ally.modules.torso).toBeGreaterThan(before + 20);
  });

  it('com o jogador perto, larga o conserto e foge', async () => {
    const s = await scene([24, 6]); // jogador a ~7 m do técnico
    const start = s.dist(s.tech, s.player);
    s.run(0.1);
    expect(s.brain.state).toBe('flee');
    s.run(0.7);
    expect(s.dist(s.tech, s.player)).toBeGreaterThan(start + 5);
    // Longe do jogador (histerese de 24 m), volta a consertar: fugiu para o lado do Mech avariado.
    s.run(3);
    expect(s.dist(s.tech, s.player)).toBeGreaterThan(16);
  });
});
