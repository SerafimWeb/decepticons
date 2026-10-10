import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, preview } from 'vite';
import { chromium } from 'playwright-core';

const dir = resolve('.tmp/hangar-preparar-trocas'); mkdirSync(dir, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = dir;
const results = [];
for (const variant of ['before', 'after']) {
  const output = dir + '/' + variant;
  await build({ logLevel: 'error', build: { outDir: output }, plugins: [{
    name: 'selection-warmup-measure', enforce: 'pre', transform(code, id) {
      if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.__game = game; game.start();');
      if (variant === 'before' && id.endsWith('/core/Game.ts')) return code.replace('this.configureHangarPreparation();', '');
    },
  }] });
  const server = await preview({ logLevel: 'error', build: { outDir: output }, preview: { host: '127.0.0.1', port: 0, open: false } });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.__links = []; window.__contexts = []; window.__phase = 'boot'; window.__revealed = false;
      for (const type of ['webglcontextlost', 'webglcontextrestored']) document.addEventListener(type, () => window.__contexts.push(type), true);
      const link = WebGL2RenderingContext.prototype.linkProgram;
      WebGL2RenderingContext.prototype.linkProgram = function (...args) {
        window.__links.push({ phase: window.__phase, revealed: window.__revealed }); return link.apply(this, args);
      };
    });
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
    await page.evaluate(() => { window.__game.settings.update({ quality: 'media', volume: 0 }); document.getElementById('btn-hangar').click(); });
    await page.waitForTimeout(1000);
    const boot = await page.evaluate(() => {
      const g = window.__game, h = g.hangarScene, gl = g.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (gl.isContextLost()) throw new Error('Contexto GPU perdido');
      let shown = h.shown;
      Object.defineProperty(h, 'shown', { get: () => shown, set: value => { shown = value; window.__revealed = true; } });
      return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', memory: { ...g.renderer.info.memory }, programs: g.renderer.info.programs.length };
    });
    const rows = [];
    for (const chassis of ['genesis01', 'lancerL1', 'lr7lBastion', 'marauder', 'vector09', 'marauder']) {
      const phase = chassis + '-' + rows.length;
      await page.evaluate(phase => { window.__phase = phase; window.__revealed = false; }, phase);
      await page.locator(`[data-chassis="${chassis}"]`).click();
      await page.waitForFunction(id => {
        const h = window.__game.hangarScene; return h.displays.has(id) && h.shown === h.displays.get(id) && !h.graphicsPreparing;
      }, chassis, { timeout: 120000 });
      await page.waitForTimeout(1000);
      const row = await page.evaluate(({ chassis, phase }) => {
        const g = window.__game, links = window.__links.filter(link => link.phase === phase);
        return { chassis, beforeReveal: links.filter(link => !link.revealed).length, afterReveal: links.filter(link => link.revealed).length,
          memory: { ...g.renderer.info.memory }, programs: g.renderer.info.programs.length };
      }, { chassis, phase });
      rows.push(row); console.log(JSON.stringify({ variant, ...row }));
    }
    await page.screenshot({ path: dir + '/' + variant + '-marauder.png' });
    const contexts = await page.evaluate(() => window.__contexts);
    results.push({ variant, boot, rows, contexts, errors });
    writeFileSync(dir + '/results.json', JSON.stringify(results, null, 2));
    if (contexts.length || errors.length) throw new Error('Coleta inválida: contexto perdido/erro de página');
    if (variant === 'after' && rows.some(row => row.afterReveal)) throw new Error('Shader novo após expor o modelo');
  } finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
}
