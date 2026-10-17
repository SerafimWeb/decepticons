import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type GameSettings } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { armaServeAoBot, armasDoBot, armasSecundariasDoBot, ESQUADRAO_VERSAO, type EsquadraoSpec } from '../sim/esquadrao';
import { Match } from '../sim/Match';
import { weapon } from './weapons';

/**
 * Os rebeldes atiram o raio laser (P175; pendência da P152/P160: "os bots usarem as armas novas"). O laser era a única arma de energia que o esquadrão não dava ao bot, porque o bot só
 * sabia o projétil comum; agora o bot manda um **pulso** a cada `fireInterval` pelo mesmo `Match.beamPulse` do jogador (acha o primeiro alvo, dá o dano, acende o desenho e, no servidor, vira evento).
 */

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const UM_REBELDE: GameSettings = { ...DEFAULT_SETTINGS, enemyMechs: 1, enemyAndroids: 0, technician: false };
const LASER = weapon('laser');

const comLaser = (onde: 'arma' | 'secundaria'): EsquadraoSpec => ({
  v: ESQUADRAO_VERSAO,
  inimigos: [{ papel: 'mech', [onde]: { id: 'laser', tier: 0 } }],
  aliados: [],
});

interface Pulso {
  tick: number;
  dist: number;
}

/** Uma partida com um rebelde e o jogador parado; anota cada pulso de laser do rebelde (o tick e a distância ao jogador) e o dano que o jogador levou. */
async function partida(segundos: number, squad: EsquadraoSpec) {
  const physics = await PhysicsWorld.create();
  const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, debris: false, foes: UM_REBELDE, allies: false, drones: false, squad });
  const jogador = new Vector09();
  match.addPlayer(jogador, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => jogador.fixedUpdate(IDLE, dt) });
  const rebelde = match.bots.mechs[0]!;
  const pulsos: Pulso[] = [];
  let tick = 0;
  match.onBeam = (_o, _d, owner) => {
    if (owner?.handle !== rebelde.collider?.handle) return;
    pulsos.push({ tick, dist: Math.hypot(rebelde.simPosition.x - jogador.simPosition.x, rebelde.simPosition.z - jogador.simPosition.z) });
  };
  let dano = 0;
  match.onMechHit = (e) => {
    if (e.mech === jogador && e.kind !== 'melee') dano += e.result.applied;
  };
  for (tick = 1; tick <= segundos * 60; tick++) match.step(FIXED_DT);
  const primaria = rebelde.loadout.primary.id;
  physics.world.free();
  return { pulsos, dano, primaria };
}

describe('o esquadrão aceita o laser para o bot', () => {
  it('armaServeAoBot: o laser agora serve (o cabo do arpão, a rotatória, o lança-chamas, o sônico e o teleguiado seguem fora)', () => {
    expect(armaServeAoBot('laser')).toBe(true);
    for (const fora of ['harpoon', 'rotary', 'flamer', 'sonic', 'seeker', 'railgun'] as const) expect(armaServeAoBot(fora), fora).toBe(false);
  });

  it('o Vector-09 (e o Marauder) oferecem o laser ao bot na mão principal e na esquerda', () => {
    expect(armasDoBot('vector09')).toContain('laser');
    expect(armasSecundariasDoBot('vector09')).toContain('laser');
    expect(armasDoBot('marauder')).toContain('laser');
  });
});

describe('o rebelde atira o laser em pulsos, com física de verdade', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('na mão principal: o esquadrão dá o laser e o rebelde manda pulsos, um a cada `fireInterval` (ou mais), e o jogador leva dano', async () => {
    const { pulsos, dano, primaria } = await partida(20, comLaser('arma'));
    expect(primaria).toBe('laser');
    expect(pulsos.length).toBeGreaterThan(5);
    for (let i = 1; i < pulsos.length; i++) expect(pulsos[i]!.tick - pulsos[i - 1]!.tick, `pulso ${i}`).toBeGreaterThanOrEqual(Math.round(LASER.fireInterval * 60) - 1);
    expect(dano).toBeGreaterThan(0);
  });

  it('na mão esquerda: o pulso sai também pela arma secundária', async () => {
    const { pulsos, dano } = await partida(20, comLaser('secundaria'));
    expect(pulsos.length).toBeGreaterThan(5);
    expect(dano).toBeGreaterThan(0);
  });

  it('o dano de um rebelde de laser é razoável: bem abaixo do que o jogador leva do plasma (cai com a distância e o bot erra a mira)', async () => {
    const { dano } = await partida(20, comLaser('arma'));
    // 20 s de combate com 6 de dano por pulso a ~7,7 pulsos/s seriam 920 de dano se todos acertassem; o calor, a pausa e a mira do bot cortam isso muito.
    expect(dano).toBeLessThan(920);
  });

  it('o mesmo jogo dá os mesmos pulsos (sem sorteio fora da semente, G1)', async () => {
    const a = await partida(15, comLaser('arma'));
    const b = await partida(15, comLaser('arma'));
    expect(a.pulsos.map((p) => p.tick)).toEqual(b.pulsos.map((p) => p.tick));
    expect(a.dano).toBe(b.dano);
    expect(a.pulsos.length).toBeGreaterThan(0);
  });
});
