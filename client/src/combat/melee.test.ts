import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { Android } from '../entities/Android';
import { ANDROID_STATS, PILOT_ANDROID_STATS } from '../entities/chassis';
import type { MechInput } from '../entities/MechBase';
import { VECTOR09_STATS, Vector09 } from '../entities/Vector09';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { BotSystem } from './BotSystem';
import { CombatSystem } from './CombatSystem';
import { CrushRule, STEP_S } from './crush';
import { ProjectileSystem } from './ProjectileSystem';
import { Respawner } from './Respawner';
import { weapon } from './weapons';

const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false, damageInRadius: () => {} } as unknown as Destructibles;
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
/** Com yaw 0, a frente é -Z: moveZ 1 anda para -Z. */
const FORWARD: MechInput = { ...IDLE, moveZ: 1 };
const BACK: MechInput = { ...IDLE, moveZ: -1 };
const SAW = weapon('chainsaw');
const MAX = VECTOR09_STATS.maxModuleHealth;

/** Mech na origem olhando para -Z e um andróide rebelde a `gap` metros da frente dele (entre as cápsulas). */
async function duel(gap: number) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(200, 2, 200));
  const combat = new CombatSystem(destructibles, debris, particles);
  const mech = new Vector09();
  mech.spawn(physics, new THREE.Vector3(0, 0, 0));
  const android = new Android();
  android.spawn(physics, new THREE.Vector3(0, 0, -(VECTOR09_STATS.radius + ANDROID_STATS.radius + gap)));
  combat.register(mech);
  combat.register(android);
  const kills: string[] = [];
  combat.onMechKilled = (dead, _at, killer) => kills.push(`${dead === android ? 'andróide' : 'mech'} por ${killer === mech ? 'mech' : 'outro'}`);
  const crush = new CrushRule(combat);
  const tick = (cmd: MechInput) => {
    mech.fixedUpdate(cmd, FIXED_DT);
    android.fixedUpdate(IDLE, FIXED_DT);
    crush.tick(FIXED_DT);
    crush.check([mech], [android]);
    physics.step();
  };
  for (let i = 0; i < 10; i++) tick(IDLE); // assenta no chão
  const run = (cmd: MechInput, seconds: number) => {
    for (let t = 0; t < seconds; t += FIXED_DT) tick(cmd);
  };
  return { combat, mech, android, crush, run, kills };
}

describe('motosserra dos andróides', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('só corta encostado: a 5 m não tira nada; colado, tira a vida da arma', async () => {
    const far = await duel(5);
    far.combat.melee(far.android, far.mech, SAW);
    expect(far.mech.modules).toEqual(MAX);
    const near = await duel(0.3);
    near.combat.melee(near.android, near.mech, SAW);
    const lost = Object.values(MAX).reduce((a, b) => a + b, 0) - Object.values(near.mech.modules).reduce((a, b) => a + b, 0);
    expect(lost).toBe(SAW.damage);
  });

  it('a lâmina do andróide pega a perna do Mech (a altura dele)', async () => {
    const s = await duel(0.3);
    s.combat.melee(s.android, s.mech, SAW);
    expect(s.mech.modules.leftLeg + s.mech.modules.rightLeg).toBe(MAX.leftLeg + MAX.rightLeg - SAW.damage);
    expect(s.mech.modules.torso).toBe(MAX.torso);
  });

  it('a IA do andróide vem colada e serra a perna do jogador parado', async () => {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(400, 2, 400));
    const combat = new CombatSystem(destructibles, debris, particles);
    const player = new Vector09();
    player.spawn(physics, new THREE.Vector3(0, 0, 0));
    combat.register(player);
    const respawner = new Respawner([[0, 150]]);
    const bots = new BotSystem({
      scene: new THREE.Scene(),
      physics,
      combat,
      projectiles: new ProjectileSystem(new THREE.Scene(), physics, particles),
      particles,
      respawner,
      spawns: [],
      androidSpawns: [[0, -12]],
      waypoints: [[0, -12]],
    });
    bots.targets = [player];
    physics.step();
    for (let t = 0; t < 6; t += FIXED_DT) {
      player.fixedUpdate(IDLE, FIXED_DT);
      bots.fixedUpdate(FIXED_DT);
      physics.step();
    }
    // Quase tudo nas pernas (um corte no meio de um pulo ou dash pode pegar mais alto).
    const legsLost = MAX.leftLeg + MAX.rightLeg - player.modules.leftLeg - player.modules.rightLeg;
    const torsoLost = MAX.torso - player.modules.torso;
    expect(legsLost).toBeGreaterThan(0);
    expect(legsLost).toBeGreaterThanOrEqual(torsoLost * 3);
  });
});

describe('pisão: o Mech esmaga o andróide andando para cima dele', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('dois passos matam: metade do torso a cada passo, e o abate conta para quem pisou', async () => {
    const s = await duel(0.2);
    s.run(FORWARD, STEP_S * 0.5);
    expect(s.android.alive).toBe(true);
    expect(s.android.modules.torso).toBe(ANDROID_STATS.maxModuleHealth.torso / 2);
    s.run(FORWARD, STEP_S);
    expect(s.android.alive).toBe(false);
    expect(s.kills).toEqual(['andróide por mech']);
  });

  it('parado encostado, ou andando para longe, não esmaga', async () => {
    const still = await duel(0.2);
    still.run(IDLE, 1);
    expect(still.android.modules.torso).toBe(ANDROID_STATS.maxModuleHealth.torso);
    const away = await duel(0.2);
    away.run(BACK, 1);
    expect(away.android.modules.torso).toBe(ANDROID_STATS.maxModuleHealth.torso);
  });

  it('vale ao contrário: um Mech rebelde esmaga o andróide do jogador em 2 passos (mais vida, mesma regra)', async () => {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(200, 2, 200));
    const combat = new CombatSystem(destructibles, debris, particles);
    const rebel = new Vector09();
    rebel.spawn(physics, new THREE.Vector3(0, 0, 0));
    const pilot = new Android({ stats: PILOT_ANDROID_STATS, tool: 'pilot' });
    pilot.spawn(physics, new THREE.Vector3(0, 0, -(VECTOR09_STATS.radius + PILOT_ANDROID_STATS.radius + 0.2)));
    combat.register(rebel);
    combat.register(pilot);
    const crush = new CrushRule(combat);
    for (let t = 0; t < STEP_S * 1.5 + 0.2; t += FIXED_DT) {
      rebel.fixedUpdate(FORWARD, FIXED_DT);
      pilot.fixedUpdate(IDLE, FIXED_DT);
      crush.tick(FIXED_DT);
      crush.check([rebel], [pilot]);
      physics.step();
    }
    expect(PILOT_ANDROID_STATS.maxModuleHealth.torso).toBeGreaterThan(ANDROID_STATS.maxModuleHealth.torso * 2);
    expect(pilot.alive).toBe(false);
  });

  it('só o grande esmaga o pequeno: andróide não pisa em Mech, Mech não pisa em Mech', async () => {
    const s = await duel(0.2);
    const other = new Vector09();
    s.crush.check([s.android], [s.mech]);
    s.crush.check([s.mech], [other]);
    expect(s.mech.modules.torso).toBe(MAX.torso);
  });
});
