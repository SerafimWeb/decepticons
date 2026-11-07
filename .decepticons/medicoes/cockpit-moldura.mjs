/**
 * Fotografa e MEDE a moldura do cockpit (câmera em primeira pessoa, P317) no jogo de verdade, numa GPU real (G15: temporários em `.tmp/`; as duas fotos do antes e do depois vão para `.decepticons/arte/cockpit-moldura-*.jpg`, as de conferência ficam em `.tmp/`).
 * Serve o `dist/` (faça `npm run build` antes). A pergunta que a bancada responde com NÚMERO, não com opinião: **a moldura cobre algum elemento do HUD de combate?** Para cada elemento visível do
 * `#hud` que tem conteúdo, ela amostra cinco pontos e vê, na ordem de empilhamento do navegador, se a moldura está por cima.
 *
 *   1. Medida ANTES: força o `z-index: 2` que a moldura tinha no rascunho do Gemini (por cima do HUD): tem de cobrir elementos (prova que a medida enxerga o defeito).
 *   2. Medida DEPOIS: o CSS de hoje (`z-index: -1`, atrás do HUD): tem de cobrir zero.
 *   3. O jogador comum (sem `?comandante=1`) nunca vê a moldura: a funcionalidade `tela:cockpit` nasce restrita (P191).
 *
 *   npm run build && node .decepticons/medicoes/cockpit-moldura.mjs              # 1280×720
 *   node .decepticons/medicoes/cockpit-moldura.mjs --tela 1920x1080
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const arg = (nome, padrao) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : padrao);
const [W, H] = arg('--tela', '1280x720').split('x').map(Number);
const prefixo = arg('--prefixo', 'cockpit-moldura');

const RAIZ = resolve('dist');
const BASE = '/cybermech/jogar';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.otf': 'font/otf', '.svg': 'image/svg+xml' };
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

const falhas = [];
const confere = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) falhas.push(texto);
};

mkdirSync(resolve('.decepticons/arte'), { recursive: true });
mkdirSync(resolve('.tmp'), { recursive: true });
/** As duas fotos que vão para o repositório (`arte/`, em JPG para não pesar) e as de conferência (só em `.tmp/`, regra G15). */
const fotoArte = (p, nome) => p.screenshot({ path: resolve(`.decepticons/arte/${prefixo}-${nome}.jpg`), type: 'jpeg', quality: 85, timeout: 90_000 });
const fotoTmp = (p, nome) => p.screenshot({ path: resolve(`.tmp/${prefixo}-${nome}.jpg`), type: 'jpeg', quality: 85, timeout: 90_000 });

/** Abre o jogo, passa pelo primeiro clique e devolve a página (com a lista de erros). */
async function abrir(query) {
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
  page.on('console', (m) => m.type() === 'error' && !/ERR_CONNECTION_REFUSED|WebSocket/.test(m.text()) && erros.push(m.text()));
  await page.goto(`http://localhost:${porta}${BASE}/?${query}`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 120_000 });
  await page.waitForTimeout(6000);
  for (let i = 0; i < 8; i++) {
    await page.click('#cta').catch(() => {});
    await page.waitForTimeout(400);
    if (await page.evaluate(() => !!document.pointerLockElement)) break;
  }
  return { page, erros };
}

const classeFps = (page) => page.evaluate(() => document.getElementById('hud')?.classList.contains('cam-fps') ?? false);
const opacidade = (page) => page.evaluate(() => getComputedStyle(document.getElementById('cockpit-frame')).opacity);

/** Vai à primeira pessoa com a tecla V (as câmeras alternam); devolve se chegou. */
async function irParaPrimeiraPessoa(page) {
  for (let i = 0; i < 4; i++) {
    const modo = await page.evaluate(() => window.__game?.rig?.mode?.id);
    if (modo === 'fps') return true;
    await page.keyboard.press('v');
    await page.waitForTimeout(700);
  }
  return (await page.evaluate(() => window.__game?.rig?.mode?.id)) === 'fps';
}

/** Quais elementos do HUD (com conteúdo) têm a moldura por cima: amostra cinco pontos de cada um e olha a pilha de empilhamento. */
async function cobertosPelaMoldura(page) {
  await page.addStyleTag({ content: '#cockpit-frame, #cockpit-frame * { pointer-events: auto !important; }' });
  const saida = await page.evaluate(() => {
    const moldura = document.getElementById('cockpit-frame');
    const hud = document.getElementById('hud');
    const achados = [];
    for (const el of hud.querySelectorAll('*')) {
      if (moldura.contains(el) || el === moldura) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) continue;
      const temConteudo = (el.childElementCount === 0 && (el.textContent ?? '').trim().length > 0) || el.tagName === 'svg' || el.tagName === 'canvas';
      if (!temConteudo) continue;
      let cobertas = 0;
      for (const [fx, fy] of [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]]) {
        const x = r.left + r.width * fx, y = r.top + r.height * fy;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        const pilha = document.elementsFromPoint(x, y);
        const iMoldura = pilha.findIndex((e) => moldura.contains(e));
        const iElemento = pilha.indexOf(el);
        if (iMoldura !== -1 && iElemento !== -1 && iMoldura < iElemento) cobertas++;
      }
      if (cobertas > 0) {
        const id = el.id ? `#${el.id}` : '';
        const cls = typeof el.className === 'string' && el.className ? `.${el.className.split(' ')[0]}` : '';
        achados.push({ elemento: `${el.tagName.toLowerCase()}${id}${cls}`, texto: (el.textContent ?? '').trim().slice(0, 22), cobertas });
      }
    }
    return achados;
  });
  await page.addStyleTag({ content: '#cockpit-frame, #cockpit-frame * { pointer-events: none !important; }' });
  return saida;
}

// ── Comandante: a moldura existe e não cobre o HUD ──────────────────────────────────────────────────────────────────────
const { page, erros } = await abrir('comandante=1&depurar');
await page.waitForTimeout(1500);
confere(!(await classeFps(page)), 'em terceira pessoa o #hud não tem a classe cam-fps');
confere((await opacidade(page)) === '0', 'em terceira pessoa a moldura está transparente (opacity 0)');
await fotoTmp(page, 'terceira');

confere(await irParaPrimeiraPessoa(page), 'a tecla V leva à primeira pessoa');
await page.waitForTimeout(1000);
confere(await classeFps(page), 'com a liberação do Comandante, em primeira pessoa o #hud ganha cam-fps');
confere((await opacidade(page)) === '1', 'a moldura fica opaca (opacity 1)');

// ANTES: o z-index do rascunho (por cima do HUD)
await page.addStyleTag({ content: '#cockpit-frame { z-index: 2 !important; }' });
await page.waitForTimeout(300);
const antes = await cobertosPelaMoldura(page);
console.log(`ANTES (z-index: 2, o rascunho): ${antes.length} elemento(s) do HUD por baixo da moldura`);
for (const c of antes.slice(0, 20)) console.log('   ', JSON.stringify(c));
await fotoArte(page, 'antes-cobria-o-hud');
confere(antes.length > 0, 'a medida enxerga o defeito: com a moldura por cima, algum painel do HUD fica coberto');

// DEPOIS: o CSS de hoje (z-index: -1)
await page.addStyleTag({ content: '#cockpit-frame { z-index: -1 !important; }' });
await page.waitForTimeout(300);
const depois = await cobertosPelaMoldura(page);
console.log(`DEPOIS (z-index: -1, o CSS de hoje): ${depois.length} elemento(s) do HUD por baixo da moldura`);
for (const c of depois.slice(0, 20)) console.log('   ', JSON.stringify(c));
confere(depois.length === 0, 'nenhum elemento do HUD de combate fica por baixo da moldura');

// a foto do que o Comandante vai ver, com o CSS de hoje (sem os overrides de teste: recarrega o estado natural)
await page.evaluate(() => {
  for (const s of [...document.querySelectorAll('style')]) if (/#cockpit-frame \{ z-index: (2|-1) !important; \}|pointer-events: (auto|none) !important/.test(s.textContent ?? '')) s.remove();
});
await page.waitForTimeout(400);
await fotoArte(page, 'primeira-pessoa');
await page.evaluate(() => { document.getElementById('cockpit-frame').style.display = 'none'; });
await page.waitForTimeout(400);
await fotoTmp(page, 'primeira-sem-moldura');
confere(erros.length === 0, `nenhum erro na página (Comandante)${erros.length ? `: ${erros.slice(0, 3).join(' | ')}` : ''}`);

// ── Jogador comum: nunca vê a moldura (restrita) ───────────────────────────────────────────────────────────────────────
const comum = await abrir('depurar');
confere(await irParaPrimeiraPessoa(comum.page), 'o jogador comum também chega à primeira pessoa');
await comum.page.waitForTimeout(1000);
confere(!(await classeFps(comum.page)), 'o jogador comum, em primeira pessoa, NÃO ganha cam-fps (a funcionalidade nasce restrita)');
confere((await opacidade(comum.page)) === '0', 'e a moldura continua transparente para ele');
await fotoTmp(comum.page, 'jogador-comum');
confere(comum.erros.length === 0, `nenhum erro na página (jogador comum)${comum.erros.length ? `: ${comum.erros.slice(0, 3).join(' | ')}` : ''}`);

await browser.close();
server.close();
process.exit(falhas.length ? 1 : 0);
