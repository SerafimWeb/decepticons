import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechBase, MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { ARENA_QUADRO_DE_LUZ, ARENA_QUADRO_VIDA } from '../environment/ArenaLayout';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { ehAndroide } from './CabosDeDados';
import { Match, type MatchOptions } from './Match';
import { QUADRO } from './QuadroDeLuz';
import { WAVE_BRIEFING_S } from './SurvivalWaves';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

async function partida(startWave = 1, mode: MatchOptions['mode'] = 'survival', map: MatchOptions['map'] = 'arena') {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map, mode, damage: false, startWave, particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  const entrada = { ...IDLE };
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(entrada, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  return { match, player, run };
}

/** O canto oposto ao banco: o jogador longe do transformador, para o teste ver os invasores sozinhos. */
const LONGE = new THREE.Vector3(85, 0, 85);
const PERTO = new THREE.Vector3(ARENA_QUADRO_DE_LUZ.x + 3.5, 0, ARENA_QUADRO_DE_LUZ.z + 3.5);
const doTransformador = (m: MechBase): number => Math.hypot(m.simPosition.x - ARENA_QUADRO_DE_LUZ.x, m.simPosition.z - ARENA_QUADRO_DE_LUZ.z);
const vivos = (m: Match): MechBase[] => m.bots.mechs.filter((b) => b.alive);
const androides = (m: Match): MechBase[] => vivos(m).filter((b) => ehAndroide(b.stats.name));
const colossus = (m: Match): MechBase | undefined => vivos(m).find((b) => b.stats.name.startsWith('COLOSSUS'));
const ordemDe = (m: Match, b: MechBase): string | undefined => m.bots.brainOf(b)?.order;

describe('o transformador do Banco Vorcaris na missão em ondas da Cidade Neon (P164, parte E)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('só a missão em ondas tem o transformador: o todos contra todos, a bandeira e o domínio não; e ele é o do banco (480 de vida, no lugar do layout)', async () => {
    const { match } = await partida(1);
    expect(match.quadro).not.toBeNull();
    expect(match.quadro!.ponto).toBe(ARENA_QUADRO_DE_LUZ);
    expect(match.quadro!.vidaMax).toBe(ARENA_QUADRO_VIDA);
    expect(match.quadro!.vida).toBe(ARENA_QUADRO_VIDA);
    // o desenho do transformador na Arena (o que o jogador vê) vem do mesmo pedido
    expect(match.arena.transformador, 'a missão em ondas desenha o transformador').not.toBeNull();
    for (const mode of ['deathmatch', 'ctf', 'dominio'] as const) {
      const outro = await partida(1, mode);
      expect(outro.match.quadro, mode).toBeNull();
      expect(outro.match.arena.transformador, `${mode} não desenha o transformador`).toBeNull();
    }
    // a praia segue com o do porto, de 240
    const praia = await partida(1, 'survival', 'praia');
    expect(praia.match.quadro!.vidaMax).toBe(QUADRO.vidaMax);
    expect(praia.match.quadro!.ponto).not.toBe(ARENA_QUADRO_DE_LUZ);
    expect(praia.match.arena.transformador, 'a praia tem o armário do porto, não o transformador').toBeNull();
  });

  it('a onda 1 não tem saboteiro: ninguém recebe a ordem de ir ao transformador; a onda 2 manda o primeiro andróide, e só ele', async () => {
    const um = await partida(1);
    um.run(WAVE_BRIEFING_S + 0.2);
    um.player.respawn(LONGE);
    um.run(2.5);
    expect(androides(um.match).length).toBeGreaterThanOrEqual(1);
    for (const a of androides(um.match)) expect(ordemDe(um.match, a), 'onda 1').not.toBe('hold');

    const dois = await partida(2);
    dois.run(WAVE_BRIEFING_S + 0.2);
    dois.player.respawn(LONGE);
    dois.run(2.5);
    const lista = androides(dois.match);
    expect(lista.length).toBe(2);
    expect(lista.filter((a) => ordemDe(dois.match, a) === 'hold'), 'um saboteiro').toHaveLength(1);
  });

  it('o saboteiro chega ao transformador e o depreda: a vida cai (peso 0,5: ~3 por segundo)', async () => {
    const { match, player, run } = await partida(2);
    run(WAVE_BRIEFING_S + 0.2);
    player.respawn(LONGE);
    run(40);
    const saboteiro = androides(match).find((a) => ordemDe(match, a) === 'hold');
    expect(saboteiro, 'o saboteiro está vivo').toBeDefined();
    expect(doTransformador(saboteiro!), 'chegou ao transformador').toBeLessThan(QUADRO.raioDeAtaque + 2);
    expect(match.quadro!.vida).toBeLessThan(ARENA_QUADRO_VIDA);
    expect(match.quadro!.estado()).toBe('sabotado');
  });

  it('o transformador apagado desliga as zonas de cura e resfriamento; o jogador que o recupera (sem invasor em cima) as religa', async () => {
    const { match, player, run } = await partida(1);
    run(WAVE_BRIEFING_S + 0.2);
    player.respawn(LONGE);
    expect(match.zones.energizadas).toBe(true);
    match.quadro!.fixedUpdate(1000, 10, 0); // dano de sobra: apagado
    run(0.1);
    expect(match.quadro!.apagado).toBe(true);
    expect(match.zones.energizadas, 'sem energia, sem zonas').toBe(false);
    // o jogador chega ao transformador (sem rebelde em cima: os rebeldes perto contam como depredadores) e o recupera
    for (const m of match.bots.mechs) m.deactivate();
    player.respawn(PERTO);
    run(20); // um defensor repara 8 por segundo: passa dos 25% de 480 (120) em 15 s
    expect(match.quadro!.apagado).toBe(false);
    expect(match.zones.energizadas).toBe(true);
    expect(match.quadro!.vida).toBeGreaterThan(QUADRO.voltaEm * ARENA_QUADRO_VIDA);
  });

  it('o Colossus da onda 6 vai direto ao transformador e o apaga em segundos (peso 4); com ele apagado, o chefe é solto e volta a caçar', async () => {
    const { match, player, run } = await partida(6);
    run(WAVE_BRIEFING_S + 0.2);
    player.respawn(LONGE);
    run(1.5);
    const chefe = colossus(match);
    expect(chefe, 'o Colossus entrou em campo').toBeDefined();
    expect(ordemDe(match, chefe!)).toBe('hold');
    for (let s = 0; s < 120 && !match.quadro!.apagado; s++) run(1);
    expect(match.quadro!.apagado, 'o Colossus apagou o transformador').toBe(true);
    expect(doTransformador(chefe!), 'estava em cima do transformador').toBeLessThan(QUADRO.raioDeAtaque + 4);
    run(2.5);
    expect(ordemDe(match, chefe!), 'solto: sem o que depredar, vem atrás do jogador').not.toBe('hold');
    expect(match.zones.energizadas).toBe(false);
  });

  it('missão nova (restartMission): o transformador volta inteiro e as zonas voltam a ter energia', async () => {
    const { match, run } = await partida(2);
    run(WAVE_BRIEFING_S + 0.2);
    run(60);
    expect(match.quadro!.vida).toBeLessThan(ARENA_QUADRO_VIDA);
    match.restartMission();
    expect(match.quadro!.vida).toBe(ARENA_QUADRO_VIDA);
    expect(match.quadro!.estado()).toBe('ligado');
    run(0.1);
    expect(match.zones.energizadas).toBe(true);
  });
});
