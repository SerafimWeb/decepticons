import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Bunker, BUNKER_SPAWNS, mapFromSearch } from './Bunker';
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
    expect(mech.simPosition.z).toBe(48);
    expect(match.arena.serafim).toBeNull(); expect(match.drones).toBeNull();
    mech.modules.torso = 0;
    for (let i = 0; i < 190; i++) match.step(FIXED_DT);
    expect(mech.alive).toBe(true); expect(mech.simPosition.z).toBe(48);
    physics.world.free();
  });
  it('não muda o mapa do servidor nem os objetivos de missões', () => {
    expect(mapFromSearch('?mapa=bunker', false, 'deathmatch')).toBe('bunker');
    expect(mapFromSearch('?mapa=bunker', true, 'deathmatch')).toBe('arena');
    expect(mapFromSearch('?mapa=bunker', false, 'ctf')).toBe('arena');
    expect(mapFromSearch('?mapa=desconhecido', false, 'deathmatch')).toBe('arena');
  });
  it('tem três pisos, vão central aberto e nascimentos no solo livre', async () => {
    const physics = await PhysicsWorld.create();
    const bunker = new Bunker(new THREE.Scene(), physics);
    physics.step();
    for (const y of [0, 10, 20]) expect(physics.terrainY(56, 24, y + 0.5, 2)).toBeCloseTo(y, 2);
    expect(physics.terrainY(0, 0, 25, 30)).toBeCloseTo(0, 2);
    for (const [x, z] of BUNKER_SPAWNS) expect(physics.terrainY(x, z, 0.5, 2)).toBeCloseTo(0, 2);
    expect(bunker.solids.count).toBeLessThan(70);
    physics.world.free();
  });
  it.each([-36, 36])('sobe os dois lances sem pulo pelo lado x=%s', async (x) => {
    const physics = await PhysicsWorld.create();
    new Bunker(new THREE.Scene(), physics);
    const mech = new Vector09();
    mech.spawn(physics, new THREE.Vector3(x, 0, 25));
    const input = { moveX: 0, moveZ: 1, moveYaw: 0, yaw: 0, jump: false, dash: false };
    for (let i = 0; i < 660; i++) { mech.fixedUpdate(input, FIXED_DT); physics.step(); }
    expect(mech.simPosition.z).toBeLessThan(-66);
    expect(mech.simPosition.y).toBeGreaterThan(19.8);
    mech.despawn(physics); physics.world.free();
  });
  it('as galerias têm passagem cruzada e parede que corta a visão', async () => {
    const physics = await PhysicsWorld.create();
    new Bunker(new THREE.Scene(), physics); physics.step();
    const dir = new THREE.Vector3(1, 0, 0);
    for (const y of [3, 13, 23]) {
      expect(physics.raycast(new THREE.Vector3(52, y, 0), dir, 32)).toBeNull();
      expect(physics.raycast(new THREE.Vector3(52, y, 24), dir, 32)).not.toBeNull();
    }
    physics.world.free();
  });
});
