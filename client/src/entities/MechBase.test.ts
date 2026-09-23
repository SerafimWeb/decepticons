import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import type { MechInput } from './MechBase';
import { VECTOR09_STATS, Vector09 } from './Vector09';

const SPEED = VECTOR09_STATS.moveSpeed;
const WARMUP_TICKS = 30; // tempo para acelerar até a velocidade máxima

/** Mesma geometria da Arena.ts: chão, prédio, plataforma e rampa. */
function buildArena(physics: PhysicsWorld): void {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  physics.addStaticBox(v(0, -1, 0), v(800, 2, 800));
  physics.addStaticBox(v(32, 10, -15), v(12, 20, 22)); // prédio: face oeste em x = 26
  physics.addStaticBox(v(-50, 3, 35), v(16, 6, 16)); // plataforma de 6 m
  const angle = Math.atan2(6, 14);
  physics.addStaticBox(
    v(-35 - Math.sin(angle) * 0.5, 3 - Math.cos(angle) * 0.5, 35),
    v(14 / Math.cos(angle), 1, 8),
    new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), -angle),
  );
}

function input(moveYaw: number, moveZ = 1, moveX = 0): MechInput {
  return { moveX, moveZ, moveYaw, yaw: moveYaw, jump: false, dash: false };
}

interface Run {
  positions: THREE.Vector3[];
  speeds: number[];
  grounded: boolean[];
}

async function simulate(
  feet: THREE.Vector3,
  cmd: MechInput,
  ticks: number,
  extra?: (physics: PhysicsWorld) => void,
): Promise<Run> {
  const physics = await PhysicsWorld.create();
  buildArena(physics);
  extra?.(physics);
  const mech = new Vector09();
  mech.spawn(physics, feet);
  const run: Run = { positions: [], speeds: [], grounded: [] };
  for (let i = 0; i < ticks; i++) {
    mech.fixedUpdate(cmd, FIXED_DT);
    physics.step();
    mech.render(0, 1); // alpha = 1: root.position = posição da simulação
    run.positions.push(mech.position.clone());
    run.speeds.push(Math.hypot(mech.velocity.x, mech.velocity.z));
    run.grounded.push(mech.grounded);
  }
  return run;
}

describe('MechBase: movimento', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('corre em chão plano sem travar (20 s)', async () => {
    const run = await simulate(new THREE.Vector3(0, 0, 0), input(0.3), 1200);
    for (let i = WARMUP_TICKS; i < run.positions.length; i++) {
      const a = run.positions[i - 1];
      const b = run.positions[i];
      const step = Math.hypot(b.x - a.x, b.z - a.z);
      // O bug: um tick "travado" andava ~0 m e zerava a velocidade (~10 ticks para reacelerar).
      expect(step, `tick ${i}: andou ${step.toFixed(3)} m`).toBeGreaterThan(SPEED * FIXED_DT * 0.5);
      expect(run.speeds[i], `tick ${i}: velocidade`).toBeGreaterThan(SPEED * 0.95);
    }
  });

  it('para na parede e desliza ao longo dela', async () => {
    const x = -Math.PI / 2; // moveYaw que aponta para +X
    const straight = await simulate(new THREE.Vector3(10, 0, -15), input(x), 120);
    const stop = straight.positions.at(-1)!;
    expect(stop.x).toBeCloseTo(26 - VECTOR09_STATS.radius - 0.05, 1);

    const diagonal = await simulate(new THREE.Vector3(10, 0, -20), input(x, 1, 0.4), 60);
    const end = diagonal.positions.at(-1)!;
    expect(end.x).toBeLessThan(26);
    expect(end.z).toBeGreaterThan(-20 + 3); // continuou andando em Z, colado na parede
  });

  it('sobe e desce a rampa sem sair do chão', async () => {
    const west = Math.PI / 2; // moveYaw que aponta para -X
    const up = await simulate(new THREE.Vector3(-15, 0, 35), input(west), 150);
    expect(up.positions.at(-1)!.y).toBeCloseTo(6, 1);

    const down = await simulate(new THREE.Vector3(-46, 6, 35), input(-west), 100);
    expect(down.positions.at(-1)!.y).toBeCloseTo(0, 1);
    // O Rapier às vezes solta o chão por 1–2 ticks (ruído numérico, já existia). Sequência maior = quicando.
    let streak = 0;
    let longest = 0;
    for (const g of down.grounded.slice(1)) {
      streak = g ? 0 : streak + 1;
      longest = Math.max(longest, streak);
    }
    expect(longest, 'maior sequência de ticks no ar na descida').toBeLessThanOrEqual(3);
  });

  it('é determinística: o mesmo input dá o mesmo trajeto', async () => {
    const a = await simulate(new THREE.Vector3(0, 0, 0), input(1.1), 300);
    const b = await simulate(new THREE.Vector3(0, 0, 0), input(1.1), 300);
    expect(b.positions).toEqual(a.positions);
  });

  it('destroços não alteram o trajeto do Mech', async () => {
    const clean = await simulate(new THREE.Vector3(0, 0, 0), input(0), 120);
    const withDebris = await simulate(new THREE.Vector3(0, 0, 0), input(0), 120, (physics) => {
      for (let z = -4; z > -24; z -= 3) {
        const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.5, z));
        physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, 0.5, 0.6), body);
      }
    });
    expect(withDebris.positions).toEqual(clean.positions);
  });
});
