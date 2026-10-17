import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * Fotografa a Amazônia no JOGO de verdade (P180, parte B): o `?mapa=amazonia&modo=deathmatch` aberto pelo Vite dev + Chrome headless (SwiftShader), com a câmera, o HUD e a névoa do jogo. Complementa
 * a bancada (`amazonia.mjs`), que usa a câmera dela (far de 3.200 m): **só o jogo real mostrou o céu preto** (a câmera do jogo vai a 800 m e o domo do céu tinha 2.200 m). Lista também os pedaços
 * sob demanda que o navegador baixou (o mapa e o Draga só vêm para quem abre a Amazônia).
 *
 *   node .decepticons/medicoes/amazonia-jogo.mjs <segundos,segundos,...> <sufixo>      # fotos em .decepticons/arte/amazonia-jogo-<sufixo>-s<segundos>-claude.jpg
 */
const instantes = (process.argv[2] ?? '12,40').split(',').map(Number);
const sufixo = process.argv[3] ?? 'b1';

const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const saida = resolve('.decepticons', 'arte');

const server = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5198, strictPort: false, open: false } });
await server.listen();
const base = server.resolvedUrls.local[0];
let browser;
try {
  const flags = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      browser = await chromium.launch({ channel, args: flags });
      break;
    } catch {
      // próximo
    }
  }
  if (!browser) throw new Error('nenhum browser');
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const erros = new Set();
  const baixados = [];
  page.on('pageerror', (e) => erros.add(String(e.message)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.add(m.text().slice(0, 600));
  });
  page.on('response', (r) => {
    const u = r.url();
    if (/Amazonia|WalkerDemo|draga-01/.test(u)) baixados.push(`${r.status()} ${u.split('/').pop()}`);
  });
  const t0 = Date.now();
  await page.goto(`${base}?mapa=amazonia&modo=deathmatch`);
  await page.waitForFunction(() => document.getElementById('cta')?.textContent?.includes('jogar'), null, { timeout: 180_000, polling: 500 }).catch(() => {});
  console.log(`pronto em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (let i = 0; i < 4; i++) {
    await page.click('#cta').catch(() => {});
    await page.waitForTimeout(500);
  }
  const t1 = Date.now();
  for (const s of instantes) {
    const falta = s * 1000 - (Date.now() - t1);
    if (falta > 0) await page.waitForTimeout(falta);
    const arquivo = resolve(saida, `amazonia-jogo-${sufixo}-s${s}-claude.jpg`);
    await page.screenshot({ path: arquivo, type: 'jpeg', quality: 86 });
    console.log(`s${s} -> ${arquivo}`);
  }
  console.log('baixados:', baixados.join(' | '));
  console.log(`erros de página: ${erros.size}`);
  for (const e of erros) console.log('  ', e);
} finally {
  await browser?.close();
  await server.close();
}
