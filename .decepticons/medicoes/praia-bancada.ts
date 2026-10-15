import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PhysicsWorld } from '../../client/src/physics/PhysicsWorld';
import { Praia } from '../../client/src/environment/Praia';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number[]): number[] => (q.get(k) ? q.get(k)!.split(',').map(Number) : d);
const [cx, cy, cz] = num('cam', [0, 20, -90]);
const [mx, my, mz] = num('mira', [0, 5, 0]);
const w = Number(q.get('w') ?? 1280);
const h = Number(q.get('h') ?? 720);
const fov = Number(q.get('fov') ?? 70);
const t = Number(q.get('t') ?? 3);

(async () => {
  const erros: string[] = [];
  window.addEventListener('error', (e) => erros.push(String(e.message)));
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.info.autoReset = false;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, 800);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;
  pmrem.dispose();
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.5, 0.9));
  composer.addPass(new OutputPass());

  const physics = await PhysicsWorld.create();
  const t0 = performance.now();
  const praia = new Praia(scene, physics);
  const construcaoMs = performance.now() - t0;
  praia.update(t);
  camera.position.set(cx, cy, cz);
  camera.lookAt(mx, my, mz);
  camera.updateMatrixWorld();
  for (let i = 0; i < 3; i++) {
    renderer.info.reset();
    composer.render();
  }
  const info = renderer.info.render;
  (window as unknown as Record<string, unknown>).__info = { calls: info.calls, triangles: info.triangles, construcaoMs: Math.round(construcaoMs), erros };
  (window as unknown as Record<string, unknown>).__pronto = true;
})().catch((e) => {
  (window as unknown as Record<string, unknown>).__erro = String(e?.stack ?? e);
});
