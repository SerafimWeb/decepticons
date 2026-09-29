import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { COLOSSUS_BOSS_STATS, VECTOR09_STATS } from '../entities/chassis';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { Arena, SPAWN_POINTS } from '../environment/Arena';
import type { DebrisSystem } from '../environment/DebrisSystem';
import { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { ANDROID_SPAWNS, BOT_SPAWNS, COLOSSUS_SPAWN } from '../sim/Match';
import { BotSystem } from './BotSystem';
import { CombatSystem } from './CombatSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { Respawner } from './Respawner';

// Efeitos visuais não importam aqui (o ParticleSystem precisa de DOM).
const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false } as unknown as Destructibles;

/** Só a arena, para medir se o ponto de nascimento cabe uma cápsula grande. */
async function arena(): Promise<{ physics: PhysicsWorld }> {
  const physics = await PhysicsWorld.create();
  const scene = new THREE.Scene();
  new Arena(scene, physics, new Destructibles(scene, physics, debris, particles));
  return { physics };
}

/** O pool de bots da missão, com o Colossus no ponto dedicado. */
async function pool(): Promise<BotSystem> {
  const { physics } = await arena();
  const scene = new THREE.Scene();
  const combat = new CombatSystem(destructibles, debris, particles);
  const projectiles = new ProjectileSystem(scene, physics, particles);
  const bots = new BotSystem({
    scene,
    physics,
    combat,
    projectiles,
    particles,
    respawner: new Respawner(SPAWN_POINTS),
    spawns: BOT_SPAWNS,
    androidSpawns: ANDROID_SPAWNS,
    bossSpawn: COLOSSUS_SPAWN[0],
    waypoints: SPAWN_POINTS,
  });
  bots.setRoster(0, 0);
  return bots;
}

describe('Colossus-01 (escala 3) no pool de bots', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('é uma máquina de 14 m: lenta, sem pulo nem dash, e com as pernas mais frágeis que o torso', () => {
    const s = COLOSSUS_BOSS_STATS;
    expect(s.height).toBe(14);
    // A cápsula do Rapier é `capsule(height / 2 - radius, radius)`: raio maior que a metade estoura.
    expect(s.radius * 2).toBeLessThan(s.height);
    expect(s.moveSpeed).toBeLessThan(VECTOR09_STATS.moveSpeed);
    expect(s.maxJumps).toBe(0);
    expect(s.dashSpeed).toBe(0);
    // O caminho para derrubá-lo é a perna, não o torso — é o que a ficha promete ("flanco e giro lentos").
    expect(s.maxModuleHealth.leftLeg).toBeLessThan(s.maxModuleHealth.torso);
    expect(s.maxModuleHealth.rightLeg).toBeLessThan(s.maxModuleHealth.torso);
    // Consequência assumida da regra do pisão: com o dobro da altura de um Vector-09, o Colossus esmaga um
    // Mech parado em dois passos (a mesma regra do jogador sobre o andróide). Não se fica na frente dele.
    expect(s.height).toBeGreaterThanOrEqual(VECTOR09_STATS.height * 2);
  });

  it('nasce uma vez, com nome próprio, e só entra na onda que pede o boss', async () => {
    const bots = await pool();
    const boss = bots.mechs[bots.mechs.length - 1]!;
    expect(bots.nameOf(boss)).toBe('COLOSSUS-01');
    expect(boss.stats.height).toBe(14);
    expect(boss.alive).toBe(false); // o pool existe desde o início; a unidade é que não está em jogo

    expect(bots.setRoster(0, 0, 0)).toBe(0);
    expect(bots.setRoster(0, 2, 1)).toBe(3); // dois andróides de escolta e o Colossus
    expect(boss.alive).toBe(true);

    expect(bots.setRoster(3, 0, 0)).toBe(3); // onda sem boss: os rebeldes entram, ele sai
    expect(boss.alive).toBe(false);
  });

  it('o ponto de nascimento cabe a cápsula de 14 m (raio de 3,6 m), sem encostar em prédio ou barricada', async () => {
    const { physics } = await arena();
    physics.step();
    const { height, radius } = COLOSSUS_BOSS_STATS;
    const capsule = new RAPIER.Capsule(height / 2 - radius, radius);
    const [x, z] = COLOSSUS_SPAWN[0];
    let blocked = 0;
    physics.world.intersectionsWithShape({ x, y: height / 2 + 0.1, z }, { x: 0, y: 0, z: 0, w: 1 }, capsule, () => {
      blocked++;
      return true;
    });
    expect(blocked, `ponto (${x}, ${z})`).toBe(0);
  });
});

/**
 * Duelo medido (não estimado): o que o dono pediu em 29/09 — *"ele não pode ser absurdamente forte (tipo um
 * tiro matar o Mech), pra que possamos ter combates épicos e com inteligência, conseguirmos superar eles"*.
 * Aqui a IA de verdade atira (erro de mira, tempo de reação, rajadas e pausa para esfriar), o tiro viaja e
 * colide: nada de conta no papel.
 */
describe('Colossus-01: o duelo é justo', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('um piloto parado no aberto aguenta vários segundos — e leva dano (o duelo aconteceu)', async () => {
    const { physics } = await arena();
    const scene = new THREE.Scene();
    const combat = new CombatSystem(destructibles, debris, particles);
    const projectiles = new ProjectileSystem(scene, physics, particles);
    projectiles.onHit = (hit, dir, dmg, owner) => combat.onProjectileHit(hit, dir, dmg, owner);
    const player = new Vector09();
    player.spawn(physics, new THREE.Vector3(SPAWN_POINTS[0]![0], 0, SPAWN_POINTS[0]![1]));
    combat.register(player);
    const bots = new BotSystem({
      scene,
      physics,
      combat,
      projectiles,
      particles,
      respawner: new Respawner(SPAWN_POINTS),
      spawns: [],
      androidSpawns: [],
      bossSpawn: COLOSSUS_SPAWN[0],
      waypoints: SPAWN_POINTS,
    });
    bots.targets = [player];
    bots.setRoster(0, 0, 1);
    physics.step();

    // Pior caso possível: o piloto não anda, não atira e não usa cobertura — só aguenta o tranco.
    const idle: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
    const limit = Math.round(20 / FIXED_DT);
    let survived = 0;
    for (let i = 0; i < limit && player.alive; i++) {
      player.fixedUpdate(idle, FIXED_DT);
      bots.fixedUpdate(FIXED_DT);
      projectiles.fixedUpdate(FIXED_DT);
      physics.step();
      survived += FIXED_DT;
    }

    // Levou dano: o Colossus atirou de verdade (senão este teste passaria com ele quebrado).
    expect(player.modules.torso).toBeLessThan(VECTOR09_STATS.maxModuleHealth.torso);
    // Meta de equilíbrio, **medida**: parado no aberto, sem reagir, o piloto aguentou os 20 s inteiros do
    // teste (o `aimErrorScale` 1.8 e as pausas para esfriar fazem o Colossus pressionar sem ser injusto).
    // A meta fica em 15 s para travar a faixa: nem saco de pancadas para o jogador, nem execução.
    expect(survived).toBeGreaterThanOrEqual(15);
  });
});
