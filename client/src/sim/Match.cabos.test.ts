import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechBase, MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { CABOS, ehAndroide, PONTOS_DOS_CABOS } from './CabosDeDados';
import { carregarMapaSeFor } from '../environment/mapasSobDemanda';
import { Match } from './Match';
import { NUCLEO } from './NucleoDaEstacao';
import { WAVE_BRIEFING_S } from './SurvivalWaves';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

/** A missão em ondas da praia sem tela e **sem dano no jogador** (o foco aqui são os cabos, não sobreviver). */
async function partida(mode: 'survival' | 'deathmatch' = 'survival') {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'praia', mode, damage: false, particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  const entrada = { ...IDLE };
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(entrada, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  return { match, player, run };
}

const noPonto = (i: number, dx = 0) => new THREE.Vector3(PONTOS_DOS_CABOS[i]!.x + dx, 0, PONTOS_DOS_CABOS[i]!.z);
const androides = (m: Match): MechBase[] => m.bots.mechs.filter((b) => b.alive && ehAndroide(b.stats.name));

describe('os cabos de dados na missão em ondas da praia (P162, capítulo 1)', () => {
  beforeAll(async () => {
    await carregarMapaSeFor('praia'); // o cenário da Praia é sob demanda (P228): o jogo o baixa antes de montar a partida, o teste também
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('só existem na missão em ondas da praia: o todos contra todos da praia não tem cabos para defender', async () => {
    expect((await partida('survival')).match.cabos).not.toBeNull();
    expect((await partida('deathmatch')).match.cabos).toBeNull();
  });

  it('a onda 1 manda os dois andróides rebeldes aos pontos de conexão (um por cabo): a ordem é "ficar no posto"', async () => {
    const { match, run } = await partida();
    run(WAVE_BRIEFING_S + 3);
    const lista = androides(match);
    expect(lista).toHaveLength(2);
    for (const a of lista) expect(match.bots.brainOf(a)?.order).toBe('hold');
  });

  it('o andróide rebelde parado no ponto se liga e INJETA: o cabo é tomado e passa a drenar a rede da estação além do invasor', async () => {
    const { match, player, run } = await partida();
    run(WAVE_BRIEFING_S + 1);
    player.respawn(new THREE.Vector3(236, 0, 8)); // o jogador longe dos pontos
    const [a] = androides(match);
    a!.respawn(noPonto(0));
    run(15);
    expect(match.cabos!.injecao[0]).toBeGreaterThan(0.1); // injetando
    expect(['injetando', 'tomado']).toContain(match.cabos!.estado(0));
    run(40);
    expect(match.cabos!.estado(0)).toBe('tomado');
    // o dreno dos cabos entra na conta da rede: cai mais que só pelo peso do andróide dentro dos muros (0,5 × 7 por segundo)
    const antes = match.nucleo!.vida;
    run(5);
    const perdido = antes - match.nucleo!.vida;
    expect(perdido).toBeGreaterThan((0.5 * NUCLEO.danoPorPesoPorS + CABOS.drenoTomadoPorS) * 5 * 0.9);
  });

  it('o jogador que chega ao ponto depois de tirar o andróide LIBERA o cabo tomado, e a rede volta a se recompor', async () => {
    const { match, player, run } = await partida();
    run(WAVE_BRIEFING_S + 1);
    player.respawn(new THREE.Vector3(236, 0, 8));
    androides(match)[0]!.respawn(noPonto(1));
    run(60);
    expect(match.cabos!.estado(1)).toBe('tomado');
    for (const b of match.bots.mechs) b.deactivate(); // os andróides caem
    player.respawn(noPonto(1, 1));
    run(14);
    expect(match.cabos!.estado(1)).toBe('livre');
    expect(match.cabos!.drenoDaRedePorS).toBe(0);
  });

  it('o rebelde pesado em cima do cabo o DEPREDA: a vida cai; sem ele e com o jogador perto, o cabo é consertado', async () => {
    const { match, player, run } = await partida();
    run(WAVE_BRIEFING_S + 1);
    player.respawn(new THREE.Vector3(236, 0, 8));
    // Um Mech rebelde (não andróide) do pool, trazido ao ponto 2 (a onda 1 não o ativa sozinha).
    const mech = match.bots.mechs.find((b) => !ehAndroide(b.stats.name) && !b.alive)!;
    expect(mech).toBeDefined();
    mech.respawn(noPonto(2));
    run(4);
    expect(match.cabos!.vida[2]).toBeLessThan(CABOS.vidaMax);
    const danificado = match.cabos!.vida[2]!;
    mech.deactivate();
    player.respawn(noPonto(2, 2));
    run(5);
    expect(match.cabos!.vida[2]).toBeGreaterThan(danificado); // o defensor perto conserta
  });

  it('missão nova (restartMission): os cabos voltam inteiros e livres', async () => {
    const { match, player, run } = await partida();
    run(WAVE_BRIEFING_S + 1);
    player.respawn(new THREE.Vector3(236, 0, 8));
    androides(match)[0]!.respawn(noPonto(0));
    run(15);
    expect(match.cabos!.injecao[0]).toBeGreaterThan(0);
    match.restartMission();
    for (let i = 0; i < 3; i++) {
      expect(match.cabos!.estado(i)).toBe('livre');
      expect(match.cabos!.fracaoDaVida(i)).toBe(1);
    }
  });
});
