import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechBase, MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { PRAIA_DESEMBARQUE, PRAIA_INIMIGOS, PRAIA_QUADRO_DE_LUZ } from '../environment/PraiaLayout';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { ehAndroide } from './CabosDeDados';
import { carregarMapaSeFor } from '../environment/mapasSobDemanda';
import { Match } from './Match';
import { NUCLEO } from './NucleoDaEstacao';
import { QUADRO } from './QuadroDeLuz';
import { WAVE_BRIEFING_S, WAVE_CLEAR_S } from './SurvivalWaves';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

async function partida(startWave = 1, mode: 'survival' | 'deathmatch' = 'survival', comDano = false) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'praia', mode, damage: comDano, startWave, particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  const entrada = { ...IDLE };
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(entrada, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  // Com o jogador longe, os rebeldes zeram a rede da estação em ~48 s e a missão acaba: aqui o foco é o porto, então a rede é refeita a cada segundo.
  const runComRedeCheia = (s: number): void => {
    for (let i = 0; i < Math.round(s); i++) {
      match.nucleo!.vida = NUCLEO.vidaMax;
      run(1);
    }
  };
  return { match, player, run, runComRedeCheia };
}

const LONGE = new THREE.Vector3(262, 0, 16);
const rebeldes = (m: Match): MechBase[] => m.bots.mechs.filter((b) => b.alive && !b.stats.name.startsWith('MANIFESTANTE') && !b.stats.name.startsWith('COLOSSUS'));
const perto = (a: MechBase, x: number, z: number, raio: number): boolean => Math.hypot(a.simPosition.x - x, a.simPosition.z - z) < raio;

describe('o porto na missão em ondas da praia (P164): contêineres que abrem e o quadro de luz da cidade', () => {
  beforeAll(async () => {
    await carregarMapaSeFor('praia'); // o cenário da Praia é sob demanda (P228): o jogo o baixa antes de montar a partida, o teste também
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('só a missão em ondas da praia tem o quadro: o todos contra todos não', async () => {
    expect((await partida(1)).match.quadro).not.toBeNull();
    const dm = await partida(1, 'deathmatch');
    expect(dm.match.quadro).toBeNull();
    expect(dm.match.desembarqueAberto).toBe(false);
  });

  it('as ondas saem dos contêineres de desembarque: os Mechs e os andróides nascem nas bocas, no cais, a ponta oeste do mapa', async () => {
    const { match, player, run } = await partida(4); // a 4 traz 2 Mechs e 2 andróides
    run(WAVE_BRIEFING_S + 0.2);
    player.respawn(LONGE);
    const lista = rebeldes(match);
    expect(lista.length).toBeGreaterThanOrEqual(4);
    const bocas = PRAIA_INIMIGOS.map(([x, z]) => [x, z] as const);
    for (const r of lista) {
      const p = r.simPosition;
      // perto de uma boca (a onda acabou de nascer; os do começo da onda ainda não andaram) e em cima do cais
      expect(bocas.some(([x, z]) => perto(r, x, z, 6)), `${r.stats.name} em ${p.x.toFixed(0)},${p.z.toFixed(0)} nasce numa boca`).toBe(true);
      expect(p.x).toBeLessThan(-228);
      expect(p.y).toBeGreaterThan(-1);
    }
    // as bocas ficam a leste dos contêineres de desembarque (a porta deles)
    for (const [x] of bocas) expect(x).toBeGreaterThan(PRAIA_DESEMBARQUE.x + PRAIA_DESEMBARQUE.comprimento / 2);
  });

  it('as portas dos contêineres abrem com a onda em campo e fecham entre as ondas', async () => {
    const { match, run } = await partida(1, 'survival', true); // com dano: o `crush` precisa matar
    expect(match.desembarqueAberto, 'no briefing ainda fechadas').toBe(false);
    run(WAVE_BRIEFING_S + 0.2);
    expect(match.desembarqueAberto, 'a onda em campo').toBe(true);
    for (const m of match.bots.mechs) if (m.alive) match.combat.crush(match.players[0]!, m, 1e9);
    expect(match.waves?.phase).toBe('clear');
    expect(match.desembarqueAberto, 'a onda caiu: fecham').toBe(false);
    run(WAVE_CLEAR_S + 0.2);
    expect(match.desembarqueAberto, 'a onda 2 em campo').toBe(true);
  });

  it('na onda 1 (a dos cabos) ninguém vai ao quadro; da onda 2 em diante o saboteiro (um andróide) atravessa o cais e o sabota', async () => {
    const um = await partida(1);
    um.run(WAVE_BRIEFING_S + 0.2);
    um.player.respawn(LONGE);
    um.runComRedeCheia(25);
    expect(um.match.quadro!.estado(), 'a onda 1 não sabota').toBe('ligado');
    expect(rebeldes(um.match).some((a) => perto(a, PRAIA_QUADRO_DE_LUZ.x, PRAIA_QUADRO_DE_LUZ.z, 30))).toBe(false);

    const dois = await partida(2);
    dois.run(WAVE_BRIEFING_S + 0.2);
    dois.player.respawn(LONGE);
    dois.runComRedeCheia(30);
    const saboteiros = rebeldes(dois.match).filter((a) => ehAndroide(a.stats.name) && perto(a, PRAIA_QUADRO_DE_LUZ.x, PRAIA_QUADRO_DE_LUZ.z, 8));
    expect(saboteiros, 'um andróide junto do quadro').toHaveLength(1);
    expect(dois.match.quadro!.estado()).toBe('sabotado');
    expect(dois.match.quadro!.vida).toBeLessThan(QUADRO.vidaMax);
  });

  it('o quadro apagado derruba as zonas de cura e de resfriamento; recuperado, elas voltam', async () => {
    const { match, player, run } = await partida(1);
    run(WAVE_BRIEFING_S + 0.2);
    player.respawn(LONGE);
    expect(match.zones.energizadas).toBe(true);
    match.quadro!.fixedUpdate(100, 10, 0); // dano de sobra: apagado
    run(0.1);
    expect(match.quadro!.apagado).toBe(true);
    expect(match.zones.energizadas).toBe(false);
    // o jogador chega ao quadro (sem rebelde em cima) e o recupera
    for (const m of match.bots.mechs) m.deactivate();
    player.respawn(new THREE.Vector3(PRAIA_QUADRO_DE_LUZ.x + 3, 0, PRAIA_QUADRO_DE_LUZ.z));
    run(12);
    expect(match.quadro!.apagado).toBe(false);
    expect(match.zones.energizadas).toBe(true);
    expect(match.quadro!.energia).toBeGreaterThan(0.25);
  });

  it('missão nova (restartMission): o quadro volta ligado, as zonas voltam a ter energia e as portas dos contêineres fecham', async () => {
    const { match, player, run } = await partida(1);
    run(WAVE_BRIEFING_S + 0.2);
    player.respawn(LONGE);
    match.quadro!.fixedUpdate(100, 10, 0); // dano de sobra: apagado
    run(0.1);
    expect(match.zones.energizadas).toBe(false);
    match.restartMission();
    expect(match.quadro!.estado()).toBe('ligado');
    expect(match.zones.energizadas).toBe(true);
    expect(match.desembarqueAberto).toBe(false);
  });
});
