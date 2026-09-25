import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { drill } from '../combat/balance';
import { OVERHEAT_SPEED } from '../combat/heat';
import { FireTimer } from '../combat/trigger';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import type { MechInput } from './MechBase';
import { VECTOR09_STATS, Vector09 } from './Vector09';

const V = VECTOR09_STATS;
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const RUN: MechInput = { ...IDLE, moveZ: 1 };
const ticks = (seconds: number) => Math.round(seconds / FIXED_DT);

async function bench() {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(800, 2, 800));
  const m = new Vector09();
  m.spawn(physics, new THREE.Vector3(0, 0, 0));
  physics.step();
  const tick = (cmd: MechInput, n = 1) => {
    for (let i = 0; i < n; i++) {
      m.fixedUpdate(cmd, FIXED_DT);
      physics.step();
    }
  };
  tick(IDLE, 20); // assenta no chão
  /** Esquenta com tiros do canhão (a regra do tiro é testada em heat.test.ts). */
  const heatUp = (target: number) => {
    while (m.heat < target && !m.overheated) m.onFire();
  };
  const speed = () => Math.hypot(m.velocity.x, m.velocity.z);
  return { m, tick, heatUp, speed };
}

describe('calor do Mech: tudo esquenta (Vector-09)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('pulo e dash esquentam, cada um com o seu coeficiente', async () => {
    const a = await bench();
    a.tick({ ...IDLE, jump: true });
    expect(a.m.heat).toBeCloseTo(V.heatJump, 3);
    const b = await bench();
    b.tick({ ...IDLE, dash: true });
    expect(b.m.heat).toBeGreaterThanOrEqual(V.heatDash);
    expect(b.m.heat).toBeLessThan(V.heatDash + 0.01);
  });

  it('correr esquenta, mas sozinho não ferve: parado esfria bem mais rápido que correndo', async () => {
    const runner = await bench();
    const still = await bench();
    runner.heatUp(0.8);
    still.heatUp(0.8);
    const h0 = runner.m.heat;
    runner.tick(RUN, ticks(0.6));
    still.tick(IDLE, ticks(0.6));
    const ranCooled = h0 - runner.m.heat;
    const stillCooled = h0 - still.m.heat;
    expect(ranCooled).toBeGreaterThan(0); // correndo ainda esfria (a corrida esquenta menos que o chassi dissipa)
    expect(stillCooled).toBeGreaterThan(ranCooled * 2); // parado: dissipa em dobro e não soma a corrida
    runner.tick(RUN, ticks(10));
    expect(runner.m.overheated).toBe(false);
  });

  it('levar tiro esquenta a blindagem sem segurar o resfriamento', async () => {
    const s = await bench();
    s.heatUp(0.5);
    s.tick(IDLE, ticks(0.5)); // passou o atraso: já está esfriando
    const before = s.m.heat;
    s.m.takeHit(new THREE.Vector3(0, 3.2, -V.radius), 50);
    const hit = s.m.heat;
    expect(hit).toBeCloseTo(before + 50 * V.heatPerDamage, 3);
    s.tick(IDLE);
    expect(s.m.heat).toBeLessThan(hit);
  });

  it('QUENTE a partir de 70%; parado e esfriando, o HUD sabe', async () => {
    const s = await bench();
    s.heatUp(0.72);
    expect(s.m.heatState).toBe('hot');
    expect(s.m.coolingBoost).toBe(false); // acabou de atirar: ainda no atraso
    s.tick(IDLE, ticks(0.4));
    expect(s.m.coolingBoost).toBe(true);
  });

  it('superaquecido: armas travadas, sem pulo nem dash, metade da velocidade', async () => {
    const s = await bench();
    s.heatUp(1);
    expect(s.m.heatState).toBe('overheated');
    expect(s.m.canFirePrimary).toBe(false);
    expect(s.m.canFireSecondary).toBe(false);
    s.tick({ ...IDLE, dash: true });
    expect(s.speed()).toBeLessThan(1);
    s.tick({ ...IDLE, jump: true });
    expect(s.m.velocity.y).toBeLessThanOrEqual(0);
    s.tick(RUN, ticks(0.8));
    expect(s.m.overheated).toBe(true);
    expect(s.speed()).toBeCloseTo(V.moveSpeed * OVERHEAT_SPEED, 0);
  });

  it('para voltar do superaquecimento, parar compensa: ~2,4 s parado, mais andando', async () => {
    const recover = async (cmd: MechInput) => {
      const s = await bench();
      s.heatUp(1);
      let t = 0;
      while (s.m.overheated && t < 30) {
        s.tick(cmd);
        t += FIXED_DT;
      }
      return t;
    };
    const still = await recover(IDLE);
    const moving = await recover(RUN);
    expect(still).toBeGreaterThan(2);
    expect(still).toBeLessThan(3);
    expect(moving).toBeGreaterThan(still * 1.2);
  });

  it('a bancada da oficina bate com o Mech de verdade (correndo com o gatilho apertado)', async () => {
    const s = await bench();
    const timer = new FireTimer();
    const real: number[] = [];
    for (let i = 1; i <= ticks(6); i++) {
      s.tick(RUN);
      timer.fixedUpdate(FIXED_DT);
      if (timer.ready && s.m.canFirePrimary) {
        s.m.onFire();
        timer.shot(V.loadout.primary.fireInterval);
      }
      if (i % ticks(1) === 0) real.push(s.m.heat);
    }
    const lab = drill(V, { speed: 1, fire: [V.loadout.primary] }, 6, Infinity, 1).heat.slice(1);
    for (let k = 0; k < real.length; k++) expect(Math.abs(real[k]! - lab[k]!)).toBeLessThan(0.08);
  });
});

describe('oficina: administrar o calor é estratégia', () => {
  const P = V.loadout.primary;

  it('rajadas curtas, parando na pausa, nunca fervem e rendem mais dano que segurar o gatilho', () => {
    const burst = drill(V, { speed: 1, fire: [P], burst: { shots: 6, pause: 1.2 }, stopInPause: true }, 20);
    const held = drill(V, { speed: 1, fire: [P] }, 20);
    const heldStill = drill(V, { speed: 0, fire: [P] }, 20);
    expect(burst.overheatAt).toBeNull();
    expect(burst.damage).toBeGreaterThan(held.damage);
    expect(burst.damage).toBeGreaterThan(heldStill.damage);
  });

  it('as mesmas rajadas sem parar na pausa fervem: o que esfria é parar', () => {
    const moving = drill(V, { speed: 1, fire: [P], burst: { shots: 6, pause: 1.2 } }, 20);
    expect(moving.overheatAt).not.toBeNull();
  });

  it('manobrar sozinho (correr, dash, pulo) não ferve; manobrar atirando ferve mais rápido que atirar parado', () => {
    const maneuver = drill(V, { speed: 1, fire: [], dashEvery: 3, jumpEvery: 2 }, 20);
    expect(Math.max(...maneuver.heat)).toBeLessThan(0.5);
    const hot = drill(V, { speed: 1, fire: [P], dashEvery: 3, jumpEvery: 2 }, 20);
    const still = drill(V, { speed: 0, fire: [P] }, 20);
    expect(hot.overheatAt!).toBeLessThan(still.overheatAt!);
  });
});
