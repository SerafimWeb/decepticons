import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const final = process.argv.includes('--final');
const dir = resolve(final ? '.tmp/warmup-final' : '.tmp/warmup');
mkdirSync(dir, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = dir;
const results = process.argv.includes('--remaining') ? JSON.parse(readFileSync(dir + '/results.json', 'utf8')) : [];
// Mesma implementação e scene; baseline retira apenas a preparação adicional do Hangar.
const cases = [
  ['before', '', { width: 1280, height: 720 }],
  ['after', '', { width: 1280, height: 720 }],
  ['after', 'v1.marauder.blaster-0.blaster-0', { width: 1280, height: 720 }],
  ['after', '', { width: 390, height: 844 }],
];
for (const [variant, build, viewport] of cases.filter(x => (!final || x[0] === 'after') && (!process.argv.includes('--remaining') || x[1] || x[2].width < 500))) {
  const label = `${variant}-${build ? 'marauder' : 'vector'}-${viewport.width}`;
  const server = await createServer({ logLevel: 'error', plugins: [{
    name: 'warmup-measure', enforce: 'pre', transform(code, id) {
      if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.__game = game; game.start();');
      if (variant === 'before' && id.endsWith('/core/Game.ts')) return code.replace('if (remainingMs > 0)', 'if (false)');
    },
  }], server: { host: '127.0.0.1', port: 0, open: false } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport, ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}) });
    const errors = [];
    const warnings = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'warning') warnings.push(e.text()); });
    await page.addInitScript(() => {
      window.__phase = 'boot'; window.__links = []; window.__logs = []; window.__frames = {};
      for (const method of ['linkProgram', 'getProgramInfoLog']) {
        const original = WebGL2RenderingContext.prototype[method];
        WebGL2RenderingContext.prototype[method] = function (...args) {
          const t = performance.now(); const result = original.apply(this, args);
          window[method === 'linkProgram' ? '__links' : '__logs'].push({ phase: window.__phase, ms: performance.now() - t });
          return result;
        };
      }
      let last = 0, phase = '';
      function frame(now) {
        const current = window.__phase;
        if (phase === current && last) (window.__frames[current] ??= []).push(now - last);
        phase = current; last = now; requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    await page.goto(server.resolvedUrls.local[0] + (build ? '?build=' + build : ''), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => !!window.__game, null, { timeout: 120000 });
    const boot = await page.evaluate(() => {
      const g = window.__game, gl = g.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { bootMs: performance.now(), gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', memory: { ...g.renderer.info.memory }, programs: g.renderer.info.programs.length, prepared: !!g.hangarScene };
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__phase = 'open'; document.getElementById('btn-hangar').click(); });
    await page.waitForTimeout(1800);
    if (!(await page.locator('#hangar-modal').isVisible())) throw new Error('Hangar não abriu');
    await page.screenshot({ path: dir + '/' + label + '.png' });
    const opened = await page.evaluate(() => ({ memory: { ...window.__game.renderer.info.memory }, programs: window.__game.renderer.info.programs.length, chassis: window.__game.hangar.current.chassis }));
    await page.evaluate(() => { window.__phase = 'test'; document.querySelector('[data-action="test"]').click(); });
    await page.waitForTimeout(4500);
    await page.evaluate(() => { window.__phase = 'return'; document.querySelector('[data-action="close"]').click(); });
    await page.waitForTimeout(1000);
    if (await page.locator('#hangar-modal').isVisible()) throw new Error('Hangar não fechou');
    const stats = await page.evaluate(() => {
      const phases = ['boot', 'open', 'test', 'return'];
      return Object.fromEntries(phases.map(p => {
        const frames = (window.__frames[p] ?? []).slice(1).sort((a,b)=>a-b);
        const quantile = q => frames[Math.min(frames.length-1, Math.floor(frames.length*q))] ?? null;
        return [p, { links: window.__links.filter(x=>x.phase===p).length, programQueries: window.__logs.filter(x=>x.phase===p).length, slowQueries: window.__logs.filter(x=>x.phase===p&&x.ms>50).length, frames: frames.length, p50: quantile(.5), p95: quantile(.95), p99: quantile(.99), stalls50: frames.filter(x=>x>50).length, stalls300: frames.filter(x=>x>300).length }];
      }));
    });
    const row = { label, viewport, boot, opened, stats, errors, warnings };
    results.push(row); writeFileSync(dir + '/results.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(row));
    if (errors.length) throw new Error(errors.join('\n'));
    if (variant === 'after' && (stats.open.links || stats.test.links || stats.return.links)) throw new Error('Programa novo após preparação');
  } finally { await browser?.close(); await server.close(); }
}
