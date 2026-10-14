import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { AimState, CameraContext } from './CameraMode';
import { ThirdPersonCamera } from './ThirdPersonCamera';

function fixture() {
  let obstruction: number | null = null;
  const collider = {};
  const ctx = {
    camera: new THREE.PerspectiveCamera(), look: { yaw: 0, pitch: 0 },
    mech: { position: new THREE.Vector3(), stats: { height: 5.3 }, collider },
    physics: { raycast: (_origin: THREE.Vector3, _dir: THREE.Vector3, range: number, exclude: unknown) => {
      expect(exclude).toBe(collider);
      return range < 100 && obstruction !== null ? { distance: obstruction } : null;
    } },
  } as unknown as CameraContext;
  const aim: AimState = { yaw: 0, pitch: 0, moveYaw: 0, point: new THREE.Vector3(), target: null };
  const mode = new ThirdPersonCamera(ctx);
  return { ctx, aim, mode, wall: (distance: number | null) => { obstruction = distance; },
    distance: () => ctx.camera.position.distanceTo(ctx.mech.position.clone().add(new THREE.Vector3(0, 4.4, 0))) };
}

describe('câmera de terceira pessoa: distância após cobertura', () => {
  it('entra já na distância correta e recolhe imediatamente diante de obstáculo', () => {
    const f = fixture();
    f.mode.update(0, f.aim);
    expect(f.distance()).toBeCloseTo(Math.hypot(1.8, .6, 7.5), 8);
    f.wall(2);
    f.mode.update(1 / 144, f.aim);
    expect(f.distance()).toBeCloseTo(1.6, 8);
  });

  it('elimina o salto de distância ao sair da parede sem atrasar o giro nem o movimento', () => {
    const f = fixture();
    f.wall(2); f.mode.update(1 / 60, f.aim);
    f.wall(null);
    f.ctx.look.yaw = Math.PI / 2;
    f.ctx.look.pitch = .2;
    f.ctx.mech.position.set(8, 0, -3);
    f.mode.update(1 / 60, f.aim);
    expect(f.distance()).toBeGreaterThan(1.6);
    expect(f.distance()).toBeLessThan(3);
    expect(f.aim.yaw).toBe(Math.PI / 2);
    expect(f.aim.pitch).toBe(.2);
    const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, Math.PI / 2, 0, 'YXZ'));
    expect(f.ctx.camera.quaternion.angleTo(expected)).toBeLessThan(1e-7);
  });

  it('recupera a mesma distância no mesmo tempo a 30, 60 e 144 Hz', () => {
    const distances = [30, 60, 144].map(hz => {
      const f = fixture();
      f.wall(2); f.mode.update(0, f.aim); f.wall(null);
      for (let i = 0; i < hz / 2; i++) f.mode.update(1 / hz, f.aim);
      return f.distance();
    });
    expect(distances[0]).toBeCloseTo(distances[1]!, 8);
    expect(distances[1]).toBeCloseTo(distances[2]!, 8);
  });

  it('recolhe outra vez durante a recuperação e reinicializa ao trocar de modo', () => {
    const f = fixture();
    f.wall(2); f.mode.update(0, f.aim); f.wall(null); f.mode.update(.05, f.aim);
    f.wall(1.5); f.mode.update(.01, f.aim);
    expect(f.distance()).toBeCloseTo(1.1, 8);
    f.wall(null); f.mode.enter(); f.mode.update(0, f.aim);
    expect(f.distance()).toBeCloseTo(Math.hypot(1.8, .6, 7.5), 8);
  });

  it('não ultrapassa a distância pedida pelo zoom nem anda para trás com dt zero', () => {
    const f = fixture();
    f.mode.update(0, f.aim); f.mode.onWheel(-1); f.mode.update(.01, f.aim);
    expect(f.distance()).toBeCloseTo(Math.hypot(1.8, .6, 7.5) * .88, 8);
    f.mode.onWheel(1); const near = f.distance(); f.mode.update(0, f.aim);
    expect(f.distance()).toBeCloseTo(near, 8);
    f.mode.update(1, f.aim);
    expect(f.distance()).toBeLessThanOrEqual(Math.hypot(1.8, .6, 7.5));
  });

  it('respeita uma parede real do Rapier e recupera depois da remoção', async () => {
    const physics = await PhysicsWorld.create();
    try {
      const wall = physics.addStaticBox(new THREE.Vector3(0, 5, 3), new THREE.Vector3(10, 10, 1));
      physics.step();
      const f = fixture();
      f.ctx.physics = physics;
      // O piloto não tem colisor neste ensaio isolado de câmera.
      Object.assign(f.ctx.mech, { collider: undefined });
      f.mode.update(1 / 60, f.aim);
      const blocked = f.distance();
      expect(f.ctx.camera.position.z).toBeLessThan(2.5);
      physics.removeCollider(wall); physics.step();
      f.mode.update(1 / 60, f.aim);
      expect(f.distance()).toBeGreaterThan(blocked);
      expect(f.distance()).toBeLessThan(blocked + 1.2);
      for (let i = 0; i < 60; i++) f.mode.update(1 / 60, f.aim);
      expect(f.distance()).toBeCloseTo(Math.hypot(1.8, .6, 7.5), 3);
    } finally { physics.world.free(); }
  });
});
