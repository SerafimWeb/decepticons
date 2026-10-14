import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { freemem, totalmem } from 'node:os';
import { build, preview } from 'vite';

// Só a bancada expõe o Game. Buffers fixos evitam gerar um objeto por quadro na coleta.
const label = process.argv[2] ?? 'baseline';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Rótulo inválido');
const seconds = Number(process.argv[3] ?? 300);
const rounds = Number(process.argv[4] ?? 3);
if (!(seconds >= 10 && seconds <= 300 && rounds >= 1 && rounds <= 3)) throw new Error('Duração inválida');
const dir = resolve('.tmp/fluidez-camera', label);
mkdirSync(dir, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = dir;
const { chromium } = await import('playwright-core');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }).trim();
const memory = () => ({ freeMiB: Math.round(freemem() / 1048576), totalMiB: Math.round(totalmem() / 1048576) });
const report = { label, revision, dirty, seconds, rounds, started: new Date().toISOString(), viewport: { width: 1280, height: 720 }, cases: [] };
const reusedBuild = process.argv.includes('--baseline-build');
const buildDir = reusedBuild ? resolve('.tmp/fluidez-camera/baseline/build') : dir + '/build';
report.reusedBuild = reusedBuild;
if (reusedBuild && !existsSync(buildDir + '/index.html')) throw new Error('Build baseline ausente');
if (!reusedBuild) await build({ logLevel: 'error', build: { outDir: buildDir }, plugins: [{
  name: 'fluidez-camera-bancada', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.__game = game; game.start();');
  },
}] });
const server = await preview({ logLevel: 'error', build: { outDir: buildDir }, preview: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist'] });
  for (let round = 0; round < rounds; round++) {
    const context = await browser.newContext({ viewport: report.viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.__links = 0;
      const link = WebGL2RenderingContext.prototype.linkProgram;
      WebGL2RenderingContext.prototype.linkProgram = function (...args) { window.__links++; return link.apply(this, args); };
    });
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.__game && !window.__game.splash.running, null, { timeout: 180000 });
    const boot = await page.evaluate(() => {
      const g = window.__game;
      g.settings.update({ quality: 'media', volume: 0 });
      g.setPlaying(true);
      g.input.locked = true;
      const gl = g.renderer.getContext(), renderer = gl.getExtension('WEBGL_debug_renderer_info');
      const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const queries = timer ? Array.from({ length: 4 }, () => ({ query: gl.createQuery(), pending: false })) : [];
      const capacity = 100000;
      const frames = new Float64Array(capacity), cpu = new Float64Array(capacity), gpu = new Float64Array(capacity), draws = new Float64Array(capacity);
      let n = 0, ngpu = 0, previous = 0, lastPulse = -1, start = 0, distance = 0, lastX = g.mech.position.x, lastZ = g.mech.position.z, aliveFrames = 0, disjoint = 0, bankDismissals = 0, pausedFrames = 0;
      const fn = g.frame;
      window.__collect = false;
      g.frame = function (now) {
        // O banco pausa ao aproximar. A bancada dispensa o atendimento no quadro seguinte,
        // sem resgatar código, e contabiliza a pausa em vez de chamar menu parado de combate.
        if (g.bankTerminal.isOpen) {
          document.getElementById('bank-terminal').close();
          g.setPlaying(true); g.input.locked = true; bankDismissals++;
        }
        if (!start) start = now;
        const t = (now - start) / 1000, part = Math.floor(t / 5) % 4;
        // Percurso quadrado relativo à mira, que gira devagar; tiros em pulsos, dash/pulo a cada 24 s.
        g.input.virtualMoveZ = part === 0 ? 1 : part === 2 ? -1 : 0;
        g.input.virtualMoveX = part === 1 ? 1 : part === 3 ? -1 : 0;
        g.rig.look.yaw = t * 0.055;
        g.input.virtualFire = t % 5 < 3;
        const pulse = Math.floor(t / 24);
        if (pulse !== lastPulse) { g.input.virtualDash = true; g.input.virtualJump = true; lastPulse = pulse; }
        if (timer && gl.getParameter(timer.GPU_DISJOINT_EXT)) {
          disjoint++;
          for (const slot of queries) { if (slot.pending) { gl.deleteQuery(slot.query); slot.query = gl.createQuery(); slot.pending = false; } }
        }
        for (const slot of queries) {
          if (slot.pending && gl.getQueryParameter(slot.query, gl.QUERY_RESULT_AVAILABLE)) {
            if (window.__collect && ngpu < capacity) gpu[ngpu++] = gl.getQueryParameter(slot.query, gl.QUERY_RESULT) / 1e6;
            slot.pending = false;
          }
        }
        let slot;
        for (const available of queries) if (!available.pending) { slot = available; break; }
        if (slot) gl.beginQuery(timer.TIME_ELAPSED_EXT, slot.query);
        const began = performance.now();
        fn.call(this, now);
        const elapsed = performance.now() - began;
        if (slot) { gl.endQuery(timer.TIME_ELAPSED_EXT); slot.pending = true; }
        if (window.__collect && previous && n < capacity) {
          frames[n] = now - previous; cpu[n] = elapsed; draws[n] = g.renderer.info.render.calls; n++;
          if (g.mech.alive) aliveFrames++;
          if (!g.playing) pausedFrames++;
          distance += Math.hypot(g.mech.position.x - lastX, g.mech.position.z - lastZ);
        }
        previous = now; lastX = g.mech.position.x; lastZ = g.mech.position.z;
      };
      window.__result = () => {
        const stats = arr => {
          const values = Array.from(arr).sort((a, b) => a - b);
          const q = p => values[Math.min(values.length - 1, Math.floor(values.length * p))] ?? null;
          return { n: values.length, p50: q(.5), p95: q(.95), p99: q(.99), max: values.at(-1) ?? null };
        };
        return { frame: stats(frames.subarray(0, n)), cpu: stats(cpu.subarray(0, n)), gpu: stats(gpu.subarray(0, ngpu)), draws: stats(draws.subarray(0, n)), stalls: Object.fromEntries([50, 100, 300].map(t => [t, frames.subarray(0, n).filter(v => v > t).length])), distance, aliveFrames, pausedFrames, bankDismissals, disjoint, links: window.__links, playing: g.playing, gameRound: g.round.number, resources: { ...g.renderer.info.memory }, ratio: g.renderer.getPixelRatio(), bloom: g.bloomPass.enabled };
      };
      return { ms: performance.now(), gpu: renderer ? gl.getParameter(renderer.UNMASKED_RENDERER_WEBGL) : 'unknown', browser: navigator.userAgent, timer: !!timer, enemies: g.bots.mechs.length, allies: g.match.allies?.mechs.length ?? 0, build: g.activeBuild, settings: { quality: g.settings.value.quality, difficulty: g.settings.value.difficulty }, memory: performance.memory?.usedJSHeapSize };
    });
    await page.waitForTimeout(10000);
    const before = memory();
    const linksBefore = await page.evaluate(() => { window.__collect = true; return window.__links; });
    console.log(JSON.stringify({ phase: 'start', round, boot, before }));
    for (let elapsed = 0; elapsed < seconds; elapsed += 30) {
      await page.waitForTimeout(Math.min(30, seconds - elapsed) * 1000);
      console.log(JSON.stringify({ phase: 'progress', round, seconds: Math.min(seconds, elapsed + 30) }));
    }
    const result = await page.evaluate(() => { window.__collect = false; return window.__result(); });
    await page.screenshot({ path: `${dir}/combate-${round + 1}.png` });
    const row = { session: round + 1, boot, before, after: memory(), ...result, newPrograms: result.links - linksBefore, errors };
    report.cases.push(row);
    writeFileSync(`${dir}/results.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ phase: 'result', ...row }));
    await context.close();
    if (errors.length) throw new Error(errors.join('\n'));
    if (!result.playing || result.pausedFrames > Math.max(3, result.bankDismissals)) throw new Error('Amostra pausada: não usar como combate');
  }
} finally {
  await browser?.close();
  await new Promise(r => server.httpServer.close(r));
}
