import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SERAFIM_TOWER } from '../environment/SerafimTower';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { DRONE, DRONE_GUN, DroneSystem, KAMIKAZE_BLAST } from './DroneSystem';
import type { WeaponStats } from './weapons';

let physics: PhysicsWorld;
beforeEach(async () => {
  physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(400, 2, 400));
});
afterEach(() => physics.world.free());

/** Esquadrilha num campo aberto: anota tiros e explosões em vez de desenhar. */
function squad(friends: Vector09[], enemies: Vector09[]) {
  const shots: WeaponStats[] = [];
  const blasts: THREE.Vector3[] = [];
  const system = new DroneSystem({
    physics,
    projectiles: { fire: (_o: THREE.Vector3, _d: THREE.Vector3, _c: unknown, _h: boolean, w: WeaponStats) => shots.push(w) } as never,
    particles: { burst: () => {} } as never,
    friends: () => friends,
    enemies: () => enemies,
    explode: (at) => blasts.push(at.clone()),
  });
  const run = (seconds: number): void => {
    for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) {
      system.fixedUpdate(FIXED_DT);
      physics.step();
    }
  };
  return { system, shots, blasts, run };
}

const mechAt = (x: number, z: number): Vector09 => {
  const m = new Vector09();
  m.spawn(physics, new THREE.Vector3(x, 0, z));
  return m;
};

describe('drones da base Serafim', () => {
  it('sem ameaça, a patrulha circula a base e o kamikaze fica pousado', () => {
    const { system, shots, blasts, run } = squad([mechAt(0, 0)], [mechAt(-90, -90)]);
    run(6);
    expect(shots).toHaveLength(0);
    expect(blasts).toHaveLength(0);
    const patrol = system.drones.find((d) => d.role === 'patrulha')!;
    expect(Math.hypot(patrol.pos.x - SERAFIM_TOWER.x, patrol.pos.z - SERAFIM_TOWER.z)).toBeLessThan(40);
    expect(system.drones.find((d) => d.role === 'kamikaze')!.state).toBe('pouso');
  });

  it('inimigo perto da base: a patrulha voa até ele e atira laser; o kamikaze mergulha e explode nele', () => {
    const enemy = mechAt(SERAFIM_TOWER.x - 30, SERAFIM_TOWER.z);
    const { system, shots, blasts, run } = squad([mechAt(-60, -60)], [enemy]);
    run(12);
    expect(shots.length).toBeGreaterThan(3);
    expect(shots.every((w) => w === DRONE_GUN)).toBe(true);
    expect(blasts.length).toBeGreaterThanOrEqual(1);
    expect(blasts[0]!.distanceTo(enemy.simPosition)).toBeLessThan(KAMIKAZE_BLAST.blastRadius + 3);
    expect(system.drones.filter((d) => d.role === 'kamikaze').some((d) => d.state === 'abatido')).toBe(true);
  });

  it('conserto devolve vida ao amigo avariado; recarga tira o calor', () => {
    const friend = mechAt(SERAFIM_TOWER.x - 25, SERAFIM_TOWER.z + 10);
    friend.damagePart('torso', 120);
    friend.absorbEmp(0.8);
    const { system, run } = squad([friend], [mechAt(-90, -90)]);
    const hp = friend.modules.torso;
    run(0.5);
    expect(system.drones.find((d) => d.role === 'conserto')!.target).toBe(friend);
    expect(system.drones.find((d) => d.role === 'recarga')!.target).toBe(friend);
    run(15);
    expect(friend.modules.torso).toBeGreaterThan(hp + 20);
    expect(friend.heat).toBeLessThan(0.5);
  });

  it('tiro derruba o drone, ele some do mundo e volta pela base depois do intervalo', () => {
    const { system, run } = squad([mechAt(0, 0)], []);
    const d = system.drones[0]!;
    expect(system.hit(d.collider!, DRONE.hp)).toBe(true);
    expect(d.state).toBe('abatido');
    expect(system.flying).toBe(system.drones.length - 1);
    run(DRONE.respawnS + 0.5);
    expect(d.state).not.toBe('abatido');
    expect(d.hp).toBe(DRONE.hp);
    expect(d.pos.y).toBeGreaterThan(SERAFIM_TOWER.height - 10);
  });

  it('explosão perto derruba quem está no raio', () => {
    const { system } = squad([mechAt(0, 0)], []);
    const d = system.drones[0]!;
    system.explosion(d.pos.clone(), { ...KAMIKAZE_BLAST, damage: DRONE.hp });
    expect(d.state).toBe('abatido');
  });
});
