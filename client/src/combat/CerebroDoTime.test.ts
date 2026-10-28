import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { BOT_SKILLS } from './BotController';
import { BotSystem } from './BotSystem';
import type { Fala } from './CerebroDoTime';
import { CombatSystem } from './CombatSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { Respawner } from './Respawner';

const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false, damageInRadius: () => {} } as unknown as Destructibles;
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };

interface Opcoes {
  spawns: [number, number][];
  dificuldade?: keyof typeof BOT_SKILLS;
  maxAttackers?: number;
  /** Onde o jogador (parado e imortal) fica; olha para -Z (yaw 0). */
  jogador?: [number, number];
}

/** Arena aberta (chão de 1200 m) com o jogador parado e imortal e os Mechs rebeldes nos pontos dados. Cada tick chama `aCada`. */
async function arena(o: Opcoes) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(600, 2, 600));
  const combat = new CombatSystem(destructibles, debris, particles);
  const projectiles = new ProjectileSystem(new THREE.Scene(), physics, particles);
  projectiles.onHit = (hit, dir, dmg, owner) => combat.onProjectileHit(hit, dir, dmg, owner);
  const player = new Vector09();
  const [px, pz] = o.jogador ?? [0, 0];
  player.spawn(physics, new THREE.Vector3(px, 0, pz));
  player.applyFacing(0, 0);
  combat.register(player);
  const respawner = new Respawner([[0, 200]]);
  const bots = new BotSystem({
    scene: new THREE.Scene(), physics, combat, projectiles, particles, respawner,
    spawns: o.spawns, waypoints: o.spawns, seed: 3, skill: BOT_SKILLS[o.dificuldade ?? 'normal'],
  });
  bots.targets = [player];
  bots.maxAttackers = o.maxAttackers ?? Infinity;
  physics.step();
  const falas: { de: string; fala: Fala }[] = [];
  bots.cerebro.onFala = (de, fala) => falas.push({ de, fala });
  const fogo = bots.mechs.map(() => 0);
  const planos: string[] = [];
  let vagasNoGolpe = 0;
  let vagasForaDoGolpe = 0;
  /** Há quanto tempo o golpe acabou: o diretor recalcula as vagas a cada 0,2 s, então logo depois do sinal ainda sobra uma por um ciclo. */
  let semGolpeHa = Infinity;
  const run = (seconds: number, aCada?: () => void) => {
    for (let t = 0; t < seconds; t += FIXED_DT) {
      Object.assign(player.modules, player.stats.maxModuleHealth);
      player.fixedUpdate(IDLE, FIXED_DT);
      bots.fixedUpdate(FIXED_DT);
      projectiles.fixedUpdate(FIXED_DT);
      physics.step();
      let vagas = 0;
      bots.mechs.forEach((m, i) => {
        const brain = bots.brainOf(m)!;
        if (brain.hasToken && brain.wantsToken) vagas++;
        if (brain.wantsToFire) fogo[i]!++;
      });
      if (bots.cerebro.plano === 'golpe') {
        vagasNoGolpe = Math.max(vagasNoGolpe, vagas);
        semGolpeHa = 0;
      } else {
        semGolpeHa += FIXED_DT;
        if (semGolpeHa > 0.5) vagasForaDoGolpe = Math.max(vagasForaDoGolpe, vagas);
      }
      if (planos[planos.length - 1] !== bots.cerebro.plano) planos.push(bots.cerebro.plano);
      aCada?.();
    }
  };
  const brain = (i: number) => bots.brainOf(bots.mechs[i]!)!;
  return { bots, player, run, falas, fogo, planos, brain, get vagasNoGolpe() { return vagasNoGolpe; }, get vagasForaDoGolpe() { return vagasForaDoGolpe; } };
}

/** O cenário da pinça: o jogador olha para -Z; o Mech 0 está na frente dele (o fixador, o mais perto) e o Mech 1 já a ~100° da frente (o flanqueador, quase em posição). */
const PINCA: Opcoes = { spawns: [[0, -30], [-38, 5]], maxAttackers: 1 };

describe('cérebro do time: pinça', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('dois bots no mesmo alvo: um fixa de frente, o outro vai ao flanco sem atirar, e o sinal solta os dois juntos', async () => {
    const s = await arena(PINCA);
    let flanqueador = -1;
    let fogoDoFlancoAntesDoSinal = 0;
    s.run(14, () => {
      if (s.bots.cerebro.plano === 'montando') {
        flanqueador = s.brain(0).tarefa === 'flanco' ? 0 : 1;
        if (s.brain(flanqueador).wantsToFire) fogoDoFlancoAntesDoSinal++;
      }
    });
    expect(s.planos).toContain('montando');
    expect(s.planos).toContain('golpe');
    expect(flanqueador).toBeGreaterThanOrEqual(0);
    // Segurou o fogo na montagem, e depois do sinal os dois atiraram.
    expect(fogoDoFlancoAntesDoSinal).toBe(0);
    expect(s.fogo[0]).toBeGreaterThan(0);
    expect(s.fogo[1]).toBeGreaterThan(0);
    // O rádio anunciou a pinça e deu o sinal, nesta ordem.
    const tipos = s.falas.map((f) => f.fala);
    expect(tipos[0]).toBe('pinca');
    expect(tipos).toContain('vai');
    expect(tipos.indexOf('vai')).toBeGreaterThan(tipos.indexOf('pinca'));
  });

  it('o golpe abre uma vaga a mais só enquanto dura; fora dele o teto do diretor manda (1 atacante)', async () => {
    const s = await arena(PINCA);
    s.run(14);
    expect(s.vagasNoGolpe).toBe(2);
    expect(s.vagasForaDoGolpe).toBeLessThanOrEqual(1);
  });

  it('o flanqueador fica no flanco: a ~100° da frente do alvo (para onde o torso dele aponta), do lado oposto ao do fixador', async () => {
    const s = await arena(PINCA);
    s.run(1.2);
    expect(s.bots.cerebro.plano).toBe('montando');
    const f = s.brain(0).tarefa === 'flanco' ? s.brain(0) : s.brain(1);
    // O alvo olha para -Z: a frente dele é a direção π (0 = +Z); o flanco é π ± 1,75.
    const desvio = Math.abs(Math.atan2(Math.sin(f.tarefaBearing - Math.PI), Math.cos(f.tarefaBearing - Math.PI)));
    expect(desvio).toBeCloseTo(1.75, 5);
    expect(f.segurarFogo).toBe(true);
  });

  it('acabado o golpe, todos largam a tarefa e a pinça esfria: não repete na hora', async () => {
    const s = await arena(PINCA);
    s.run(14);
    expect(s.brain(0).tarefa).toBe('nenhuma');
    expect(s.brain(1).tarefa).toBe('nenhuma');
    expect(s.brain(0).segurarFogo || s.brain(1).segurarFogo).toBe(false);
    expect(s.planos.filter((p) => p === 'montando').length).toBe(1);
  });

  it('na dificuldade fácil o time não faz pinça (a coordenação escala com a dificuldade, não só a mira)', async () => {
    const s = await arena({ ...PINCA, dificuldade: 'facil' });
    s.run(10);
    expect(s.planos).toEqual(['livre']);
    expect(s.falas).toEqual([]);
  });

  it('com o interruptor desligado o time luta como antes, e desligar no meio da pinça solta a tarefa', async () => {
    const desligado = await arena(PINCA);
    desligado.bots.coordenar = false;
    desligado.run(10);
    expect(desligado.planos).toEqual(['livre']);

    const s = await arena(PINCA);
    s.run(1.2);
    expect(s.bots.cerebro.plano).toBe('montando');
    s.bots.coordenar = false;
    s.run(1);
    expect(s.bots.cerebro.plano).toBe('livre');
    expect(s.brain(0).tarefa).toBe('nenhuma');
    expect(s.brain(1).tarefa).toBe('nenhuma');
    expect(s.brain(0).segurarFogo || s.brain(1).segurarFogo).toBe(false);
  });

  it('se o flanqueador morre na montagem, a pinça se desfaz e ninguém fica preso na tarefa', async () => {
    const s = await arena(PINCA);
    s.run(1.2);
    expect(s.bots.cerebro.plano).toBe('montando');
    const f = s.brain(0).tarefa === 'flanco' ? 0 : 1;
    s.bots.mechs[f]!.modules.torso = 0;
    s.run(1.5);
    expect(s.bots.cerebro.plano).toBe('livre');
    expect(s.brain(f).tarefa).toBe('nenhuma');
  });

  it('é determinístico: a mesma cena duas vezes dá os mesmos planos, as mesmas falas e o mesmo fogo', async () => {
    const a = await arena(PINCA);
    const b = await arena(PINCA);
    a.run(14);
    b.run(14);
    expect(b.planos).toEqual(a.planos);
    expect(b.falas).toEqual(a.falas);
    expect(b.fogo).toEqual(a.fogo);
    expect(b.bots.mechs.map((m) => m.simPosition.x)).toEqual(a.bots.mechs.map((m) => m.simPosition.x));
  });
});

describe('cérebro do time: reagrupar', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  // Três bots espalhados em patrulha, longe do jogador (a 300 m: fora da visão de 90 m).
  const ESPALHADOS: Opcoes = { spawns: [[-70, -60], [70, -60], [0, 60]], jogador: [250, 250] };

  const espalhamento = (s: Awaited<ReturnType<typeof arena>>): number => {
    let maior = 0;
    for (const a of s.bots.mechs) for (const b of s.bots.mechs) maior = Math.max(maior, Math.hypot(a.simPosition.x - b.simPosition.x, a.simPosition.z - b.simPosition.z));
    return maior;
  };

  it('time espalhado e sem combate se junta em volta do mais central, e o rádio avisa', async () => {
    const s = await arena(ESPALHADOS);
    const antes = espalhamento(s);
    s.run(12);
    expect(s.planos).toContain('reagrupando');
    expect(s.falas.some((f) => f.fala === 'reagrupar')).toBe(true);
    expect(espalhamento(s)).toBeLessThan(antes * 0.7);
  });

  it('acabado o reagrupamento todos largam a tarefa (e há uma pausa antes do próximo)', async () => {
    const s = await arena(ESPALHADOS);
    s.run(20);
    for (let i = 0; i < 3; i++) expect(s.brain(i).tarefa).toBe('nenhuma');
    expect(s.planos.filter((p) => p === 'reagrupando').length).toBe(1);
  });

  it('com o jogador à vista não reagrupa: quem luta não espera ninguém', async () => {
    const s = await arena({ spawns: [[-70, -60], [70, -60], [0, 60]], jogador: [0, 0] });
    s.run(6);
    expect(s.planos).not.toContain('reagrupando');
  });
});
