import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * A MÚSICA DE COMBATE no navegador de verdade (P315, corte 1). Mede o som que a música manda para a saída (um analisador RMS na cadeia de
 * áudio), porque o gosto é do ouvido do Comandante; a bancada confere que a música existe, que sobe com o combate e que cala na pausa.
 *   - Partida na Cidade Neon: o primeiro clique começa a partida e a música toca (o colchão do pad, mesmo calmo).
 *   - Calmo: nível 0, e o som da música já é audível.
 *   - Um abate do jogador (o Game ouve o abate pelo mesmo caminho do combate): o nível vai a 2, e o som fica mais cheio que no calmo.
 *   - Pausa: a música cala.
 *
 *   node .decepticons/medicoes/musica-combate.mjs [chrome|msedge|brave]
 *
 * G15: temporários em `.tmp/`.
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
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const falhas = [];
const confere = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) falhas.push(texto);
};

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5205, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => erros.push(e.message));

/** O nível sonoro médio de `n` leituras espaçadas por `intervaloMs`. */
const mediaSonora = async (n, intervaloMs) => {
  let soma = 0;
  for (let i = 0; i < n; i++) {
    soma += await page.evaluate(() => window.__game.musica?.nivelSonoro() ?? 0);
    await dormir(intervaloMs);
  }
  return soma / n;
};

try {
  await page.goto(`${base}?mapa=arena&depurar`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 180_000 });
  await dormir(3000);
  // O primeiro clique começa a partida (e o áudio): a música entra depois, quando o contexto de áudio existe.
  for (let i = 0; i < 6; i++) {
    await page.click('#cta').catch(() => {});
    await dormir(500);
    if (await page.evaluate(() => !!window.__game.musica)) break;
  }
  await page.waitForFunction(() => !!window.__game.musica?.tocando, null, { timeout: 120_000 }).catch(() => {});
  confere(await page.evaluate(() => !!window.__game.musica?.tocando), 'a música de combate liga com a partida');
  await dormir(2500);

  const calmo = await mediaSonora(8, 150);
  confere((await page.evaluate(() => window.__game.musica.nivel)) === 0, 'no calmo, a música fica no nível 0 (só o colchão do pad)');
  confere(calmo > 0.001, `o colchão do pad é audível no calmo (RMS ${calmo.toFixed(4)})`);

  // Um abate do jogador: o caminho do combate (o Game ouve pelo mesmo callback) sobe a energia de uma vez.
  await page.evaluate(() => {
    const g = window.__game;
    g.match.onMechKilled(g.match.bots.mechs[0], g.mech.root.position, g.mech);
  });
  confere((await page.evaluate(() => window.__game.musica.nivel)) === 2, 'um abate do jogador leva a música ao nível 2 (o combate)');
  await dormir(800);
  const combate = await mediaSonora(8, 150);
  confere(combate > calmo * 1.3, `no combate, a música soa mais cheia que no calmo (RMS ${combate.toFixed(4)} contra ${calmo.toFixed(4)})`);

  // Pausa: a música cala.
  await page.evaluate(() => window.__game.setPlaying(false));
  await dormir(3500);
  const pausado = await mediaSonora(3, 200);
  confere(!(await page.evaluate(() => window.__game.musica.tocando)) && pausado < calmo * 0.25, `na pausa a música cala (RMS ${pausado.toFixed(4)})`);
  confere(erros.length === 0, `sem erro de página${erros.length ? ` (${erros.join(' | ')})` : ''}`);
} catch (e) {
  falhas.push(`a bancada quebrou: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
  await vite.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);
