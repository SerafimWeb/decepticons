import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Persona, sanitizeSettings } from '../core/Settings';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { MECH_PROFILE, PERSONAS } from './BotController';
import { BotSystem, type BotKit } from './BotSystem';
import { CombatSystem } from './CombatSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { Respawner } from './Respawner';

const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false, damageInRadius: () => {} } as unknown as Destructibles;
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };

/**
 * Arena aberta com o jogador parado no centro (imortal: a vida volta a cada tick) e Mechs rebeldes em
 * volta. `playerYaw`: para onde o jogador olha (π olha para +Z). Conta, a cada tick, quantos atiraram.
 */
async function arena(spawns: [number, number][], personas: Persona[], maxAttackers = Infinity, playerYaw = 0, kits?: BotKit[]) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(600, 2, 600));
  const combat = new CombatSystem(destructibles, debris, particles);
  const projectiles = new ProjectileSystem(new THREE.Scene(), physics, particles);
  projectiles.onHit = (hit, dir, dmg, owner) => combat.onProjectileHit(hit, dir, dmg, owner);
  const player = new Vector09();
  player.spawn(physics, new THREE.Vector3(0, 0, 0));
  player.applyFacing(playerYaw, 0);
  combat.register(player);
  const respawner = new Respawner([[0, 200]]);
  const bots = new BotSystem({ scene: new THREE.Scene(), physics, combat, projectiles, particles, respawner, spawns, waypoints: spawns, seed: 3, personas, kits });
  bots.targets = [player];
  bots.maxAttackers = maxAttackers;
  physics.step();
  const firedBy = new Map<unknown, number>();
  let maxConcurrent = 0;
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += FIXED_DT) {
      Object.assign(player.modules, player.stats.maxModuleHealth);
      player.fixedUpdate(IDLE, FIXED_DT);
      bots.fixedUpdate(FIXED_DT);
      projectiles.fixedUpdate(FIXED_DT);
      physics.step();
      let tokens = 0;
      for (const m of bots.mechs) {
        const brain = bots.brainOf(m)!;
        if (brain.hasToken && brain.wantsToken) tokens++;
        if (brain.wantsToFire) firedBy.set(m, (firedBy.get(m) ?? 0) + 1);
      }
      maxConcurrent = Math.max(maxConcurrent, tokens);
    }
  };
  const dist = (i: number) => Math.hypot(bots.mechs[i]!.simPosition.x, bots.mechs[i]!.simPosition.z);
  return { bots, player, run, firedBy, dist, get maxConcurrent() { return maxConcurrent; } };
}

describe('personalidades dos bots', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('cada uma muda o jeito de lutar: o brabo chega perto e aguenta mais; o manso fica longe e recua cedo', () => {
    const { brabo, manso, fujao, soldado } = PERSONAS;
    expect(brabo.rangeScale).toBeLessThan(soldado.rangeScale);
    expect(manso.rangeScale).toBeGreaterThan(soldado.rangeScale);
    expect(brabo.retreatAt).toBeLessThan(soldado.retreatAt);
    expect(manso.retreatAt).toBeGreaterThan(soldado.retreatAt);
    expect(brabo.aggression).toBeGreaterThan(manso.aggression);
    expect(fujao.ambush).toBe(true);
    expect(brabo.priority).toBeGreaterThan(manso.priority);
  });

  it('em combate, o brabo luta bem mais perto que o manso', async () => {
    const brabo = await arena([[0, -70]], ['brabo']);
    const manso = await arena([[0, -70]], ['manso']);
    brabo.run(5);
    manso.run(5);
    expect(brabo.dist(0)).toBeLessThan(MECH_PROFILE.attackRange);
    expect(manso.dist(0)).toBeGreaterThan(brabo.dist(0) + 15);
  });

  it('fujão: com o jogador olhando para ele, espreita sem atirar; de costas, ataca', async () => {
    // Jogador na origem olhando para -Z, onde o fujão está: sem brecha.
    const s = await arena([[0, -60]], ['fujao'], Infinity, 0);
    s.run(3);
    expect(s.bots.brainOf(s.bots.mechs[0]!)!.state).toBe('stalk');
    expect(s.firedBy.get(s.bots.mechs[0]) ?? 0).toBe(0);
    // O jogador vira de costas (olha para +Z): brecha.
    s.player.applyFacing(Math.PI, 0);
    s.run(3);
    expect(s.firedBy.get(s.bots.mechs[0]) ?? 0).toBeGreaterThan(0);
  });
});

describe('diretor de ataque: não caem todos em cima', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  const ring: [number, number][] = [
    [0, -40],
    [35, 20],
    [-35, 20],
  ];

  it('com vaga para 1, só um Mech ataca por vez; sem limite, os três atacam juntos', async () => {
    const one = await arena(ring, ['soldado', 'soldado', 'soldado'], 1);
    one.run(6);
    expect(one.maxConcurrent).toBe(1);
    const free = await arena(ring, ['soldado', 'soldado', 'soldado'], Infinity);
    free.run(6);
    expect(free.maxConcurrent).toBe(3);
  });

  it('quem espera fica mais longe e não atira; a vez passa: em 20 s os três atiram', async () => {
    const s = await arena(ring, ['soldado', 'soldado', 'soldado'], 1);
    s.run(20);
    expect(s.firedBy.size).toBe(3);
  });

  it('pedindo a vaga ao mesmo tempo, ela vai primeiro para o brabo (quem já tem, termina o turno)', async () => {
    // Os dois dentro do raio em que "ouvem" o jogador (14 m), à mesma distância: reagem e pedem a vaga no mesmo tick.
    const s = await arena(
      [
        [0, -10],
        [0, 10],
      ],
      ['manso', 'brabo'],
      1,
    );
    s.run(3);
    const [manso, brabo] = s.bots.mechs;
    expect(s.firedBy.get(brabo) ?? 0).toBeGreaterThan(0);
    expect(s.firedBy.get(manso) ?? 0).toBe(0);
  });
});

describe('tática de esquadrão (P119): a retaguarda segura o setor em vez de rushar', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  const linha: [number, number][] = [
    [0, -20], // escopeta (assalto), perto do jogador
    [0, -70], // trilho (apoio), longe
    [20, -20], // escopeta (assalto)
  ];
  const kits: BotKit[] = [
    { arma: { id: 'shotgun', tier: 0 } },
    { arma: { id: 'railgun', tier: 0 } },
    { arma: { id: 'shotgun', tier: 0 } },
  ];

  it('o de arma de linha fica de guarda e não chega perto; os de perto entram', async () => {
    const s = await arena(linha, ['soldado', 'soldado', 'soldado'], 2, 0, kits);
    s.run(8);
    expect(s.bots.brainOf(s.bots.mechs[1]!)!.rearguard).toBe(true);
    expect(s.dist(1)).toBeGreaterThan(45); // segura o setor de nascimento
    expect(s.dist(0)).toBeLessThan(45); // entra
    expect(s.dist(2)).toBeLessThan(45); // entra
  });

  it('sem arma de linha no esquadrão, ninguém fica de guarda (o jogo de sempre não muda)', async () => {
    const s = await arena(linha, ['soldado', 'soldado', 'soldado'], 2);
    s.run(2);
    for (const m of s.bots.mechs) expect(s.bots.brainOf(m)!.rearguard).toBe(false);
  });
});

describe('configurações dos inimigos (contrato da tela)', () => {
  it('padrão: 3 Mechs (brabo, soldado, fujão), 2 andróides, técnico e 2 atacando juntos', () => {
    expect(DEFAULT_SETTINGS.enemyMechs).toBe(3);
    expect(DEFAULT_SETTINGS.enemyAndroids).toBe(2);
    expect(DEFAULT_SETTINGS.technician).toBe(true);
    expect(DEFAULT_SETTINGS.enemyPersonas).toEqual(['brabo', 'soldado', 'fujao']);
    expect(DEFAULT_SETTINGS.maxAttackers).toBe(2);
  });

  it('dado de fora é limitado campo a campo', () => {
    const s = sanitizeSettings({ enemyMechs: 9, enemyAndroids: -2, technician: 'sim', enemyPersonas: ['manso', 'hacker'], maxAttackers: 1.3 });
    expect(s.enemyMechs).toBe(3);
    expect(s.enemyAndroids).toBe(0);
    expect(s.technician).toBe(true);
    expect(s.enemyPersonas).toEqual(['manso', 'soldado', 'fujao']);
    expect(s.maxAttackers).toBe(1.5);
  });
});
