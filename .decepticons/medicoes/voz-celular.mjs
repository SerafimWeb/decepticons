import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';
import { gerarWav } from './vozLib.mjs';

/**
 * O CHAT DE VOZ NO CELULAR (P209): o jogo de verdade num **celular emulado** (Chrome com tela de toque, 915×412 deitado, `(hover: none) and (pointer: coarse)`), online, com um colega falando (uma
 * página da bancada) e o microfone FALSO do Chrome. Prova o que importa para quem joga sem teclado: o botão de microfone **aparece** (só no toque, com o jogo rodando), **está por cima da camada de
 * mira** (o toque chega nele), tocar **alterna o mudo**, no modo "segurar" vale enquanto o dedo está nele, o texto não cita tecla e o indicador mostra quem fala. O toque é de verdade
 * (`touchscreen.tap` e `Input.dispatchTouchEvent` do CDP), não um clique de mouse. Foto em `arte/voz-celular-claude.png`.
 *
 *   node .decepticons/medicoes/voz-celular.mjs     # sai com 1 se algo falhar; grava medicoes/voz-celular-<data>.json
 *
 * O que NÃO prova: aparelho de verdade (Android e, principalmente, iPhone: o Safari tem manias com áudio WebRTC no Web Audio). G15: temporários em `.tmp/`.
 */
const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const tom = gerarWav('tom.wav', 0.5, 6);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const verificacoes = [];
const conferir = (nome, ok, detalhe = '') => {
  verificacoes.push({ nome, ok, detalhe });
  console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
};
async function ate(fn, ms = 60000, passo = 300) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await dormir(passo);
  }
}

const { startServer } = (await runnerImport(resolve('server/Server.ts'), { configFile: false, logLevel: 'warn' })).module;
const jogo = await startServer({ port: 2597, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 200, total: 400, msgs: 200, burst: 200 }, log: () => {} });
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5195, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const PAGINA = resolve('.decepticons', 'medicoes', 'voz-bancada.html').split(String.fromCharCode(92)).join('/');
let browser;
const erros = new Set();
try {
  const flags = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${tom}`, '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'];
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      browser = await chromium.launch({ channel, args: flags });
      break;
    } catch {
      // próximo
    }
  }
  if (!browser) throw new Error('nenhum navegador');

  // O colega (desktop): uma página da bancada falando um tom, na mesma sala.
  const colega = await browser.newPage();
  colega.on('pageerror', (e) => erros.add(`colega: ${e.message}`));
  await colega.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await colega.goto(`${base}@fs/${PAGINA}?${new URLSearchParams({ servidor: 'ws://127.0.0.1:2597', sala: 'VOZCEL', nome: 'BRAVO', dsp: '0' })}`);

  // O celular: Chrome com tela de toque, deitado.
  const ctx = await browser.newContext({
    viewport: { width: 915, height: 412 },
    screen: { width: 915, height: 412 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.add(e.message));
  await page.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await page.goto(`${base}?sala=VOZCEL&nome=DAN&servidor=ws://127.0.0.1:2597&comandante=1`);
  await page.waitForFunction(() => document.getElementById('cta')?.textContent?.includes('jogar'), null, { timeout: 240_000, polling: 500 }).catch(() => {});
  for (let i = 0; i < 4; i++) {
    await page.tap('#cta').catch(() => page.click('#cta').catch(() => {}));
    await page.waitForTimeout(500);
  }
  conferir('o jogo abriu em modo toque (html.touch)', await page.evaluate(() => document.documentElement.classList.contains('touch')));

  const botao = page.locator('.voz-mic');
  const visivel = await ate(() => page.evaluate(() => { const b = document.querySelector('.voz-mic'); return !!b && getComputedStyle(b).display !== 'none' && b.classList.contains('ativo'); }), 120_000);
  conferir('o botão de microfone aparece no toque, com a voz ativa e o jogo rodando', !!visivel);
  const caixa = await botao.boundingBox();
  const cx = caixa ? caixa.x + caixa.width / 2 : 0;
  const cy = caixa ? caixa.y + caixa.height / 2 : 0;
  conferir('o botão está no canto de cima à direita, dentro da tela, com tamanho de dedo (≥ 44 px)', !!caixa && caixa.x > 915 * 0.8 && caixa.y < 412 * 0.5 && caixa.x + caixa.width <= 915 && caixa.width >= 44 && caixa.height >= 44, JSON.stringify(caixa));
  conferir('o toque chega no botão (ele está ACIMA da camada de mira): elementFromPoint é ele', await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('voz-mic') === true, { x: cx, y: cy }));
  const estado = () => page.evaluate(() => ({ botao: document.querySelector('.voz-mic')?.getAttribute('data-estado'), texto: document.querySelector('.voz-estado')?.textContent, fala: document.querySelector('.voz-fala')?.textContent, glifo: document.querySelector('.voz-mic')?.textContent }));
  const e0 = await ate(async () => { const s = await estado(); return s.botao === 'no-ar' ? s : null; }, 60000);
  conferir('com o microfone aberto o botão está "no ar" e o texto não cita tecla', !!e0 && !/\[/.test(e0.texto ?? ''), JSON.stringify(e0));
  conferir('o indicador mostra o colega falando (a voz chega no celular sozinha, sem tecla nem clique)', !!(await ate(async () => (await estado()).fala?.includes('BRAVO'), 120_000)));

  // tocar alterna o mudo (toque de verdade)
  await page.touchscreen.tap(cx, cy);
  const mudo = await ate(async () => { const s = await estado(); return s.botao === 'mudo' ? s : null; }, 10000);
  conferir('tocar o botão silencia o microfone (estado "mudo", texto "MUDO")', !!mudo && mudo.texto === 'MUDO', JSON.stringify(mudo));
  await page.touchscreen.tap(cx, cy);
  const aberto = await ate(async () => { const s = await estado(); return s.botao === 'no-ar' ? s : null; }, 10000);
  conferir('tocar de novo abre o microfone (estado "no-ar", texto "MICROFONE ABERTO")', !!aberto && aberto.texto === 'MICROFONE ABERTO', JSON.stringify(aberto));

  // modo "segurar para falar": muda pela tela de Configurações (o caminho do jogador)
  await page.evaluate(() => {
    document.getElementById('btn-settings')?.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('.settings-tab[data-tab="graficos"]')?.click();
    const sel = document.getElementById('setting-voz-modo');
    sel.value = 'ptt';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('btn-settings-close')?.click();
  });
  await page.waitForTimeout(600);
  // fechar as configurações pode deixar o jogo em pausa: volta com o toque no CTA
  for (let i = 0; i < 3; i++) {
    await page.tap('#cta').catch(() => {});
    await page.waitForTimeout(400);
  }
  const espera = await ate(async () => { const s = await estado(); return s.botao === 'espera' ? s : null; }, 20000);
  conferir('no modo "segurar" o botão fica em espera e o texto manda segurar o botão', !!espera && espera.texto === 'SEGURE O BOTÃO PARA FALAR', JSON.stringify(espera));
  const cdp = await ctx.newCDPSession(page);
  const caixa2 = await botao.boundingBox();
  const hx = caixa2.x + caixa2.width / 2;
  const hy = caixa2.y + caixa2.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hx, y: hy }] });
  const segurando = await ate(async () => { const s = await estado(); return s.botao === 'no-ar' && s.texto === 'FALANDO' ? s : null; }, 10000);
  conferir('segurando o dedo no botão o microfone transmite ("FALANDO")', !!segurando, JSON.stringify(segurando));
  await page.screenshot({ path: resolve('.decepticons', 'arte', 'voz-celular-claude.png') });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const solto = await ate(async () => { const s = await estado(); return s.botao === 'espera' ? s : null; }, 10000);
  conferir('soltando o dedo o microfone fecha de novo', !!solto, JSON.stringify(solto));
  conferir('nenhum erro de página', erros.size === 0, [...erros].slice(0, 3).join(' | '));
} finally {
  await browser?.close().catch(() => {});
  await vite.close();
  await jogo.close();
}
const data = new Date().toLocaleDateString('sv');
writeFileSync(resolve('.decepticons', 'medicoes', `voz-celular-${data}.json`), `${JSON.stringify({ data, verificacoes }, null, 2)}\n`);
const falhas = verificacoes.filter((v) => !v.ok);
console.log(`\n${verificacoes.length - falhas.length}/${verificacoes.length} verificações`);
process.exit(falhas.length ? 1 : 0);
