/**
 * Smoke test (Protocolo Serafim UM — R15 + R7): roda sobre o build de produção em dist/.
 *
 *  1. Performance budget: JS (gzip) e Wasm (gzip) dentro dos limites. O JS tem dois tetos (`scripts/orcamentoDeJs.mjs`, P180): o **de partida** (500 KB, o que todo jogador baixa)
 *     e o de cada pedaço **sob demanda** (o que só baixa quem entra numa fase: o Draga-01, e depois o mapa da Amazônia).
 *  2. Boot real num Chrome/Edge headless (WebGL via SwiftShader): a física (Rapier)
 *     inicializa, o Game monta e o loop de render roda sem erro no console.
 *
 * Uso: npm run build && npm run smoke   (ou `npm run check`, que faz tudo)
 *      npm run smoke:dev                  (só o boot, contra o dev server do Vite)
 * Browser: usa SMOKE_BROWSER (caminho do executável) se definido; senão tenta
 * Chrome, depois Edge, depois o Chromium do Playwright (CI: `npx playwright install chromium`).
 * Saída: exit 0 = ok, exit 1 = falha.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createServer, preview } from 'vite';
import { chunksDePartida, entradaDoHtml, JS_PARTIDA_KB, JS_SOB_DEMANDA_KB } from './orcamentoDeJs.mjs';

// Nada fora da pasta do projeto: o perfil temporário do Chrome e os artefatos do Playwright
// vão para .tmp/smoke/ (zerada a cada execução). Precisa vir antes do import do Playwright,
// que lê os.tmpdir() ao carregar.
const TMP = resolve('.tmp', 'smoke');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');

// Budgets em bytes gzip. Wasm tem limite próprio: ver HISTORICO_DE_DECISOES (2026-09-23).
const JS_BUDGET = JS_PARTIDA_KB * 1024; // o JS de partida: tudo o que o jogador baixa para abrir o jogo
const JS_LAZY_BUDGET = JS_SOB_DEMANDA_KB * 1024; // cada pedaço sob demanda
const WASM_BUDGET = 900 * 1024;
const BOOT_TIMEOUT_MS = 30_000;

const DEV = process.argv.includes('--dev');
const failures = [];
const fail = (msg) => failures.push(msg);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

// --- 1. Budget (só faz sentido no build de produção) ---
if (!DEV) {
  const assetsDir = join('dist', 'assets');
  let files;
  try {
    files = readdirSync(assetsDir);
  } catch {
    console.error('❌ dist/assets não existe. Rode `npm run build` antes do smoke.');
    process.exit(1);
  }
  const gzDe = (f) => gzipSync(readFileSync(join(assetsDir, f))).length;
  const gz = (ext) => files.filter((f) => f.endsWith(ext)).reduce((sum, f) => sum + gzDe(f), 0);
  const wasmGz = gz('.wasm');
  // O JS se divide em "de partida" (o que todo jogador baixa) e "sob demanda" (só quem entra na fase). Sem achar a entrada no index.html, tudo é de partida (a regra antiga).
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  const codigos = new Map(jsFiles.map((f) => [f, readFileSync(join(assetsDir, f), 'utf8')]));
  let entrada = null;
  try {
    entrada = entradaDoHtml(readFileSync(join('dist', 'index.html'), 'utf8'));
  } catch {
    entrada = null;
  }
  const partida = entrada && codigos.has(entrada) ? chunksDePartida(codigos, entrada) : new Set(jsFiles);
  const jsGz = jsFiles.filter((f) => partida.has(f)).reduce((sum, f) => sum + gzDe(f), 0);
  const lazy = jsFiles.filter((f) => !partida.has(f)).map((f) => [f, gzDe(f)]);
  console.log(`budget  JS   ${kb(jsGz).padStart(10)} / ${kb(JS_BUDGET)}  (de partida: ${[...partida].length} pedaços)`);
  for (const [f, g] of lazy) console.log(`budget  JS sob demanda ${kb(g).padStart(8)} / ${kb(JS_LAZY_BUDGET)}  ${f}`);
  console.log(`budget  Wasm ${kb(wasmGz).padStart(10)} / ${kb(WASM_BUDGET)}`);
  if (jsGz > JS_BUDGET) fail(`JS de partida gzip ${kb(jsGz)} acima do budget de ${kb(JS_BUDGET)}`);
  for (const [f, g] of lazy) if (g > JS_LAZY_BUDGET) fail(`JS sob demanda ${f} gzip ${kb(g)} acima do budget de ${kb(JS_LAZY_BUDGET)} por pedaço`);
  if (wasmGz > WASM_BUDGET) fail(`Wasm gzip ${kb(wasmGz)} acima do budget de ${kb(WASM_BUDGET)}`);
}

// --- 2. Boot no browser ---
async function launchBrowser() {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  if (process.env.SMOKE_BROWSER) return chromium.launch({ executablePath: process.env.SMOKE_BROWSER, args });
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch({ channel, args });
    } catch {
      // tenta o próximo
    }
  }
  throw new Error('nenhum browser encontrado (defina SMOKE_BROWSER ou rode `npx playwright install chromium`)');
}

const server = DEV
  ? await createServer({ logLevel: 'silent', server: { port: 4198, strictPort: false, open: false } }).then((s) =>
      s.listen(),
    )
  : await preview({ logLevel: 'silent', preview: { port: 4199, strictPort: false, open: false } });
const url = server.resolvedUrls?.local[0];
let browser;
try {
  if (!url) throw new Error('o Vite não retornou URL');
  browser = await launchBrowser();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });

  const t0 = Date.now();
  await page.goto(url);
  // HUD.setReady() só roda depois de a física inicializar e todos os módulos montarem.
  await page.waitForFunction(() => document.getElementById('cta')?.textContent === '[ clique para jogar ]', null, {
    timeout: BOOT_TIMEOUT_MS,
  });
  const bootMs = Date.now() - t0;
  // O DebugPanel escreve FPS a cada 0,2 s dentro do frame(): prova que sim + render rodaram.
  // Com a máquina ocupada (vários agentes compilando, CI), os primeiros quadros em SwiftShader levam
  // segundos: o mesmo teto do boot, para não reprovar por tempo o que não é defeito.
  await page.waitForFunction(() => document.getElementById('debug-panel')?.textContent?.includes('FPS'), null, {
    timeout: BOOT_TIMEOUT_MS,
  });
  // A arena desenha dezenas de objetos: um total baixo significa contagem errada
  // (ex.: renderer.info zerado a cada passada do pós-processamento).
  const panel = await page.evaluate(() => document.getElementById('debug-panel')?.textContent ?? '');
  const draws = Number(/DRAWS\s+(\d+)/.exec(panel)?.[1] ?? 0);
  if (draws < 10) fail(`painel de debug mostra ${draws} draw calls por frame (esperado dezenas)`);
  // CSS quebrado derruba regras inteiras em silêncio (em 23/09 um bloco sem seletor apagou a mira).
  const crosshair = await page.evaluate(() => getComputedStyle(document.getElementById('crosshair')).position);
  if (crosshair !== 'absolute') fail(`mira sem estilo (position=${crosshair}): CSS quebrado em styles.css`);
  // ' abre o painel detalhado nos dois teclados (ABNT2 = Backquote, US = Quote) e fecha de novo.
  // Espera o texto em vez de um tempo fixo: em headless os primeiros frames são lentos.
  const panelDetailed = (want) =>
    page
      .waitForFunction(
        (want) => {
          const p = document.getElementById('debug-panel');
          const open = !!p?.classList.contains('detailed') && !!p.textContent?.includes('QUAL');
          return want ? open : !p?.classList.contains('detailed');
        },
        want,
        { timeout: BOOT_TIMEOUT_MS },
      )
      .then(() => true, () => false);
  for (const code of ['Backquote', 'Quote']) {
    await page.keyboard.press(code);
    if (!(await panelDetailed(true))) fail(`tecla ${code} não abriu o painel de desempenho detalhado`);
    await page.keyboard.press(code);
    if (!(await panelDetailed(false))) fail(`tecla ${code} não fechou o painel de desempenho detalhado`);
  }
  // Console de comando (P86): o CSS de pé (a grade dos monitores), o mapa do teatro com as missões e um clique no vazio de um
  // monitor sem começar a partida (a pausa inteira é o botão de jogar; os monitores barram o clique).
  // O console liga 250 ms depois do botão ficar pronto (`CommandConsole`: espera de assentamento): espera ele sair da tela de carregamento.
  const ligou = await page
    .waitForFunction(() => !document.getElementById('overlay').classList.contains('cc-espera'), null, { timeout: 10_000 })
    .then(() => true, () => false);
  if (!ligou) fail('o console de comando não ligou: o #overlay ficou na tela de carregamento (cc-espera) com o jogo pronto');
  // Primeiro acesso (P133): o navegador do smoke nasce sem nada salvo, então cai na tela enxuta (o título, a frase, JOGAR e "mais opções", sem os
  // monitores). Confere isso e pede "mais opções": dali em diante valem as checagens do console completo, que seguem abaixo.
  const enxuta = await page.evaluate(() => ({
    classes: document.getElementById('overlay').className,
    teatro: getComputedStyle(document.getElementById('mon-teatro')).display,
    mais: !document.getElementById('cc-mais').hidden && getComputedStyle(document.getElementById('cc-mais')).display !== 'none',
    frase: !document.getElementById('cc-pitch').hidden && getComputedStyle(document.getElementById('cc-pitch')).display !== 'none',
  }));
  if (!/cc-primeira/.test(enxuta.classes)) fail(`o primeiro acesso não caiu na tela enxuta (classes: ${enxuta.classes})`);
  if (enxuta.teatro !== 'none') fail('a tela enxuta mostra o monitor do mapa (devia estar escondido: o jogador novo cai na partida, não no painel)');
  if (!enxuta.mais || !enxuta.frase) fail('a tela enxuta sem a frase ou sem o "mais opções"');
  await page.locator('#cc-mais').click();
  await page.waitForTimeout(300);
  if (!(await page.locator('#overlay').isVisible())) fail('"mais opções" começou a partida (devia só abrir o console completo)');
  const cc = await page.evaluate(() => ({
    grade: getComputedStyle(document.getElementById('overlay')).display,
    pins: document.querySelectorAll('#mon-teatro .pin').length,
    classes: document.getElementById('overlay').className,
  }));
  if (cc.grade !== 'grid') fail(`console de comando sem estilo (display=${cc.grade}): CSS quebrado em styles.css`);
  if (cc.pins < 5) fail(`mapa do teatro com ${cc.pins} missões (esperado 5)`);
  if (/cc-carregando/.test(cc.classes)) fail('o botão de jogar ficou apagado (cc-carregando) com o jogo pronto');
  const monitor = await page.locator('#mon-piloto .mon-screen').boundingBox();
  if (monitor) await page.mouse.click(monitor.x + monitor.width / 2, monitor.y + monitor.height - 6);
  await page.waitForTimeout(300);
  if (!(await page.locator('#overlay').isVisible())) fail('clicar num monitor do console começou a partida (o monitor devia barrar o clique)');
  const hasCanvas = await page.evaluate(() => !!document.querySelector('#app canvas'));
  console.log(`boot    ${bootMs} ms até "clique para jogar" (${DEV ? 'dev server' : 'build'}, headless/SwiftShader)`);
  if (!hasCanvas) fail('canvas WebGL não foi criado');
  for (const e of errors) fail(e);
} catch (err) {
  fail(`boot: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await browser?.close();
  await server.close();
}

if (failures.length) {
  console.error('\n❌ SMOKE FALHOU');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('\n✅ SMOKE OK');
