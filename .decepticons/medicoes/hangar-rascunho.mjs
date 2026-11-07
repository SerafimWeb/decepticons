import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * O rascunho do Hangar no Chrome de verdade (P319, passo 1; achados 1, 3, 7 e 13). Confere o que o teste puro (`hangar/edicao.test.ts`) promete, na tela:
 *   1. a cor comprada continua "EM USO" ao fechar e reabrir o Hangar;
 *   3. BOTÃO 2 no braço direito e depois trocar o módulo: o APLICAR salva (antes: "botões só na versão 4 da montagem");
 *   7. "TUDO NO 1" no Lancer-L1 (uma arma só) deixa a arma no botão 1;
 *  13. o texto do módulo diz a tecla do escudo que o jogador remapeou.
 * E fotografa a tela (regra 16).
 *
 *   node .decepticons/medicoes/hangar-rascunho.mjs [chrome|msedge|brave]
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

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5201, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));

const abrirHangar = async () => {
  await page.click('#btn-hangar', { timeout: 60_000 }).catch(async () => {
    await page.evaluate(() => document.querySelector('#btn-hangar')?.click());
  });
  await page.waitForSelector('[data-pintura]', { state: 'attached', timeout: 60_000 });
  await dormir(1200);
};
const fecharHangar = async () => {
  await page.evaluate(() => document.querySelector('.hangar-close, [data-action="close"]')?.click());
  await dormir(800);
};
const aplicar = async () => {
  await page.evaluate(() => document.querySelector('.hangar-apply')?.click());
  await dormir(1200);
  return page.evaluate(() => {
    const m = document.querySelector('#hangar-message');
    return { texto: m?.textContent ?? '', tipo: m?.dataset.kind ?? '' };
  });
};

try {
  await page.goto(`${base}?depurar`);
  await page.waitForFunction(() => !!window.__game && document.querySelector('#btn-hangar'), null, { timeout: 180_000 });
  await dormir(4000);
  // Créditos para comprar uma cor (o jogador comum começa sem).
  await page.evaluate(() => window.__game.dailyChallenges.restore({ nivel: 1, xp: 0, creditos: 5000, pinturas: 0 }));
  await abrirHangar();

  // 1. A cor comprada fica ao reabrir.
  await page.click('[data-pintura="2"]');
  await dormir(500);
  const aviso1 = await aplicar();
  confere(aviso1.tipo !== 'error', `aplicar com a cor nova salva (${aviso1.texto})`);
  await fecharHangar();
  await abrirHangar();
  const emUso = await page.evaluate(() => [...document.querySelectorAll('[data-pintura].selected')].map((b) => b.dataset.pintura));
  confere(emUso.length === 1 && emUso[0] === '2', `a cor 2 continua EM USO ao reabrir (${emUso.join(',') || 'nenhuma'})`);

  // 3. BOTÃO 2 no braço direito, depois o módulo: o APLICAR salva.
  await page.click('[data-slot="right"]');
  await page.click('[data-botao="2"]');
  await page.selectOption('#hangar-module-select', 'fire');
  await dormir(600);
  const aviso3 = await aplicar();
  confere(aviso3.tipo !== 'error' && !/versão 4/.test(aviso3.texto), `BOTÃO 2 + módulo: o APLICAR salva (${aviso3.texto})`);
  const botao = await page.evaluate(() => document.querySelector('[data-botao="2"]')?.getAttribute('aria-pressed'));
  confere(botao === 'true', 'o botão 2 continua marcado depois de trocar o módulo');
  await page.locator('#hangar-module-select').scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: resolve(saida, 'hangar-rascunho-claude.jpg'), type: 'jpeg', quality: 82, timeout: 120_000 });

  // 13. A tecla do escudo remapeada aparece no texto do módulo.
  const dica0 = await page.evaluate(() => document.querySelector('#hangar-shield-hint')?.textContent ?? '');
  confere(/^Ctrl liga e desliga/.test(dica0), `de fábrica o módulo diz Ctrl (${dica0.slice(0, 30)})`);
  await page.evaluate(() => window.__game.settings.update({ keys: { ...window.__game.settings.value.keys, shield: 'KeyQ' } }));
  await page.click('[data-slot="left"]'); // qualquer clique refaz a tela
  await dormir(600);
  const dica1 = await page.evaluate(() => document.querySelector('#hangar-shield-hint')?.textContent ?? '');
  confere(/^Q liga e desliga/.test(dica1), `com o escudo na tecla Q o módulo diz Q (${dica1.slice(0, 30)})`);

  // 7. "TUDO NO 1" com uma arma só (o Lancer-L1 de fábrica) deixa a arma no botão 1.
  await page.click('[data-chassis="lancerL1"]');
  await page.click('[data-slot="right"]');
  await page.click('[data-botoes-preset="tudo1"]');
  await dormir(500);
  const lancer = await page.evaluate(() => ({ b1: document.querySelector('[data-botao="1"]')?.getAttribute('aria-pressed'), b2: document.querySelector('[data-botao="2"]')?.getAttribute('aria-pressed') }));
  confere(lancer.b1 === 'true' && lancer.b2 === 'false', `Lancer-L1, "TUDO NO 1": a arma fica no botão 1 (1=${lancer.b1}, 2=${lancer.b2})`);

  for (const e of erros) console.log(`  erro de página: ${e}`);
  confere(erros.length === 0, 'nenhum erro de página');
} catch (e) {
  falhas.push(`a bancada quebrou: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
  await vite.close();
}
if (falhas.length) {
  console.error(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log('\nTudo certo.');
