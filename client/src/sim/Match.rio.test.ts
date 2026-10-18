import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { AMAZONIA_DRAGA_INICIO_X, rioEmX } from '../environment/AmazoniaLayout';
import { alturaDoTerreno } from '../environment/AmazoniaTerreno';
import { carregarChefeSeFor, carregarMapaSeFor } from '../environment/mapasSobDemanda';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { distanciaAteAAldeia, LINHA_DA_ALDEIA_X, posicaoNaMarcha } from './DragaMarcha';
import { Match } from './Match';
import type { MissionStats } from './SurvivalWaves';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

/** A missão do rio (P180, parte C), sem tela: o Draga-01 marcha rumo à aldeia; o jogador nasce nela. */
async function partidaDoRio(mode: 'survival' | 'deathmatch' = 'survival', marcha?: number) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'amazonia', mode, particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false, ...(marcha === undefined ? {} : { marcha }) });
  const fins: { sobreviveu: boolean; stats: MissionStats }[] = [];
  match.onMissionEnd = (sobreviveu, _onda, stats) => fins.push({ sobreviveu, stats });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate({ ...IDLE }, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  return { match, player, run, fins, physics };
}

describe('a missão do rio no Match (P180, parte C): o Draga-01 contra a aldeia', () => {
  beforeAll(async () => {
    await RAPIER.init();
    await carregarMapaSeFor('amazonia');
    await carregarChefeSeFor('amazonia');
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('o Draga é o único chefe (a guarda de 9, parte D2, segura os geradores): sem ondas, sem núcleo, sem quadro de luz, e a missão do rio existe só na Sobrevivência da Amazônia', async () => {
    const { match } = await partidaDoRio();
    expect(match.rio).not.toBeNull();
    expect(match.waves).toBeNull();
    expect(match.nucleo).toBeNull();
    expect(match.quadro).toBeNull();
    expect(match.bots.mechs).toHaveLength(10); // o Draga + a guarda (3 Mechs e 6 andróides, `Match.guarda.test.ts`)
    expect(match.bots.chefe?.stats.name).toBe('DRAGA-01');
    // no Deathmatch da Amazônia a missão e o chefe não existem (o passeio do Draga é só desenho)
    const dm = await partidaDoRio('deathmatch');
    expect(dm.match.rio).toBeNull();
    expect(dm.match.bots.chefe).toBeNull();
  });

  it('o Draga nasce no leito, na largada, de pé e inteiro, e o jogador nasce no posto avançado, a quase 1.000 m dele (fora do alcance do canhão de 320 m)', async () => {
    const { match, player, run } = await partidaDoRio();
    run(2);
    const d = match.bots.chefe!;
    expect(d.simPosition.x).toBeCloseTo(AMAZONIA_DRAGA_INICIO_X, -1);
    expect(Math.abs(d.simPosition.z - rioEmX(d.simPosition.x))).toBeLessThan(15);
    expect(d.modules.torso).toBe(d.stats.maxModuleHealth.torso);
    expect(Math.abs(d.simPosition.y - alturaDoTerreno(d.simPosition.x, d.simPosition.z))).toBeLessThan(2);
    expect(d.simPosition.x - player.simPosition.x).toBeGreaterThan(900);
  });

  it('o Draga marcha para o oeste (rio acima): em 20 s anda ~45 m, a missão segue em marcha e o relógio corre', async () => {
    const { match, run, fins } = await partidaDoRio();
    run(0.5);
    const x0 = match.bots.chefe!.simPosition.x;
    run(20);
    const andou = x0 - match.bots.chefe!.simPosition.x;
    expect(andou).toBeGreaterThan(40);
    expect(andou).toBeLessThan(55);
    expect(match.rio!.fase).toBe('marcha');
    expect(match.rio!.tempoS).toBeCloseTo(20.5, 0);
    expect(fins).toEqual([]);
  });

  it('VITÓRIA: derrubar o Draga acaba a missão, uma vez, e o mundo congela (ele para onde caiu)', async () => {
    const { match, run, fins } = await partidaDoRio();
    run(1);
    const d = match.bots.chefe!;
    const p = d.simPosition;
    d.takeHit(new THREE.Vector3(p.x, p.y + 20, p.z), 1e6);
    expect(d.alive).toBe(false);
    expect(match.bots.chefe).toBeNull();
    run(1);
    expect(match.rio!.fase).toBe('vitoria');
    expect(fins).toHaveLength(1);
    expect(fins[0]!.sobreviveu).toBe(true);
    expect(fins[0]!.stats.wavesCleared).toBe(1);
    const tempo = match.rio!.tempoS;
    run(3);
    expect(match.rio!.tempoS).toBe(tempo); // congelado
    expect(fins).toHaveLength(1);
  });

  it('DERROTA: o Draga chegar à linha da aldeia perde a missão, uma vez só, e o fim leva o tempo e o placar', async () => {
    const { match, run, fins } = await partidaDoRio();
    run(1);
    const d = match.bots.chefe!;
    const z = rioEmX(LINHA_DA_ALDEIA_X + 2);
    d.respawn(new THREE.Vector3(LINHA_DA_ALDEIA_X + 2, alturaDoTerreno(LINHA_DA_ALDEIA_X + 2, z), z));
    run(4);
    expect(match.rio!.fase).toBe('derrota');
    expect(fins).toHaveLength(1);
    expect(fins[0]!.sobreviveu).toBe(false);
    expect(fins[0]!.stats.survivalSeconds).toBeGreaterThan(1);
    expect(d.simPosition.x).toBeLessThanOrEqual(LINHA_DA_ALDEIA_X + 0.5);
    const parou = d.simPosition.x;
    run(5);
    expect(fins).toHaveLength(1);
    expect(d.simPosition.x, 'o mundo congela no fim: o Draga fica onde chegou').toBe(parou);
  });

  it('o jogador morrer não perde a missão: ele renasce na aldeia e o Draga segue marchando', async () => {
    const { match, player, run, fins } = await partidaDoRio();
    run(1);
    const p = player.simPosition;
    player.takeHit(new THREE.Vector3(p.x, p.y + 2.5, p.z), 1e6);
    expect(player.alive).toBe(false);
    run(10);
    expect(player.alive).toBe(true);
    expect(match.rio!.fase).toBe('marcha');
    expect(fins).toEqual([]);
  });

  it('o dano que o jogador causa ao Draga e o abate entram no placar de fim', async () => {
    const { match, player, run, fins } = await partidaDoRio();
    run(0.5);
    const d = match.bots.chefe!;
    match.combat.onMechHit!({ mech: d, result: { part: 'torso', applied: 120, partDestroyed: false, killed: false }, shooter: player });
    match.combat.onMechHit!({ mech: d, result: { part: 'leftLeg', applied: 80, partDestroyed: false, killed: false }, shooter: player });
    match.combat.onMechHit!({ mech: player, result: { part: 'torso', applied: 999, partDestroyed: false, killed: false }, shooter: d }); // dano ao jogador não conta
    const p = d.simPosition;
    d.takeHit(new THREE.Vector3(p.x, p.y + 20, p.z), 1e6);
    match.combat.onMechKilled!(d, new THREE.Vector3(p.x, p.y, p.z), player);
    run(1);
    expect(fins[0]!.stats.damageDealt).toBe(200);
    expect(fins[0]!.stats.kills).toBe(1);
  });

  it('o Draga atira no jogador ao alcance: o canhão de cerco sai da boca do convés, depois da espera inicial', async () => {
    const { match, player, run, physics } = await partidaDoRio();
    const disparos: { dir: THREE.Vector3; owner: unknown }[] = [];
    const original = match.projectiles.fire.bind(match.projectiles);
    vi.spyOn(match.projectiles, 'fire').mockImplementation((origin, dir, owner, ...resto) => {
      disparos.push({ dir: dir.clone(), owner });
      return original(origin, dir, owner, ...resto);
    });
    run(0.5);
    const d = match.bots.chefe!;
    const x = d.simPosition.x - 150;
    const z = rioEmX(x);
    player.respawn(new THREE.Vector3(x, alturaDoTerreno(x, z), z));
    physics.step();
    // as torres da margem (tiro sem dono) também atiram em quem anda no leito (parte D2): aqui só conta o canhão do Draga
    const doDraga = () => disparos.filter((t) => t.owner === d.collider);
    run(2);
    expect(doDraga()).toHaveLength(0); // ainda na espera de 3 s
    run(5);
    expect(doDraga().length).toBeGreaterThanOrEqual(1);
    expect(doDraga()[0]!.dir.x).toBeLessThan(0); // para o oeste, onde o jogador está
  });

  it('?marcha=0,8: o Draga nasce com 80% do caminho andado (a 310 m da linha da aldeia, no leito), a missão mede a partir dali, e recomeçar volta para lá', async () => {
    const { match, run } = await partidaDoRio('survival', 0.8);
    run(1);
    const d = match.bots.chefe!;
    expect(d.simPosition.x).toBeCloseTo(posicaoNaMarcha(0.8), -1);
    expect(Math.abs(d.simPosition.z - rioEmX(d.simPosition.x))).toBeLessThan(15);
    expect(distanciaAteAAldeia(d.simPosition.x)).toBeGreaterThan(280);
    expect(distanciaAteAAldeia(d.simPosition.x)).toBeLessThan(330);
    match.restartMission();
    run(1);
    expect(match.bots.chefe!.simPosition.x).toBeGreaterThan(posicaoNaMarcha(0.8) - 15);
    expect(match.bots.chefe!.simPosition.x).toBeLessThan(posicaoNaMarcha(0.8) + 5);
  });

  it('?marcha=0,95 nasce a 77 m da linha e perde em ~30 s sem ninguém para o derrubar: o fim da missão se testa em meio minuto', async () => {
    const { match, run, fins } = await partidaDoRio('survival', 0.95);
    run(40);
    expect(match.rio!.fase).toBe('derrota');
    expect(fins).toHaveLength(1);
    expect(fins[0]!.sobreviveu).toBe(false);
  });

  it('recomeçar devolve o Draga inteiro à largada, o jogador à aldeia e a missão à marcha (a tentativa de novo)', async () => {
    const { match, player, run, fins } = await partidaDoRio();
    run(1);
    const d0 = match.bots.chefe!;
    const z = rioEmX(LINHA_DA_ALDEIA_X + 2);
    d0.takeHit(new THREE.Vector3(d0.simPosition.x + 6, d0.simPosition.y + 5, d0.simPosition.z), 100);
    d0.respawn(new THREE.Vector3(LINHA_DA_ALDEIA_X + 2, alturaDoTerreno(LINHA_DA_ALDEIA_X + 2, z), z));
    run(4);
    expect(match.rio!.fase).toBe('derrota');
    match.restartMission();
    run(1);
    expect(match.rio!.fase).toBe('marcha');
    expect(match.rio!.tempoS).toBeLessThan(2);
    const d = match.bots.chefe!;
    expect(d.simPosition.x).toBeGreaterThan(AMAZONIA_DRAGA_INICIO_X - 15);
    expect(d.modules.torso).toBe(d.stats.maxModuleHealth.torso);
    expect(d.modules.rightLeg).toBe(d.stats.maxModuleHealth.rightLeg);
    expect(player.alive).toBe(true);
    expect(fins).toHaveLength(1);
  });

  it('com um lado caído o Draga marcha na metade da velocidade; com os dois, rasteja a 30% (a regra do chefe, no mapa de verdade)', async () => {
    const mede = async (lados: { e: boolean; d: boolean }): Promise<number> => {
      const { match, run } = await partidaDoRio();
      const d = match.bots.chefe!;
      if (lados.e) d.modules.leftLeg = 0;
      if (lados.d) d.modules.rightLeg = 0;
      run(3);
      const x0 = d.simPosition.x;
      run(10);
      return (x0 - d.simPosition.x) / 10;
    };
    const inteiro = await mede({ e: false, d: false });
    const manco = await mede({ e: true, d: false });
    const rasteja = await mede({ e: true, d: true });
    expect(manco).toBeCloseTo(inteiro * 0.5, 1);
    expect(rasteja).toBeCloseTo(inteiro * 0.3, 1);
  });
});
