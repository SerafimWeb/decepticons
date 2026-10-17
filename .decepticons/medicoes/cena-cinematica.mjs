/**
 * Fotografias promocionais dos Mechs REAIS do jogo (rigs e malhas de `client/`), em cena de hangar
 * cinematográfica: fora do runtime, só para o site. Nada de modelo novo: o que se vê é o `.glb` ou o
 * Mech procedural do jogo, com luz, névoa, brilho e faíscas em volta.
 *
 *   node .decepticons/medicoes/cena-cinematica.mjs               → todas as fotos
 *   node .decepticons/medicoes/cena-cinematica.mjs hero duelo    → só essas
 *
 * Fotos (`cena-<nome>.jpg`): hero (2400×1200), duelo (1280×720), colossusv4 / marauder / vector09 (720×780, fichas),
 * hangar (1000×1000), escala (2400×800: Andróide, Vector-09 e Colossus-01 lado a lado e o Colossus-V4 por trás) e arma-<id> (640×420, o desenho real da arma).
 * A posição das partes, das medidas e dos chassis na foto sai em `scripts/site/cena/<nome>.json` (a landing posiciona os rótulos por ela).
 * Saída em `client/public/press/`. Renderiza por software (SwiftShader): leva alguns minutos, uma vez.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const tmp = resolve('.tmp/cena-cinematica');
const out = resolve('client/public/press');
mkdirSync(tmp, { recursive: true });
mkdirSync(out, { recursive: true });
mkdirSync(resolve('scripts/site/cena'), { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmp;

const SHOTS = {
  hero: { w: 2400, h: 1200 },
  duelo: { w: 1280, h: 720 },
  colossusv4: { w: 720, h: 780 },
  marauder: { w: 720, h: 780 },
  vector09: { w: 720, h: 780 },
  hangar: { w: 1000, h: 1000 },
  escala: { w: 2400, h: 800 },
  ...Object.fromEntries(['rotary', 'flamer', 'seeker', 'cannon', 'autocannon', 'arc'].map((id) => [`arma-${id}`, { w: 640, h: 420 }])),
};

const page = `<!doctype html><html><head><style>body{margin:0;background:#05070a}canvas{display:block}</style></head><body><script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CHASSIS } from '/src/entities/chassis.ts';
import { Vector09 } from '/src/entities/Vector09.ts';
import { Android } from '/src/entities/Android.ts';
import { COLOSSUS_01_BLUEPRINT } from '/src/entities/mechBlueprint.ts';
import { weaponModel } from '/src/entities/weaponModels.ts';
import { ImportedMech } from '/src/entities/ImportedMech.ts';
import { IMPORTED_CHASSIS, whenMechAssetReady, tryInstantiateMechRig } from '/src/entities/importedMechAssets.ts';

const q = new URLSearchParams(location.search);
const shot = q.get('shot');
const W = Number(q.get('w')), H = Number(q.get('h'));

// Aleatório com semente: a mesma foto sai igual a cada execução (ferramenta de site, fora da simulação).
let seed = 20261016;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
const FOG = 0x0a1118;
scene.background = new THREE.Color(0x05080c);
scene.fog = new THREE.FogExp2(FOG, shot === 'hero' ? 0.0105 : shot === 'escala' ? 0.0075 : 0.018);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

/* ---------- os Mechs do jogo ---------- */
async function mech(id, escurece = 1) {
  const config = IMPORTED_CHASSIS[id];
  let model;
  if (config) {
    await whenMechAssetReady(config.url, CHASSIS[id].height, config);
    model = new ImportedMech(CHASSIS[id], tryInstantiateMechRig(config.url, CHASSIS[id].height), CHASSIS[id].loadout);
  } else if (id === 'android') {
    model = new Android({ stats: CHASSIS.android, loadout: CHASSIS.android.loadout });
  } else if (id === 'colossus01') {
    model = new Vector09({ stats: CHASSIS.colossus01, loadout: CHASSIS.colossus01.loadout, blueprint: COLOSSUS_01_BLUEPRINT });
  } else {
    model = new Vector09({ stats: CHASSIS[id], loadout: CHASSIS[id].loadout });
  }
  model.render(0, 1);
  model.root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    // casco branco do Marauder estoura no brilho: escurece o tom do material (a malha continua a do jogo)
    const tom = (id === 'marauder' ? 0.5 : 1) * escurece;
    if (tom !== 1 && o.material?.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(tom); }
  });
  return model;
}
const place = (m, x, z, rotY) => { m.root.position.set(x, 0, z); m.root.rotation.y = rotY; scene.add(m.root); return m; };

/* ---------- o hangar ---------- */
const steel = new THREE.MeshStandardMaterial({ color: 0x1b2631, roughness: 0.62, metalness: 0.7 });
const dark = new THREE.MeshStandardMaterial({ color: 0x0d141b, roughness: 0.8, metalness: 0.5 });
const emit = (c, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
function hall(zFar) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: 0x0e151c, roughness: 0.22, metalness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // faixas de segurança e trilhos de luz no chão, em perspectiva
  for (const x of [-14, 14]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 240), new THREE.MeshBasicMaterial({ color: 0xffb81f })); s.rotation.x = -Math.PI / 2; s.position.set(x, 0.02, -40); scene.add(s); }
  for (const x of [-6, 6]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 240), emit(0xffa31a, 2.2)); s.rotation.x = -Math.PI / 2; s.position.set(x, 0.025, -40); scene.add(s); }
  for (let z = 30; z > zFar; z -= 9) { const s = new THREE.Mesh(new THREE.PlaneGeometry(46, 0.22), emit(0x2f6f8f, 1.2)); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.022, z); scene.add(s); }
  // paredes laterais com pilares, passarelas e painéis
  for (const side of [-1, 1]) {
    for (let z = 24; z > zFar; z -= 9) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(2, 38, 2), steel); pil.position.set(side * 30, 19, z); pil.castShadow = true; scene.add(pil);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 26, 6.4), dark); panel.position.set(side * 31, 14, z - 4.6); scene.add(panel);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 22, 0.35), emit(side > 0 ? 0xffa31a : 0x3aa7d8, 2.4)); strip.position.set(side * 29, 12, z - 1.2); scene.add(strip);
    }
    const walk = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 260), steel); walk.position.set(side * 28, 13, -50); scene.add(walk);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 260), emit(0xffb81f, 1.1)); rail.position.set(side * 25.6, 14, -50); scene.add(rail);
  }
  // teto: tesouras e barras de luz
  for (let z = 26; z > zFar; z -= 7) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(62, 1.1, 1.1), steel); beam.position.set(0, 34, z); scene.add(beam);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 0.7), emit(0xffe0a0, 1.5)); bar.position.set(0, 33.2, z - 2); scene.add(bar);
  }
  // fundo: parede escura com réstias de luz (o brilho vem do halo, não de um retângulo)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), dark); back.position.set(0, 20, zFar - 6); scene.add(back);
  for (let i = -9; i <= 9; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 14 + (i % 3) * 3, 0.3), emit(i % 2 ? 0xffb25a : 0xff7a2a, 1.5)); sl.position.set(i * 2.4, 8 + (i % 3) * 1.5, zFar - 5.5); scene.add(sl); }
}
// feixes de luz (volumétrico falso): cones com borda e ponta esmaecidas, aditivos
const shaftMat = (c, a) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uC: { value: new THREE.Color(c) }, uA: { value: a } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vH; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vH = uv.y; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec3 vN; varying vec3 vV; varying float vH; void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float h = pow(clamp(vH, 0.0, 1.0), 1.4); gl_FragColor = vec4(uC * (e * h * uA), 1.0); }',
});
function shafts(list) {
  for (const [x, z, h, c, a] of list) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(h * 0.3, h, 40, 1, true), shaftMat(c, a));
    cone.position.set(x, h / 2, z); scene.add(cone);
  }
}
// halo: brilho radial atrás de um Mech (contraluz de cinema)
function halo(x, y, z, size, color, op) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.position.set(x, y, z); sp.scale.set(size, size, 1); scene.add(sp);
}
function sparks(cx, cy, cz, n, spread, size = 0.07) {
  const g = new THREE.BufferGeometry(); const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.6) * spread; p[i * 3] = cx + Math.cos(a) * r; p[i * 3 + 1] = cy + rnd() * spread * 1.4; p[i * 3 + 2] = cz + Math.sin(a) * r; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffc040, size, sizeAttenuation: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
}
function key(color, intensity, pos, target, cast = true) {
  const l = new THREE.DirectionalLight(color, intensity); l.position.set(...pos); l.target.position.set(...target); scene.add(l, l.target);
  if (cast) { l.castShadow = true; l.shadow.mapSize.set(2048, 2048); Object.assign(l.shadow.camera, { left: -26, right: 26, top: 32, bottom: -12, far: 120 }); l.shadow.bias = -0.0008; }
  return l;
}

const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 400);
const pct = (v) => [Number(((v.x + 1) / 2 * 100).toFixed(2)), Number(((1 - v.y) / 2 * 100).toFixed(2))];
// caixa de um Mech projetada na tela (em % da foto): topo, base e lados
function medida(m) {
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const b = new THREE.Box3().setFromObject(m.root); const c = b.getCenter(new THREE.Vector3());
  const P = (x, y, z) => pct(new THREE.Vector3(x, y, z).project(camera));
  return { topo: P(c.x, b.max.y, c.z), base: P(c.x, b.min.y, c.z), esq: P(b.min.x, c.y, c.z), dir: P(b.max.x, c.y, c.z), alturaM: Number((b.max.y - b.min.y).toFixed(1)) };
}
const info = {};
const zFar = -70;

if (shot === 'hero') {
  hall(zFar);
  const big = place(await mech('colossusv4'), 6, -6, 0.42);
  const small = place(await mech('vector09'), 3, 17, Math.PI + 0.45);
  const mid = place(await mech('marauder'), -20, -26, Math.PI - 0.5);
  key(0xffb766, 2.6, [-14, 22, 28], [4, 8, -4]);                  // luz principal quente, de frente
  key(0x4fb4ff, 3.6, [26, 18, -26], [6, 10, -6], false);           // contraluz azul
  key(0xff3fa0, 0.7, [-26, 12, -22], [-4, 8, -6], false);          // acento rosa, discreto
  scene.add(new THREE.HemisphereLight(0x6f8fb0, 0x2a1d12, 0.5));
  const pl = new THREE.PointLight(0xffa31a, 380, 40, 2); pl.position.set(-8, 5, 18); scene.add(pl);
  halo(9, 11, -16, 70, 0xff9a3a, 0.75); halo(-34, 8, -30, 40, 0x3aa7d8, 0.35);
  shafts([[-22, -16, 34, 0xffc070, 0.5], [22, -26, 34, 0xffc070, 0.4]]);
  sparks(-3, 0.3, 8, 420, 13, 0.2);
  sparks(8, 0.3, -2, 320, 10, 0.26);
  camera.position.set(-14, 2.0, 54); camera.fov = 33;
  camera.lookAt(-15, 10.5, -6);
  info.medidas = { colossusv4: medida(big), vector09: medida(small) };
} else if (shot === 'duelo') {
  hall(-40);
  const a = place(await mech('marauder'), -7, 0, Math.PI / 2 - 0.5);
  const b = place(await mech('colossusv4'), 9, -4, -Math.PI / 2 + 0.35);
  key(0xffb766, 3, [-10, 20, 22], [0, 6, 0]); key(0x4fb4ff, 3, [14, 14, -22], [0, 8, 0], false); key(0xff3fa0, 1.6, [-20, 10, -14], [0, 6, 0], false);
  scene.add(new THREE.HemisphereLight(0x6f8fb0, 0x2a1d12, 0.5));
  sparks(1, 0.2, -1, 420, 7, 0.1);
  camera.position.set(2, 3.4, 38); camera.fov = 34; camera.lookAt(1, 8, -2);
} else if (shot.startsWith('arma-')) {
  // a arma sozinha, o desenho que o jogo pendura no braço (MK III: o mais detalhado)
  hall(-30);
  const wm = weaponModel({ id: shot.slice(5), tier: 2 });
  wm.object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const holder = new THREE.Group(); holder.add(wm.object); holder.rotation.y = -Math.PI / 2 + 0.62; holder.rotation.z = 0.05;
  scene.add(holder);
  const bb = new THREE.Box3().setFromObject(holder); const sz = bb.getSize(new THREE.Vector3()); const ct = bb.getCenter(new THREE.Vector3());
  holder.position.set(-ct.x, 1.4 - ct.y, -ct.z);
  key(0xe9f0ff, 2.3, [-6, 9, 8], [0, 1.4, 0]); key(0x4fb4ff, 3.4, [8, 5, -6], [0, 1.4, 0], false); key(0xff9a3a, 2.2, [-7, 2, -6], [0, 1.4, 0], false);
  scene.add(new THREE.HemisphereLight(0x6f8fb0, 0x2a1d12, 0.5));
  const mx = Math.max(sz.x, sz.y, sz.z);
  const dist = { seeker: 2.7, cannon: 1.4 }[shot.slice(5)] ?? 1.5;
  camera.position.set(mx * 0.4, 1.4 + mx * 0.26, mx * dist); camera.fov = 30; camera.lookAt(0, 1.4, 0);
  scene.fog.density = 0.05;
} else if (shot === 'escala') {
  // a comparação: Andróide (tamanho 1), Vector-09 (2) e Colossus-01 (3) lado a lado, e o Colossus-V4 (4) por trás, discreto
  hall(-40);
  const lista = [];
  const colocar = async (id, x, z, rot, escurece = 1) => { const m = place(await mech(id, escurece), x, z, rot); lista.push([id, m]); return m; };
  await colocar('colossusv4', -1, -40, 0.12, 0.5);          // por trás, escuro e na névoa: a escala, sem roubar a cena
  await colocar('colossus01', 14, 2, Math.PI + 0.22);
  await colocar('vector09', -5, 5, Math.PI + 0.4);
  await colocar('android', -13, 8, Math.PI + 0.3);
  key(0xffb766, 3, [-16, 26, 40], [-4, 6, 0]); key(0x4fb4ff, 3.2, [30, 20, -20], [0, 8, 0], false); key(0xff9a3a, 1.2, [-30, 10, 10], [-10, 4, 0], false);
  scene.add(new THREE.HemisphereLight(0x6f8fb0, 0x2a1d12, 0.55));
  halo(0, 13, -43, 120, 0xff9a3a, 0.7);
  sparks(-2, 0.2, 6, 260, 16, 0.16);
  camera.position.set(0, 3.4, 62); camera.fov = 21; camera.lookAt(0.5, 8.5, 0);
  info.escala = lista.map(([id, m]) => ({ id, ...medida(m) }));
} else if (shot === 'hangar') {
  hall(-40);
  const id = q.get('id') || 'marauder';
  const m = await mech(id);
  place(m, 0, 0, Math.PI + 0.32);
  key(0xffb766, 3.2, [-10, 18, 20], [0, 4, 0]); key(0x4fb4ff, 3, [14, 12, -14], [0, 5, 0], false); key(0xff9a3a, 1.4, [10, 6, 14], [0, 3, 0], false);
  scene.add(new THREE.HemisphereLight(0x6f8fb0, 0x2a1d12, 0.55));
  sparks(0, 0.2, 2, 160, 5, 0.05);
  const hgt = CHASSIS[id].height;
  camera.position.set(2.2, hgt * 0.5, hgt * 2.55); camera.fov = 32; camera.lookAt(0, hgt * 0.5, 0);
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  // âncoras das seis partes: frações da caixa do Mech, projetadas na tela
  const box = new THREE.Box3().setFromObject(m.root); const sz = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
  const at = (fx, fy) => { const v = new THREE.Vector3(c.x + (fx - 0.5) * sz.x, box.min.y + fy * sz.y, c.z).project(camera); return [Number(((v.x + 1) / 2 * 100).toFixed(1)), Number(((1 - v.y) / 2 * 100).toFixed(1))]; };
  info.partes = { head: at(0.5, 0.93), leftArm: at(0.22, 0.66), torso: at(0.5, 0.68), rightArm: at(0.78, 0.66), leftLeg: at(0.4, 0.28), rightLeg: at(0.62, 0.28) };
  info.box = { x: sz.x, y: sz.y };
} else {
  // ficha de um chassi
  hall(-30);
  const id = shot;
  const m = place(await mech(id), 0, 0, id === 'colossusv4' ? 0.3 : Math.PI + 0.62);
  key(0xffb766, 3.2, [-10, 18, 18], [0, 4, 0]); key(0x4fb4ff, 3, [14, 12, -14], [0, 5, 0], false); key(0xff3fa0, 1.2, [-14, 8, -10], [0, 5, 0], false);
  scene.add(new THREE.HemisphereLight(0x6f8fb0, 0x2a1d12, 0.5));
  sparks(0, 0.2, 2, 140, 4, 0.05);
  const hgt = CHASSIS[id].height;
  camera.position.set(1.8, hgt * 0.5, hgt * (id === 'colossusv4' ? 2.5 : id === 'vector09' ? 3.2 : 2.2)); camera.fov = 32; camera.lookAt(0, hgt * 0.48, 0);
}
camera.updateProjectionMatrix();

/* ---------- pós-processamento: brilho, vinheta e grão leve ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), shot === 'hero' ? 0.62 : 0.5, 0.65, 0.78));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.55 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float uVig; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 1.15))); c.rgb *= mix(1.0 - uVig, 1.0, v); c.rgb = pow(max(c.rgb, vec3(0.0)), vec3(1.04)); gl_FragColor = c; }',
}));
await renderer.compileAsync(scene, camera);
composer.render();
window.info = info;
window.captureReady = true;
</script></body></html>`;

const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 4218, strictPort: true, open: false },
  plugins: [{ name: 'cena', configureServer(s) { s.middlewares.use('/__cena', async (req, res, next) => { try { res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/__cena' + (req.url || ''), page)); } catch (e) { next(e); } }); } }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const want = process.argv.slice(2);
  for (const [name, { w, h }] of Object.entries(SHOTS)) {
    if (want.length && !want.includes(name)) continue;
    const t0 = Date.now();
    const pg = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    pg.on('pageerror', (e) => errors.push(e.message));
    pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
    await pg.goto(`http://127.0.0.1:4218/__cena?shot=${name === 'hangar' ? 'hangar' : name}&w=${w}&h=${h}`);
    await pg.waitForFunction(() => window.captureReady, null, { timeout: 280000 }).catch((e) => { throw new Error(`${name}: ${e.message}\n${errors.join('\n')}`); });
    await pg.screenshot({ path: resolve(out, `cena-${name}.jpg`), type: 'jpeg', quality: 86 });
    if (['hangar', 'hero', 'escala'].includes(name)) writeFileSync(resolve('scripts/site/cena', `${name}.json`), JSON.stringify(await pg.evaluate(() => window.info), null, 1));
    await pg.close();
    console.log(`foto ${name} (${((Date.now() - t0) / 1000).toFixed(0)} s)${errors.length ? ' · avisos: ' + errors.slice(0, 3).join(' | ') : ''}`);
  }
} finally {
  await browser?.close();
  await server.close();
}
