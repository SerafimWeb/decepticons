import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { AMAZONIA_GERADORES, AMAZONIA_GUARDA, larguraDoRio, rioEmX } from '../environment/AmazoniaLayout';
import { alturaDoTerreno } from '../environment/AmazoniaTerreno';
import { carregarChefeSeFor, carregarMapaSeFor } from '../environment/mapasSobDemanda';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from './Match';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

async function partida(mode: 'survival' | 'deathmatch' = 'survival') {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'amazonia', mode, particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate({ ...IDLE }, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  const levar = (x: number, z: number): void => {
    player.respawn(new THREE.Vector3(x, alturaDoTerreno(x, z) + 0.2, z));
  };
  /** Quantos tiros acertaram o jogador (a vida dele regenera e some de um medidor; o evento não). */
  const acertos = { n: 0, deTorre: 0 };
  match.onMechHit = (e) => {
    if (e.mech === player) {
      acertos.n++;
      if (!e.shooter) acertos.deTorre++;
    }
  };
  return { match, player, run, levar, acertos };
}

describe('a força de defesa e as torres da Amazônia no Match (P180, parte D2)', () => {
  beforeAll(async () => {
    await RAPIER.init();
    await carregarMapaSeFor('amazonia');
    await carregarChefeSeFor('amazonia');
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('a missão do rio tem o Draga e uma guarda de 3 Mechs e 6 andróides em volta dos geradores; o Deathmatch da Amazônia não tem guarda nem torres', async () => {
    const { match } = await partida();
    expect(match.bots.chefe?.stats.name).toBe('DRAGA-01');
    expect(match.bots.mechs).toHaveLength(1 + AMAZONIA_GUARDA.mechs.length + AMAZONIA_GUARDA.androids.length);
    expect(AMAZONIA_GUARDA.mechs).toHaveLength(3);
    expect(AMAZONIA_GUARDA.androids).toHaveLength(6);
    expect(match.torres).not.toBeNull();
    expect(match.torres!.pontos).toHaveLength(8);
    const dm = await partida('deathmatch');
    expect(dm.match.torres).toBeNull();
    expect(dm.match.bots.chefe).toBeNull();
  });

  it('cada Mech da guarda nasce perto de um gerador (menos de 60 m), e a guarda inteira fica do lado norte do rio com os geradores', () => {
    const noLado = ([x, z]: readonly [number, number]): boolean => z > rioEmX(x) + larguraDoRio(x) / 2;
    for (const p of [...AMAZONIA_GUARDA.mechs, ...AMAZONIA_GUARDA.androids]) expect(noLado(p), `guarda em (${p[0]}, ${p[1]})`).toBe(true);
    for (const m of AMAZONIA_GUARDA.mechs) {
      const perto = AMAZONIA_GERADORES.some((g) => Math.hypot(g.x - m[0], g.z - m[1]) < 60);
      expect(perto, `Mech em (${m[0]}, ${m[1]}) longe de todo gerador`).toBe(true);
    }
  });

  it('a guarda SEGURA O POSTO: sem ninguém por perto, depois de 20 s cada um segue a menos de 15 m de onde nasceu (não vaga pelo mapa nem corre para a aldeia)', async () => {
    const { match, run } = await partida();
    const antes = match.bots.mechs.map((m) => ({ x: m.simPosition.x, z: m.simPosition.z }));
    run(20);
    match.bots.mechs.forEach((m, i) => {
      if (m === match.bots.chefe) return;
      expect(Math.hypot(m.simPosition.x - antes[i]!.x, m.simPosition.z - antes[i]!.z), `bot ${i}`).toBeLessThan(15);
    });
  });

  it('a guarda não renasce: derrubado, fica derrubado', async () => {
    const { match, run } = await partida();
    const guarda = match.bots.mechs.find((m) => m !== match.bots.chefe)!;
    guarda.damagePart('torso', 1e6);
    expect(guarda.alive).toBe(false);
    run(40);
    expect(guarda.alive).toBe(false);
  });

  it('quem atravessa o rio sob uma torre leva fogo de cobertura; derrubado o gerador da CERCA, as torres calam', async () => {
    const { match, run, levar, acertos } = await partida();
    const x = 60;
    levar(x, rioEmX(x) - larguraDoRio(x) / 2 - 12); // na margem sul, de frente para a torre da margem norte (~140 m)
    run(12);
    expect(match.torres!.tiros, 'as torres atiraram').toBeGreaterThan(0);
    expect(acertos.deTorre, 'e acertaram alguma vez (tiro sem dono: o da torre)').toBeGreaterThan(0);
    // o gerador da CERCA cai: as torres perdem a energia e param de atirar
    match.escudo!.quebrar(0);
    run(0.2);
    expect(match.torres!.ativa).toBe(false);
    const tiros = match.torres!.tiros;
    run(10);
    expect(match.torres!.tiros).toBe(tiros);
  });

  it('as torres só atiram em quem está ao alcance: o jogador na aldeia, a 1.000 m, não leva um tiro', async () => {
    const { match, run } = await partida();
    run(12);
    expect(match.torres!.tiros).toBe(0);
  });

  it('um Mech da guarda troca tiro com quem chega perto do posto (com as torres caladas, para o dano ser só dele)', async () => {
    const { match, run, levar, acertos } = await partida();
    match.escudo!.quebrar(0);
    const [mx, mz] = AMAZONIA_GUARDA.mechs[1]!;
    levar(mx - 30, mz - 6);
    run(15);
    expect(acertos.n, 'o Mech da guarda acertou o jogador').toBeGreaterThan(0);
    expect(acertos.deTorre, 'e nenhum tiro foi de torre').toBe(0);
  });

  it('a guarda DORME enquanto ninguém chega perto (zero CPU: não pensa nem se move) e ACORDA com um alvo a 420 m ou com dano', async () => {
    const { match, run, levar } = await partida();
    const guarda = match.bots.mechs.find((m) => m !== match.bots.chefe && m.stats.radius > 1)!;
    const espiao = vi.spyOn(guarda, 'fixedUpdate');
    levar(-960, -180); // longe de tudo (o posto avançado, onde o jogador nasce, já está a menos de 420 m de um Mech da guarda)
    run(3);
    expect(espiao, 'o jogador está a ~900 m: a guarda dorme').toHaveBeenCalledTimes(0);
    // um alvo chega a menos de 420 m: ela acorda
    levar(guarda.simPosition.x - 300, guarda.simPosition.z - 120);
    run(1);
    expect(espiao.mock.calls.length).toBeGreaterThan(30);
    // o alvo some de novo: ela fica acordada por alguns segundos e volta a dormir
    levar(-960, -180);
    run(8);
    const depois = espiao.mock.calls.length;
    run(2);
    expect(espiao.mock.calls.length, 'dormiu de novo').toBe(depois);
    // dano de longe (um tiro de rifle a 900 m) a acorda
    guarda.damagePart('torso', 30);
    run(1);
    expect(espiao.mock.calls.length).toBeGreaterThan(depois + 30);
  });
});
