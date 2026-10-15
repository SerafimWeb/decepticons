import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { PRAIA_AGUA, PRAIA_ASSALTO, PRAIA_COMPLEXO, PRAIA_ESCOTILHA, PRAIA_ESTACAO, PRAIA_PIER, PRAIA_SPAWNS } from '../environment/PraiaLayout';
import { costaEm, faixaEm, PRAIA_LIMITES } from '../environment/PraiaTerreno';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from './Match';
import { NUCLEO } from './NucleoDaEstacao';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

/** A missão em ondas da praia (a defesa da estação, P126/P127), sem tela: o jogador nasce na escotilha; o mar freia e afoga só o fundo. */
async function partidaDaPraia(extra: { mode?: 'survival' | 'deathmatch'; damage?: boolean } = {}) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'praia', mode: extra.mode ?? 'survival', damage: extra.damage, particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  const entrada = { ...IDLE };
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(entrada, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  return { match, player, run, entrada };
}

describe('a praia no Match (P126/P127): a defesa da estação em ondas, a orla ao longo de 640 m', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('o jogador nasce em terra firme, na escotilha da estação (o mapa reconhecido é a praia, mesmo no modo em ondas)', async () => {
    const { player } = await partidaDaPraia();
    expect(player.simPosition.x).toBeCloseTo(PRAIA_SPAWNS[0]![0], 0);
    expect(player.simPosition.z).toBeCloseTo(PRAIA_ESCOTILHA.z, 0);
    expect(faixaEm(player.simPosition.x, player.simPosition.z)).not.toBe('mar');
    expect(player.simPosition.x).toBeGreaterThan(PRAIA_COMPLEXO.minX); // dentro do complexo
  });

  it('o chão aguenta o Mech parado: quem nasce na escotilha não afunda nem cai pelo terreno', async () => {
    const { player, run } = await partidaDaPraia();
    run(3);
    expect(player.simPosition.y).toBeGreaterThan(-0.2);
    expect(player.simPosition.y).toBeLessThan(0.3);
  });

  it('a água freia de verdade na partida (G14): no mar fundo, o Mech perde velocidade', async () => {
    const { player, run } = await partidaDaPraia();
    expect(player.moveSpeedScale).toBeCloseTo(1, 5); // em terra, sem freio
    // Joga o Mech mar adentro (80 m da costa) e o deixa afundar até o fundo: a água freia.
    player.respawn(new THREE.Vector3(0, 0, costaEm(0) - 80));
    run(3);
    expect(player.simPosition.y).toBeLessThan(PRAIA_AGUA.superficie - 5); // desceu até o fundo
    expect(player.moveSpeedScale).toBeLessThan(0.5); // a água freia forte lá no fundo
  });

  it('vadear não afoga, o fundo afoga: no raso (< 1,4 m) o Mech só anda devagar; no fundo, depois de 3 s, perde casco', async () => {
    const raso = await partidaDaPraia();
    // A 5 m da costa a água dá ~1 m: joelho.
    raso.player.respawn(new THREE.Vector3(0, 0, costaEm(0) - 5));
    raso.run(2);
    const funduraRasa = raso.match.estadoDaAgua(raso.player).fundura;
    expect(funduraRasa).toBeGreaterThan(0.4);
    expect(funduraRasa).toBeLessThan(PRAIA_AGUA.afogaDesde!);
    expect(raso.player.moveSpeedScale).toBeLessThan(1); // freia
    const torsoAntes = raso.player.modules.torso;
    raso.run(6);
    expect(raso.player.modules.torso, 'vadeando não machuca').toBe(torsoAntes);

    const fundo = await partidaDaPraia();
    fundo.player.respawn(new THREE.Vector3(0, 0, costaEm(0) - 20)); // 20 m: ~5 m de fundura
    fundo.run(1);
    expect(fundo.match.estadoDaAgua(fundo.player).fundura).toBeGreaterThan(PRAIA_AGUA.afogaDesde!);
    const antes = fundo.player.modules.torso;
    fundo.run(6); // passa dos 3 s
    expect(fundo.player.modules.torso, 'no fundo, depois de 3 s, afoga').toBeLessThan(antes);
    expect(fundo.match.estadoDaAgua(fundo.player).afogandoS).toBeGreaterThan(3);
  });

  it('a Ponte Metálica: a rampa sobe sem pular e o Mech chega ao tabuleiro de 2,6 m sobre o mar', async () => {
    const { player, run, entrada } = await partidaDaPraia();
    // Na areia, de frente para a rampa (o mar fica no -z), andando para o mar.
    player.respawn(new THREE.Vector3(PRAIA_PIER.x, 0, PRAIA_PIER.zRampa + 6));
    entrada.moveZ = 1;
    run(8);
    expect(player.simPosition.y, 'subiu ao tabuleiro').toBeGreaterThan(PRAIA_PIER.topo - 0.5);
    expect(player.simPosition.z, 'andou para o mar').toBeLessThan(PRAIA_PIER.zTabuleiro);
    expect(player.alive).toBe(true);
  });

  it('as ondas rebeldes nascem em terra firme, longe da estação que o jogador defende, e vêm para ela (a rota de assalto)', async () => {
    const { match, player, run } = await partidaDaPraia();
    expect(match.bots.mechs.every((m) => !m.alive)).toBe(true);
    run(4); // passa o briefing: a onda 1 entra
    const vivos = match.bots.mechs.filter((m) => m.alive);
    expect(vivos.length).toBeGreaterThan(0);
    for (const m of vivos) {
      expect(faixaEm(m.simPosition.x, m.simPosition.z)).not.toBe('mar');
      expect(Math.hypot(m.simPosition.x - PRAIA_ESTACAO.x, m.simPosition.z - PRAIA_ESTACAO.z), 'longe da estação').toBeGreaterThan(120);
    }
    const distancia = (): number => Math.min(...vivos.filter((m) => m.alive).map((m) => Math.hypot(m.simPosition.x - player.simPosition.x, m.simPosition.z - player.simPosition.z)));
    const antes = distancia();
    run(40);
    // Em 40 s os rebeldes marcharam para os portões: a distância até quem defende encolheu bastante (não ficaram vagando).
    expect(distancia(), 'a onda marcha para a estação').toBeLessThan(antes - 60);
    // E todos os pontos da rota de assalto ficam perto da estação.
    for (const [x, z] of PRAIA_ASSALTO) expect(Math.hypot(x - PRAIA_ESTACAO.x, z - PRAIA_ESTACAO.z)).toBeLessThan(80);
    // O mapa jogável é o do tamanho certo (nada saiu pela parede invisível).
    for (const m of vivos) expect(m.simPosition.x).toBeLessThan(PRAIA_LIMITES.maxX);
  });
});

describe('o núcleo da estação na missão em ondas da praia (P127): a defesa de verdade', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('só a missão em ondas da praia tem núcleo: o combate livre e a Arena não', async () => {
    expect((await partidaDaPraia()).match.nucleo).not.toBeNull();
    expect((await partidaDaPraia({ mode: 'deathmatch' })).match.nucleo).toBeNull();
  });

  it('o rebelde que entra nos muros drena o núcleo; fora deles, não', async () => {
    const { match, run } = await partidaDaPraia({ damage: false });
    run(4); // a onda 1 entra: dois andróides
    const [a, b] = match.bots.mechs.filter((m) => m.alive);
    expect(a && b).toBeTruthy();
    // Fora do complexo (ainda na areia, longe): nada drena.
    expect(match.nucleo!.vida).toBe(NUCLEO.vidaMax);
    // Um deles entra no pátio: a rede começa a cair (andróide pesa meio).
    a!.respawn(new THREE.Vector3(262, 0, 40));
    run(2);
    expect(match.nucleo!.pressao).toBeGreaterThan(0);
    expect(match.nucleo!.vida).toBeLessThan(NUCLEO.vidaMax);
  });

  it('a estação cai: com o jogador a salvo, os invasores derrubam a rede e a missão FALHA (o jogador não precisa morrer)', async () => {
    const { match, player, run } = await partidaDaPraia({ damage: false });
    let fim: { survived: boolean } | null = null;
    match.onMissionEnd = (survived) => {
      fim = { survived };
    };
    run(4);
    const vivos = match.bots.mechs.filter((m) => m.alive);
    for (const m of vivos) m.respawn(new THREE.Vector3(262, 0, 40)); // todos dentro do complexo
    // O dano está desligado: o jogador não morre, e os invasores ficam lá drenando.
    run(260);
    expect(player.alive).toBe(true);
    expect(match.nucleo!.caiu).toBe(true);
    expect(match.waves!.phase).toBe('failed');
    expect(fim).toEqual({ survived: false });
  });

  it('cada onda eliminada devolve vida à rede', async () => {
    const { match, run } = await partidaDaPraia({ damage: false });
    run(4);
    match.nucleo!.vida = 500;
    // Os abates da onda (o diretor conta cada um): ao último, a onda está eliminada.
    while (match.waves!.phase === 'active') match.waves!.recordEnemyKilled();
    expect(match.waves!.phase).toBe('clear');
    expect(match.nucleo!.vida).toBeGreaterThanOrEqual(500 + NUCLEO.curaPorOnda - 1);
  });

  it('a missão nova levanta a estação de novo', async () => {
    const { match, run } = await partidaDaPraia({ damage: false });
    run(4);
    match.nucleo!.vida = 100;
    match.restartMission();
    expect(match.nucleo!.vida).toBe(NUCLEO.vidaMax);
  });
});
