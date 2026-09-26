/** Captura repetível das silhuetas geradas pelo próprio código, para revisão visual do PR. */
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const TMP = resolve('.tmp', 'blueprint-capture');
const PAGE = resolve('client', '.tmp-blueprint-capture.html');
const OUTPUT = resolve('.decepticons', 'arte', 'mech-blueprints.png');
mkdirSync(TMP, { recursive: true });
mkdirSync(resolve('.decepticons', 'arte'), { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { writeFileSync } = await import('node:fs');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;background:#a9abad;color:#202426;font:600 20px Consolas,monospace;letter-spacing:.1em}
  main{width:1800px;height:760px;display:grid;grid-template-rows:1fr 92px}canvas{display:block;width:1800px;height:668px}
  footer{display:grid;grid-template-columns:repeat(3,1fr);align-items:center;text-align:center;border-top:2px solid #777}
  small{display:block;font-size:13px;font-weight:400;letter-spacing:.16em;margin-top:7px}
  </style></head><body><main><canvas id="preview"></canvas><footer>
  <div>LEVE<small>FERRET · 4,5 M</small></div><div>MÉDIO<small>VECTOR-09 · 5,3 M</small></div><div>PESADO<small>COLOSSUS · 6,5 M</small></div>
  </footer></main><script type="module">
    import * as THREE from 'three';
    import { MECH_BLUEPRINTS, buildMechBlueprintRig } from '/src/entities/mechBlueprint.ts';
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('preview'), antialias: true, alpha: false });
    renderer.setSize(1800, 668, false);
    renderer.setClearColor(0xa9abad);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-9.85, 9.85, 3.65, -3.65, 0.1, 80);
    camera.position.set(0, 3.05, -32);
    camera.lookAt(0, 3.05, 0);
    const black = new THREE.MeshBasicMaterial({ color: 0x080a0b });
    // A câmera olha o robô de frente a partir de -Z, portanto o eixo horizontal projetado inverte.
    const xs = [6.4, 0, -6.4];
    const heights = [];
    const drawsPerMech = [];
    const blueprintIds = [];
    const widths = [];
    MECH_BLUEPRINTS.forEach((blueprint, index) => {
      const rig = buildMechBlueprintRig(blueprint);
      const bounds = new THREE.Box3().setFromObject(rig.model);
      const size = bounds.getSize(new THREE.Vector3());
      rig.model.scale.multiplyScalar(blueprint.referenceHeight / size.y);
      rig.model.position.x = xs[index];
      rig.model.traverse((node) => { if (node instanceof THREE.Mesh) node.material = black; });
      let drawCount = 0;
      rig.model.traverse((node) => { if (node instanceof THREE.Mesh && node.visible) drawCount++; });
      scene.add(rig.model);
      heights.push(blueprint.referenceHeight);
      drawsPerMech.push(drawCount);
      blueprintIds.push(blueprint.id);
      widths.push(size.x * blueprint.referenceHeight / size.y);
    });
    renderer.render(scene, camera);
    window.captureReady = true;
    window.captureData = { heights, drawsPerMech, blueprintIds, widths };
  </script></body></html>`;
writeFileSync(PAGE, html, 'utf8');

const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 4207, strictPort: true, open: false } });
let browser;
try {
  await server.listen();
  const { chromium: pw } = await import('playwright-core');
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  if (process.env.SMOKE_BROWSER) browser = await pw.launch({ executablePath: process.env.SMOKE_BROWSER, args });
  else {
    for (const channel of ['chrome', 'msedge', undefined]) {
      try { browser = await pw.launch({ channel, args }); break; } catch { /* próximo navegador instalado */ }
    }
  }
  if (!browser) throw new Error('Defina SMOKE_BROWSER com o caminho do Chrome ou Edge.');
  const page = await browser.newPage({ viewport: { width: 1800, height: 760 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${server.resolvedUrls.local[0]}.tmp-blueprint-capture.html`);
  await page.waitForFunction(() => window.captureReady === true, null, { timeout: 15_000 });
  const data = await page.evaluate(() => window.captureData);
  console.log(`Blueprints: ${data.blueprintIds.join(', ')}; largura: ${data.widths.map((width) => width.toFixed(2)).join(', ')}; draws: ${data.drawsPerMech.join(', ')}`);
  if (data.drawsPerMech.some((draws) => draws > 10)) throw new Error(`Teto de draw calls excedido: ${data.drawsPerMech}`);
  if (errors.length) throw new Error(errors.join('\n'));
  await page.screenshot({ path: OUTPUT });
  console.log(`Captura criada: ${OUTPUT}`);
} finally {
  await browser?.close();
  await server.close();
  rmSync(PAGE, { force: true });
}
