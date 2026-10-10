import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build, preview } from 'vite';
import { chromium } from 'playwright-core';

// Instrumentação só na bancada; não publica globals nem pré-carrega outros modelos.
const dir = resolve('.tmp/hangar-selecao');
mkdirSync(dir, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = dir;
await build({ logLevel: 'error', build: { outDir: dir + '/build' }, plugins: [{
  name: 'selection-measure', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.__game = game; game.start();');
  },
}] });
const server = await preview({ logLevel: 'error', build: { outDir: dir + '/build' }, preview: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__links = []; window.__phase = 'boot'; window.__contextEvents = [];
    for (const type of ['webglcontextlost', 'webglcontextrestored']) {
      document.addEventListener(type, () => window.__contextEvents.push({ type, phase: window.__phase }), true);
    }
    const original = WebGL2RenderingContext.prototype.linkProgram;
    WebGL2RenderingContext.prototype.linkProgram = function (...args) {
      window.__links.push(window.__phase); return original.apply(this, args);
    };
  });
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
  await page.evaluate(() => {
    window.__game.settings.update({ quality: 'media', volume: 0 });
    document.getElementById('btn-hangar').click();
  });
  await page.waitForTimeout(1500);
  const boot = await page.evaluate(() => {
    const g = window.__game, gl = g.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (gl.isContextLost()) throw new Error('Contexto GPU perdido no início da coleta');
    return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', memory: { ...g.renderer.info.memory }, programs: g.renderer.info.programs.length };
  });
  const rows = [];
  for (const chassis of ['genesis01', 'lancerL1', 'lr7lBastion', 'marauder', 'vector09', 'marauder']) {
    const phase = chassis + '-' + rows.length;
    const before = await page.evaluate(({ chassis, phase }) => {
      const g = window.__game;
      window.__phase = phase;
      const memory = { ...g.renderer.info.memory }, programs = g.renderer.info.programs.length;
      const start = performance.now(); g.hangarScene.show(chassis, g.hangar.equipped);
      return { memory, programs, showMs: performance.now() - start };
    }, { chassis, phase });
    await page.waitForFunction(id => {
      const h = window.__game.hangarScene;
      return h.displays.has(id) && h.shown === h.displays.get(id);
    }, chassis, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const after = await page.evaluate(phase => {
      const g = window.__game;
      return { memory: { ...g.renderer.info.memory }, programs: g.renderer.info.programs.length, links: window.__links.filter(p => p === phase).length };
    }, phase);
    rows.push({ chassis, before, after });
    console.log(JSON.stringify(rows.at(-1)));
  }
  await page.screenshot({ path: dir + '/marauder.png' });
  const contextEvents = await page.evaluate(() => window.__contextEvents);
  const result = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), viewport: { width: 1280, height: 720 }, quality: 'media', boot, rows, errors, contextEvents,
    limits: 'Seleção direta da cena, não valida UI; cache de driver/GLB e carga concorrente; recursos não são bytes de VRAM; não mede FPS ou remotos.' };
  writeFileSync(dir + '/results.json', JSON.stringify(result, null, 2));
  if (errors.length || contextEvents.length) throw new Error('Coleta inválida: ' + JSON.stringify({ errors, contextEvents }));
} finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
