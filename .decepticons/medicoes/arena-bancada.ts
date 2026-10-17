import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PhysicsWorld } from '../../client/src/physics/PhysicsWorld';
import { Arena } from '../../client/src/environment/Arena';
import { Destructibles } from '../../client/src/environment/Destructibles';
import { addBankSign } from '../../client/src/environment/BankSign';
import { Android } from '../../client/src/entities/Android';
import { ANDROID_STATS, COLOSSUS_BOSS_STATS } from '../../client/src/entities/chassis';
import { aplicarMascaraDoChefe, mascaraFromSearch } from '../../client/src/entities/mascaraDoChefe';
import { COLOSSUS_01_BLUEPRINT } from '../../client/src/entities/mechBlueprint';
import { Vector09 } from '../../client/src/entities/Vector09';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number[]): number[] => (q.get(k) ? q.get(k)!.split(',').map(Number) : d);
const [cx, cy, cz] = num('cam', [0, 60, 80]);
const [mx, my, mz] = num('mira', [0, 5, -10]);
const w = Number(q.get('w') ?? 1280);
const h = Number(q.get('h') ?? 720);
const fov = Number(q.get('fov') ?? 70);

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
  const destructibles = new Destructibles(scene, physics, { shatter: () => {} } as never, { burst: () => {} } as never);
  const t0 = performance.now();
  const arena = new Arena(scene, physics, destructibles, 'arena', { transformador: q.get('transformador') !== '0' });
  arena.registraLuzes(addBankSign(scene));
  const construcaoMs = performance.now() - t0;
  // O transformador (P164, parte E): `?quadro=estado:vida:energia` (0 ligado, 1 sabotado, 2 apagado; vida e energia de 0 a 1).
  const quadro = (q.get('quadro') ?? '').split(':').map(Number);
  if (quadro.length >= 2) {
    arena.setQuadro(quadro[0] ?? 0, quadro[1] ?? 1);
    arena.setEnergia(quadro[2] ?? 1);
  }
  arena.update(Number(q.get('t') ?? 0.5)); // o relógio do pisca
  const lugares = (nome: string): number[][] => (q.get(nome) ?? '').split(';').filter(Boolean).map((p) => p.split(',').map(Number));
  for (const [x, z] of lugares('androides')) {
    const a = new Android({ stats: ANDROID_STATS });
    a.spawn(physics, new THREE.Vector3(x, 0, z));
    scene.add(a.root);
  }
  // O chefe: `?chefe=x,z` põe o Colossus-01 na cena, com a máscara (a menos que o link traga `?mascara=0`).
  for (const [x, z] of lugares('chefe')) {
    const chefe = new Vector09({ stats: COLOSSUS_BOSS_STATS, blueprint: COLOSSUS_01_BLUEPRINT });
    chefe.spawn(physics, new THREE.Vector3(x, 0, z));
    if (mascaraFromSearch(location.search)) aplicarMascaraDoChefe(chefe.root);
    scene.add(chefe.root);
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
