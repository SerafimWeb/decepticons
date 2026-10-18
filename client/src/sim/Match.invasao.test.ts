import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechBase, MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { AMAZONIA_POSTO_AVANCADO, AMAZONIA_RESISTENCIA } from '../environment/AmazoniaLayout';
import { alturaDoTerreno } from '../environment/AmazoniaTerreno';
import { carregarChefeSeFor, carregarMapaSeFor } from '../environment/mapasSobDemanda';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { INVASAO } from './InvasaoDoDraga';
import { Match } from './Match';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

async function partida(marcha?: number, mode: 'survival' | 'deathmatch' = 'survival') {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'amazonia', mode, particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, ...(marcha === undefined ? {} : { marcha }) });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate({ ...IDLE }, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  const derrubarOsGeradores = (): void => {
    for (let i = 0; i < match.escudo!.total; i++) match.escudo!.quebrar(i);
  };
  const androides = (): MechBase[] => [...match.allies!.mechs];
  /** Põe os andróides da Resistência a `dist` m da escotilha (de lado, no chão), como se já tivessem chegado perto. */
  const levarAsAteAEscotilha = (dist: number): void => {
    run(0.05); // um tick para a escotilha ter lugar
    androides().forEach((a, i) => {
      const x = match.escotilha.x + dist + i * 1.2;
      const z = match.escotilha.z - 0.5 * i;
      a.respawn(new THREE.Vector3(x, alturaDoTerreno(x, z) + 0.2, z));
    });
  };
  return { match, player, run, derrubarOsGeradores, androides, levarAsAteAEscotilha };
}

describe('a invasão do Draga-01 com os andróides da Resistência (P180, parte E)', () => {
  beforeAll(async () => {
    await RAPIER.init();
    await carregarMapaSeFor('amazonia');
    await carregarChefeSeFor('amazonia');
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('a missão do rio tem a Resistência (3 andróides aliados na aldeia) e a invasão fechada; o Deathmatch da Amazônia não tem invasão', async () => {
    const { match, androides } = await partida();
    expect(match.allies).not.toBeNull();
    expect(androides()).toHaveLength(INVASAO.androides);
    expect(androides().map((a) => a.stats.name.startsWith('ANDR'))).toEqual([true, true, true]);
    for (let i = 0; i < AMAZONIA_RESISTENCIA.length; i++) {
      const p = androides()[i]!.simPosition;
      expect(Math.hypot(p.x - AMAZONIA_RESISTENCIA[i]![0], p.z - AMAZONIA_RESISTENCIA[i]![1]), `andróide ${i}`).toBeLessThan(2);
    }
    expect(match.invasao).not.toBeNull();
    expect(match.invasao!.aberta).toBe(false);
    expect(match.drones).toBeNull(); // a Resistência não leva drones
    const dm = await partida(undefined, 'deathmatch');
    expect(dm.match.invasao).toBeNull();
  });

  it('com o escudo de pé a escotilha fica fechada e os andróides acompanham o jogador (nenhuma ordem de ir ao Draga)', async () => {
    const { match, run, androides } = await partida();
    run(5);
    expect(match.invasao!.aberta).toBe(false);
    expect(match.invasao!.carga).toBe(0);
    for (const a of androides()) expect(match.allies!.brainOf(a)!.order).not.toBe('hold');
  });

  it('derrubados os três geradores, a escotilha abre e os três andróides recebem a ordem de ir a ela', async () => {
    const { match, run, derrubarOsGeradores, androides } = await partida();
    run(1);
    derrubarOsGeradores();
    run(2);
    expect(match.invasao!.aberta).toBe(true);
    for (const a of androides()) expect(match.allies!.brainOf(a)!.order).toBe('hold');
  });

  it('a escotilha acompanha o Draga: a 13 m do eixo, no flanco do lado sul quando ele olha para o oeste', async () => {
    const { match, run, derrubarOsGeradores } = await partida();
    run(1);
    derrubarOsGeradores();
    run(1);
    const d = match.bots.chefe!.simPosition;
    expect(Math.hypot(match.escotilha.x - d.x, match.escotilha.z - d.z)).toBeCloseTo(INVASAO.ladoDaEscotilhaM, 1);
    expect(match.escotilha.z).toBeLessThan(d.z); // o lado sul
  });

  it('com os andróides junto da escotilha a carga sobe e, cheia, o Draga cai por dentro: vitória, o abate conta e o escudo não teve de ser refeito', async () => {
    const { match, run, derrubarOsGeradores, levarAsAteAEscotilha } = await partida();
    run(1);
    derrubarOsGeradores();
    levarAsAteAEscotilha(2);
    run(4);
    expect(match.invasao!.plantando).toBeGreaterThanOrEqual(2);
    expect(match.invasao!.carga).toBeGreaterThan(0.2);
    expect(match.bots.chefe).not.toBeNull(); // ainda de pé
    run(12);
    expect(match.invasao!.detonou).toBe(true);
    expect(match.bots.chefe).toBeNull();
    expect(match.rio!.fase).toBe('vitoria');
    expect(match.rio!.abates).toBe(1);
  });

  it('saindo da aldeia a pé, os andróides cruzam o campo, alcançam o Draga que marcha para eles e começam a plantar', async () => {
    const { match, run, derrubarOsGeradores, androides } = await partida(0.85);
    run(1);
    derrubarOsGeradores();
    let chegou = -1;
    for (let t = 1; t <= 70 && chegou < 0; t++) {
      run(1);
      if (match.invasao!.plantando >= 1) chegou = t;
    }
    expect(chegou, 'nenhum andróide chegou à escotilha em 70 s').toBeGreaterThan(0);
    expect(androides().some((a) => a.alive)).toBe(true);
    expect(match.invasao!.carga).toBeGreaterThan(0);
  });

  it('sem andróide junto da escotilha a carga não sobe (mesmo aberta); o jogador sozinho junto dela também não planta', async () => {
    const { match, player, run, derrubarOsGeradores } = await partida();
    run(1);
    derrubarOsGeradores();
    run(1);
    player.respawn(new THREE.Vector3(match.escotilha.x, alturaDoTerreno(match.escotilha.x, match.escotilha.z) + 0.2, match.escotilha.z));
    run(8);
    expect(match.invasao!.aberta).toBe(true);
    expect(match.invasao!.plantando).toBe(0);
    expect(match.invasao!.carga).toBe(0);
  });

  it('o canhão do Draga só mira Mechs: os andróides junto do casco não levam um tiro, e o Mech do jogador a 150 m, sim', async () => {
    const { match, player, run, derrubarOsGeradores, levarAsAteAEscotilha } = await partida();
    const disparos: unknown[] = [];
    const original = match.projectiles.fire.bind(match.projectiles);
    vi.spyOn(match.projectiles, 'fire').mockImplementation((origin, dir, owner, ...resto) => {
      if (owner === match.bots.chefe?.collider) disparos.push(owner);
      return original(origin, dir, owner, ...resto);
    });
    run(1);
    derrubarOsGeradores();
    levarAsAteAEscotilha(2);
    run(9); // passa da espera inicial (3 s) e de dois tiros de cadência (4,5 s): se mirasse andróide, já teria atirado
    expect(disparos).toHaveLength(0);
    const x = match.bots.chefe!.simPosition.x - 150;
    const z = match.bots.chefe!.simPosition.z;
    player.respawn(new THREE.Vector3(x, alturaDoTerreno(x, z) + 0.2, z));
    match.physics.step();
    run(6);
    expect(disparos.length).toBeGreaterThanOrEqual(1);
  });

  it('o jogador que morre renasce no posto avançado (com a Resistência na partida, o "ponto mais longe dos vivos" o mandaria para o outro lado do mapa)', async () => {
    const { match, player, run } = await partida();
    run(1);
    expect(Math.hypot(player.simPosition.x - AMAZONIA_POSTO_AVANCADO.x, player.simPosition.z - AMAZONIA_POSTO_AVANCADO.z), 'a missão começa no posto').toBeLessThan(3);
    player.damagePart('torso', 1e6);
    expect(player.alive).toBe(false);
    run(20);
    expect(player.alive).toBe(true);
    expect(Math.hypot(player.simPosition.x - AMAZONIA_RESISTENCIA[0]![0], player.simPosition.z - AMAZONIA_RESISTENCIA[0]![1])).toBeLessThan(60);
    expect(match.invasao).not.toBeNull();
  });

  it('recomeçar a missão fecha a escotilha, zera a carga e traz o Draga e a Resistência de volta', async () => {
    const { match, run, derrubarOsGeradores, levarAsAteAEscotilha, androides } = await partida();
    run(1);
    derrubarOsGeradores();
    levarAsAteAEscotilha(2);
    run(30);
    expect(match.invasao!.detonou).toBe(true);
    match.restartMission();
    expect(match.invasao!.aberta).toBe(false);
    expect(match.invasao!.carga).toBe(0);
    expect(match.invasao!.detonou).toBe(false);
    expect(match.bots.chefe).not.toBeNull();
    expect(match.rio!.fase).toBe('marcha');
    const p = androides()[0]!.simPosition;
    expect(Math.hypot(p.x - AMAZONIA_RESISTENCIA[0]![0], p.z - AMAZONIA_RESISTENCIA[0]![1])).toBeLessThan(40);
  });
});
