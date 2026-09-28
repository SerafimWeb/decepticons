import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { MechBase } from '../entities/MechBase';
import type { Occluder } from '../environment/Arena';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { KillCam } from './KillCam';

function subject(x = 12, z = -4): MechBase {
  return {
    position: new THREE.Vector3(x, 0, z),
    yaw: 0,
    stats: { height: 5.3 },
    collider: {},
  } as unknown as MechBase;
}

const CLEAR_WORLD = { raycast: () => null } as unknown as PhysicsWorld;

describe('KillCam (render isolado)', () => {
  it('acompanha atrás e acima do matador sem alterar o alvo', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 4, 8);
    const killer = subject();
    const original = killer.position.clone();
    const killCam = new KillCam(camera, CLEAR_WORLD);

    killCam.start(killer, new THREE.Vector3(0, 2.4, 0));
    for (let i = 0; i < 90; i++) killCam.update(1 / 60);

    expect(killCam.overridesRig).toBe(true);
    expect(camera.position.y).toBeGreaterThan(killer.position.y + 3);
    expect(camera.position.z).toBeGreaterThan(killer.position.z);
    expect(killer.position).toEqual(original);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const toKiller = new THREE.Vector3()
      .copy(killer.position)
      .setY(killer.position.y + killer.stats.height * 0.55)
      .sub(camera.position)
      .normalize();
    expect(direction.dot(toKiller)).toBeGreaterThan(0.98);
  });

  it('V cancela imediatamente; o renascimento faz transição e termina na câmera normal', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 4, 8);
    const killCam = new KillCam(camera, CLEAR_WORLD);
    killCam.start(subject(), new THREE.Vector3(0, 2.4, 0));
    killCam.update(1 / 60);
    killCam.cancel();
    expect(killCam.active).toBe(false);

    killCam.start(subject(), new THREE.Vector3(0, 2.4, 0));
    for (let i = 0; i < 30; i++) killCam.update(1 / 60);
    killCam.release();
    expect(killCam.overridesRig).toBe(false);

    const normal = new THREE.Vector3(-20, 7, 30);
    for (let i = 0; i < 30; i++) {
      // No jogo esta pose é escrita pelo CameraRig antes de KillCam.update().
      camera.position.copy(normal);
      camera.quaternion.identity();
      killCam.update(1 / 60);
    }

    expect(killCam.active).toBe(false);
    expect(camera.position.distanceTo(normal)).toBeLessThan(1e-6);
  });

  it('evita parede a partir do matador mesmo enquanto olha o destroço distante', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 4, 8);
    const killer = subject(12, -4);
    const rayOrigin = new THREE.Vector3();
    const blocked = {
      raycast(origin: THREE.Vector3) {
        rayOrigin.copy(origin);
        return { distance: 2 };
      },
    } as unknown as PhysicsWorld;
    const killCam = new KillCam(camera, blocked);

    killCam.start(killer, new THREE.Vector3(-80, 2.4, 60));
    for (let i = 0; i < 120; i++) killCam.update(1 / 60);

    expect(rayOrigin.x).toBeCloseTo(killer.position.x);
    expect(rayOrigin.y).toBeCloseTo(killer.position.y + killer.stats.height * 0.55);
    expect(rayOrigin.z).toBeCloseTo(killer.position.z);
    expect(camera.position.distanceTo(rayOrigin)).toBeLessThan(2);
  });

  it('torna translúcido o prédio que esconde o matador e restaura ao sair', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 4, 8);
    const material = new THREE.MeshStandardMaterial({ transparent: true });
    const occluder = {
      box: new THREE.Box3(new THREE.Vector3(8, 0, -8), new THREE.Vector3(16, 12, 2)),
      material,
    } satisfies Occluder;
    const killCam = new KillCam(camera, CLEAR_WORLD, [occluder]);

    killCam.start(subject(12, -4), new THREE.Vector3(0, 2.4, 0));
    for (let i = 0; i < 90; i++) killCam.update(1 / 60);
    expect(material.opacity).toBeLessThan(1);
    expect(material.depthWrite).toBe(false);

    killCam.cancel();
    expect(material.opacity).toBe(1);
    expect(material.depthWrite).toBe(true);
  });

  it('troca para o ombro lateral quando as costas do matador estão bloqueadas', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 4, 8);
    const world = {
      raycast(_origin: THREE.Vector3, direction: THREE.Vector3) {
        return direction.z > 0.5 ? { distance: 0.4 } : null;
      },
    } as unknown as PhysicsWorld;
    const killCam = new KillCam(camera, world);
    const killer = subject(12, -4);

    killCam.start(killer, new THREE.Vector3(0, 2.4, 0));
    for (let i = 0; i < 120; i++) killCam.update(1 / 60);

    expect(Math.abs(camera.position.x - killer.position.x)).toBeGreaterThan(4);
    expect(camera.position.z - killer.position.z).toBeLessThan(3);
  });
});
