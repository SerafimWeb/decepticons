import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraPath } from './CameraPath';
import { CutsceneDirector } from './CutsceneDirector';

function path(duration = 2): CameraPath {
  return new CameraPath([
    { t: 0, position: { x: 0, y: 10, z: 0 }, lookAt: { x: 1, y: 0, z: 0 }, fov: 50 },
    { t: duration, position: { x: 10, y: 10, z: 0 }, lookAt: { x: 11, y: 0, z: 0 }, fov: 40 },
  ]);
}

describe('CutsceneDirector (render isolado)', () => {
  it('não mexe na câmera antes de start()', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 5, 5);
    const director = new CutsceneDirector(camera, path());
    director.update(1 / 60);
    expect(camera.position.x).toBe(5);
    expect(director.overridesRig).toBe(false);
  });

  it('assume a câmera enquanto toca e libera quando termina', () => {
    const camera = new THREE.PerspectiveCamera();
    const director = new CutsceneDirector(camera, path(2));
    director.start();
    expect(director.overridesRig).toBe(true);

    for (let i = 0; i < 180; i++) director.update(1 / 60); // 3 s > duração de 2 s

    expect(director.done).toBe(true);
    expect(director.overridesRig).toBe(false);
    expect(camera.position.x).toBeCloseTo(10, 1);
  });

  it('progress vai de 0 a 1 e nunca passa disso', () => {
    const director = new CutsceneDirector(new THREE.PerspectiveCamera(), path(1));
    director.start();
    expect(director.progress).toBe(0);
    director.update(0.5);
    expect(director.progress).toBeCloseTo(0.5, 5);
    director.update(10);
    expect(director.progress).toBe(1);
  });
});
