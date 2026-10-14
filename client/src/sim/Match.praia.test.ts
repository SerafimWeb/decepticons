import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { PRAIA_AGUA, PRAIA_ESTACAO, PRAIA_SPAWNS } from '../environment/PraiaLayout';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from './Match';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

/** A missão em ondas da praia (a defesa da estação, P126), sem tela: o jogador nasce na boca da escotilha e o mar freia/afoga. */
async function partidaDaPraia() {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'praia', mode: 'survival', particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(IDLE, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  return { match, player, run };
}

describe('a praia no Match (P126): a defesa da estação em ondas', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('o jogador nasce na areia seca, na boca da escotilha (o mapa reconhecido é a praia, mesmo no modo em ondas)', async () => {
    const { player } = await partidaDaPraia();
    // Nasce no primeiro ponto (a boca da escotilha da estação) e do lado seco.
    expect(player.simPosition.x).toBeCloseTo(PRAIA_SPAWNS[0]![0], 0);
    expect(player.simPosition.x).toBeGreaterThan(PRAIA_AGUA.maxX);
    expect(Math.abs(player.simPosition.z)).toBeLessThan(2);
  });

  it('a água da praia freia de verdade na partida (G14): no mar, o Mech perde velocidade', async () => {
    const { player, run } = await partidaDaPraia();
    expect(player.moveSpeedScale).toBeCloseTo(1, 5); // na areia seca, sem freio
    // Joga o Mech no mar (do lado do afogamento) e o deixa afundar: a água freia.
    player.respawn(new THREE.Vector3(-120, 0, 0));
    run(2);
    expect(player.simPosition.x).toBeLessThan(PRAIA_AGUA.maxX); // está dentro do mar
    expect(player.moveSpeedScale).toBeLessThan(1); // a água freia
  });

  it('as ondas rebeldes nascem na areia, longe da estação que o jogador defende', async () => {
    const { match, run } = await partidaDaPraia();
    // O briefing dura 3 s e a onda 1 não nasce antes disso; os pontos das ondas são os da praia (não os da Arena).
    expect(match.bots.mechs.every((m) => !m.alive)).toBe(true);
    run(4); // passa o briefing: a onda 1 entra
    const vivos = match.bots.mechs.filter((m) => m.alive);
    expect(vivos.length).toBeGreaterThan(0);
    for (const m of vivos) {
      expect(m.simPosition.x).toBeGreaterThan(PRAIA_AGUA.maxX); // nascem na areia
      expect(m.simPosition.x).toBeLessThan(PRAIA_ESTACAO.x - 40); // longe da estação
    }
  });
});
