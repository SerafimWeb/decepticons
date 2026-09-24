import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MechInput } from '../entities/MechBase';
import { VECTOR09_STATS, Vector09 } from '../entities/Vector09';
import { Arena, SPAWN_POINTS } from '../environment/Arena';
import type { DebrisSystem } from '../environment/DebrisSystem';
import { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { BOT_SKILL_NORMAL, type BotState } from './BotController';
import { BotSystem } from './BotSystem';
import { CombatSystem } from './CombatSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { Respawner } from './Respawner';

// Efeitos visuais não importam aqui (o ParticleSystem precisa de DOM).
const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false } as unknown as Destructibles;
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const totalHealth = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

interface Scenario {
  bot: [number, number];
  player: [number, number];
  /** Parede alta entre z = -29 e -31, de x = -20 a 20. */
  wall?: boolean;
  waypoints?: [number, number][];
  seed?: number;
}

async function scenario(o: Scenario) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(400, 2, 400));
  if (o.wall) physics.addStaticBox(new THREE.Vector3(0, 10, -30), new THREE.Vector3(40, 20, 2));
  const combat = new CombatSystem(destructibles, debris, particles);
  const projectiles = new ProjectileSystem(new THREE.Scene(), physics, particles);
  projectiles.onHit = (hit, dir, dmg, owner) => combat.onProjectileHit(hit, dir, dmg, owner);

  const player = new Vector09();
  player.spawn(physics, new THREE.Vector3(o.player[0], 0, o.player[1]));
  combat.register(player);

  const respawner = new Respawner([[0, 90]]);
  const bots = new BotSystem({
    scene: new THREE.Scene(),
    physics,
    combat,
    projectiles,
    particles,
    respawner,
    spawns: [o.bot],
    waypoints: o.waypoints ?? [
      [0, 80],
      [10, 80],
    ],
    seed: o.seed ?? 7,
  });
  bots.targets = [player];
  const bot = bots.mechs[0]!;
  const brain = bots.brainOf(bot)!;
  combat.onMechHit = (e) => {
    if (e.mech !== player) bots.onDamaged(e.mech, e.shooter);
  };

  const shots: number[] = [];
  const states = new Set<BotState>();
  let t = 0;
  const fire = projectiles.fire.bind(projectiles);
  projectiles.fire = (...args) => {
    shots.push(t);
    fire(...args);
  };
  physics.step();

  const run = (seconds: number, each?: () => void) => {
    const n = Math.round(seconds / FIXED_DT);
    for (let i = 0; i < n; i++) {
      player.fixedUpdate(IDLE, FIXED_DT);
      bots.fixedUpdate(FIXED_DT);
      respawner.fixedUpdate(FIXED_DT);
      projectiles.fixedUpdate(FIXED_DT);
      physics.step();
      t += FIXED_DT;
      states.add(brain.state);
      each?.();
    }
  };
  const distance = () => Math.hypot(bot.simPosition.x - player.simPosition.x, bot.simPosition.z - player.simPosition.z);
  return { physics, player, bot, bots, brain, shots, states, run, distance };
}

describe('bots (inimigos)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('vê o jogador à frente, espera o tempo de reação, persegue na direção certa e atira', async () => {
    // Bot na origem olhando para -Z (nasce olhando o centro); jogador 60 m à frente.
    const s = await scenario({ bot: [0, 0], player: [0, -60] });
    s.run(4);
    expect(s.shots.length).toBeGreaterThan(0);
    expect(s.shots[0]!).toBeGreaterThanOrEqual(BOT_SKILL_NORMAL.reactionS);
    expect(s.distance()).toBeLessThan(50); // chegou mais perto: andou para o lado certo
    expect(s.states.has('chase')).toBe(true);
  });

  it('não vê nem atira através de uma parede', async () => {
    const s = await scenario({ bot: [0, 0], player: [0, -60], wall: true });
    s.run(3);
    expect(s.shots).toEqual([]);
    expect(s.brain.state).toBe('patrol');
  });

  it('em patrulha não vê quem está longe e atrás dele', async () => {
    // Bot olha para -Z e patrulha para -Z; jogador 40 m atrás.
    const s = await scenario({ bot: [0, 0], player: [0, 40], waypoints: [[0, -60], [10, -60]] });
    s.run(2);
    expect(s.shots).toEqual([]);
    expect(s.brain.state).toBe('patrol');
  });

  it('levou tiro de quem não via: vira, encontra e revida', async () => {
    const s = await scenario({ bot: [0, 0], player: [0, 40], waypoints: [[0, -60], [10, -60]] });
    s.bots.onDamaged(s.bot, s.player);
    expect(s.brain.state).toBe('chase');
    s.run(3);
    expect(s.shots.length).toBeGreaterThan(0);
  });

  it('de perto ataca andando de lado e acerta o jogador', async () => {
    const s = await scenario({ bot: [0, 0], player: [0, -30] });
    let maxSide = 0;
    s.run(6, () => (maxSide = Math.max(maxSide, Math.abs(s.bot.simPosition.x))));
    expect(s.states.has('attack')).toBe(true);
    expect(maxSide).toBeGreaterThan(2);
    expect(totalHealth(s.player.modules)).toBeLessThan(totalHealth(VECTOR09_STATS.maxModuleHealth));
  });

  it('com o torso baixo recua', async () => {
    const s = await scenario({ bot: [0, 0], player: [0, -30] });
    s.bot.modules.torso = VECTOR09_STATS.maxModuleHealth.torso * 0.25;
    s.run(1.2);
    expect(s.states.has('retreat')).toBe(true);
    expect(s.distance()).toBeGreaterThan(32);
  });

  it('é determinístico: mesmo cenário e semente, mesmo trajeto e mesmos tiros', async () => {
    const trace = async () => {
      const s = await scenario({ bot: [0, 0], player: [0, -30], seed: 3 });
      const path: number[] = [];
      s.run(4, () => path.push(s.bot.simPosition.x, s.bot.simPosition.z));
      return { path, shots: s.shots, health: { ...s.player.modules } };
    };
    const a = await trace();
    const b = await trace();
    expect(b.path).toEqual(a.path);
    expect(b.shots).toEqual(a.shots);
    expect(b.health).toEqual(a.health);
  });
});

describe('arena', () => {
  it('todos os pontos de nascimento estão livres de prédios, barricadas e plataforma', async () => {
    await RAPIER.init();
    const physics = await PhysicsWorld.create();
    const scene = new THREE.Scene();
    new Arena(scene, physics, new Destructibles(scene, physics, debris, particles));
    physics.step();
    const { height, radius } = VECTOR09_STATS;
    const capsule = new RAPIER.Capsule(height / 2 - radius, radius);
    for (const [x, z] of SPAWN_POINTS) {
      let blocked = 0;
      physics.world.intersectionsWithShape({ x, y: height / 2 + 0.1, z }, { x: 0, y: 0, z: 0, w: 1 }, capsule, () => {
        blocked++;
        return true;
      });
      expect(blocked, `ponto (${x}, ${z})`).toBe(0);
    }
  });
});
