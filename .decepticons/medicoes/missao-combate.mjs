import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * A MISSÃO DE COMBATE no navegador de verdade (P314, corte 2): `?modo=missao&missao=caca` abre a caça na Cidade Neon.
 *   - Com a liberação (`comandante=1`, que vê o restrito): a missão larga depois do briefing, a linha de cima mostra o objetivo e os
 *     alvos, e derrubar o alvo marcado fecha a caça com "CAÇA CUMPRIDA".
 *   - Sem a liberação: o mesmo link cai no Deathmatch (P191).
 * Foto para o dono (regra 16): a missão em andamento, em `.decepticons/arte/missao-caca-claude.jpg`.
 *
 *   node .decepticons/medicoes/missao-combate.mjs [chrome|msedge|brave]
 *
 * SwiftShader (sem GPU): lento, mas a interface e a simulação são as de verdade. G15: temporários em `.tmp/`.
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

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5204, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const pageA = await ctxA.newPage();
pageA.on('pageerror', (e) => erros.push(`A: ${e.message}`));
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const pageB = await ctxB.newPage();
pageB.on('pageerror', (e) => erros.push(`B: ${e.message}`));

const textoDoStatus = (page) => page.evaluate(() => document.getElementById('mission-status')?.textContent ?? '');

try {
  // --- A: com a liberação do Comandante (`comandante=1` vê o que está restrito), a caça na Cidade Neon.
  await pageA.goto(`${base}?mapa=arena&modo=missao&missao=caca&comandante=1&depurar`);
  await pageA.waitForFunction(() => !!window.__game, null, { timeout: 180_000 });
  await dormir(4000);
  confere(await pageA.evaluate(() => window.__game.gameMode === 'missao'), 'o link ?modo=missao, com a liberação, abre o modo missão');
  confere(await pageA.evaluate(() => window.__game.match.missaoDeCombate?.plano.tipo === 'caca'), 'a missão é a caça (o tipo veio do link)');

  // O primeiro clique começa a partida (como no jogo de verdade); depois do briefing (3 s), a missão larga.
  for (let i = 0; i < 6; i++) {
    await pageA.click('#cta').catch(() => {});
    await dormir(500);
    if (await pageA.evaluate(() => window.__game.match.missaoDeCombate?.fase !== 'briefing')) break;
  }
  await pageA.waitForFunction(() => window.__game.match.missaoDeCombate?.fase === 'ativa', null, { timeout: 120_000 }).catch(() => {});
  confere(await pageA.evaluate(() => window.__game.match.missaoDeCombate?.fase === 'ativa'), 'a missão larga depois do briefing (fase ativa)');
  await dormir(2000);
  const linha = await textoDoStatus(pageA);
  confere(linha.includes('DERRUBE') || linha.includes('ALVOS'), `a linha de cima mostra o objetivo ou os alvos (${linha})`);
  await pageA.screenshot({ path: resolve(saida, 'missao-caca-claude.jpg'), type: 'jpeg', quality: 80, timeout: 180_000 });

  // Derruba o alvo marcado (o primeiro Mech do elenco): a caça tem de cumprir.
  await pageA.evaluate(() => {
    const g = window.__game;
    g.match.combat.onMechKilled(g.match.bots.mechs[0], g.mech.root.position, g.mech);
  });
  await pageA.waitForFunction(() => window.__game.match.missaoDeCombate?.fase === 'cumprida', null, { timeout: 30_000 }).catch(() => {});
  confere(await pageA.evaluate(() => window.__game.match.missaoDeCombate?.fase === 'cumprida'), 'derrubar o alvo marcado cumpre a caça');
  const fim = await pageA.evaluate(() => document.getElementById('mission-status')?.textContent ?? '');
  confere(fim.includes('CAÇA CUMPRIDA'), `o fim mostra o título da caça cumprida (${fim})`);

  // --- B: o mesmo link, sem a liberação: cai no Deathmatch (P191).
  await pageB.goto(`${base}?mapa=arena&modo=missao&missao=caca&depurar`);
  await pageB.waitForFunction(() => !!window.__game, null, { timeout: 180_000 });
  await dormir(2000);
  confere(await pageB.evaluate(() => window.__game.gameMode === 'deathmatch'), 'sem a liberação, o link do modo missão cai no Deathmatch (P191)');
} catch (e) {
  falhas.push(`a bancada quebrou: ${e.message}`);
  console.error(e);
} finally {
  for (const e of erros) console.log(`  erro de página: ${e}`);
  await browser.close();
  await vite.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);
