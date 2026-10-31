import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type GameSettings } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { armasDoExtraDoBot, ESQUADRAO_VERSAO, type EsquadraoSpec } from '../sim/esquadrao';
import { Match } from '../sim/Match';
import type { MountId } from './mounts';
import { weapon } from './weapons';

/**
 * O rebelde atira os encaixes extras (P288: os ombros do Onça no esquadrão), cada um na cadência e no alcance da arma dele, junto com a mão. Antes o bot só sabia a mão direita e a esquerda: o Hangar
 * já tinha ombros e costas, e a ficha do esquadrão não os oferecia. Sem extras no esquadrão, nada disto roda (o jogo de sempre).
 */

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const UM_REBELDE: GameSettings = { ...DEFAULT_SETTINGS, enemyMechs: 1, enemyAndroids: 0, technician: false };
const ARMA = armasDoExtraDoBot('onca', 'rightShoulder')[0]!;

const esquadrao = (extras: NonNullable<EsquadraoSpec['inimigos'][number]['extras']> | undefined): EsquadraoSpec => ({
  v: ESQUADRAO_VERSAO,
  inimigos: [{ papel: 'mech', chassi: 'onca', ...(extras ? { extras } : {}) }],
  aliados: [],
});

/** Uma partida com um Onça rebelde e o jogador parado; anota o tick de cada tiro do rebelde, por encaixe, e o dano que o jogador levou. */
async function partida(segundos: number, squad: EsquadraoSpec) {
  const physics = await PhysicsWorld.create();
  const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, debris: false, foes: UM_REBELDE, allies: false, drones: false, squad });
  const jogador = new Vector09();
  match.addPlayer(jogador, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => jogador.fixedUpdate(IDLE, dt) });
  const rebelde = match.bots.mechs[0]!;
  const tiros: Record<string, number[]> = {};
  let tick = 0;
  const original = rebelde.onFireMount.bind(rebelde);
  rebelde.onFireMount = (mount: MountId, w) => {
    (tiros[mount] ??= []).push(tick);
    original(mount, w);
  };
  let dano = 0;
  match.onMechHit = (e) => {
    if (e.mech === jogador && e.kind !== 'melee') dano += e.result.applied;
  };
  for (tick = 1; tick <= segundos * 60; tick++) match.step(FIXED_DT);
  const loadout = rebelde.loadout;
  physics.world.free();
  return { tiros, dano, loadout };
}

describe('o bot com encaixes extras', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('os dois ombros do Onça atiram a arma que o esquadrão deu, cada um no seu ritmo, junto com a mão', async () => {
    const { tiros, loadout } = await partida(25, esquadrao({ rightShoulder: { id: ARMA, tier: 0 }, leftShoulder: { id: ARMA, tier: 0 } }));
    expect(loadout.rightShoulder?.id).toBe(ARMA);
    expect(loadout.leftShoulder?.id).toBe(ARMA);
    expect(tiros.rightShoulder?.length ?? 0).toBeGreaterThan(3);
    expect(tiros.leftShoulder?.length ?? 0).toBeGreaterThan(3);
    expect(tiros.rightHand?.length ?? 0).toBeGreaterThan(0); // a mão segue atirando
    // a cadência da arma vale: dois tiros do mesmo ombro nunca ficam mais perto que o `fireInterval` dela
    const minimo = Math.floor(weapon(ARMA).fireInterval * 60) - 1;
    for (const ombro of ['rightShoulder', 'leftShoulder']) {
      const t = tiros[ombro]!;
      for (let i = 1; i < t.length; i++) expect(t[i]! - t[i - 1]!, `${ombro} tiro ${i}`).toBeGreaterThanOrEqual(minimo);
    }
  });

  it('um ombro só: o outro fica calado', async () => {
    const { tiros } = await partida(25, esquadrao({ leftShoulder: { id: ARMA, tier: 0 } }));
    expect(tiros.leftShoulder?.length ?? 0).toBeGreaterThan(3);
    expect(tiros.rightShoulder).toBeUndefined();
  });

  it('sem extras no esquadrão o Onça atira só a mão, como sempre', async () => {
    const { tiros, loadout } = await partida(25, esquadrao(undefined));
    expect(tiros.rightHand?.length ?? 0).toBeGreaterThan(0);
    expect(tiros.rightShoulder).toBeUndefined();
    expect(tiros.leftShoulder).toBeUndefined();
    expect(loadout.rightShoulder ?? null).toBeNull();
  });

  it('os tiros dos ombros acertam o jogador (a arma sai da boca do ombro e a bala vale dano)', async () => {
    const { tiros, dano } = await partida(30, esquadrao({ rightShoulder: { id: ARMA, tier: 0 }, leftShoulder: { id: ARMA, tier: 0 } }));
    expect(tiros.rightShoulder?.length ?? 0).toBeGreaterThan(0);
    expect(dano).toBeGreaterThan(0);
  });
});
