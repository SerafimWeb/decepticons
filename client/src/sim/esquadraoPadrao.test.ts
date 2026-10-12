import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type GameSettings } from '../core/Settings';
import type { MechBase, MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match, type MatchOptions } from './Match';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;

/** Os ticks em que a foto da partida é tirada (1 s, 5 s, 10 s e 20 s): cobre a aproximação, o primeiro tiroteio e o rodízio. */
const FOTOS = [60, 300, 600, 1200];

/** Hash curto (FNV-1a) de um texto: a foto inteira cabe numa linha do teste. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Todo mundo da partida (posição ao centímetro, vida do torso, vivo ou não) e o placar, em texto. */
function foto(match: Match, player: MechBase): string {
  const rows: string[] = [];
  const put = (lado: string, list: readonly MechBase[], nome: (m: MechBase) => string): void => {
    for (const m of list) rows.push(`${lado}:${nome(m)}:${m.simPosition.x.toFixed(2)},${m.simPosition.z.toFixed(2)}:${Math.round(m.modules.torso)}:${m.alive ? 1 : 0}`);
  };
  put('P', [player], () => 'VOCÊ');
  put('E', match.bots.mechs, (m) => match.bots.nameOf(m));
  if (match.allies) put('A', match.allies.mechs, (m) => match.allies!.nameOf(m));
  const placar = match.round.standings().map((r) => `${r.name}=${r.kills}/${r.deaths}`).join(';');
  return `${rows.join('|')}#${placar}`;
}

/** Roda a partida com o jogador parado e devolve o hash de cada foto. */
async function rodar(opcoes: Partial<MatchOptions> & { foes: MatchOptions['foes'] }): Promise<string[]> {
  const physics = await PhysicsWorld.create();
  try {
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, debris: false, ...opcoes });
    const player = new Vector09();
    match.addPlayer(player, 'VOCÊ');
    match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(IDLE, dt) });
    const hashes: string[] = [];
    for (let tick = 1; tick <= FOTOS[FOTOS.length - 1]!; tick++) {
      match.step(FIXED_DT);
      if (FOTOS.includes(tick)) hashes.push(fnv(foto(match, player)));
    }
    return hashes;
  } finally {
    physics.world.free();
  }
}

/** A Arena do servidor: três Mechs, três andróides e o técnico, sem aliados nem drones (`ArenaRoom.ts`). */
const FOES_DO_SERVIDOR: GameSettings = {
  ...DEFAULT_SETTINGS,
  enemyMechs: 3,
  enemyAndroids: 3,
  technician: true,
  enemyPersonas: ['brabo', 'manso', 'fujao'],
};

/**
 * O esquadrão padrão é o jogo de hoje (P91): estas fotos foram tiradas **antes** de a partida passar a montar o esquadrão, com o
 * código de contagens fixas (`enemyMechs`, `enemyAndroids`, `technician`) e a lista fixa de pontos de nascimento. Se alguma mudar, a
 * partida padrão mudou: é decisão do dono (registre no `HISTORICO_DE_DECISOES.md` e refaça as fotos), nunca efeito colateral.
 */
describe('esquadrão padrão: a partida de hoje, tick a tick', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('Arena com aliados e drones (o jogo offline padrão)', async () => {
    expect(await rodar({ foes: DEFAULT_SETTINGS })).toEqual(['8446b764', 'c1495ab6', '1d51c4a7', '10da91f4']);
  });

  it('Arena do servidor (3 Mechs, 3 andróides, técnico, sem aliados)', async () => {
    expect(await rodar({ foes: FOES_DO_SERVIDOR, allies: false, drones: false })).toEqual(['0188c3d7', '82f1bcb9', 'c87f512e', 'f3c6a54f']);
  });

  it('Bunker com aliados (o mapa vertical)', async () => {
    expect(await rodar({ foes: DEFAULT_SETTINGS, map: 'bunker' })).toEqual(['19bc4530', 'cde0f054', 'a044d070', '121cbcd5']);
  });

  it('Arena sem inimigos além do técnico: os aliados e os drones esperam', async () => {
    const vazio: GameSettings = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
    expect(await rodar({ foes: vazio })).toEqual(['5e41784b', '48685f22', 'a9f58284', 'a9f58284']);
  });
});
