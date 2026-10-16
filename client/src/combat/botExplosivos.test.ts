import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type GameSettings } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { ESQUADRAO_VERSAO, type EsquadraoSpec } from '../sim/esquadrao';
import { Match } from '../sim/Match';
import { BOT_SKILLS, PERSONAS, volleyMinDistance, volleyPauseS, type BotController } from './BotController';
import { weapon } from './weapons';

/**
 * Os rebeldes lançam as armas explosivas (P160 parte 4; o Comandante, 16/10: "bote pra torar na iteração das armas"). O Vector-09 inimigo sai de
 * fábrica com o casulo de foguetes na mão esquerda e nunca o usava: o inimigo só atirava energia, e as explosões quase nunca vinham contra o jogador.
 */

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const UM_REBELDE: GameSettings = { ...DEFAULT_SETTINGS, enemyMechs: 1, enemyAndroids: 0, technician: false };

interface Lancamento {
  tick: number;
  dist: number;
  id: string;
}

/** Uma partida com um rebelde e o jogador parado; anota cada lançamento explosivo do rebelde (o tick, a distância ao jogador e a arma). */
async function partida(segundos: number, opcoes: { explosivos?: boolean; squad?: EsquadraoSpec } = {}) {
  const physics = await PhysicsWorld.create();
  const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, debris: false, foes: UM_REBELDE, allies: false, drones: false, ...opcoes });
  const jogador = new Vector09();
  match.addPlayer(jogador, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => jogador.fixedUpdate(IDLE, dt) });
  const rebelde = match.bots.mechs[0]!;
  const brain = (match.bots as unknown as { bots: Array<{ brain: BotController }> }).bots[0]!.brain;
  const lancados: Lancamento[] = [];
  let tick = 0;
  const anota = (owner: RAPIER.Collider | undefined, id: string): void => {
    if (owner?.handle !== rebelde.collider?.handle) return;
    lancados.push({ tick, dist: Math.hypot(rebelde.simPosition.x - jogador.simPosition.x, rebelde.simPosition.z - jogador.simPosition.z), id });
  };
  match.rockets.onFired = (_o, _d, owner, w) => anota(owner, w.id);
  match.grenades.onFired = (_o, _d, owner, w) => anota(owner, `granada:${w.id}`);
  let danoNoJogador = 0;
  match.onMechHit = (e) => { if (e.mech === jogador && e.kind !== 'melee') danoNoJogador += e.result.applied; };
  for (tick = 1; tick <= segundos * 60; tick++) match.step(FIXED_DT);
  physics.world.free();
  return { lancados, brain, danoNoJogador };
}

/** Separa os lançamentos em salvas (um intervalo maior que 1 s começa outra). */
function salvas(l: readonly Lancamento[]): Lancamento[][] {
  const out: Lancamento[][] = [];
  for (const x of l) {
    const ultima = out[out.length - 1];
    if (ultima && x.tick - ultima[ultima.length - 1]!.tick <= 60) ultima.push(x);
    else out.push([x]);
  }
  return out;
}

describe('a pausa e a distância da salva', () => {
  it('a fácil espera mais que a normal, que espera mais que a difícil; a personalidade agressiva encurta, a mansa alonga', () => {
    const s = PERSONAS.soldado;
    expect(volleyPauseS(BOT_SKILLS.normal, s)).toBeCloseTo(7, 6);
    expect(volleyPauseS(BOT_SKILLS.facil, s)).toBeGreaterThan(volleyPauseS(BOT_SKILLS.normal, s));
    expect(volleyPauseS(BOT_SKILLS.dificil, s)).toBeLessThan(volleyPauseS(BOT_SKILLS.normal, s));
    expect(volleyPauseS(BOT_SKILLS.normal, PERSONAS.brabo)).toBeLessThan(7);
    expect(volleyPauseS(BOT_SKILLS.normal, PERSONAS.manso)).toBeGreaterThan(7);
  });

  it('nunca perto o bastante para a explosão pegar o próprio bot', () => {
    for (const id of ['rockets', 'grenade', 'swarm', 'cruise', 'seeker'] as const) expect(volleyMinDistance(weapon(id))).toBeGreaterThan(weapon(id).blastRadius + 4);
  });
});

describe('o rebelde lança os foguetes da mão esquerda em salvas, com física de verdade', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('em 40 s: salvas de até dois foguetes, um a cada 0,3 s, a pausa da dificuldade entre elas, e nunca de perto', async () => {
    const { lancados, brain } = await partida(40);
    const s = salvas(lancados);
    expect(s.length).toBeGreaterThanOrEqual(2);
    for (const v of s) {
      expect(v.length).toBeLessThanOrEqual(2);
      for (let i = 1; i < v.length; i++) expect(v[i]!.tick - v[i - 1]!.tick).toBeGreaterThanOrEqual(Math.round(weapon('rockets').fireInterval * 60) - 1);
    }
    const pausa = volleyPauseS(brain.skill, brain.persona);
    for (let i = 1; i < s.length; i++) expect((s[i]![0]!.tick - s[i - 1]![s[i - 1]!.length - 1]!.tick) / 60).toBeGreaterThanOrEqual(pausa - 0.05);
    for (const x of lancados) {
      expect(x.id).toBe('rockets');
      expect(x.dist).toBeGreaterThanOrEqual(volleyMinDistance(weapon('rockets')) - 1);
    }
  });

  it('o mesmo jogo dá os mesmos lançamentos (sem sorteio fora da semente)', async () => {
    const a = await partida(20);
    const b = await partida(20);
    expect(a.lancados.map((x) => x.tick)).toEqual(b.lancados.map((x) => x.tick));
    expect(a.lancados.length).toBeGreaterThan(0);
  });

  it('colado no jogador (9 m, dentro da explosão) o rebelde não lança foguete nenhum: só de mais longe', async () => {
    const physics = await PhysicsWorld.create();
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, debris: false, foes: UM_REBELDE, allies: false, drones: false });
    const jogador = new Vector09();
    match.addPlayer(jogador, 'VOCÊ');
    match.pilots.push({ fixedUpdate: (dt) => jogador.fixedUpdate(IDLE, dt) });
    const rebelde = match.bots.mechs[0]!;
    let lancados = 0;
    match.rockets.onFired = (_o, _d, owner) => { if (owner?.handle === rebelde.collider?.handle) lancados++; };
    for (let tick = 1; tick <= 25 * 60; tick++) {
      // O rebelde volta a 9 m do jogador a cada tick (ele quer se afastar, e o teste o segura ali).
      rebelde.respawn(new THREE.Vector3(jogador.simPosition.x + 9, jogador.simPosition.y, jogador.simPosition.z));
      match.step(FIXED_DT);
    }
    physics.world.free();
    expect(volleyMinDistance(weapon('rockets'))).toBeGreaterThan(9);
    expect(lancados).toBe(0);
  });

  it('com os explosivos desligados (`explosivos: false`), o rebelde só atira energia', async () => {
    const { lancados } = await partida(30, { explosivos: false });
    expect(lancados).toEqual([]);
  });

  it('o esquadrão pode dar granadas ao rebelde: ele lança em arco (pelo sistema de granadas), não foguetes', async () => {
    const squad: EsquadraoSpec = { v: ESQUADRAO_VERSAO, inimigos: [{ papel: 'mech', secundaria: { id: 'grenade', tier: 0 } }], aliados: [] };
    const { lancados } = await partida(40, { squad });
    expect(lancados.length).toBeGreaterThan(0);
    expect(new Set(lancados.map((x) => x.id))).toEqual(new Set(['granada:grenade'])); // pelo sistema de granadas (o arco), nunca como foguete
  });
});
