/**
 * Fotografa a MISSÃO DO 8 DE JANEIRO (P217, passo 5 da ficha `fichas/cenario-8-de-janeiro.md`) no jogo de verdade, numa GPU real, e mede o quadro (G15: temporários em `.tmp/`; as fotos vão para
 * `.decepticons/arte/janeiro-missao-*.png`). Serve o `dist/` (faça `npm run build` antes) e abre `?mapa=janeiro&modo=survival&comandante=1&depurar` (o mapa nasce restrito ao Comandante). Joga
 * a missão de verdade por ~50 s (o relógio da fase é o do jogo): a multidão chega, o Mech fica em frente ao Congresso e atira, e no fim derruba um prédio para ver a tela de derrota.
 *
 *   npm run build && node .decepticons/medicoes/janeiro-missao.mjs                # as fotos e a medida, 1280×720
 *   node .decepticons/medicoes/janeiro-missao.mjs --espera 30                      # quantos segundos esperar a multidão chegar (padrão 75: dá tempo de os androides rebeldes chegarem)
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const arg = (nome, padrao) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : padrao);
const [W, H] = arg('--tela', '1280x720').split('x').map(Number);
const espera = Number(arg('--espera', '75'));

const RAIZ = resolve('dist');
const BASE = '/cybermech/jogar';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
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

const estado = (page) =>
  page.evaluate(() => {
    const m = window.__game.match;
    return {
      tick: m.tickDaMissao,
      fase: m.missaoJaneiro?.fase,
      integridade: m.missaoJaneiro?.integridade.map((v) => Math.round(v)),
      presentes: m.multidao?.presentes,
      eliminados: m.multidao?.eliminados,
      expulsos: m.missaoJaneiro?.expulsos,
      faltamChegar: m.multidao?.faltamChegar,
      rebeldes: m.rebeldesVivos,
    };
  });

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
await page.goto(`http://localhost:${porta}${BASE}/?mapa=janeiro&modo=survival&comandante=1&depurar`);
await page.waitForFunction(() => !!window.__game, null, { timeout: 120_000 });
await page.waitForTimeout(6000);
for (let i = 0; i < 8; i++) {
  await page.click('#cta').catch(() => {});
  await page.waitForTimeout(400);
  if (await page.evaluate(() => !!document.pointerLockElement)) break;
}
mkdirSync(resolve('.decepticons/arte'), { recursive: true });
const foto = (nome) => page.screenshot({ path: resolve(`.decepticons/arte/janeiro-missao-${nome}.png`), timeout: 90_000 });

console.log('começo   ', JSON.stringify(await estado(page)));
await page.waitForTimeout(3000);
await foto('inicio');

// O Mech em frente ao Congresso, de frente para a Esplanada por onde a multidão chega (oeste: yaw +π/2).
await page.evaluate(() => {
  const g = window.__game;
  const V = g.mech.root.position.constructor;
  g.mech.respawn(new V(-24, 1, 0));
  g.rig.look.yaw = Math.PI / 2;
  g.rig.look.pitch = -0.05;
});
await page.waitForTimeout(espera * 1000);
// Com os androides rebeldes o Mech pode ter caído e renascido na Praça: volta para a frente do Congresso antes da foto.
await page.evaluate(() => {
  const g = window.__game;
  const V = g.mech.root.position.constructor;
  g.mech.respawn(new V(-24, 1, 0));
  g.rig.look.yaw = Math.PI / 2;
  g.rig.look.pitch = -0.05;
});
await page.waitForTimeout(2500);
console.log('chegou   ', JSON.stringify(await estado(page)));
await foto('multidao-chegando');

// Um androide rebelde (de preto, no meio da multidão) visto de perto: o Mech vai para 9 m dele, de frente.
const viuRebelde = await page.evaluate(() => {
  const g = window.__game;
  const r = g.match.bots.mechs.find((m) => m.alive);
  if (!r) return false;
  const p = r.simPosition;
  const V = g.mech.root.position.constructor;
  g.mech.respawn(new V(p.x - 9, 1, p.z));
  g.rig.look.yaw = -Math.PI / 2;
  g.rig.look.pitch = -0.04;
  return true;
});
await page.waitForTimeout(700);
if (viuRebelde) await foto('rebelde');
else console.log('nenhum androide rebelde em campo para fotografar');

await page.mouse.down();
await page.waitForTimeout(1800);
await foto('atirando');
const quadro = await medir(page, 2500);
await page.mouse.up();
console.log('quadro   ', JSON.stringify(quadro));
console.log('depois   ', JSON.stringify(await estado(page)));

// O fim: derruba o Legislativo e fotografa a tela de derrota.
await page.evaluate(() => {
  window.__game.match.missaoJaneiro.integridade[0] = 0;
});
await page.waitForTimeout(2500);
await foto('derrota');
console.log('fim      ', JSON.stringify(await estado(page)));

// O Relatório de Consequências da missão (o chip RELATÓRIO ▸ do console): a aba dos fatos, com a fonte.
const chip = await page.$('#cc-relatorio:not([hidden])');
if (chip) {
  await chip.click();
  await page.waitForTimeout(1500);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(500);
  await foto('relatorio');
  console.log('relatório aberto');
} else console.log('o chip RELATÓRIO não apareceu');

if (erros.length) console.log('ERROS DO NAVEGADOR:', [...new Set(erros)].slice(0, 6).join(' | '));
else console.log('0 erros de página');
await browser.close();
server.close();
