import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match, type MatchOptions } from './Match';
import { NASCIMENTOS_DO_DOMINIO, PONTOS_DO_DOMINIO } from './dominioMapa';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

/** Uma partida de Domínio sem tela, com o jogador parado onde nasce (a base azul, em cima do ponto A). */
async function partida(modo: MatchOptions['mode'] = 'dominio') {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, mode: modo });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(IDLE, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  return { match, player, run };
}

describe('Match no modo Domínio', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('só o modo Domínio tem a regra; os outros seguem como eram', async () => {
    expect((await partida('deathmatch')).match.dominio).toBeNull();
    expect((await partida('ctf')).match.dominio).toBeNull();
    const { match } = await partida();
    expect(match.dominio).not.toBeNull();
    expect(match.dominio!.pontos.map((p) => p.def.letra)).toEqual(PONTOS_DO_DOMINIO.map((p) => p.letra));
  });

  it('cada lado nasce na sua base: o jogador e os aliados no canto azul, os rebeldes no vermelho', async () => {
    const { match, player } = await partida();
    const d = match.dominio!;
    expect(player.simPosition.x).toBeCloseTo(NASCIMENTOS_DO_DOMINIO.blue[0]![0], 0);
    expect(player.simPosition.z).toBeCloseTo(NASCIMENTOS_DO_DOMINIO.blue[0]![1], 0);
    expect(d.ladoDe(player)).toBe('blue');
    expect(match.bots.mechs.length).toBeGreaterThan(0);
    for (const b of match.bots.mechs) {
      expect(d.ladoDe(b), 'rebelde é vermelho').toBe('red');
      expect(b.simPosition.x, 'rebelde no canto vermelho').toBeGreaterThan(30);
      expect(b.simPosition.z).toBeLessThan(-30);
    }
    for (const a of match.allies!.mechs) {
      expect(d.ladoDe(a), 'aliado é azul').toBe('blue');
      expect(a.simPosition.x).toBeLessThan(-30);
      expect(a.simPosition.z).toBeGreaterThan(30);
    }
  });

  it('os bots recebem posto de um ponto (em vez de patrulhar), e quem nasce em cima do seu ponto o domina', async () => {
    const { match, run } = await partida();
    run(3);
    for (const b of match.bots.mechs) {
      const cerebro = match.bots.brainOf(b);
      if (cerebro) expect(cerebro.order, 'rebelde segura posto').toBe('hold');
    }
    run(14);
    const [a, , , , e] = match.dominio!.pontos;
    expect(a!.dono, 'o jogador nasce em cima do A').toBe('blue');
    expect(e!.dono, 'os rebeldes nascem em cima do E').toBe('red');
    expect(match.dominio!.pontosDe('blue')).toBeGreaterThan(0);
    expect(match.dominio!.pontosDe('red')).toBeGreaterThan(0);
  });

  it('com o tempo os bots saem das bases e vão disputar os pontos do meio', async () => {
    const { match, run } = await partida();
    run(70);
    const meio = match.dominio!.pontos.slice(1, 4);
    expect(meio.some((p) => p.control !== 0 || p.presenca.blue + p.presenca.red > 0), 'alguém chegou a B, C ou D').toBe(true);
  }, 60_000);

  it('quem morre renasce na base do próprio lado, não no meio do mapa', async () => {
    const { match, run } = await partida();
    run(1);
    const rebelde = match.bots.mechs[0]!;
    rebelde.modules.torso = 0;
    run(12);
    expect(rebelde.alive).toBe(true);
    expect(rebelde.simPosition.x).toBeGreaterThan(30);
    expect(rebelde.simPosition.z).toBeLessThan(-30);
  });

  it('restartMission zera a partida e põe todo mundo de volta nas bases', async () => {
    const { match, player, run } = await partida();
    run(12);
    expect(match.dominio!.pontosDe('blue')).toBeGreaterThanOrEqual(0);
    match.restartMission();
    expect(match.dominio!.placar.blue.pontos).toBe(0);
    expect(match.dominio!.pontos.every((p) => p.dono === null)).toBe(true);
    expect(player.simPosition.x).toBeCloseTo(NASCIMENTOS_DO_DOMINIO.blue[0]![0], 0);
  });
});
