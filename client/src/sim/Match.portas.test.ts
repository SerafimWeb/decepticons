import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { ANDROID_STATS, ehManifestante, MANIFESTANTE_STATS } from '../entities/chassis';
import type { MechBase, MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { PRAIA_COMPLEXO, PRAIA_MANIFESTANTES } from '../environment/PraiaLayout';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from './Match';
import { NUCLEO } from './NucleoDaEstacao';
import { PORTAS, PORTAS_DA_ESTACAO } from './PortasDaEstacao';
import { SURVIVAL_MAX_MANIFESTANTES, SURVIVAL_WAVE_PLANS, WAVE_BRIEFING_S } from './SurvivalWaves';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

/** A missão em ondas da praia sem tela e sem dano no jogador, começando na onda `startWave` (a 3 já traz os manifestantes e o Mech). */
async function partida(startWave = 1, mode: 'survival' | 'deathmatch' = 'survival') {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'praia', mode, damage: false, startWave, particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  const entrada = { ...IDLE };
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(entrada, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  // Com o jogador longe, os rebeldes da onda zeram a rede da estação em ~48 s e a missão acaba (e os bots são desativados) antes de uma porta ceder: aqui o foco é a porta,
  // então a rede é refeita a cada segundo.
  const runComRedeCheia = (s: number): void => {
    for (let i = 0; i < Math.round(s); i++) {
      match.nucleo!.vida = NUCLEO.vidaMax;
      run(1);
    }
  };
  return { match, player, run, runComRedeCheia };
}

const manifestantes = (m: Match): MechBase[] => m.bots.mechs.filter((b) => b.alive && ehManifestante(b.stats.name));
const LONGE = new THREE.Vector3(236, 0, 8);

describe('o manifestante (P163): o vândalo humano da missão em ondas da praia', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('é mais fraco e mais lento que o andróide, e sem arma de fogo: a pancada de bandeira é a metade da motosserra', () => {
    expect(MANIFESTANTE_STATS.maxModuleHealth.torso).toBeLessThan(ANDROID_STATS.maxModuleHealth.torso);
    expect(MANIFESTANTE_STATS.moveSpeed).toBeLessThan(ANDROID_STATS.moveSpeed);
    const arma = MANIFESTANTE_STATS.loadout.primary!;
    expect(arma.kind).toBe('melee');
    expect(arma.damage).toBe(ANDROID_STATS.loadout.primary!.damage / 2);
    expect(MANIFESTANTE_STATS.loadout.secondary).toBeNull();
    expect(ehManifestante(MANIFESTANTE_STATS.name)).toBe(true);
    expect(ehManifestante(ANDROID_STATS.name)).toBe(false);
  });

  it('as ondas 2 a 5 e a do Colossus trazem manifestantes; a 1, a dos cabos, não; nenhum plano passa do pool', () => {
    expect(SURVIVAL_WAVE_PLANS[0]!.manifestantes ?? 0).toBe(0);
    for (const plano of SURVIVAL_WAVE_PLANS.slice(1)) {
      expect(plano.manifestantes).toBeGreaterThan(0);
      expect(plano.manifestantes).toBeLessThanOrEqual(SURVIVAL_MAX_MANIFESTANTES);
    }
    expect(PRAIA_MANIFESTANTES.length).toBeGreaterThanOrEqual(SURVIVAL_MAX_MANIFESTANTES);
  });

  it('só a missão em ondas da praia tem manifestantes, cabos e portas; o todos contra todos não', async () => {
    const { match } = await partida(1, 'deathmatch');
    expect(match.portas).toBeNull();
    expect(match.bots.mechs.some((m) => ehManifestante(m.stats.name))).toBe(false);
    const missao = await partida(1);
    expect(missao.match.portas).not.toBeNull();
    // o pool existe (5 vagas) mas a onda 1 não ativa nenhum
    expect(missao.match.bots.mechs.filter((m) => ehManifestante(m.stats.name))).toHaveLength(SURVIVAL_MAX_MANIFESTANTES);
    missao.run(WAVE_BRIEFING_S + 1);
    expect(manifestantes(missao.match)).toHaveLength(0);
  });

  it('a onda 3 ativa os 3 manifestantes do plano: uns pela avenida, outro pela rua dos fundos, atrás do muro norte da estação', async () => {
    const { match, run } = await partida(3);
    run(WAVE_BRIEFING_S + 1);
    const lista = manifestantes(match);
    expect(lista).toHaveLength(SURVIVAL_WAVE_PLANS[2]!.manifestantes!);
    // a vaga 1 nasce na rua dos fundos (além do muro norte, z > 100) e as outras na avenida (a oeste do complexo)
    const pelosFundos = lista.filter((m) => m.simPosition.z > PRAIA_COMPLEXO.maxZ);
    const pelaAvenida = lista.filter((m) => m.simPosition.x < PRAIA_COMPLEXO.minX);
    expect(pelosFundos.length).toBeGreaterThanOrEqual(1);
    expect(pelaAvenida.length).toBeGreaterThanOrEqual(1);
    for (const m of lista) expect(m.simPosition.y).toBeGreaterThan(-1); // em terra firme: não afundaram no mar nem no chão
  });

  it('cada manifestante recebe a ordem de ficar no posto do alvo da vaga dele (a porta ou o cabo)', async () => {
    const { match, run } = await partida(3);
    run(WAVE_BRIEFING_S + 2);
    for (const m of manifestantes(match)) expect(match.bots.brainOf(m)?.order).toBe('hold');
  });

  it('manifestante parado na porta a FORÇA: a vida cai, a porta fica forçada; e o dreno da rede só começa depois de arrombada', async () => {
    const { match, player, run } = await partida(3);
    run(WAVE_BRIEFING_S + 1);
    player.respawn(LONGE);
    const vaga0 = manifestantes(match).find((m) => m.simPosition.x < PRAIA_COMPLEXO.minX)!; // a vaga da frente
    const frente = PORTAS_DA_ESTACAO[0]!;
    vaga0.respawn(new THREE.Vector3(frente.x, 0, frente.z));
    run(20);
    expect(match.portas!.estado(0)).toBe('forcada');
    expect(match.portas!.vida[0]).toBeLessThan(PORTAS.vidaMax);
    expect(match.portas!.drenoDaRedePorS).toBe(0);
  });

  it('o grupo dos fundos chega sozinho à entrada dos fundos e a força, enquanto o da avenida vai à principal: as duas frentes ao mesmo tempo', async () => {
    const { match, player, run, runComRedeCheia } = await partida(2);
    run(WAVE_BRIEFING_S + 1);
    player.respawn(LONGE);
    runComRedeCheia(45);
    expect(match.portas!.estado(1), 'a porta dos fundos').not.toBe('fechada');
    expect(match.portas!.vida[1]).toBeLessThan(PORTAS.vidaMax);
  });

  it('o jogador que chega à porta e tira o invasor a RECUPERA', async () => {
    const { match, player, run } = await partida(3);
    run(WAVE_BRIEFING_S + 1);
    player.respawn(LONGE);
    const frente = PORTAS_DA_ESTACAO[0]!;
    const vaga0 = manifestantes(match).find((m) => m.simPosition.x < PRAIA_COMPLEXO.minX)!;
    vaga0.respawn(new THREE.Vector3(frente.x, 0, frente.z));
    run(20);
    const danificada = match.portas!.vida[0]!;
    for (const b of match.bots.mechs) b.deactivate();
    player.respawn(new THREE.Vector3(frente.x + 1, 0, frente.z));
    run(6);
    expect(match.portas!.vida[0]).toBeGreaterThan(danificada);
  });

  it('porta arrombada drena a rede da estação além do invasor; e o restartMission fecha as portas de novo', async () => {
    const { match, player, run, runComRedeCheia } = await partida(5); // a 5 traz os 5 manifestantes: as vagas 1 e 3 são as dos fundos
    run(WAVE_BRIEFING_S + 1);
    player.respawn(LONGE);
    // os dois manifestantes dos fundos forçando a porta dos fundos: 2 pontos de peso → 50 s
    const fundos = PORTAS_DA_ESTACAO[1]!;
    const dosFundos = manifestantes(match).filter((m) => m.simPosition.z > PRAIA_COMPLEXO.maxZ);
    expect(dosFundos).toHaveLength(2);
    for (const m of dosFundos) m.respawn(new THREE.Vector3(fundos.x + 1, 0, fundos.z));
    runComRedeCheia(75);
    expect(match.portas!.estado(1)).toBe('arrombada');
    // Tira os invasores de cena para isolar o dreno: só a porta arrombada machuca a rede (12 por segundo), nem um ponto a mais.
    for (const b of match.bots.mechs) b.deactivate();
    match.cabos!.reset(); // os andróides já tinham tomado os cabos (cada um drena 10 por segundo): aqui só a porta
    match.nucleo!.vida = NUCLEO.vidaMax;
    const antes = match.nucleo!.vida;
    run(4);
    const perdido = antes - match.nucleo!.vida;
    expect(perdido).toBeGreaterThan(PORTAS.drenoArrombadaPorS * 4 * 0.95);
    expect(perdido).toBeLessThan(PORTAS.drenoArrombadaPorS * 4 * 1.05);
    match.restartMission();
    for (let i = 0; i < 2; i++) expect(match.portas!.estado(i)).toBe('fechada');
  });
});
