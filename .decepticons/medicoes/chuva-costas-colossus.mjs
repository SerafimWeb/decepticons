import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';

/**
 * A chuva de mísseis do COLOSSUS-01 SAI DAS COSTAS (P307, a ordem do Comandante: "o tiro pra cima da chuva de mísseis está saindo da frente do ombro, e não das
 * costas"). Abre a Cidade Neon com o Colossus equipado com a chuva no encaixe das costas, dispara pelo botão direito (o botão dela) e fotografa logo depois do
 * disparo, para o dono ver de onde sobe o lançamento (regra 16). Confere no navegador que a boca do lançamento fica atrás do robô.
 *
 *   node .decepticons/medicoes/chuva-costas-colossus.mjs [chrome|msedge|brave]
 *
 * SwiftShader (sem GPU): lento, mas o desenho é o de verdade. G15: temporários em `.tmp/`.
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

const { factorySpec, validateLoadout, loadoutKey } = (await runnerImport(resolve('client/src/hangar/loadout.ts'), { configFile: false, logLevel: 'warn' })).module;
const montagem = { ...factorySpec('colossus01'), back: { id: 'barrage', tier: 1 } };
const valida = validateLoadout(montagem);
const falhas = [];
const confere = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) falhas.push(texto);
};
confere(valida.ok, `a montagem com a chuva nas costas é válida${valida.ok ? '' : ` (${valida.error}: ${valida.detail})`}`);
if (!valida.ok) process.exit(1);
console.log(`  chave: ${loadoutKey(montagem)}`);

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5199, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(({ m, p }) => {
    if (!sessionStorage.getItem('chuva-costas')) {
      localStorage.setItem('cybermech.hangar.v1', m);
      localStorage.setItem('cybermech_pilot_progression', p);
      sessionStorage.setItem('chuva-costas', '1');
    }
  }, { m: JSON.stringify(montagem), p: JSON.stringify({ level: 1, xp: 0, credits: 500, lastResetDate: hoje, challenges: [], pinturas: 0 }) });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto(`${base}?mapa=arena&comandante=1&depurar`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 180_000 });
  await dormir(5000);
  for (let i = 0; i < 8; i++) {
    await page.click('#cta').catch(() => {});
    await dormir(400);
    if (await page.evaluate(() => !!document.pointerLockElement)) break;
  }
  await dormir(8000);
  const arma = await page.evaluate(() => {
    const m = window.__game.mech;
    return { chuvaNoBotao2: m.armed?.secondary?.id ?? null, chuvaNasCostas: m.armed?.back?.id ?? null, morteiroVisivel: null };
  });
  confere(arma.chuvaNasCostas === 'barrage', `o Colossus leva a chuva nas costas no jogo (costas: ${arma.chuvaNasCostas})`);
  // Dispara pelo botão direito (o da chuva), e fotografa logo depois: o lançamento sobe de onde o morteiro está.
  await page.mouse.move(640, 360);
  await page.mouse.down({ button: 'right' });
  await dormir(700);
  const boca = await page.evaluate(() => {
    const m = window.__game.mech;
    const v = m.barrageMouth(new window.__game.mech.root.position.constructor());
    return v ? { x: v.x, y: v.y, z: v.z } : null;
  });
  await page.screenshot({ path: resolve(saida, 'chuva-costas-colossus-claude.jpg'), type: 'jpeg', quality: 82, timeout: 120_000 });
  await page.mouse.up({ button: 'right' });
  confere(boca !== null, 'a chuva tem boca de lançamento no jogo');
  if (boca) {
    // A frente do robô é -Z; as costas são +Z. A boca do morteiro tem de estar do lado das costas, em relação ao centro do robô.
    const pos = await page.evaluate(() => {
      const p = window.__game.mech.root.position;
      return { x: p.x, y: p.y, z: p.z };
    });
    confere(boca.z - pos.z > 0, `a boca do lançamento fica atrás do robô (z da boca ${boca.z.toFixed(2)}, centro ${pos.z.toFixed(2)})`);
  }
  for (const e of erros) console.log(`  erro de página: ${e}`);
  await ctx.close();
} catch (e) {
  falhas.push(`a bancada quebrou: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
  await vite.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);
