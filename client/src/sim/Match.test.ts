import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Android } from '../entities/Android';
import { PILOT_ANDROID_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { ALLY_COUNT, Match } from './Match';
import { CTF_BASES, CTF_CARRIER_SPEED } from './CaptureTheFlag';
import { WAVE_BRIEFING_S, WAVE_CLEAR_S } from './SurvivalWaves';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
/** Efeitos desligados: no servidor ninguém vê faísca. */
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;

/**
 * Uma partida como o servidor vai rodar: sem tela, sem DOM, com a sala cheia (1 jogador + os bots do
 * padrão) e o jogador parado (os bots vêm atrás dele). Devolve um resumo e o tempo médio do tick.
 */
async function play(seconds: number, debris: boolean, breakAll = false) {
  const physics = await PhysicsWorld.create();
  const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, debris });
  // Todas as barricadas quebradas no começo: o mapa fica igual com e sem destroços; só os estilhaços mudam.
  if (breakAll) match.destructibles.damageInRadius(new THREE.Vector3(0, 0, 0), 500, 1e6, new THREE.Vector3(0, 1, 0));
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
  return {
    match, player, hitsOnPlayer, where, deaths: match.round.scoreOf(player)?.deaths ?? 0, msPerTick,
    units: 1 + match.bots.mechs.length + (match.allies?.mechs.length ?? 0),
  };
}

describe('partida sem tela (M1 do multiplayer: o que o servidor vai rodar)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('a partida inteira roda no Node: os bots caçam, atiram e o placar conta', async () => {
    const r = await play(40, false);
    // Arena normal soma 2 aliados (30/09) e tira a mesma conta do pool de Mechs inimigos, pra não
    // estourar o teto de 8 personagens da sala (G11) — ver ALLY_COUNT em Match.ts.
    const enemyMechs = Math.max(0, DEFAULT_SETTINGS.enemyMechs - ALLY_COUNT);
    expect(r.units).toBe(1 + enemyMechs + DEFAULT_SETTINGS.enemyAndroids + (DEFAULT_SETTINGS.technician ? 1 : 0) + ALLY_COUNT);
    expect(r.units).toBeLessThanOrEqual(8);
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

  it('destroços visuais ficam só no cliente; servidor mantém a simulação sem corpos cosméticos', async () => {
    // Divergir de trajetória não é requisito: o cenário pode evoluir igual mesmo com corpos extras.
    const withDebris = await play(0.2, true, true);
    const without = await play(0.2, false, true);
    expect(withDebris.match.physics.world.bodies.len()).toBeGreaterThan(without.match.physics.world.bodies.len());
    expect(without.match.bots.mechs.every(m => m.alive)).toBe(true);
  });

  it('cabe no servidor: o tick da sala cheia fica bem abaixo dos 16,7 ms de um quadro (meta G14: 2 ms)', async () => {
    const r = await play(20, false);
    // Folga para máquina ocupada (CI, testes em paralelo): o número de referência sai do log da M7.
    expect(r.msPerTick).toBeLessThan(8);
  });
});

describe('jogar de andróide (a partida)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('a motosserra do jogador corta o inimigo encostado mais perto; longe de todos, não corta ninguém', async () => {
    const physics = await PhysicsWorld.create();
    // enemyMechs pede ALLY_COUNT + 1: a Arena normal tira ALLY_COUNT do pool pros aliados (30/09),
    // e este teste quer exatamente 1 Mech inimigo de verdade pra cortar.
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: { ...DEFAULT_SETTINGS, enemyMechs: ALLY_COUNT + 1, enemyAndroids: 0, technician: false }, debris: false });
    const pilot = new Android({ stats: PILOT_ANDROID_STATS, tool: 'pilot' });
    match.addPlayer(pilot, 'VOCÊ');
    const saw = pilot.loadout.secondary!;
    const rebel = match.bots.mechs[0]!;
    const total = () => Object.values(rebel.modules).reduce((a, b) => a + b, 0);
    const full = total();
    match.meleeNearest(pilot, saw);
    expect(total()).toBe(full);
    // Encosta o jogador na frente do Mech rebelde e corta: pega a perna dele.
    const r = rebel.simPosition;
    pilot.respawn(new THREE.Vector3(r.x, 0, r.z - (rebel.stats.radius + pilot.stats.radius + 0.3)));
    match.meleeNearest(pilot, saw);
    expect(total()).toBe(full - saw.damage);
    expect(rebel.modules.leftLeg + rebel.modules.rightLeg).toBeLessThan(rebel.stats.maxModuleHealth.leftLeg * 2);
  });
});

describe('missão Sobrevivência integrada à partida', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('ativa o pool conforme cada onda, conta abates e não renasce inimigos fora do plano', async () => {
    const physics = await PhysicsWorld.create();
    const match = new Match({
      physics,
      scene: new THREE.Scene(),
      particles: NO_FX,
      foes: DEFAULT_SETTINGS,
      debris: false,
      mode: 'survival',
    });
    const pilot = new Vector09();
    match.addPlayer(pilot, 'VOCÊ');
    const starts: number[] = [];
    match.onWaveStart = (wave) => starts.push(wave);

    for (let i = 0; i < Math.ceil(WAVE_BRIEFING_S / FIXED_DT) + 1; i++) match.step(FIXED_DT);
    let active = match.bots.mechs.filter((m) => m.alive);
    expect(starts).toEqual([1]);
    expect(active).toHaveLength(2);
    expect(active.every((m) => m instanceof Android)).toBe(true);

    for (const enemy of active) match.combat.crush(pilot, enemy, 1e9);
    expect(match.waves?.phase).toBe('clear');
    expect(match.waves?.killed).toBe(2);
    expect(match.bots.mechs.every((m) => !m.alive)).toBe(true);

    for (let i = 0; i < Math.ceil(WAVE_CLEAR_S / FIXED_DT) + 1; i++) match.step(FIXED_DT);
    active = match.bots.mechs.filter((m) => m.alive);
    expect(starts).toEqual([1, 2]);
    expect(active).toHaveLength(3);
    expect(active.filter((m) => m instanceof Android)).toHaveLength(2);
  });
});

describe('Capture The Flag integrado à partida', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('monta dois defensores, registra o jogador azul e captura de ponta a ponta', async () => {
    const physics = await PhysicsWorld.create();
    const match = new Match({
      physics,
      scene: new THREE.Scene(),
      particles: NO_FX,
      foes: DEFAULT_SETTINGS,
      debris: false,
      mode: 'ctf',
    });
    const pilot = new Vector09();
    match.addPlayer(pilot, 'VOCÊ');
    expect(match.bots.mechs).toHaveLength(2);
    expect(match.ctf?.teamOf(pilot)).toBe('blue');

    pilot.respawn(new THREE.Vector3(CTF_BASES.red.x, 0, CTF_BASES.red.z));
    match.step(FIXED_DT);
    expect(match.ctf?.flag('red').carrier).toBe(pilot);
    expect(pilot.moveSpeedScale).toBe(CTF_CARRIER_SPEED);

    pilot.respawn(new THREE.Vector3(CTF_BASES.blue.x, 0, CTF_BASES.blue.z));
    match.step(FIXED_DT);
    expect(match.ctf?.scores.blue.captures).toBe(1);
    expect(match.ctf?.flag('red').phase).toBe('home');
  });
});

describe('aliados na Arena normal (30/09, "sozinho tá muito intenso")', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('existem, nunca atiram no jogador, e o inimigo também os caça (não só o jogador)', async () => {
    const physics = await PhysicsWorld.create();
    const match = new Match({
      physics,
      scene: new THREE.Scene(),
      particles: NO_FX,
      foes: { ...DEFAULT_SETTINGS, enemyMechs: 3, enemyAndroids: 0, technician: false },
    });
    const player = new Vector09();
    match.addPlayer(player, 'VOCÊ');
    match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(IDLE, dt) });

    expect(match.allies?.mechs).toHaveLength(2);
    // O inimigo tira 2 vagas pros aliados (ALLY_COUNT do pool de enemyMechs=3): sobra 1 Mech inimigo de verdade.
    expect(match.bots.mechs).toHaveLength(1);

    let friendlyFireOnPlayer = 0;
    let alliesGotHit = 0;
    let enemyGotHit = 0;
    match.onMechHit = (e) => {
      if (e.mech === player && e.shooter && match.allies!.mechs.includes(e.shooter)) friendlyFireOnPlayer++;
      if (match.allies!.mechs.includes(e.mech)) alliesGotHit++;
      if (match.bots.mechs.includes(e.mech)) enemyGotHit++;
    };

    const ticks = Math.round(30 / FIXED_DT);
    for (let i = 0; i < ticks; i++) match.step(FIXED_DT);

    expect(friendlyFireOnPlayer).toBe(0);
    // Prova que o combate de 3 lados de verdade rolou: aliado brigando com inimigo, os dois se acertando.
    expect(enemyGotHit).toBeGreaterThan(0);
    expect(alliesGotHit).toBeGreaterThan(0);
  });

  it('Sobrevivência e CTF não ganham aliado (pool e time próprios)', async () => {
    const physics = await PhysicsWorld.create();
    const survival = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, mode: 'survival' });
    expect(survival.allies).toBeNull();
    const ctf = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, mode: 'ctf' });
    expect(ctf.allies).toBeNull();
  });
});
