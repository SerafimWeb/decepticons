import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * A cor do casco PÚBLICA (P308, a ordem do Comandante: "sim liberado"): um jogador COMUM, sem `?comandante=1`, abre o Hangar e vê a seção COR DO CASCO
 * com as cores à venda. Confere no navegador de verdade que a seção aparece e tem as sete cores, e fotografa a tela (regra 16).
 *
 *   node .decepticons/medicoes/cor-publica.mjs [chrome|msedge|brave]
 *
 * SwiftShader (sem GPU): lento, mas a interface é a de verdade. G15: temporários em `.tmp/`.
 */
const quem = process.argv[2] ?? 'chrome';
const EXE = {
  chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  brave: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  msedge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
}[quem];
if (!EXE) throw new Error('use chrome, brave ou msedge');

const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const saida = resolve('.decepticons', 'arte');
mkdirSync(saida, { recursive: true });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const falhas = [];
const confere = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) falhas.push(texto);
};

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5200, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));

try {
  // Sem `comandante=1`: é o jogador comum. Sem exceção gravada no navegador (contexto novo).
  await page.goto(base);
  await page.waitForFunction(() => !!window.__game || document.querySelector('#btn-hangar'), null, { timeout: 180_000 });
  await dormir(4000);
  await page.click('#btn-hangar', { timeout: 60_000 }).catch(async () => {
    await page.evaluate(() => document.querySelector('#btn-hangar')?.click());
  });
  await page.waitForSelector('[data-pintura]', { state: 'attached', timeout: 60_000 });
  await dormir(1500);
  const seção = await page.evaluate(() => {
    const box = document.querySelector('#hangar-pintura');
    if (!box) return { existe: false };
    const visivel = box.offsetParent !== null && getComputedStyle(box).display !== 'none';
    return { existe: true, visivel, cores: box.querySelectorAll('[data-pintura]').length, titulo: box.querySelector('.hg-layout-title')?.textContent ?? '' };
  });
  confere(seção.existe, 'a seção COR DO CASCO existe no Hangar');
  confere(seção.visivel === true, 'a seção está visível para o jogador comum (sem o modo Comandante)');
  confere(seção.cores === 7, `as sete cores aparecem (${seção.cores})`);
  await page.locator('#hangar-pintura').scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: resolve(saida, 'cor-publica-hangar-claude.jpg'), type: 'jpeg', quality: 82, timeout: 120_000 });
  for (const e of erros) console.log(`  erro de página: ${e}`);
} catch (e) {
  falhas.push(`a bancada quebrou: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
  await vite.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);
