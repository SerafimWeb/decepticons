import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * O MICROFONE DE VERDADE (P229, 20/10): roda o `MicTest` do jogo contra cada microfone REAL deste computador, no Chrome ou no Brave (o navegador do Comandante), sem o microfone falso das outras bancadas.
 * Nasceu de um defeito que nenhuma bancada com microfone falso vê: com o fone Bluetooth dele o teste ficava mudo, porque o jogo pedia o aparelho como `ideal` e o navegador abria sempre o padrão.
 *
 *   node .decepticons/medicoes/mic-real.mjs [chrome|brave|msedge] [segundos por aparelho]
 *
 * Fale no microfone durante a medida para ver a barra subir (sem voz, só o chiado do quarto: "sem sinal"; aparelho mudo: "silêncio total"). Só lê o nível; não grava nada. G15: nada fora do projeto.
 */
const quem = process.argv[2] ?? 'chrome';
const segundos = Number(process.argv[3] ?? 6);
const EXE = {
  chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  brave: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  msedge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
}[quem];
if (!EXE) throw new Error('use chrome, brave ou msedge');
const { chromium } = await import('playwright-core');

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5191, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const PAGINA = resolve('.decepticons', 'medicoes', 'mic-real.html').split(String.fromCharCode(92)).join('/');
let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, headless: !process.env.CABECA, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext();
  await ctx.grantPermissions(['microphone'], { origin: new URL(base).origin });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('erro de página:', e.message));
  await page.goto(`${base}@fs/${PAGINA}`);
  await page.waitForFunction(() => typeof window.__medirTodos === 'function', null, { timeout: 120_000 });
  const linhas = await page.evaluate((ms) => window.__medirTodos(ms), segundos * 1000);
  console.log(`\n=== ${quem}: o MicTest do jogo contra cada microfone real (${segundos}s cada) ===`);
  for (const l of linhas) console.log(`${l.pedido.slice(0, 52).padEnd(52)} -> ${(l.aparelhoAberto || '(nada abriu)').padEnd(78)} estado=${String(l.estado).padEnd(13)} barraMax=${String(l.barraMax).padStart(3)}%`);
  // a regra que o defeito quebrava: o aparelho PEDIDO tem de ser o ABERTO (menos o padrão, que abre o padrão)
  const trocados = linhas.filter((l) => l.aparelhoAberto && !l.aparelhoAberto.endsWith(l.pedido) && !l.pedido.startsWith('Padrão') && !l.pedido.startsWith('Comunicações'));
  console.log(trocados.length ? `\nFALHOU: ${trocados.length} pedido(s) abriram OUTRO aparelho (a escolha foi ignorada)` : '\nOK: todo aparelho escolhido foi o aparelho aberto');
  process.exitCode = trocados.length ? 1 : 0;
} finally {
  await browser?.close().catch(() => {});
  await vite.close();
}
