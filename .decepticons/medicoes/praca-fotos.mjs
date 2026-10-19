/**
 * Fotografa a PRAÇA DOS TRÊS PODERES (P217, passo 4 da ficha `fichas/cenario-8-de-janeiro.md`) no jogo de verdade e mede o quadro na GPU real (G15: temporários em `.tmp/`; as fotos vão para
 * `.decepticons/arte/praca-*.png`). Serve o `dist/` (faça `npm run build` antes) e abre `?mapa=janeiro&comandante=1&depurar` (o mapa nasce restrito ao Comandante) no Chrome/Edge do sistema com
 * `--use-angle=d3d11`; teletransporta o Mech e gira a câmera para as vistas-chave: a Praça entre os três prédios, o Congresso visto da Esplanada (a rampa, as torres, a cúpula e a tigela), o
 * Planalto, o Supremo e a Esplanada de ponta a ponta. Para cada vista guarda a foto, o fps, os desenhos e os triângulos.
 *
 *   npm run build && node .decepticons/medicoes/praca-fotos.mjs                 # as fotos e a medida, 1280×720
 *   node .decepticons/medicoes/praca-fotos.mjs --multidao 2000                  # com a multidão da demonstração na cena (`?multidao=1`)
 *   node .decepticons/medicoes/praca-fotos.mjs --salvar                         # grava medicoes/praca-<data>.json
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const arg = (nome, padrao) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : padrao);
const [W, H] = arg('--tela', '1280x720').split('x').map(Number);
const multidao = Number(arg('--multidao', '0'));
const salvar = args.includes('--salvar');

const RAIZ = resolve('dist');
const BASE = '/cybermech/jogar';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.endsWith('/') || p === '') p += 'index.html';
  const file = join(RAIZ, p);
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end('404');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const porta = server.address().port;

let browser = null;
const flags = ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-frame-rate-limit', '--disable-gpu-vsync'];
for (const channel of ['chrome', 'msedge', undefined]) {
  try {
    browser = await chromium.launch({ channel, args: flags });
    break;
  } catch {
    /* próximo */
  }
}
if (!browser) throw new Error('nenhum navegador');

/** As vistas-chave: onde o Mech fica (x, y, z), para onde olha (yaw, pitch) e o nome da foto. `yaw`: 0 olha para -Z (norte); +π/2 para -X (oeste); -π/2 para +X (leste). */
const VISTAS = [
  { nome: 'a-praca', x: 66, y: 1, z: -12, yaw: Math.PI / 2 + 0.25, pitch: -0.1 },
  { nome: 'o-congresso-da-esplanada', x: -70, y: 1, z: 0, yaw: -Math.PI / 2, pitch: 0.12 },
  { nome: 'as-rampas-e-os-gradis', x: -46, y: 1, z: 6, yaw: -Math.PI / 2 - 0.15, pitch: 0.16 },
  { nome: 'o-planalto', x: 62, y: 1, z: -26, yaw: 0.1, pitch: -0.02 },
  { nome: 'o-supremo-e-a-estatua', x: 62, y: 1, z: 28, yaw: Math.PI, pitch: 0.02 },
  { nome: 'o-telhado-do-congresso', x: 6, y: 5.2, z: 34, yaw: -Math.PI / 2 + 0.2, pitch: -0.05 },
];

const medir = (page, ms) =>
  page.evaluate(
    (dur) =>
      new Promise((resolvido) => {
        const t = [];
        let ult = performance.now();
        const ini = ult;
        const passo = (agora) => {
          t.push(agora - ult);
          ult = agora;
          if (agora - ini < dur) requestAnimationFrame(passo);
          else {
            t.shift();
            const s = [...t].sort((a, b) => a - b);
            const media = t.reduce((a, b) => a + b, 0) / t.length;
            const info = window.__game?.renderer?.info?.render;
            resolvido({ fps: +(1000 / media).toFixed(1), p50: +s[Math.floor(s.length * 0.5)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), desenhos: info?.calls ?? null, triangulos: info?.triangles ?? null });
          }
        };
        requestAnimationFrame(passo);
      }),
    ms,
  );

const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('cybermech.settings.v1', JSON.stringify({ quality: 'alta' }));
  } catch {
    /* sem storage */
  }
});
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));
page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
const extra = multidao > 0 ? `&multidao=1&cota=${multidao}&t=9000` : '';
await page.goto(`http://localhost:${porta}${BASE}/?mapa=janeiro&comandante=1&depurar${extra}`);
await page.waitForFunction(() => !!window.__game, null, { timeout: 120_000 });
await page.waitForTimeout(6000);
for (let i = 0; i < 8; i++) {
  await page.click('#cta').catch(() => {});
  await page.waitForTimeout(400);
  if (await page.evaluate(() => !!document.pointerLockElement)) break;
}
mkdirSync(resolve('.decepticons/arte'), { recursive: true });
const resultados = {};
for (const v of VISTAS) {
  await page.evaluate((p) => {
    const g = window.__game;
    const V = g.mech.root.position.constructor;
    g.mech.respawn(new V(p.x, p.y, p.z));
    g.rig.look.yaw = p.yaw;
    g.rig.look.pitch = p.pitch;
  }, v);
  await page.waitForTimeout(2500);
  const m = await medir(page, 3000);
  await page.screenshot({ path: resolve(`.decepticons/arte/praca-${v.nome}${multidao > 0 ? '-com-multidao' : ''}.png`) });
  resultados[v.nome] = m;
  console.log(`${v.nome.padEnd(30)} ${m.fps} fps · p50 ${m.p50} ms · p95 ${m.p95} ms · ${m.desenhos} desenhos · ${m.triangulos} triângulos`);
}
if (erros.length) console.log('ERROS DO NAVEGADOR:', [...new Set(erros)].slice(0, 6).join(' | '));
await browser.close();
server.close();
if (salvar) {
  const dia = new Date().toISOString().slice(0, 10);
  writeFileSync(resolve(`.decepticons/medicoes/praca-${dia}.json`), JSON.stringify({ tela: `${W}x${H}`, multidao, resultados, erros: [...new Set(erros)].slice(0, 6) }, null, 1));
}
