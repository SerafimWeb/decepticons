/**
 * Mede o quadro da MULTIDÃO do 8 DE JANEIRO (P217, passo 3 da ficha) na GPU integrada desta máquina e fotografa (G15: temporários em `.tmp/`; as fotos vão para `.decepticons/arte/`).
 * Serve o `dist/` (faça `npm run build` antes) e abre `?multidao=1&cota=N&t=T&depurar` no Chrome/Edge do sistema com `--use-angle=d3d11`, sem limite de quadros nem vsync, então o fps é o que
 * a máquina aguenta de verdade (o SwiftShader do CI não mostra isto). Compara o MESMO ponto da Cidade Neon sem a multidão e com ela, em rodadas intercaladas (o iGPU divide a máquina com
 * o resto: a mediana de cada configuração, não uma rodada só), e guarda os desenhos e triângulos do quadro.
 *
 *   npm run build && node .decepticons/medicoes/multidao-gpu.mjs                   # sem, 1500 e 3000 figurantes, 1280×720
 *   node .decepticons/medicoes/multidao-gpu.mjs --cotas 0,3000 --rodadas 3          # outras cotas
 *   node .decepticons/medicoes/multidao-gpu.mjs --fotos                             # grava as fotos em .decepticons/arte/multidao-*.png
 *   node .decepticons/medicoes/multidao-gpu.mjs --salvar                            # grava medicoes/multidao-gpu-<data>.json
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const arg = (nome, padrao) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : padrao);
const [W, H] = arg('--tela', '1280x720').split('x').map(Number);
const cotas = arg('--cotas', '0,1500,3000').split(',').map(Number);
const rodadas = Number(arg('--rodadas', '3'));
const inicio = Number(arg('--t', '4500'));
const fotos = args.includes('--fotos');
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

/** Mede `ms` de quadros: fps médio, p50/p95/p99, o pior e quantos passaram de 33 ms; desenhos e triângulos do último quadro. */
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
            resolvido({
              quadros: t.length,
              fps: +(1000 / media).toFixed(1),
              p50: +s[Math.floor(s.length * 0.5)].toFixed(1),
              p95: +s[Math.floor(s.length * 0.95)].toFixed(1),
              pior: +s[s.length - 1].toFixed(1),
              acima33ms: t.filter((x) => x > 33).length,
              desenhos: info?.calls ?? null,
              triangulos: info?.triangles ?? null,
            });
          }
        };
        requestAnimationFrame(passo);
      }),
    ms,
  );

const mediana = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

/** Abre o jogo com a cota pedida (0 = sem a multidão), entra na partida e põe a câmera olhando a marcha. */
async function abrir(cota) {
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
  const consulta = cota > 0 ? `multidao=1&cota=${cota}&t=${inicio}&` : '';
  await page.goto(`http://localhost:${porta}${BASE}/?${consulta}depurar`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 120_000 });
  await page.waitForTimeout(6000);
  for (let i = 0; i < 8; i++) {
    await page.click('#cta').catch(() => {});
    await page.waitForTimeout(400);
    if (await page.evaluate(() => !!document.pointerLockElement)) break;
  }
  // A câmera de longe, olhando a marcha (os ônibus no oeste, os alvos no leste).
  await page.evaluate(() => {
    const g = window.__game;
    const V = g.mech.root.position.constructor;
    g.mech.respawn(new V(30, 1, 10));
    g.rig.look.yaw = Math.PI / 2;
    g.rig.look.pitch = -0.12;
  });
  await page.waitForTimeout(3000);
  return { page, ctx, erros };
}

const medidas = Object.fromEntries(cotas.map((c) => [c, []]));
const detalhes = {};
for (let r = 0; r < rodadas; r++) {
  for (const cota of cotas) {
    const { page, ctx, erros } = await abrir(cota);
    const m = await medir(page, 6000);
    medidas[cota].push(m);
    if (r === 0) {
      detalhes[cota] = { erros: erros.slice(0, 5) };
      if (fotos) {
        mkdirSync(resolve('.decepticons/arte'), { recursive: true });
        await page.screenshot({ path: resolve(`.decepticons/arte/multidao-${cota}.png`) });
      }
    }
    await ctx.close();
    console.log(`rodada ${r + 1}/${rodadas}  cota ${String(cota).padStart(4)}  ${m.fps} fps  p50 ${m.p50} ms  p95 ${m.p95} ms  ${m.desenhos} desenhos  ${m.triangulos} triângulos`);
  }
}
await browser.close();
server.close();

const resumo = {};
console.log('\nMEDIANA DAS RODADAS');
for (const cota of cotas) {
  const v = medidas[cota];
  const base = {
    cota,
    fps: mediana(v.map((x) => x.fps)),
    p50: mediana(v.map((x) => x.p50)),
    p95: mediana(v.map((x) => x.p95)),
    desenhos: v[0].desenhos,
    triangulos: v[0].triangulos,
    ...detalhes[cota],
  };
  resumo[cota] = base;
  console.log(`cota ${String(cota).padStart(4)}: ${base.fps} fps · p50 ${base.p50} ms · p95 ${base.p95} ms · ${base.desenhos} desenhos · ${base.triangulos} triângulos${base.erros?.length ? ' · ERROS: ' + base.erros.join(' | ') : ''}`);
}
if (salvar) {
  const dia = new Date().toISOString().slice(0, 10);
  writeFileSync(resolve(`.decepticons/medicoes/multidao-gpu-${dia}.json`), JSON.stringify({ tela: `${W}x${H}`, inicio, rodadas, resumo }, null, 1));
}
