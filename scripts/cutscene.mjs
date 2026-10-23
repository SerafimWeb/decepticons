/**
 * Grava a cutscene-piloto do 8 DE JANEIRO (P245) em vídeo real, numa GPU de verdade: serve o `dist/` (faça `npm run
 * build` antes), abre `?mapa=janeiro&modo=survival&comandante=1&cutscene=janeiro-abertura&depurar`, espera a
 * trajetória da câmera terminar (~24 s, `client/src/debug/CutsceneJaneiro.ts`) e converte a gravação do Playwright
 * (.webm) para .mp4 com o ffmpeg do projeto (`scripts/sonsRodar.mjs`, o mesmo usado pelo Estúdio).
 *
 * G15: o vídeo fica em `.tmp/video/cutscenes/` (temporário, fora do git — ignorado pelo `.gitignore`); uma captura de
 * quadro também vai para `.decepticons/arte/cutscene-janeiro-piloto.png` (prova visual rápida, sem precisar rodar
 * nada nem ter ffmpeg instalado).
 *
 *   npm run build && npm run cutscene
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright-core';
import { acharFfmpeg } from './sonsRodar.mjs';

const RAIZ = resolve('dist');
const BASE = '/cybermech/jogar';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };

if (!existsSync(RAIZ)) throw new Error('dist/ não existe: rode "npm run build" antes de "npm run cutscene"');

const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.endsWith('/') || p === '') p += 'index.html';
  // Só serve o que fica dentro de dist/: sem isto, "../../../" no link escaparia da pasta (achado da revisão de segurança).
  const file = resolve(RAIZ, '.' + p);
  if (file !== RAIZ && !file.startsWith(RAIZ + sep)) {
    res.writeHead(403);
    res.end('403');
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end('404');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
// Loopback só: este servidor nasce e morre dentro do script, nunca precisa ser alcançável pela rede.
await new Promise((r) => server.listen(0, '127.0.0.1', r));
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
if (!browser) throw new Error('nenhum navegador (Chrome ou Edge) encontrado para gravar com GPU real');

const W = 1280;
const H = 720;
const DIR_VIDEO = resolve('.tmp/video/cutscenes');
mkdirSync(DIR_VIDEO, { recursive: true });
mkdirSync(resolve('.decepticons/arte'), { recursive: true });

const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: DIR_VIDEO, size: { width: W, height: H } } });
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

await page.goto(`http://127.0.0.1:${porta}${BASE}/?mapa=janeiro&modo=survival&comandante=1&cutscene=janeiro-abertura&depurar`);
await page.waitForFunction(() => !!window.__game, null, { timeout: 120_000 });
for (let i = 0; i < 8; i++) {
  await page.click('#cta').catch(() => {});
  await page.waitForTimeout(400);
  if (await page.evaluate(() => !!document.pointerLockElement || !!window.__game?.playing)) break;
}
// A cutscene carrega sob demanda (import() assíncrono) só depois de a missão montar: espera ela aparecer.
await page.waitForFunction(() => !!window.__game?.cutscene, null, { timeout: 30_000 }).catch(() => {
  erros.push('a cutscene não começou em 30 s (a missão carregou? confira ?mapa=janeiro&modo=survival&comandante=1)');
});

await page.waitForTimeout(12_000);
await page.screenshot({ path: resolve('.decepticons/arte/cutscene-janeiro-piloto.png') });

await page.waitForFunction(() => window.__cutsceneTerminou === true, null, { timeout: 40_000 }).catch(() => {
  erros.push('a cutscene não terminou a tempo (ficou presa ou a trajetória mudou de duração)');
});
await page.waitForTimeout(500); // folga para o último quadro entrar na gravação

const video = page.video();
await ctx.close();
await browser.close();
server.close();

if (erros.length) console.error('avisos:', erros);

const bruto = video ? await video.path() : null;
if (!bruto || !existsSync(bruto)) throw new Error('o Playwright não gravou o vídeo (recordVideo falhou)');

const ffmpeg = acharFfmpeg();
const saida = join(DIR_VIDEO, 'janeiro-abertura.mp4');
if (!ffmpeg) {
  console.log(`ffmpeg não encontrado no PATH (nem em FFMPEG=, nem no winget): o .webm bruto ficou em ${bruto}.`);
  console.log('instale o ffmpeg para gerar o .mp4, ou assista o .webm direto (todo navegador moderno abre).');
} else {
  const r = spawnSync(ffmpeg, ['-y', '-i', bruto, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', saida], { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(saida)) console.error('o ffmpeg falhou:', (r.stderr ?? '').split('\n').slice(-6).join('\n'));
  else console.log(`vídeo pronto: ${saida}`);
}
console.log('quadro de prova: .decepticons/arte/cutscene-janeiro-piloto.png');
if (erros.length) process.exitCode = 1;
