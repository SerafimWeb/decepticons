import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Bunker, BUNKER_LEVELS, BUNKER_SPAWNS, bunkerBlocks, mapFromSearch } from './Bunker';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Vector09 } from '../entities/Vector09';
import { Match } from '../sim/Match';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { ParticleSystem } from '../fx/ParticleSystem';

describe('Bunker: mapa físico compartilhado', () => {
  it('a partida usa spawn/respawn do bunker sem ativar instalações da cidade', async () => {
    const physics = await PhysicsWorld.create();
    const match = new Match({ physics, scene: new THREE.Scene(), map: 'bunker',
      particles: { burst: () => {} } as unknown as ParticleSystem,
      foes: { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false }, debris: false, allies: false });
    const mech = new Vector09(); match.addPlayer(mech, 'TESTE');
    expect(mech.simPosition.z).toBe(43);
    expect(match.arena.serafim).toBeNull(); expect(match.drones).toBeNull();
    mech.modules.torso = 0;
    for (let i = 0; i < 190; i++) match.step(FIXED_DT);
    expect(mech.alive).toBe(true); expect(mech.simPosition.z).toBe(43);
    physics.world.free();
  });
  it('não muda o mapa do servidor nem os objetivos de missões', () => {
    expect(mapFromSearch('?mapa=bunker', false, 'deathmatch')).toBe('bunker');
    expect(mapFromSearch('?mapa=bunker', true, 'deathmatch')).toBe('arena');
    expect(mapFromSearch('?mapa=bunker', false, 'ctf')).toBe('arena');
    expect(mapFromSearch('?mapa=desconhecido', false, 'deathmatch')).toBe('arena');
  });
  it('tem quatro andares separados, poço aberto e nascimentos no fundo', async () => {
    const physics = await PhysicsWorld.create();
    const bunker = new Bunker(new THREE.Scene(), physics);
    physics.step();
    expect(BUNKER_LEVELS).toEqual([0, 14, 28, 42]);
    for (const y of BUNKER_LEVELS) expect(physics.terrainY(56, 24, y + 0.5, 2)).toBeCloseTo(y, 2);
    expect(physics.terrainY(0, 0, 10, 10)).toBeCloseTo(0, 2);
    for (const [x, z] of BUNKER_SPAWNS) expect(physics.terrainY(x, z, 0.5, 2)).toBeCloseTo(0, 2);
    expect(bunker.solids.count).toBeLessThan(310);
    expect(bunkerBlocks().some((b) => b.kind === 'sniper' && b.y > 42)).toBe(true);
    physics.world.free();
  });
  it.each([0, 14, 28])('rampas permitem subir do andar %s para o seguinte sem pulo', async (floor) => {
    const physics = await PhysicsWorld.create();
    new Bunker(new THREE.Scene(), physics);
    const mech = new Vector09();
    mech.spawn(physics, new THREE.Vector3(36, floor, 27));
    const input = { moveX: 0, moveZ: 1, moveYaw: 0, yaw: 0, jump: false, dash: false };
    for (let i = 0; i < 900; i++) { mech.fixedUpdate(input, FIXED_DT); physics.step(); }
    expect(mech.simPosition.y).toBeGreaterThan(floor + 13.5);
    mech.despawn(physics); physics.world.free();
  });
  it.each([0, 14, 28])('rampas transversais ligam o andar %s ao próximo', async (floor) => {
    const physics = await PhysicsWorld.create();
    new Bunker(new THREE.Scene(), physics);
    const mech = new Vector09();
    mech.spawn(physics, new THREE.Vector3(-27, floor, 69));
    const input = { moveX: 1, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
    for (let i = 0; i < 900; i++) { mech.fixedUpdate(input, FIXED_DT); physics.step(); }
    expect(mech.simPosition.y).toBeGreaterThan(floor + 13.5);
    mech.despawn(physics); physics.world.free();
  });
  it('galerias cortam linha de tiro e a passagem secreta continua transitável', async () => {
    const physics = await PhysicsWorld.create();
    new Bunker(new THREE.Scene(), physics); physics.step();
    const dir = new THREE.Vector3(1, 0, 0);
    for (const y of [3, 17, 31, 45]) {
      expect(physics.raycast(new THREE.Vector3(40, y, 0), dir, 32)).toBeNull();
      expect(physics.raycast(new THREE.Vector3(40, y, 24), dir, 32)).not.toBeNull();
    }
    expect(physics.raycast(new THREE.Vector3(49, 31, -40), dir, 30)).toBeNull();
    expect(physics.raycast(new THREE.Vector3(64, 31, -43), new THREE.Vector3(0, 0, -1), 18)).toBeNull();
    expect(physics.raycast(new THREE.Vector3(57, 45, 57), new THREE.Vector3(-1, 0, -1).normalize(), 80)).toBeNull();
    physics.world.free();
  });
});
