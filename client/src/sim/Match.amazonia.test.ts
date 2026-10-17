import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { AMAZONIA_LIMITES, AMAZONIA_SPAWNS, estaNoRio, NIVEL_DA_AGUA } from '../environment/AmazoniaLayout';
import { alturaDoTerreno } from '../environment/AmazoniaTerreno';
import { mapFromSearch } from '../environment/Bunker';
import { carregarMapaSeFor } from '../environment/mapasSobDemanda';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from './Match';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

/** O Deathmatch da Amazônia (P180, parte B), sem tela: o jogador nasce na aldeia, os outros ao longo da margem sul do rio. */
async function partidaDaAmazonia() {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'amazonia', mode: 'deathmatch', particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  const entrada = { ...IDLE };
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(entrada, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  return { match, player, run, entrada };
}

describe('a Amazônia no Match (P180, parte B): o Deathmatch no mapa grande', () => {
  beforeAll(async () => {
    await RAPIER.init();
    await carregarMapaSeFor('amazonia'); // o Game.create faz o mesmo antes de montar a partida
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('o jogador nasce no ponto da aldeia (o primeiro) e o chão o segura: nem afunda nem cai pelo terreno', async () => {
    const { player, run } = await partidaDaAmazonia();
    expect(player.simPosition.x).toBeCloseTo(AMAZONIA_SPAWNS[0]![0], 0);
    expect(player.simPosition.z).toBeCloseTo(AMAZONIA_SPAWNS[0]![1], 0);
    expect(estaNoRio(player.simPosition.x, player.simPosition.z)).toBe(false);
    run(3);
    const chao = alturaDoTerreno(player.simPosition.x, player.simPosition.z);
    expect(player.simPosition.y).toBeGreaterThan(chao - 0.4);
    expect(player.simPosition.y).toBeLessThan(chao + 0.8);
  });

  it('os bots nascem nos outros pontos do mapa, todos em terra firme e dentro dos limites', async () => {
    const { match, run } = await partidaDaAmazonia();
    expect(match.bots.mechs.length).toBeGreaterThan(0);
    const pontos = new Set(AMAZONIA_SPAWNS.slice(1).map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`));
    for (const m of match.bots.mechs) {
      const p = m.simPosition;
      expect(pontos.has(`${p.x.toFixed(1)},${p.z.toFixed(1)}`), `bot em ${p.x.toFixed(0)},${p.z.toFixed(0)} fora dos pontos do mapa`).toBe(true);
      expect(estaNoRio(p.x, p.z)).toBe(false);
    }
    run(3);
    for (const m of match.bots.mechs) {
      expect(m.simPosition.y, 'o bot não pode ter caído pelo chão').toBeGreaterThan(NIVEL_DA_AGUA - 0.5);
      expect(Math.abs(m.simPosition.x)).toBeLessThan(AMAZONIA_LIMITES.maxX);
      expect(Math.abs(m.simPosition.z)).toBeLessThan(AMAZONIA_LIMITES.maxZ);
    }
  });

  it('o Arena entrega ao mapa o tempo e o olhar da câmera: o relógio da água anda com o update e o céu e a floresta seguem o observar', async () => {
    const { match } = await partidaDaAmazonia();
    const mapa = match.arena.amazonia as unknown as { u: { tempo: { value: number } }; floresta: { pedacos: { perto: { visible: boolean } }[] } };
    expect(mapa).not.toBeNull();
    match.arena.update(0.5);
    match.arena.update(0.25);
    expect(mapa.u.tempo.value).toBeCloseTo(0.75, 9);
    match.arena.observar(0, 20, 0);
    expect(mapa.floresta.pedacos.some((p) => p.perto.visible), 'perto do centro do mapa há árvore de perto').toBe(true);
    match.arena.observar(-1150, 20, -440);
    const pertoNoCanto = mapa.floresta.pedacos.filter((p) => p.perto.visible).length;
    expect(pertoNoCanto).toBeLessThanOrEqual(9);
  });

  it('nos outros mapas o Arena não tem mapa da Amazônia (o observar não faz nada)', async () => {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const match = new Match({ physics, scene: new THREE.Scene(), map: 'arena', mode: 'deathmatch', particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
    expect(match.arena.amazonia).toBeNull();
    expect(() => match.arena.observar(1, 2, 3)).not.toThrow();
  });

  it('o mapa não tem zonas de domínio nem missão: a partida é só o Deathmatch (as missões vêm nas partes C a E)', async () => {
    const { match } = await partidaDaAmazonia();
    expect((match.zones as unknown as { zones: readonly unknown[] }).zones.length).toBe(0); // a lista é privada: o que importa é que está vazia
    expect(match.waves).toBeNull();
    expect(match.nucleo).toBeNull();
  });

  it('o terreno é UM colisor de altura que o Mech pisa de verdade: andando pela margem, o Mech acompanha o relevo sem afundar nem voar', async () => {
    const { player, run, entrada } = await partidaDaAmazonia();
    run(1);
    const x0 = player.simPosition.x;
    const z0 = player.simPosition.z;
    entrada.moveZ = 1;
    entrada.yaw = -Math.PI / 2; // a frente (−Z) do Mech passa a apontar para o leste (+X), rio abaixo
    for (let i = 0; i < 6; i++) {
      run(2);
      const chao = alturaDoTerreno(player.simPosition.x, player.simPosition.z);
      expect(Math.abs(player.simPosition.y - chao), `${player.simPosition.x.toFixed(0)},${player.simPosition.z.toFixed(0)}`).toBeLessThan(3);
    }
    expect(Math.hypot(player.simPosition.x - x0, player.simPosition.z - z0), 'o Mech andou de fato').toBeGreaterThan(30);
  });
});

describe('o link da Amazônia (P180, parte B): ?mapa=amazonia só abre no Deathmatch offline', () => {
  it('abre a Amazônia no Deathmatch; os outros modos e o online ficam na Cidade Neon', () => {
    expect(mapFromSearch('?mapa=amazonia', false, 'deathmatch')).toBe('amazonia');
    expect(mapFromSearch('?mapa=amazonia', false, 'survival')).toBe('arena');
    expect(mapFromSearch('?mapa=amazonia', false, 'ctf')).toBe('arena');
    expect(mapFromSearch('?mapa=amazonia', true, 'deathmatch')).toBe('arena');
    expect(mapFromSearch('?mapa=outra', false, 'deathmatch')).toBe('arena');
  });
});
