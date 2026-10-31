import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import type { EsquadraoSpec } from './esquadrao';
import { Match, type Foes } from './Match';
import type { GameMode } from './gameMode';
import type { RoteiroSpec } from './Roteiro';

/**
 * O WARGAME nos outros modos (P292): o episódio roda como espectador em sobrevivência, bandeira ou domínio, sem o jogador controlar nada e sem quebrar a partida.
 * O elenco é o mesmo de sempre; o que muda é o modo da partida.
 */

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];
const ESQUADRAO: EsquadraoSpec = { v: 1, inimigos: [{ papel: 'mech' }, { papel: 'android' }], aliados: [{ papel: 'mech' }] };
const FOES: Foes = { enemyMechs: 0, enemyAndroids: 0, technician: false, enemyPersonas: [], names: { mechs: [], androids: [], technicians: [], allies: [] } };

describe('Match com um roteiro WARGAME em cada modo (P292)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  for (const modo of ['deathmatch', 'survival', 'ctf', 'dominio'] as GameMode[]) {
    it(`${modo}: o episódio roda como espectador por 20 s sem o jogador, com os dois esquadrões de pé`, async () => {
      const physics = await PhysicsWorld.create();
      abertas.push(physics);
      const roteiro: RoteiroSpec = { v: 1, mapa: 'arena', esquadrao: ESQUADRAO, beats: [] };
      const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: FOES, debris: false, mode: modo, squad: ESQUADRAO, roteiro, espectador: true });
      for (let i = 0; i < Math.round(20 / FIXED_DT); i++) match.step(FIXED_DT);
      expect(match.players.length).toBe(0);
      expect(match.bots.mechs.length).toBeGreaterThan(0);
      // Sobrevivência e Bandeira usam times próprios do modo (sem esquadrão aliado, por `arenaMode`): o lado aliado do elenco não entra nesses dois.
      if (modo === 'deathmatch' || modo === 'dominio') expect(match.allies!.mechs.length).toBeGreaterThan(0);
    });
  }
});
