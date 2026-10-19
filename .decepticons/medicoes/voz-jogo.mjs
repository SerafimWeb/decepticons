import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';
import { gerarWav } from './vozLib.mjs';

/**
 * Fotografa o CHAT DE VOZ no JOGO de verdade (P205, regra 16: o dono julga por olho): o jogo online aberto em `?comandante=1` (a voz nasce restrita; só o modo Comandante a vê) numa sala com um
 * segundo jogador (uma página da bancada, falando um tom), com o microfone FALSO do Chrome. Tira duas fotos em `.decepticons/arte/`:
 *   voz-hud-jogo-claude.png        o jogo com o indicador de voz no canto de baixo à esquerda (o seu microfone e quem está falando)
 *   voz-configuracoes-claude.png   Configurações > GRÁFICOS E SOM > CHAT DE VOZ (com o selo TESTE: ainda restrito)
 *
 *   node .decepticons/medicoes/voz-jogo.mjs              # as duas fotos (jogo online + colega falando)
 *   node .decepticons/medicoes/voz-jogo.mjs --so-config  # só a foto das Configurações (sem servidor, sem colega: rápido e leve)
 *
 * SwiftShader (sem GPU): o jogo roda devagar, mas a interface é a de verdade. G15: temporários em `.tmp/`.
 */
const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const saida = resolve('.decepticons', 'arte');
const soConfig = process.argv.includes('--so-config');
const tom = gerarWav('tom.wav', 0.5, 6);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const { startServer } = (await runnerImport(resolve('server/Server.ts'), { configFile: false, logLevel: 'warn' })).module;
const jogo = soConfig ? null : await startServer({ port: 2599, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 200, total: 400, msgs: 200, burst: 200 }, log: () => {} });
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5196, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const PAGINA = resolve('.decepticons', 'medicoes', 'voz-bancada.html').split(String.fromCharCode(92)).join('/');
let browser;
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
  const erros = new Set();

  // O colega: uma página da bancada falando um tom, na mesma sala.
  if (!soConfig) {
    const colega = await browser.newPage();
    colega.on('pageerror', (e) => erros.add(`colega: ${e.message}`));
    await colega.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
    await colega.goto(`${base}@fs/${PAGINA}?${new URLSearchParams({ servidor: 'ws://127.0.0.1:2599', sala: 'VOZ', nome: 'BRAVO', dsp: '0' })}`);
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => erros.add(e.message));
  await page.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await page.goto(soConfig ? `${base}?comandante=1` : `${base}?sala=VOZ&nome=DAN&servidor=ws://127.0.0.1:2599&comandante=1`);
  await page.waitForFunction(() => document.getElementById('cta')?.textContent?.includes('jogar'), null, { timeout: 240_000, polling: 500 }).catch(() => {});
  for (let i = 0; i < 4; i++) {
    await page.click('#cta').catch(() => {});
    await page.waitForTimeout(500);
  }
  // Espera o indicador de voz mostrar o colega falando (a sala, a ligação e o áudio têm de funcionar no jogo de verdade).
  const falou = soConfig ? true : await page
    .waitForFunction(() => (document.querySelector('.voz-fala')?.textContent ?? '').includes('BRAVO'), null, { timeout: 180_000, polling: 500 })
    .then(() => true)
    .catch(() => false);
  if (!soConfig) {
    console.log(`indicador mostra BRAVO falando: ${falou}`);
    console.log('estado:', JSON.stringify(await page.evaluate(() => ({ estado: document.querySelector('.voz-estado')?.textContent, rede: document.querySelector('.voz-rede')?.textContent, fala: document.querySelector('.voz-fala')?.textContent, escondido: document.querySelector('.voz-hud')?.hidden }))));
    await dormir(500);
    await page.screenshot({ path: resolve(saida, 'voz-hud-jogo-claude.png') });
  }

  // As configurações: a seção CHAT DE VOZ (com o selo TESTE).
  await page.evaluate(() => document.getElementById('btn-settings')?.click());
  await page.waitForTimeout(400);
  // Pelo DOM (o clique do mouse não chegava na aba com o jogo por trás) e rola até a seção da voz.
  await page.evaluate(() => {
    document.querySelector('.settings-tab[data-tab="graficos"]')?.click();
    document.querySelector('.settings-section[data-tab="graficos"][data-func="tela:voz"]')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(500);
  console.log('aba ativa:', await page.evaluate(() => document.querySelector('.settings-tab.active')?.textContent), '| seção da voz visível:', await page.evaluate(() => { const s = document.querySelector('.settings-section[data-func="tela:voz"]'); return !!s && getComputedStyle(s).display !== 'none'; }));
  const modal = page.locator('#settings-modal');
  await modal.screenshot({ path: resolve(saida, 'voz-configuracoes-claude.png') }).catch(async () => page.screenshot({ path: resolve(saida, 'voz-configuracoes-claude.png') }));
  console.log(`erros de página: ${erros.size}`);
  for (const e of erros) console.log('  ', e);
  process.exitCode = falou && erros.size === 0 ? 0 : 1;
} finally {
  await browser?.close();
  await vite.close();
  await jogo?.close();
}
