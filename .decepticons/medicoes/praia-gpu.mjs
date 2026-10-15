/** Mede o quadro da praia na GPU integrada desta máquina (G15: ferramenta em .tmp/). Serve o dist e roda `alta` e `baixa`. */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const RAIZ = 'dist';
const BASE = '/cybermech/jogar';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.otf': 'font/otf' };
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.endsWith('/') || p === '') p += 'index.html';
  const file = join(RAIZ, p);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const porta = server.address().port;

let browser = null;
const flags = ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-frame-rate-limit', '--disable-gpu-vsync'];
for (const channel of ['chrome', 'msedge', undefined]) {
  try { browser = await chromium.launch({ channel, args: flags }); break; } catch { /* próximo */ }
}
if (!browser) throw new Error('nenhum navegador');

const resultados = {};
for (const q of ['alta', 'baixa']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((qualidade) => {
    try { localStorage.setItem('cybermech.settings.v1', JSON.stringify({ quality: qualidade })); } catch { /* sem storage */ }
  }, q);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto(`http://localhost:${porta}${BASE}/?mapa=praia&modo=survival`);
  await page.waitForTimeout(9000);
  for (let i = 0; i < 8; i++) {
    await page.click('#cta').catch(() => {});
    await page.waitForTimeout(400);
    if (await page.evaluate(() => !!document.pointerLockElement)) break;
  }
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => new Promise((resolve) => {
    const t = [];
    let ult = performance.now();
    const ini = ult;
    const passo = (agora) => {
      t.push(agora - ult);
      ult = agora;
      if (agora - ini < 8000) requestAnimationFrame(passo);
      else {
        t.shift();
        const s = [...t].sort((a, b) => a - b);
        const media = t.reduce((a, b) => a + b, 0) / t.length;
        resolve({ quadros: t.length, fpsMedio: +(1000 / media).toFixed(1), p50: +s[Math.floor(s.length * 0.5)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), p99: +s[Math.floor(s.length * 0.99)].toFixed(1), max: +s[s.length - 1].toFixed(1), acima50ms: t.filter((x) => x > 50).length });
      }
    };
    requestAnimationFrame(passo);
  }));
  resultados[q] = { ...m, erros: erros.slice(0, 3) };
  console.log(q, JSON.stringify(resultados[q]));
  await ctx.close();
}
await browser.close();
server.close();
