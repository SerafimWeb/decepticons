import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { MOBILIDADE_RASTEJANDO, type MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { PONTOS_DOS_CABOS } from './CabosDeDados';
import { faseDoChefe } from './FasesDoChefe';
import { Match } from './Match';
import { NUCLEO } from './NucleoDaEstacao';
import { PORTAS_DA_ESTACAO } from './PortasDaEstacao';
import { WAVE_BRIEFING_S } from './SurvivalWaves';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

/** A missão em ondas da praia, na onda `startWave` (a 6 é a do Colossus), sem dano no jogador. */
async function partida(startWave = 6, bossMask?: boolean) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({
    physics,
    scene: new THREE.Scene(),
    map: 'praia',
    mode: 'survival',
    damage: false,
    startWave,
    ...(bossMask === undefined ? {} : { bossMask }),
    particles: NO_FX,
    foes: DEFAULT_SETTINGS,
    debris: false,
    allies: false,
  });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  const entrada = { ...IDLE };
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(entrada, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  // Com o jogador longe, os rebeldes zeram a rede da estação em ~48 s e a missão acaba: aqui o foco é o chefe, então a rede é refeita a cada segundo.
  const runComRedeCheia = (s: number): void => {
    for (let i = 0; i < Math.round(s); i++) {
      match.nucleo!.vida = NUCLEO.vidaMax;
      run(1);
    }
  };
  return { match, player, run, runComRedeCheia };
}

/** O jogador longe e fora do alcance do chefe (46 m): perto e à vista, o chefe o enfrenta em vez de ficar no cabo (o que é o certo, e outro teste). */
const LONGE = new THREE.Vector3(120, 0, 28);
const noPonto = (i: number, dx = 0, dz = 0) => new THREE.Vector3(PONTOS_DOS_CABOS[i]!.x + dx, 0, PONTOS_DOS_CABOS[i]!.z + dz);

describe('o chefe da missão, o Colossus (P165, parte D): vai aos cabos, tem fases e usa a máscara', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('só a onda 6 traz o chefe; ele rasteja (crawls) e veste a máscara, e o ?mascara=0 a tira', async () => {
    const antes = await partida(1);
    antes.run(WAVE_BRIEFING_S + 0.3);
    expect(antes.match.bots.chefe, 'a onda 1 não traz o chefe').toBeNull();

    const { match, run } = await partida(6);
    run(WAVE_BRIEFING_S + 0.3);
    const chefe = match.bots.chefe!;
    expect(chefe).not.toBeNull();
    expect(chefe.stats.name).toBe('COLOSSUS-01');
    expect(chefe.crawls).toBe(true);
    expect(chefe.root.getObjectByName('mascara-do-chefe'), 'a máscara').toBeDefined();

    const sem = await partida(6, false);
    sem.run(WAVE_BRIEFING_S + 0.3);
    expect(sem.match.bots.chefe).not.toBeNull();
    expect(sem.match.bots.chefe!.root.getObjectByName('mascara-do-chefe'), 'sem a máscara').toBeUndefined();
  });

  it('o chefe vai ao cabo e o corta (peso 4: ~17 s), e segue para o próximo cabo que ainda não caiu', async () => {
    const { match, player, runComRedeCheia } = await partida(6);
    runComRedeCheia(WAVE_BRIEFING_S + 1);
    player.respawn(LONGE);
    const chefe = match.bots.chefe!;
    chefe.respawn(noPonto(0, 0, -3)); // perto do ponto do cabo 1 (o de x menor)
    runComRedeCheia(25);
    const p = chefe.simPosition;
    expect(match.cabos!.estado(0), `o primeiro cabo cortado (vida ${match.cabos!.vida.map((v) => v.toFixed(0))}; chefe em ${p.x.toFixed(1)},${p.z.toFixed(1)}, vivo ${chefe.alive}, onda ${match.waves?.phase})`).toBe('cortado');
    // o próximo alvo é o cabo mais perto que ainda não caiu: o titã anda os 6 m até ele e o corta também
    runComRedeCheia(45);
    expect(match.cabos!.estado(1), 'o segundo cabo').toBe('cortado');
    expect(chefe.simPosition.x).toBeGreaterThan(PONTOS_DOS_CABOS[0]!.x + 2);
  });

  it('derrubar as pernas muda a fase (anda, manca, rasteja) e o chefe que rasteja ainda anda, devagar, em direção ao cabo', async () => {
    const { match, player, run } = await partida(6);
    run(WAVE_BRIEFING_S + 0.3);
    player.respawn(LONGE);
    const chefe = match.bots.chefe!;
    chefe.respawn(new THREE.Vector3(205, 0, 28)); // a oeste do portão da avenida, a ~50 m do cabo mais perto
    expect(faseDoChefe(chefe.modules)).toBe('anda');
    chefe.damagePart('leftLeg', 1e6);
    expect(faseDoChefe(chefe.modules)).toBe('manca');
    expect(chefe.mobility).toBe(0.5);
    chefe.damagePart('rightLeg', 1e6);
    expect(faseDoChefe(chefe.modules)).toBe('rasteja');
    expect(chefe.mobility).toBe(MOBILIDADE_RASTEJANDO);
    expect(chefe.alive).toBe(true);
    const antes = chefe.simPosition.clone();
    for (let s = 0; s < 8; s++) {
      match.nucleo!.vida = NUCLEO.vidaMax;
      run(1);
    }
    const andou = chefe.simPosition.distanceTo(antes);
    expect(andou, 'rasteja: se mexeu').toBeGreaterThan(4);
    expect(andou, 'e devagar: a 30% de 5 m/s são ~12 m em 8 s').toBeLessThan(16);
  });

  it('o tronco zerado derruba o chefe: a fase é "caído" e ele sai de campo', async () => {
    const { match, run } = await partida(6);
    run(WAVE_BRIEFING_S + 0.3);
    const chefe = match.bots.chefe!;
    chefe.damagePart('torso', 1e6);
    expect(faseDoChefe(chefe.modules)).toBe('caido');
    expect(chefe.alive).toBe(false);
    expect(match.bots.chefe).toBeNull();
  });

  it('com os três cabos cortados o chefe muda de alvo: vai à porta principal do prédio', async () => {
    const { match, player, run } = await partida(6);
    run(WAVE_BRIEFING_S + 0.3);
    player.respawn(LONGE);
    match.cabos!.fixedUpdate(100, [0, 0, 0], [10, 10, 10], [0, 0, 0]); // os três cortados
    const chefe = match.bots.chefe!;
    chefe.respawn(new THREE.Vector3(262, 0, 28));
    const porta = PORTAS_DA_ESTACAO[0]!;
    const distancia = (): number => Math.hypot(chefe.simPosition.x - porta.x, chefe.simPosition.z - porta.z);
    const antes = distancia();
    for (let s = 0; s < 8; s++) {
      match.nucleo!.vida = NUCLEO.vidaMax;
      run(1);
    }
    expect(distancia(), 'chegou mais perto da porta').toBeLessThan(antes - 6);
  });
});
