import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PhysicsWorld } from '../../client/src/physics/PhysicsWorld';
import { Vector09 } from '../../client/src/entities/Vector09';
import { LEG_IDS, newWalkerPose, walkerPose, type LegId } from '../../client/src/entities/walkerGait';
import { loadWalkerAsset, WalkerVisual } from '../../client/src/entities/WalkerVisual';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number[]): number[] => (q.get(k) ? q.get(k)!.split(',').map(Number) : d);
const [cx, cy, cz] = num('cam', [60, 18, -60]);
const [mx, my, mz] = num('mira', [0, 16, 0]);
const w = Number(q.get('w') ?? 1280);
const h = Number(q.get('h') ?? 720);
const fov = Number(q.get('fov') ?? 50);
const fase = Number(q.get('fase') ?? 0);
const giro = Number(q.get('giro') ?? 0);
const tempo = Number(q.get('tempo') ?? 4);
const movendo = Number(q.get('movendo') ?? 1);
const colapso = (q.get('colapso') ?? '').split(',').filter(Boolean) as LegId[];

(async () => {
  const erros: string[] = [];
  window.addEventListener('error', (e) => erros.push(String(e.message)));
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.info.autoReset = false;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb4c4);
  scene.fog = new THREE.Fog(0x9fb4c4, 120, 520);
  const camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, 1200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xdfe9f2, 0x4a4036, 1.0));
  const sol = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sol.position.set(80, 140, -40);
  scene.add(sol);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: 0x5b5a48, roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  scene.add(chao);
  const grade = new THREE.GridHelper(400, 40, 0x222222, 0x3a3a30);
  grade.position.y = 0.05;
  scene.add(grade);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.25, 0.5, 0.95));
  composer.addPass(new OutputPass());

  const t0 = performance.now();
  const asset = await loadWalkerAsset('/models/draga-01.glb');
  const walker = new WalkerVisual(asset);
  const construcaoMs = performance.now() - t0;
  scene.add(walker.root);
  const queda = { fl: 0, fr: 0, rl: 0, rr: 0 } as Record<LegId, number>;
  for (const id of colapso) if (LEG_IDS.includes(id)) queda[id] = 1;
  const pose = newWalkerPose();
  walkerPose(fase, movendo, queda, giro, tempo, pose);
  walker.apply(pose);
  walker.root.updateMatrixWorld(true);

  // a régua de escala: o Vector-09 (5,3 m) ao lado, e um poste de 10 m
  if (q.get('escala') !== '0') {
    const physics = await PhysicsWorld.create();
    const vec = new Vector09();
    vec.spawn(physics, new THREE.Vector3(-26, 0, -14));
    scene.add(vec.root);
  }

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
