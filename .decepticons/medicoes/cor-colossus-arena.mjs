import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';

/**
 * A cor do casco do COLOSSUS-01 NA ARENA (P307, a ordem do Comandante: "mudei a cor do colossus mas não apareceu na cor, na arena"). Abre a Cidade Neon
 * duas vezes no navegador de verdade: uma com o Colossus de fábrica e outra com o casco ciano (a pintura comprada). Fotografa cada uma em
 * `.decepticons/arte/` para o dono comparar por olho (regra 16). Confere, no próprio jogo, quantos vértices do robô saem na cor do casco.
 *
 *   node .decepticons/medicoes/cor-colossus-arena.mjs [chrome|msedge|brave]
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

const { factorySpec, loadoutKey } = (await runnerImport(resolve('client/src/hangar/loadout.ts'), { configFile: false, logLevel: 'warn' })).module;
const { PINTURAS } = (await runnerImport(resolve('shared/pinturas.ts'), { configFile: false, logLevel: 'warn' })).module;
const idxCiano = PINTURAS.findIndex((p) => p.id === 'ciano');

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5198, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const falhas = [];
const confere = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) falhas.push(texto);
};
const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

async function cenario(nome, pintura) {
  const montagem = { ...factorySpec('colossus01'), ...(pintura === null ? {} : { pintura }) };
  const progresso = JSON.stringify({ level: 1, xp: 0, credits: 500, lastResetDate: hoje, challenges: [], pinturas: pintura === null ? 0 : 2 ** pintura });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(({ m, p }) => {
    if (!sessionStorage.getItem('cor-colossus')) {
      localStorage.setItem('cybermech.hangar.v1', m);
      localStorage.setItem('cybermech_pilot_progression', p);
      sessionStorage.setItem('cor-colossus', '1');
    }
  }, { m: JSON.stringify(montagem), p: progresso });
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
  await dormir(9000);
  // Quantos vértices do próprio robô saem na cor do casco (o que o desenho recebeu do Hangar).
  const cor = pintura === null ? null : PINTURAS[pintura].cor;
  const medida = await page.evaluate((hex) => {
    const g = window.__game;
    const mech = g.mech;
    if (!hex) return { total: 0, iguais: 0, montagem: g.hangar.current.chassis };
    const r = (hex >> 16) & 255;
    const gg = (hex >> 8) & 255;
    const b = hex & 255;
    const lin = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    const [tr, tg, tb] = [lin(r), lin(gg), lin(b)];
    let total = 0;
    let iguais = 0;
    mech.root.traverse((o) => {
      const at = o.geometry?.attributes?.color;
      if (!at) return;
      for (let i = 0; i < at.count; i++) {
        total++;
        if (Math.abs(at.getX(i) - tr) < 0.01 && Math.abs(at.getY(i) - tg) < 0.01 && Math.abs(at.getZ(i) - tb) < 0.01) iguais++;
      }
    });
    return { total, iguais, montagem: g.hangar.current.chassis };
  }, cor);
  const foto = resolve(saida, nome);
  await page.screenshot({ path: foto, type: 'jpeg', quality: 82, timeout: 120_000 });
  for (const e of erros) console.log(`  erro de página: ${e}`);
  await ctx.close();
  return medida;
}

try {
  const fabrica = await cenario('colossus-cor-fabrica-claude.jpg', null);
  confere(fabrica.montagem === 'colossus01', 'a arena monta o Colossus-01 (o chassi certo)');
  const casco = await cenario('colossus-cor-casco-claude.jpg', idxCiano);
  confere(casco.iguais > 0, `com o casco ciano, o robô da arena sai na cor (${casco.iguais} de ${casco.total} vértices)`);
  confere(casco.iguais > fabrica.iguais, 'o casco ciano aparece mais que o visual de fábrica');
  console.log(`  chave da montagem usada: ${loadoutKey({ ...factorySpec('colossus01'), pintura: idxCiano })}`);
} catch (e) {
  falhas.push(`a bancada quebrou: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
  await vite.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);
