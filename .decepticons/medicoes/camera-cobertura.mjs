import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, preview } from 'vite';

// Compara o build baseline congelado pelo fluidez-camera.mjs com o código atual.
const scenario = process.argv[2] ?? 'predio';
const paths = { predio: { x: -28, z: -24, exitFrame: 75 }, barricada: { x: 22, z: 34, exitFrame: 25 } };
const path = paths[scenario];
if (!path) throw new Error('Cenário inválido');
const dir = resolve('.tmp/camera-cobertura', scenario);
mkdirSync(dir, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = dir;
const { chromium } = await import('playwright-core');
const baseline = resolve('.tmp/fluidez-camera/baseline/build');
if (!existsSync(baseline)) throw new Error('Primeiro rode fluidez-camera.mjs baseline');
const candidate = dir + '/build';
await build({ logLevel: 'error', build: { outDir: candidate }, plugins: [{
  name: 'camera-cobertura-bancada', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.__game = game; game.start();');
  },
}] });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist'] });
const report = [];
try {
  for (const [label, buildDir] of [['antes', baseline], ['depois', candidate]]) {
    const server = await preview({ logLevel: 'error', build: { outDir: buildDir }, preview: { host: '127.0.0.1', port: 0, open: false } });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    mkdirSync(`${dir}/${label}`, { recursive: true });
    let frame = 0;
    const capture = () => page.screenshot({ path: `${dir}/${label}/frame-${String(frame++).padStart(3, '0')}.png` });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__game && !window.__game.splash.running, null, { timeout: 180000 });
      await page.evaluate(({ x, z }) => {
        const g = window.__game;
        g.settings.update({ quality: 'media', volume: 0 });
        g.renderer.setAnimationLoop(null);
        g.setPlaying(true);
        g.hud.roundOverlay.parar();
        // O menu inicial ainda não executou ticks: atualizar o índice de colisores antes do raycast.
        g.rig.ctx.physics.step();
        g.rig.look.yaw = Math.PI;
        g.rig.look.pitch = 0;
        g.rig.trauma = 0;
        g.killCam.cancel();
        // Face sul do obstáculo, olhando para sul: a câmera está entre Mech e cobertura.
        g.mech.root.position.set(x, 0, z);
        window.__pathX = x;
        g.rig.mode.enter?.();
        window.__cameraFrames = [];
        window.__cameraPose = (x, phase) => {
          g.mech.root.position.x = x;
          g.rig.update(1 / 60);
          const pivot = g.mech.position.clone(); pivot.y += 4.4;
          window.__cameraFrames.push({ phase, x, distance: g.camera.position.distanceTo(pivot), camera: g.camera.position.toArray(), yaw: g.rig.aim.yaw });
          g.scene.updateMatrixWorld(true);
          g.renderer.info.reset();
          g.composer.render(1 / 60);
        };
        window.__cameraPose(x, 'coberto');
      }, path);
      await page.screenshot({ path: `${dir}/${label}-coberto.png` });
      // Percurso visual contínuo junto à face: 14 m em 2 s, próximo da velocidade do Mech.
      for (let i = 0; i <= 120; i++) {
        await page.evaluate(i => window.__cameraPose(window.__pathX + i * 14 / 120, 'saida'), i);
        await capture();
        if (i === path.exitFrame) await page.screenshot({ path: `${dir}/${label}-saida.png` });
      }
      for (let i = 0; i < 45; i++) {
        await page.evaluate(() => window.__cameraPose(window.__pathX + 14, 'livre'));
        await capture();
      }
      await page.screenshot({ path: `${dir}/${label}-livre.png` });
      const result = await page.evaluate(() => {
        const rows = window.__cameraFrames;
        let maxBoomStep = 0;
        for (let i = 1; i < rows.length; i++) maxBoomStep = Math.max(maxBoomStep, rows[i].distance - rows[i - 1].distance);
        if (rows[0].distance >= 6 || maxBoomStep <= 0) throw new Error('Percurso não exercitou obstrução e recuperação');
        return { rows, maxBoomStep, draws: window.__game.renderer.info.render.calls, triangles: window.__game.renderer.info.render.triangles };
      });
      report.push({ label, scenario, errors, ...result });
      await context.close();
      console.log(JSON.stringify({ label, maxBoomStep: result.maxBoomStep, errors }));
      if (errors.length) throw new Error(errors.join('\n'));
    } finally {
      await context.close();
      await new Promise(r => server.httpServer.close(r));
    }
  }
  writeFileSync(`${dir}/results.json`, JSON.stringify(report, null, 2));
} finally { await browser.close(); }
