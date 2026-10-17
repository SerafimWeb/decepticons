import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PhysicsWorld } from '../../client/src/physics/PhysicsWorld';
import { ALCANCE_DA_CAMERA, Amazonia } from '../../client/src/environment/Amazonia';
import { AMAZONIA_DRAGA_INICIO_X, rioEmX } from '../../client/src/environment/AmazoniaLayout';
import { alturaDoTerreno } from '../../client/src/environment/AmazoniaTerreno';
import { Vector09 } from '../../client/src/entities/Vector09';
import { loadWalkerAsset, WalkerVisual } from '../../client/src/entities/WalkerVisual';
import { newWalkerPose, walkerPose } from '../../client/src/entities/walkerGait';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number[]): number[] => (q.get(k) ? q.get(k)!.split(',').map(Number) : d);
const [cx, cy, cz] = num('cam', [0, 900, 900]);
const [mx, my, mz] = num('mira', [0, 0, 0]);
const w = Number(q.get('w') ?? 1280);
const h = Number(q.get('h') ?? 720);
const fov = Number(q.get('fov') ?? 55);
const frente = Number(q.get('frente') ?? AMAZONIA_DRAGA_INICIO_X);
const tempo = Number(q.get('tempo') ?? 3);

(async () => {
  const erros: string[] = [];
  window.addEventListener('error', (e) => erros.push(String(e.message)));
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.info.autoReset = false;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  // A câmera do jogo na Amazônia vai até o `alcanceDaCamera` do mapa (1.500 m); só a vista de cima (sem névoa) precisa de mais. Com o far do jogo a bancada reproduz o que o jogador vê (o céu preto de 17/10 só apareceu no jogo).
  const camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, q.get('semnevoa') === '1' ? 3200 : ALCANCE_DA_CAMERA);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  pmrem.dispose();
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.2, 0.5, 0.95));
  composer.addPass(new OutputPass());

  const physics = await PhysicsWorld.create();
  const t0 = performance.now();
  const amazonia = new Amazonia(scene, physics);
  const construcaoMs = performance.now() - t0;
  if (q.get('semnevoa') === '1') scene.fog = null; // a vista de cima (1.500 m) seria só névoa
  amazonia.setFrente(frente);
  amazonia.update(tempo);
  amazonia.observar(cx, cy, cz);

  if (q.get('draga') !== '0') {
    const asset = await loadWalkerAsset('/models/draga-01.glb');
    const walker = new WalkerVisual(asset);
    const z = rioEmX(frente);
    walker.root.position.set(frente, alturaDoTerreno(frente, z), z);
    walker.root.rotation.y = Math.PI / 2; // a frente (-Z) vira para o oeste: o Draga sobe o rio
    const pose = newWalkerPose();
    walkerPose(0.2, 1, { fl: 0, fr: 0, rl: 0, rr: 0 }, 0, tempo, pose);
    walker.apply(pose);
    scene.add(walker.root);
  }
  if (q.get('escala') === '1') {
    const vec = new Vector09();
    vec.spawn(physics, new THREE.Vector3(cx + 14, alturaDoTerreno(cx + 14, cz) + 0.1, cz));
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
