import * as THREE from 'three';
import { expect, it } from 'vitest';
import { ARENA_ZONES } from '../combat/Zone';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SPAWN_POINTS } from './Arena';
import { SERAFIM_TOWER, SerafimTower } from './SerafimTower';

/** Banco VORCARIS: a fachada do prédio ciano de `Arena.ts` (times opostos ficam longe). */
const BANK = { x: -28, z: -35 };

it('o Prédio Serafim é sólido, alto, longe do banco e fora de nascimentos e zonas', async () => {
  const physics = await PhysicsWorld.create();
  try {
    const tower = new SerafimTower(new THREE.Scene(), physics);
    physics.step();
    // Tiro vindo do centro da arena para a base do prédio para no casco (bloqueia tiro e visão, no cliente e no servidor).
    const from = new THREE.Vector3(0, 3, SERAFIM_TOWER.z);
    const hit = physics.firstColliderOnRay(from, new THREE.Vector3(1, 0, 0), 200);
    expect(hit).not.toBeNull();
    // O topo (base dos drones) é chão de verdade a 56 m.
    expect(physics.terrainY(SERAFIM_TOWER.x, SERAFIM_TOWER.z, 80, 40)).toBeCloseTo(SERAFIM_TOWER.height + 0.6, 1);
    expect(Math.hypot(SERAFIM_TOWER.x - BANK.x, SERAFIM_TOWER.z - BANK.z)).toBeGreaterThan(120);
    const clear = tower.bounds.clone().expandByScalar(3);
    for (const [x, z] of SPAWN_POINTS) expect(clear.containsPoint(new THREE.Vector3(x, 1, z)), `${x},${z}`).toBe(false);
    for (const zone of ARENA_ZONES) expect(Math.hypot(zone.x - SERAFIM_TOWER.x, zone.z - SERAFIM_TOWER.z)).toBeGreaterThan(zone.radius + 12);
    // LED: verde é o normal; emergência e festa trocam a cor sem quebrar a volta ao verde.
    expect(tower.ledMode).toBe('ok');
    tower.setMode('emergencia');
    tower.update(0.1);
    tower.setMode('ok');
    expect(tower.ledMode).toBe('ok');
  } finally {
    physics.world.free();
  }
});
