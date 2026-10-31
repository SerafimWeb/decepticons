import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import type { EsquadraoSpec } from './esquadrao';
import { Match, type Foes } from './Match';
import type { BeatDoRoteiro, RoteiroSpec } from './Roteiro';

/**
 * A ordem de UM robô do WARGAME (P290): a batida com `alvo` manda só o robô da lista, e o resto do lado segue como estava. A lista do esquadrão mistura Mechs e andróides, mas o sistema de bots guarda os
 * Mechs primeiro e os andróides depois: a conta de `posicaoNoSistema` é o que leva a ordem ao robô certo.
 */

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];
/** Inimigos: um andróide NA FRENTE da lista, depois dois Mechs (a lista não é a ordem do sistema); um aliado. */
const ESQUADRAO: EsquadraoSpec = { v: 1, inimigos: [{ papel: 'android' }, { papel: 'mech' }, { papel: 'mech' }], aliados: [{ papel: 'mech' }] };
const PONTO = { x: 30, z: -40 };

async function partida(beats: BeatDoRoteiro[]) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const foes: Foes = { enemyMechs: 0, enemyAndroids: 0, technician: false, enemyPersonas: [], names: { mechs: [], androids: [], technicians: [], allies: [] } };
  const roteiro: RoteiroSpec = { v: 1, mapa: 'arena', esquadrao: ESQUADRAO, beats };
  const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false, mode: 'deathmatch', squad: ESQUADRAO, roteiro, espectador: true });
  const ordens = () => match.bots.mechs.map((m) => match.bots.brainOf(m)?.order);
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  return { match, ordens, run };
}

describe('Match: a ordem de um robô só (P290)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('o sistema guarda os Mechs primeiro e o andróide depois (a conta da posição parte disto)', async () => {
    const { match } = await partida([]);
    expect(match.bots.mechs.map((m) => m.stats.height > 3)).toEqual([true, true, false]); // dois Mechs (altos), um andróide
  });

  it('a ordem com alvo vai só ao robô da lista: o 2º Mech do esquadrão é o Mech 1 do sistema, e os outros ficam como estavam', async () => {
    const { ordens, run } = await partida([{ tick: 0, lado: 'inimigo', alvo: 2, ordem: { tipo: 'hold', ponto: PONTO } }]);
    const antes = ordens();
    run(0.1);
    const depois = ordens();
    expect(depois[1]).toBe('hold'); // lista[2] = o 2º Mech = sistema[1]
    expect(depois[0]).toBe(antes[0]);
    expect(depois[2]).toBe(antes[2]);
    expect(depois[0]).not.toBe('hold');
  });

  it('o andróide do começo da lista é o último do sistema: a ordem dele chega a ele e a mais ninguém', async () => {
    const { ordens, run } = await partida([{ tick: 0, lado: 'inimigo', alvo: 0, ordem: { tipo: 'hold', ponto: PONTO } }]);
    const antes = ordens();
    run(0.1);
    const depois = ordens();
    expect(depois[2]).toBe('hold');
    expect(depois[0]).toBe(antes[0]);
    expect(depois[1]).toBe(antes[1]);
  });

  it('sem alvo a ordem vai ao lado inteiro, como sempre', async () => {
    const { ordens, run } = await partida([{ tick: 0, lado: 'inimigo', ordem: { tipo: 'hold', ponto: PONTO } }]);
    run(0.1);
    expect(ordens()).toEqual(['hold', 'hold', 'hold']);
  });

  it('um alvo que não existe não derruba a partida nem manda a ordem a quem não devia', async () => {
    const { ordens, run } = await partida([{ tick: 0, lado: 'inimigo', alvo: 9, ordem: { tipo: 'hold', ponto: PONTO } }]);
    const antes = ordens();
    run(0.1);
    expect(ordens()).toEqual(antes);
  });

  it('o aliado também recebe a ordem de um robô só', async () => {
    const { match, run } = await partida([{ tick: 0, lado: 'aliado', alvo: 0, ordem: { tipo: 'follow', ponto: PONTO } }]);
    run(0.1);
    expect(match.allies!.brainOf(match.allies!.mechs[0]!)!.order).toBe('follow');
  });
});
