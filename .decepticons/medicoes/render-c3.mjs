import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build, preview } from 'vite';
import { chromium } from 'playwright-core';

// Instrumentação só no build de bancada: nenhum global ou coletor vai ao site.
const dir = resolve('.tmp/c3');
mkdirSync(dir, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = dir;
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const system = () => JSON.parse(execFileSync('powershell', ['-NoProfile', '-Command',
  '$s=Get-CimInstance Win32_OperatingSystem; $p=Get-Process node,msedge -ErrorAction SilentlyContinue; @{freeMiB=[math]::Round($s.FreePhysicalMemory/1024);totalMiB=[math]::Round($s.TotalVisibleMemorySize/1024);processes=@($p | Select-Object ProcessName,Id,CPU,WorkingSet64)} | ConvertTo-Json -Depth 3 -Compress'], { encoding: 'utf8' }));
await build({ logLevel: 'error', build: { outDir: dir + '/build' }, plugins: [{
  name: 'c3-instrument', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/src/main.ts')) return code.replace('game.start();', 'window.__game = game; game.start();');
  },
}] });
const server = await preview({ logLevel: 'error', build: { outDir: dir + '/build' }, preview: { host: '127.0.0.1', port: 0, open: false } });
const report = { revision, viewport: { width: 1280, height: 720 }, method: 'production build; Edge headless real GPU; fixed quality media; frozen Arena/Hangar ABBA bloom; separate active combat; no concurrent checks started by Codex', started: new Date().toISOString(), systemBefore: system(), cases: [] };
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: report.viewport });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__links = 0;
    const original = WebGL2RenderingContext.prototype.linkProgram;
    WebGL2RenderingContext.prototype.linkProgram = function (...args) { window.__links++; return original.apply(this, args); };
  });
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
  report.boot = await page.evaluate(() => {
    const g = window.__game, gl = g.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    g.settings.update({ quality: 'media', volume: 0 });
    window.__samples = []; window.__collect = false; window.__phase = '';
    const timings = {};
    for (const [obj, method, label] of [[g.mech,'render','mech'],[g.bots,'render','bots'],[g.nameplates,'update','nameplates'],[g.hangarScene,'update','hangar'],[g.hud,'update','hud'],[g.composer,'render','composer'],[g.particles,'update','particles']]) {
      if (!obj) continue;
      const fn = obj[method]; obj[method] = function (...args) { const t = performance.now(); try { return fn.apply(this,args); } finally { timings[label] = (timings[label] ?? 0) + performance.now()-t; } };
    }
    const fn = g.frame; let previous = 0;
    g.frame = function (now) {
      for (const k in timings) timings[k] = 0;
      const t = performance.now(); fn.call(this,now); const cpu = performance.now()-t;
      if (window.__collect) window.__samples.push({ frame: previous ? now-previous : null, cpu, ...timings, calls:g.renderer.info.render.calls, triangles:g.renderer.info.render.triangles });
      previous=now;
    };
    return { ms: performance.now(), gpu:ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown', browser:navigator.userAgent, heap:performance.memory?.usedJSHeapSize ?? null, resources:{...g.renderer.info.memory}, timerQuery:!!gl.getExtension('EXT_disjoint_timer_query_webgl2') };
  });
  async function sample(label, seconds=12) {
    const hostBefore=system();
    await page.waitForTimeout(1500);
    const before=await page.evaluate(() => { window.__samples=[];window.__collect=true;return window.__links; });
    await page.waitForTimeout(seconds*1000);
    const data=await page.evaluate(() => {
      window.__collect=false;const g=window.__game;
      return {samples:window.__samples,links:window.__links,heap:performance.memory?.usedJSHeapSize ?? null,resources:{...g.renderer.info.memory},pixelRatio:g.renderer.getPixelRatio(),bloom:g.bloomPass.enabled,playing:g.playing,hangar:g.hangarView};
    });
    const summary={};
    for(const key of ['frame','cpu','composer','mech','bots','hangar','hud','particles','nameplates','calls','triangles']) {
      const vals=data.samples.slice(1).map(s=>s[key]).filter(Number.isFinite).sort((a,b)=>a-b);
      const q=p=>vals[Math.min(vals.length-1,Math.floor(vals.length*p))] ?? null;
      summary[key]={n:vals.length,p50:q(.5),p95:q(.95),p99:q(.99),max:vals.at(-1) ?? null};
    }
    const frames=data.samples.slice(1).map(s=>s.frame);
    const row={label,hostBefore,hostAfter:system(),...data,newPrograms:data.links-before,summary,stalls:Object.fromEntries([50,100,300].map(t=>[t,frames.filter(x=>x>t).length]))};
    report.cases.push(row);writeFileSync(dir+'/results.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify({label,summary,stalls:row.stalls,newPrograms:row.newPrograms}));
  }
  for(const scene of ['arena','hangar']) {
    if(scene==='hangar') await page.locator('#btn-hangar').click();
    for(const [index,on] of [true,false,false,true].entries()) {
      await page.evaluate(on=>{window.__game.bloomPass.enabled=on;},on);
      await sample(`${scene}-${index}-${on?'bloom':'sem-bloom'}`);
    }
    await page.screenshot({path:dir+'/'+scene+'.png'});
  }
  await page.evaluate(()=>{document.querySelector('[data-action="close"]').click();window.__game.bloomPass.enabled=true;window.__game.setPlaying(true);});
  await page.mouse.down();await sample('combate',20);await page.mouse.up();
  await page.screenshot({path:dir+'/combate.png'});
  report.errors=errors;report.systemAfter=system();report.finished=new Date().toISOString();
  writeFileSync(dir+'/results.json',JSON.stringify(report,null,2));
  if(errors.length) throw new Error(errors.join('\n'));
} finally { await browser?.close(); await new Promise(r=>server.httpServer.close(r)); }
