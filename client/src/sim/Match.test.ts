import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from './Match';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
/** Efeitos desligados: no servidor ninguém vê faísca. */
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;

/**
 * Uma partida como o servidor vai rodar: sem tela, sem DOM, com a sala cheia (1 jogador + os bots do
 * padrão) e o jogador parado (os bots vêm atrás dele). Devolve um resumo e o tempo médio do tick.
 */
async function play(seconds: number, debris: boolean) {
  const physics = await PhysicsWorld.create();
  const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, debris });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(IDLE, dt) });
  let hitsOnPlayer = 0;
  match.onMechHit = (e) => {
    if (e.mech === player) hitsOnPlayer++;
  };
  const ticks = Math.round(seconds / FIXED_DT);
  const t0 = performance.now();
  for (let i = 0; i < ticks; i++) match.step(FIXED_DT);
  const msPerTick = (performance.now() - t0) / ticks;
  const where = match.bots.mechs.map((m) => `${m.simPosition.x.toFixed(2)},${m.simPosition.z.toFixed(2)},${m.modules.torso}`).join(' ');
  return { match, player, hitsOnPlayer, where, deaths: match.round.scoreOf(player)?.deaths ?? 0, msPerTick, units: 1 + match.bots.mechs.length };
}

describe('partida sem tela (M1 do multiplayer: o que o servidor vai rodar)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('a partida inteira roda no Node: os bots caçam, atiram e o placar conta', async () => {
    const r = await play(40, false);
    expect(r.units).toBe(1 + DEFAULT_SETTINGS.enemyMechs + DEFAULT_SETTINGS.enemyAndroids + (DEFAULT_SETTINGS.technician ? 1 : 0));
    expect(r.hitsOnPlayer).toBeGreaterThan(0);
    expect(r.match.round.standings().length).toBe(r.units);
  });

  it('é determinística: a mesma partida duas vezes dá o mesmo resultado, tick a tick', async () => {
    const a = await play(20, false);
    const b = await play(20, false);
    expect(b.where).toBe(a.where);
    expect(b.hitsOnPlayer).toBe(a.hitsOnPlayer);
    expect(b.deaths).toBe(a.deaths);
  });

  it('destroços mexem na partida: estilhaço no mesmo mundo físico muda a ordem interna do Rapier', async () => {
    // Achado da M1 (25/09): com destroços, a partida diverge ~1 s depois do primeiro estilhaço, e duas
    // partidas com destroços divergem entre si (eles usam Math.random). O servidor roda SEM destroços
    // (determinístico, teste acima); no cliente, a reconciliação da M4 absorve a diferença. Se as correções
    // aparecerem, os destroços vão para um mundo físico só deles (MULTIPLAYER.md, riscos).
    const withDebris = await play(20, true);
    const without = await play(20, false);
    expect(without.where).not.toBe(withDebris.where);
  });

  it('cabe no servidor: o tick da sala cheia fica bem abaixo dos 16,7 ms de um quadro (meta G14: 2 ms)', async () => {
    const r = await play(20, false);
    // Folga para máquina ocupada (CI, testes em paralelo): o número de referência sai do log da M7.
    expect(r.msPerTick).toBeLessThan(8);
  });
});
