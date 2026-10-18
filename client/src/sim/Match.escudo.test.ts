import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { AMAZONIA_GERADORES } from '../environment/AmazoniaLayout';
import { alturaDoTerreno } from '../environment/AmazoniaTerreno';
import { carregarChefeSeFor, carregarMapaSeFor } from '../environment/mapasSobDemanda';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { ESCUDO_DO_DRAGA } from './EscudoDoDraga';
import { Match } from './Match';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];
const CIMA = new THREE.Vector3(0, 1, 0);

/** A missão do rio com os geradores, sem tela. */
async function partida(mode: 'survival' | 'deathmatch' = 'survival') {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'amazonia', mode, particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate({ ...IDLE }, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  /** Um tiro de canhão que acerta em cheio o gerador `i` (o dano da explosão no centro dele). */
  const derrubar = (i: number): void => {
    const g = AMAZONIA_GERADORES[i]!;
    match.destructibles.damageInRadius(new THREE.Vector3(g.x, alturaDoTerreno(g.x, g.z) + 4.6, g.z), 3, ESCUDO_DO_DRAGA.vidaDoGerador, CIMA);
  };
  return { match, player, run, derrubar };
}

describe('o escudo do Draga-01 no Match (P180, parte D): os geradores e o dano', () => {
  beforeAll(async () => {
    await RAPIER.init();
    await carregarMapaSeFor('amazonia');
    await carregarChefeSeFor('amazonia');
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('só a missão do rio tem escudo: três geradores de pé; o Deathmatch da Amazônia não tem', async () => {
    const { match } = await partida();
    expect(match.escudo).not.toBeNull();
    expect(match.escudo!.geradoresVivos).toBe(3);
    expect(match.escudo!.ativo).toBe(true);
    const dm = await partida('deathmatch');
    expect(dm.match.escudo).toBeNull();
  });

  it('com o escudo de pé o Draga leva 10% do dano; derrubados os três geradores, leva tudo', async () => {
    const { match, run, derrubar } = await partida();
    run(0.5);
    const d = match.bots.chefe!;
    const antes = d.modules.torso;
    d.damagePart('torso', 1000);
    const comEscudo = antes - d.modules.torso;
    expect(comEscudo).toBeCloseTo(100, 0);
    for (const i of [0, 1, 2]) derrubar(i);
    run(0.2); // o tick escreve o fator no corpo
    expect(match.escudo!.ativo).toBe(false);
    const meio = d.modules.torso;
    d.damagePart('torso', 1000);
    expect(meio - d.modules.torso).toBeCloseTo(1000, 0);
  });

  it('um ou dois geradores caídos não bastam: o Draga segue protegido até o último', async () => {
    const { match, run, derrubar } = await partida();
    run(0.2);
    derrubar(1);
    derrubar(2);
    run(0.2);
    expect(match.escudo!.geradoresVivos).toBe(1);
    const d = match.bots.chefe!;
    const antes = d.modules.torso;
    d.damagePart('torso', 1000);
    expect(antes - d.modules.torso).toBeCloseTo(100, 0);
    derrubar(0);
    run(0.2);
    expect(match.escudo!.ativo).toBe(false);
    expect(match.escudo!.derrubadoNoTick).toBe(true);
  });

  it('o fogo, o choque e o gelo (dano por segundo) também passam pelo escudo', async () => {
    const { match, run } = await partida();
    run(0.2);
    const d = match.bots.chefe!;
    const antes = d.modules.torso;
    d.statusDamage(100);
    expect(antes - d.modules.torso).toBeCloseTo(10, 0);
  });

  it('o tiro que acerta o corpo (takeHit, o caminho do tiro de verdade) também respeita o escudo, seja qual for a parte', async () => {
    const { match, run } = await partida();
    run(0.2);
    const d = match.bots.chefe!;
    const soma = (): number => d.modules.torso + d.modules.head + d.modules.leftArm + d.modules.rightArm + d.modules.leftLeg + d.modules.rightLeg;
    const antes = soma();
    const p = d.simPosition;
    d.takeHit(new THREE.Vector3(p.x, p.y + 20, p.z), 500);
    const perdeu = antes - soma();
    expect(perdeu).toBeGreaterThan(0);
    expect(perdeu).toBeLessThanOrEqual(50.001); // 500 de dano, 10% chega
  });

  it('rodada nova (os alvos voltam) devolve os geradores e o escudo', async () => {
    const { match, run, derrubar } = await partida();
    run(0.2);
    for (const i of [0, 1, 2]) derrubar(i);
    run(0.2);
    expect(match.escudo!.ativo).toBe(false);
    match.destructibles.restoreAll();
    expect(match.escudo!.geradoresVivos).toBe(3);
    expect(match.escudo!.ativo).toBe(true);
    run(0.2);
    const d = match.bots.chefe!;
    const antes = d.modules.torso;
    d.damagePart('torso', 1000);
    expect(antes - d.modules.torso).toBeCloseTo(100, 0);
  });
});
