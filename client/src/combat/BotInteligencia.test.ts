import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MechBase, MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { BOT_SKILLS, type BotSkill, type BotState } from './BotController';
import { BotSystem, RADIO_RANGE } from './BotSystem';
import { CombatSystem } from './CombatSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { Respawner } from './Respawner';
import { wrapAngle, yawOf } from './steer';

const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false, damageInRadius: () => {} } as unknown as Destructibles;

interface Wall {
  /** Centro (x, y, z) e tamanho (x, y, z) da caixa. */
  at: [number, number, number];
  size: [number, number, number];
}

interface Field {
  /** Mechs rebeldes (x, z), na ordem: o primeiro é o CLAWD. */
  bots?: [number, number][];
  /** O Colossus (perfil de cerco). */
  boss?: [number, number];
  players: [number, number][];
  walls?: Wall[];
  waypoints?: [number, number][];
  maxAttackers?: number;
  skill?: BotSkill;
}

/**
 * Chão aberto, paredes opcionais, jogadores imortais (a vida volta a cada tick) e um `BotSystem` de verdade.
 * `inputs[i]` é o comando do jogador i; `face(i, yaw)` aponta o torso dele (o comando não gira o torso).
 */
async function field(o: Field) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(600, 2, 600));
  for (const w of o.walls ?? []) physics.addStaticBox(new THREE.Vector3(...w.at), new THREE.Vector3(...w.size));
  const combat = new CombatSystem(destructibles, debris, particles);
  const projectiles = new ProjectileSystem(new THREE.Scene(), physics, particles);
  projectiles.onHit = (hit, dir, dmg, owner) => combat.onProjectileHit(hit, dir, dmg, owner);
  const players = o.players.map(([x, z]) => {
    const m = new Vector09();
    m.spawn(physics, new THREE.Vector3(x, 0, z));
    combat.register(m);
    return m;
  });
  const respawner = new Respawner([[0, 300]]);
  const spawns = o.bots ?? [];
  const bots = new BotSystem({
    scene: new THREE.Scene(), physics, combat, projectiles, particles, respawner,
    spawns, bossSpawn: o.boss, waypoints: o.waypoints ?? (spawns.length ? spawns : [o.boss!]), seed: 5, skill: o.skill,
  });
  bots.targets = players;
  bots.maxAttackers = o.maxAttackers ?? Infinity;
  combat.onMechHit = (e) => {
    if (!players.includes(e.mech)) bots.onDamaged(e.mech, e.shooter);
  };
  const calls: { from: string; target: MechBase }[] = [];
  bots.onRadio = (from, target) => calls.push({ from, target });
  const inputs: MechInput[] = players.map(() => ({ moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false }));
  const yaws = players.map(() => 0);
  physics.step();
  const states = new Set<BotState>();
  const run = (seconds: number, each?: () => void) => {
    const n = Math.round(seconds / FIXED_DT);
    for (let i = 0; i < n; i++) {
      players.forEach((p, k) => {
        Object.assign(p.modules, p.stats.maxModuleHealth);
        p.applyFacing(yaws[k]!, 0);
        p.fixedUpdate(inputs[k]!, FIXED_DT);
      });
      bots.fixedUpdate(FIXED_DT);
      respawner.fixedUpdate(FIXED_DT);
      projectiles.fixedUpdate(FIXED_DT);
      physics.step();
      for (const m of bots.mechs) states.add(bots.brainOf(m)!.state);
      each?.();
    }
  };
  /** Direção de `m` vista de `from` (rad; 0 = +Z), a mesma convenção do cerco. */
  const bearing = (m: MechBase, from: MechBase) =>
    Math.atan2(m.simPosition.x - from.simPosition.x, m.simPosition.z - from.simPosition.z);
  const face = (k: number, yaw: number) => (yaws[k] = yaw);
  return { physics, players, bots, calls, inputs, states, run, bearing, face };
}

describe('inteligência dos bots (11/10)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('rádio do clã: quem vê avisa; o companheiro atrás da parede vem investigar; a tela recebe um aviso só', async () => {
    // A (0,0) vê o jogador a 40 m. B (60,0) tem uma parede entre ele e o jogador: sozinho, nunca saberia.
    const s = await field({
      bots: [[0, 0], [60, 0]],
      players: [[0, -40]],
      walls: [{ at: [40, 10, -25], size: [2, 20, 70] }],
      waypoints: [[100, 0], [100, 10]],
    });
    const [a, b] = s.bots.mechs;
    const brainB = s.bots.brainOf(b!)!;
    s.run(0.3);
    expect(brainB.state).toBe('patrol'); // A ainda não reagiu: nada no rádio
    expect(s.calls).toEqual([]);
    s.run(0.7);
    expect(brainB.seesTarget).toBe(false);
    expect(brainB.state).toBe('chase');
    expect(brainB.currentTarget).toBe(s.players[0]);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0]!.from).toBe(s.bots.nameOf(a!));
    expect(s.calls[0]!.target).toBe(s.players[0]);
    s.run(5);
    expect(s.calls).toHaveLength(1); // no máximo um aviso a cada 8 s por time
  });

  it('fora do alcance do rádio, o companheiro não fica sabendo', async () => {
    // B a ~103 m de A (mais que o alcance do rádio) e a 95 m do jogador (além da visão de 90 m).
    const s = await field({
      bots: [[0, 0], [95, -40]],
      players: [[0, -40]],
      waypoints: [[0, -20], [0, -25]],
    });
    expect(Math.hypot(95, -40)).toBeGreaterThan(RADIO_RANGE);
    const [a, b] = s.bots.mechs;
    s.run(1);
    expect(s.bots.brainOf(a!)!.seesTarget).toBe(true);
    expect(s.bots.brainOf(b!)!.state).toBe('patrol');
  });

  it('perdeu o alvo de vista: vai aonde ele deve estar (o caminho projetado), não aonde estava, e o acha', async () => {
    // O jogador corre para +X e some atrás de uma parede (x de 6 a 30, z de -34 a -26), depois para em x = 40.
    const s = await field({
      bots: [[0, 0]],
      players: [[0, -45]],
      walls: [{ at: [18, 10, -30], size: [24, 20, 8] }],
      waypoints: [[0, -10], [2, -10]],
    });
    const brain = s.bots.brainOf(s.bots.mechs[0]!)!;
    const player = s.players[0]!;
    s.inputs[0]!.moveX = 1;
    let saw = false;
    let lostAt: number | null = null;
    let goalAtLoss = 0;
    s.run(4, () => {
      if (brain.seesTarget) saw = true;
      else if (saw && lostAt === null) {
        lostAt = player.simPosition.x;
        goalAtLoss = brain.searchGoal.x;
      }
      if (player.simPosition.x > 40) s.inputs[0]!.moveX = 0;
    });
    expect(saw).toBe(true);
    expect(lostAt).not.toBeNull();
    // Vai ~1,2 s à frente de onde o perdeu (até 14 m), na direção em que o jogador corria.
    expect(goalAtLoss).toBeGreaterThan(lostAt! + 8);
    s.run(6);
    expect(brain.seesTarget).toBe(true);
  });

  it('sem achar no ponto projetado, vasculha em volta e só então volta a patrulhar', async () => {
    const s = await field({ bots: [[0, 0]], players: [[0, -40]], waypoints: [[0, -20], [3, -20]] });
    const brain = s.bots.brainOf(s.bots.mechs[0]!)!;
    s.run(1.5);
    expect(brain.seesTarget).toBe(true);
    s.players[0]!.respawn(new THREE.Vector3(0, 0, 300)); // some da arena (além da visão)
    const seen: BotState[] = [];
    s.run(12, () => {
      if (seen[seen.length - 1] !== brain.state) seen.push(brain.state);
    });
    const search = seen.indexOf('search');
    expect(search).toBeGreaterThan(-1);
    expect(seen.lastIndexOf('patrol')).toBeGreaterThan(search);
    expect(brain.currentTarget).toBe(null);
  });

  it('lê a mira: com o torso do jogador apontado para ele, troca de lado; de costas, não; o fácil e o Colossus não leem', async () => {
    const jukes = async (o: { skill?: BotSkill; aimed: boolean; boss?: boolean }) => {
      const route: [number, number][] = [[0, -10], [2, -10]];
      const s = await field(o.boss
        ? { boss: [0, 0], players: [[0, -30]], skill: o.skill, waypoints: route }
        : { bots: [[0, 0]], players: [[0, -30]], skill: o.skill, waypoints: route });
      const bot = s.bots.mechs[0]!;
      const player = s.players[0]!;
      s.run(8, () => {
        const p = player.simPosition;
        const m = bot.simPosition;
        s.face(0, o.aimed ? yawOf(m.x - p.x, m.z - p.z) : yawOf(p.x - m.x, p.z - m.z));
      });
      return s.bots.brainOf(bot)!.jukes;
    };
    expect(await jukes({ aimed: true })).toBeGreaterThan(0);
    expect(await jukes({ aimed: false })).toBe(0);
    expect(await jukes({ aimed: true, skill: BOT_SKILLS.facil })).toBe(0);
    expect(await jukes({ aimed: true, skill: BOT_SKILLS.dificil })).toBeGreaterThan(0);
    expect(await jukes({ aimed: true, boss: true, skill: BOT_SKILLS.dificil })).toBe(0);
  });

  it('revida em quem atira: com dois alvos à vista, troca para o que acabou de acertá-lo', async () => {
    const s = await field({ bots: [[0, 0]], players: [[0, -25], [20, -35]], waypoints: [[0, -10], [2, -10]] });
    const bot = s.bots.mechs[0]!;
    const brain = s.bots.brainOf(bot)!;
    s.run(1.5);
    expect(brain.currentTarget).toBe(s.players[0]); // o mais perto
    s.bots.onDamaged(bot, s.players[1]);
    s.run(0.3);
    expect(brain.currentTarget).toBe(s.players[1]);
  });

  it('cerco: quem espera a vez sai da frente do alvo e vai para os flancos, um de cada lado', async () => {
    // Os três chegam pela frente do jogador (ele olha para -Z, o sul); só um ataca por vez.
    const s = await field({ bots: [[0, -40], [6, -46], [-6, -46]], players: [[0, 0]], maxAttackers: 1 });
    const player = s.players[0]!;
    const front = Math.PI; // a frente do jogador (yaw 0), na convenção do cerco
    const offsets = () =>
      s.bots.mechs.filter((m) => !s.bots.brainOf(m)!.hasToken).map((m) => wrapAngle(s.bearing(m, player) - front));
    s.run(1);
    for (const off of offsets()) expect(Math.abs(off)).toBeLessThan(0.3); // ainda na frente dele
    s.run(5.5);
    const waiting = offsets();
    expect(waiting).toHaveLength(2);
    // Andando em volta (a ~53 m dele, uns 10° por segundo): em 6,5 s cada um já está a mais de 45° da frente do jogador,
    // e um de cada lado.
    for (const off of waiting) expect(Math.abs(off)).toBeGreaterThan(0.8);
    expect(Math.sign(waiting[0]!)).not.toBe(Math.sign(waiting[1]!));
  });

  it('é determinístico com rádio e cerco: mesmo cenário, mesmo trajeto', async () => {
    const trace = async () => {
      const s = await field({
        bots: [[0, -40], [6, -46], [-60, 10]],
        players: [[0, 0]],
        walls: [{ at: [-30, 10, 0], size: [2, 20, 40] }],
        maxAttackers: 1,
      });
      const path: number[] = [];
      s.run(5, () => {
        for (const m of s.bots.mechs) path.push(m.simPosition.x, m.simPosition.z);
      });
      return { path, calls: s.calls.map((c) => c.from) };
    };
    const a = await trace();
    const b = await trace();
    expect(b.path).toEqual(a.path);
    expect(b.calls).toEqual(a.calls);
  });
});
