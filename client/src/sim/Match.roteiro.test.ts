import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BOT_SKILLS } from '../combat/BotController';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import type { EsquadraoSpec } from './esquadrao';
import { Match, type Foes } from './Match';
import type { BeatDoRoteiro, RoteiroSpec } from './Roteiro';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

/** Um esquadrão de 1 Mech de cada lado — o menor que prova a ordem chegando a cada um. */
const ESQUADRAO_1V1: EsquadraoSpec = { v: 1, inimigos: [{ papel: 'mech' }], aliados: [{ papel: 'mech' }] };

/** Uma partida WARGAME sem tela: dois esquadrões, nenhum jogador, um roteiro de 3 batidas. */
async function partida(beats: BeatDoRoteiro[]) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const foes: Foes = { enemyMechs: 0, enemyAndroids: 0, technician: false, enemyPersonas: [], names: { mechs: [], androids: [], technicians: [], allies: [] } };
  const roteiro: RoteiroSpec = { v: 1, mapa: 'arena', esquadrao: ESQUADRAO_1V1, beats };
  const eventos: BeatDoRoteiro[] = [];
  const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false, mode: 'deathmatch', squad: ESQUADRAO_1V1, roteiro, espectador: true });
  match.onRoteiroEvento = (b) => eventos.push(b);
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  return { match, eventos, run };
}

describe('Match com um roteiro WARGAME (P262): dois esquadrões, sem jogador', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('nasce sem nenhum jogador — os dois esquadrões já existem e se enxergam', async () => {
    const { match } = await partida([]);
    expect(match.players.length).toBe(0);
    expect(match.bots.mechs.length).toBe(1);
    expect(match.allies!.mechs.length).toBe(1);
    // O inimigo mira no aliado, o aliado mira no inimigo — nenhum dos dois vê um jogador (não há nenhum).
    expect(match.bots.targets).toEqual(match.allies!.mechs);
    expect(match.allies!.targets).toEqual(match.bots.mechs);
  });

  it('uma batida sem ordem (só legenda) dispara o evento mas não toca em nenhum bot', async () => {
    const { match, eventos, run } = await partida([{ tick: 5, legenda: { texto: 'Abertura', duracaoS: 3 } }]);
    const cerebro = match.bots.brainOf(match.bots.mechs[0]!)!;
    const ordemAntes = cerebro.order;
    run(0.2); // 12 ticks a 60 Hz
    expect(eventos.map((e) => e.tick)).toEqual([5]);
    expect(eventos[0]!.legenda?.texto).toBe('Abertura');
    expect(cerebro.order).toBe(ordemAntes);
  });

  it('três batidas disparam exatamente nos ticks certos, em ordem, cada uma uma vez só', async () => {
    const beats: BeatDoRoteiro[] = [
      { tick: 0, lado: 'inimigo', ordem: { tipo: 'hold', ponto: { x: 12, z: -8 } } },
      { tick: 60, lado: 'aliado', ordem: { tipo: 'follow', ponto: { x: -5, z: 5 } } },
      { tick: 120, legenda: { texto: 'Fim do primeiro ato', duracaoS: 2 } },
    ];
    const { match, eventos, run } = await partida(beats);
    run(3); // 180 ticks a 60 Hz: as três batidas já passaram
    expect(eventos.map((e) => e.tick)).toEqual([0, 60, 120]);

    const cerebroInimigo = match.bots.brainOf(match.bots.mechs[0]!)!;
    expect(cerebroInimigo.order).toBe('hold');

    const cerebroAliado = match.allies!.brainOf(match.allies!.mechs[0]!)!;
    expect(cerebroAliado.order).toBe('follow');
  });

  it('os dois esquadrões brigam no nível mais afiado (dificil) — é espetáculo, sem jogador para proteger', async () => {
    const { match } = await partida([]);
    expect(match.bots.brainOf(match.bots.mechs[0]!)!.skill).toBe(BOT_SKILLS.dificil);
    expect(match.allies!.brainOf(match.allies!.mechs[0]!)!.skill).toBe(BOT_SKILLS.dificil);
  });

  it('sem roteiro (o jogo de sempre), nada dispara e nenhum bot é tocado por ele', async () => {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const foes: Foes = { enemyMechs: 0, enemyAndroids: 0, technician: false, enemyPersonas: [], names: { mechs: [], androids: [], technicians: [], allies: [] } };
    const eventos: BeatDoRoteiro[] = [];
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false, mode: 'deathmatch', squad: ESQUADRAO_1V1 });
    match.onRoteiroEvento = (b) => eventos.push(b);
    for (let i = 0; i < Math.round(1 / FIXED_DT); i++) match.step(FIXED_DT);
    expect(eventos).toEqual([]);
  });
});
