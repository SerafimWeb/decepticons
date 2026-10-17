/**
 * A bancada do CHECKPOINT DAS EXPLOSÕES (16/10, P170): roda os sistemas de verdade (`ProjectileSystem`, `RocketSystem`, `CruiseSystem`, `WeaponFx`, `BeamVisuals`,
 * `ParticleSystem`, a física e os Mechs) em ticks fixos, com o bloom do jogo, e fotografa 15 quadros: foguetes com fita de fumaça, a explosão (clarão, bola de fogo, fumaça
 * escura, estilhaços, onda de choque, queimado), o Mech destruído, plasma/trilho/gelo/laser com as marcas, o canhão pesado, o enxame, o cruzador e o laser.
 * Quem mexer em `fx/Explosions|Ribbons|Marks|Billboards|WeaponFx|weaponLook|explosionScale|BeamVisuals` roda isto e compara com `arte/armas-impacto-bancada-claude.jpg`
 * (`CHECKPOINTS.md`). Roda em software (SwiftShader): o quadro é o do tick pedido, a lentidão não importa.
 * Uso (da raiz do projeto): node .decepticons/medicoes/explosoes.mjs [saida.jpg|png] [so=A,C,F]   (A foguetes · C Mech destruído · D plasma e marcas · F trilho · G canhão · H enxame · I cruzador · J laser)
 * G15: temporários só em .tmp/.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const TMP = resolve('.tmp', 'explosoes');
const PAGE = resolve('client', '.tmp-capture-explosoes.html');
const OUTPUT = resolve(process.argv[2] ?? '.tmp/explosoes/bancada.jpg');
const SO = (process.argv[3] ?? '').replace(/^so=/, '');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#05070c;font:600 14px Consolas,monospace;color:#e6edf3}
  #wrap{position:relative;width:1600px}
  canvas{display:block}
  .l{position:absolute;padding:4px 8px;background:rgba(0,0,0,.6);border-radius:4px;max-width:760px}
</style></head><body><div id="wrap"><canvas id="out"></canvas></div><script type="module">
  import * as THREE from 'three';
  import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
  import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
  import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
  import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
  import { PhysicsWorld, FIXED_DT } from '/src/physics/PhysicsWorld.ts';
  import { ProjectileSystem } from '/src/combat/ProjectileSystem.ts';
  import { RocketSystem } from '/src/combat/RocketSystem.ts';
  import { CruiseSystem } from '/src/combat/CruiseSystem.ts';
  import { BeamVisuals } from '/src/fx/BeamVisuals.ts';
  import { ParticleSystem } from '/src/fx/ParticleSystem.ts';
  import { WeaponFx } from '/src/fx/WeaponFx.ts';
  import { IMPACT_FX } from '/src/fx/impactFx.ts';
  import { weapon } from '/src/combat/weapons.ts';
  import { spreadAt, applySpread } from '/src/combat/spread.ts';
  import { Vector09 } from '/src/entities/Vector09.ts';
  import { PALETTE } from '/src/core/palette.ts';

  const SO = ${JSON.stringify(SO)}.split(',').filter(Boolean);
  const quer = (id) => SO.length === 0 || SO.includes(id);
  const PW = 800, PH = 450;
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(PW, PH, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const cam = new THREE.PerspectiveCamera(45, PW / PH, 0.1, 1500);

  /** Um mundo: chão de asfalto escuro com a grade, um muro ao fundo, luz, o atirador e o alvo, a física, os sistemas de tiro e os efeitos. */
  async function mundo({ atirador = [0, 30], alvo = [0, -60], muro = null, ceu = 0x0b1424 }) {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(1200, 2, 1200));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ceu);
    scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0045);
    scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x1a1f2a, 1.4));
    const sun = new THREE.DirectionalLight(0xffe2c0, 2.0); sun.position.set(60, 90, 40); scene.add(sun);
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: 0x1c2832, roughness: 0.95 }));
    chao.rotation.x = -Math.PI / 2; scene.add(chao);
    const grade = new THREE.GridHelper(1600, 160, 0x1d6f86, 0x14303b); grade.position.y = 0.02; scene.add(grade);
    if (muro) {
      const [cx, cz, w, h] = muro;
      physics.addStaticBox(new THREE.Vector3(cx, h / 2, cz), new THREE.Vector3(w, h, 1.2));
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.2), new THREE.MeshStandardMaterial({ color: 0x3a434b, roughness: 0.85 }));
      m.position.set(cx, h / 2, cz); scene.add(m);
    }
    const particles = new ParticleSystem();
    scene.add(particles.points);
    const mech = (x, z, paint, visor, yaw) => {
      const m = new Vector09({ paint, visor });
      m.spawn(physics, new THREE.Vector3(x, 0, z));
      m.root.position.set(x, 0, z);
      m.root.rotation.y = yaw;
      scene.add(m.root);
      return m;
    };
    const mira = alvo ?? [0, -60];
    const dirYaw = Math.atan2(mira[0] - atirador[0], mira[1] - atirador[1]) + Math.PI;
    const shooter = mech(atirador[0], atirador[1], PALETTE.playerPaint, PALETTE.green, dirYaw);
    const target = alvo ? mech(alvo[0], alvo[1], PALETTE.enemyPaint, PALETTE.signal, dirYaw + Math.PI) : null;
    physics.step(); physics.step();
    const projectiles = new ProjectileSystem(scene, physics, particles);
    const rockets = new RocketSystem(scene, physics, particles);
    const cruise = new CruiseSystem(scene, physics, particles);
    const beams = new BeamVisuals(scene);
    const fx = new WeaponFx(particles, cam, (x, y, z) => physics.terrainY(x, z, y + 1, 40), beams);
    for (const o of fx.objects) scene.add(o);
    projectiles.fx = rockets.fx = cruise.fx = fx;
    rockets.onExplode = (at, _d, _o, w) => fx.explosion(at, w);
    cruise.onExplode = (at, _d, _o, w) => fx.explosion(at, w);
    let tick = 0;
    const eventos = [];
    const quadro = (dt) => {
      fx.beginFrame();
      projectiles.render(1); rockets.render(1); cruise.render(1);
      particles.update(dt);
      fx.update(dt);
    };
    const passo = () => {
      for (const e of eventos) if (!e.feito && e.tick <= tick) { e.feito = true; e.f(); }
      projectiles.fixedUpdate(FIXED_DT); rockets.fixedUpdate(FIXED_DT); cruise.fixedUpdate(FIXED_DT); beams.update(FIXED_DT);
      physics.step();
      quadro(FIXED_DT);
      tick++;
    };
    const ate = (n) => { while (tick < n) passo(); };
    return { physics, scene, particles, projectiles, rockets, cruise, beams, fx, shooter, target, eventos, ate, quadro, get tick() { return tick; } };
  }

  const composites = [];
  function foto(m, pos, olha, rotulo, fov = 45) {
    cam.fov = fov; cam.aspect = PW / PH; cam.position.set(...pos); cam.lookAt(new THREE.Vector3(...olha)); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    m.quadro(0);
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(PW, PH, { type: THREE.HalfFloatType, samples: 4 }));
    composer.setSize(PW, PH);
    composer.addPass(new RenderPass(m.scene, cam));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(PW, PH), 0.85, 0.5, 0.9));
    composer.addPass(new OutputPass());
    composer.render();
    const c = document.createElement('canvas'); c.width = PW; c.height = PH;
    c.getContext('2d').drawImage(renderer.domElement, 0, 0);
    composites.push({ c, rotulo });
  }
  const ticks = (s) => Math.round(s * 60);
  const dirDe = (a, b) => new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize();

  try {
    // A–B. Foguetes em voo (fumaça e fogo em fita) e a explosão: clarão + bola de fogo; depois fumaça escura, estilhaços, onda e queimado.
    if (quer('A')) {
      const m = await mundo({ atirador: [0, 30], alvo: [0, -50] });
      const w = weapon('rockets');
      for (let i = 0; i < 4; i++) {
        m.eventos.push({ tick: Math.round(i * w.fireInterval * 60), f: () => {
          for (const lado of [-1, 1]) {
            const o = [lado * 1.7, 4.4, 29.4];
            m.rockets.fire(new THREE.Vector3(...o), dirDe(o, [lado * 2 + i * 0.6, 0.6, -48]), m.shooter.collider, w);
          }
        } });
      }
      m.ate(ticks(0.62));
      foto(m, [16, 7, 4], [0, 3, -14], 'Foguetes em voo: a fumaça é uma fita contínua que abre e sobe, com a língua de fogo do motor (antes, uma fila de pontos)', 50);
      m.ate(ticks(1.15));
      foto(m, [18, 9, -18], [0, 2, -46], 'O primeiro par chega: clarão branco, bola de fogo low-poly que ferve, faíscas', 46);
      m.ate(ticks(1.7));
      foto(m, [18, 9, -18], [0, 3, -46], '0,5 s depois: a fumaça é escura de verdade (antes somava luz), acesa por dentro pelo fogo; estilhaços em brasa e a onda de choque no chão', 46);
      m.ate(ticks(3.6));
      foto(m, [18, 11, -16], [0, 3, -46], '2,5 s depois: a fumaça sobe e se desfaz; o chão fica queimado (some em ~12 s)', 46);
    }
    // C. Um Mech destruído: a explosão grande com estilhaço.
    if (quer('C')) {
      const m = await mundo({ atirador: [0, 30], alvo: [0, -20] });
      m.target.root.visible = false;
      m.eventos.push({ tick: 1, f: () => m.fx.wreck(new THREE.Vector3(0, 0, -20), 6.5) });
      m.ate(ticks(0.3));
      foto(m, [14, 6, 2], [0, 4, -20], 'Mech destruído: a carcaça estoura com uma bola de fogo do tamanho dele, fumaça preta e estilhaços que quicam', 50);
    }
    // D–E. Plasma: o brilho da cabeça e a estrela da boca; as marcas no muro.
    if (quer('D')) {
      const m = await mundo({ atirador: [0, 30], alvo: null, muro: [0, -10, 40, 14] });
      const w = weapon('plasma');
      for (let i = 0; i < 8; i++) {
        m.eventos.push({ tick: Math.round(i * w.fireInterval * 60), f: () => {
          const o = [1.7, 4.4, 29.4];
          m.projectiles.fire(new THREE.Vector3(...o), dirDe(o, [-6 + i * 1.6, 3 + (i % 3) * 1.4, -9]), m.shooter.collider, false, w);
        } });
      }
      m.ate(ticks(1.0));
      foto(m, [9, 6, 34], [0, 4, 5], 'Plasma: cada tiro é uma bola de luz com núcleo branco e cauda (antes, só a risca); estrela verde na boca', 50);
      const outras = [['railgun', [-12, 8]], ['autocannon', [8, 2]], ['cryo', [14, 6]], ['cannon', [-15, 3]], ['laser', [3, 9]]];
      let t = m.tick + 2;
      for (const [id, [x, y]] of outras) {
        const ww = weapon(id);
        for (let k = 0; k < (id === 'autocannon' ? 5 : id === 'laser' ? 4 : 2); k++) {
          m.eventos.push({ tick: t++, f: () => {
            const o = [1.7, 4.4, 29.4];
            const alvo = [x + k * 0.9, y + (k % 2) * 0.8, -9.4];
            if (id === 'laser') {
              const d = dirDe(o, alvo);
              const hit = m.physics.raycast(new THREE.Vector3(...o), d, 400, m.shooter.collider, true);
              if (hit) { const at = hit.point.clone(); const n = hit.normal.clone(); m.beams.spawn(new THREE.Vector3(...o), at, false, ww.beam.glow); m.fx.impact(at, n, ww, false, true); for (const b of IMPACT_FX.laser) m.particles.burst(at, n, b); }
            } else m.projectiles.fire(new THREE.Vector3(...o), dirDe(o, alvo), m.shooter.collider, false, ww);
          } });
          t += 3;
        }
      }
      m.ate(t + ticks(0.6));
      foto(m, [4, 6, 6], [2, 5, -10], 'As marcas no muro: furos com aro aceso na cor do tiro (plasma verde, trilho azul, metal em brasa), a geada do gelo e o queimado do laser; esfriam e somem em segundos', 52);
    }
    // F. Trilho: o raio iônico.
    if (quer('F')) {
      const m = await mundo({ atirador: [0, 30], alvo: [4, -70] });
      const w = weapon('railgun');
      m.eventos.push({ tick: 1, f: () => { const o = [1.7, 4.4, 29.4]; m.projectiles.fire(new THREE.Vector3(...o), dirDe(o, [4, 3, -70]), m.shooter.collider, false, w); } });
      m.ate(ticks(0.16));
      foto(m, [12, 7, 36], [2, 3, -20], 'Canhão de trilho: o raio iônico grosso do cano ao alvo, com energia correndo, apagando em meio segundo (antes, uma linha de 1 pixel)', 50);
    }
    // G. Canhão pesado: a língua de pólvora na boca e a fumaça do obus.
    if (quer('G')) {
      const m = await mundo({ atirador: [0, 30], alvo: [0, -90] });
      const w = weapon('cannon');
      m.eventos.push({ tick: 1, f: () => { const o = [1.7, 4.4, 29.4]; m.projectiles.fire(new THREE.Vector3(...o), dirDe(o, [0, 3, -90]), m.shooter.collider, false, w); } });
      m.ate(ticks(0.05));
      foto(m, [14, 5, 26], [1, 4, 22], 'Canhão pesado no disparo: estrela e língua de fogo da pólvora deitada na direção do tiro, fumaça do cano', 48);
      m.ate(ticks(0.42));
      foto(m, [18, 8, 0], [0, 4, -30], '0,4 s depois: o obus em brasa e a fita de fumaça que ele deixa', 50);
    }
    // H. Enxame MK III: dezenas de fitas finas.
    if (quer('H')) {
      const m = await mundo({ atirador: [0, 30], alvo: [0, -60] });
      const w = weapon('swarm', 2);
      const aim = new THREE.Vector3(0, 2, -60);
      let n = 0;
      for (let i = 0; i < w.magazine; i++) {
        m.eventos.push({ tick: Math.round(i * w.fireInterval * 60), f: () => {
          for (const lado of [-1, 1]) {
            const o = new THREE.Vector3(lado * 1.7, 4.7, 29.4);
            const d = aim.clone().sub(o).normalize();
            m.rockets.fire(o, applySpread(d, spreadAt(n++, w.salvo.cone, { x: 0, y: 0 })), m.shooter.collider, w);
          }
        } });
      }
      m.ate(ticks(1.0));
      foto(m, [14, 9, 36], [0, 3, -10], 'Lançador leve MK III: 64 mísseis, cada um com a sua fita fina de fumaça e o brilho do motor', 52);
      m.ate(ticks(1.75));
      foto(m, [16, 9, -24], [0, 2.5, -58], 'a chegada: bolas de fogo pequenas (2,2 m) e a fumaça das fitas no ar', 48);
    }
    // I. Cruzador: o arco com a fita grossa.
    if (quer('I')) {
      const m = await mundo({ atirador: [-90, 0], alvo: [110, 0] });
      const w = weapon('cruise');
      m.eventos.push({ tick: 0, f: () => m.cruise.fire(new THREE.Vector3(-88.5, 4.7, -1.2), new THREE.Vector3(1, 0, 0), new THREE.Vector3(110, 1.5, 0), m.shooter.collider, w) });
      m.ate(ticks(1.1));
      foto(m, [10, 30, 140], [10, 14, 0], 'Míssil cruzador: a fita de fumaça grossa desenha o arco no céu', 44);
      m.ate(ticks(1.85));
      foto(m, [96, 12, 48], [110, 5, 0], 'a chegada do cruzador: 9 m de explosão (a maior do arsenal)', 48);
    }
    // J. Laser.
    if (quer('J')) {
      const m = await mundo({ atirador: [0, 30], alvo: [0, -80] });
      const w = weapon('laser');
      const o = new THREE.Vector3(1.7, 4.7, 29.4);
      const fim = new THREE.Vector3(0, 2.4, -78.8);
      for (let i = 0; i < 6; i++) m.eventos.push({ tick: Math.round(i * w.fireInterval * 60), f: () => { m.beams.spawn(o, fim, false, w.beam.glow); m.fx.impact(fim, new THREE.Vector3(0, 0, 1), w, false, false); for (const b of IMPACT_FX.laser) m.particles.burst(fim, new THREE.Vector3(0, 0, 1), b); m.fx.fired(o, new THREE.Vector3(0,0,-1), w, false); } });
      m.ate(ticks(0.7));
      foto(m, [6, 6, 40], [0, 3, -20], 'Raio laser: o feixe com borda macia e a energia correndo do cano ao alvo', 48);
    }

    const lin = Math.ceil(composites.length / 2);
    const out = document.getElementById('out');
    out.width = PW * 2; out.height = PH * lin;
    const ctx = out.getContext('2d');
    composites.forEach((p, i) => {
      const x = (i % 2) * PW, y = Math.floor(i / 2) * PH;
      ctx.drawImage(p.c, x, y);
      const el = document.createElement('div');
      el.className = 'l'; el.textContent = p.rotulo; el.style.left = (x + 8) + 'px'; el.style.top = (y + 8) + 'px';
      document.getElementById('wrap').appendChild(el);
    });
    window.captureData = { paineis: composites.length };
  } catch (e) { window.captureError = String(e && e.stack || e); }
  window.captureReady = true;
</script></body></html>`;
writeFileSync(PAGE, html, 'utf8');

const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 4233, strictPort: true, open: false } });
let browser;
try {
  await server.listen();
  const { chromium: pw } = await import('playwright-core');
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  for (const channel of ['chrome', 'msedge', undefined]) { try { browser = await pw.launch({ channel, args }); break; } catch { /* próximo */ } }
  if (!browser) throw new Error('nenhum browser encontrado');
  const page = await browser.newPage({ viewport: { width: 1600, height: 3000 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 400)); });
  await page.goto(`${server.resolvedUrls.local[0]}.tmp-capture-explosoes.html`);
  await page.waitForFunction(() => window.captureReady === true, null, { timeout: 580_000 });
  const err = await page.evaluate(() => window.captureError);
  if (logs.length) console.log('logs', logs.slice(0, 12).join('\n'));
  if (err) throw new Error(err);
  console.log('dados', JSON.stringify(await page.evaluate(() => window.captureData)));
  await page.locator('#wrap').screenshot({ path: OUTPUT, ...(OUTPUT.endsWith('.jpg') ? { type: 'jpeg', quality: 86 } : {}) });
  console.log('captura', OUTPUT);
} finally {
  await browser?.close();
  await server.close();
  rmSync(PAGE, { force: true });
}
