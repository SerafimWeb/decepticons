import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';

/**
 * Prova de ponta a ponta do aviso de reinício (P204), no jogo de verdade: um servidor local, o jogo aberto pelo Vite dev + Chrome headless,
 * o jogador entra na sala, o servidor reinicia COM AVISO (a tela conta, o corte vem, "servidor reiniciando" com a previsão, o servidor volta
 * e a tela some sozinha) e depois cai SEM AVISO (conexão perdida, o contador sobe, o botão de jogar offline aparece).
 *
 *   node .decepticons/medicoes/aviso-reinicio.mjs      # fotos em .decepticons/arte/aviso-reinicio-<fase>-claude.jpg
 *
 * Pesado (um Chrome e um Vite): rode com o servidor de jogo de verdade sem ninguém jogando.
 */
const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const dados = resolve('.tmp/aviso-dados');
rmSync(dados, { recursive: true, force: true });
mkdirSync(dados, { recursive: true });
const saida = resolve('.decepticons', 'arte');
const PORTA_JOGO = 2598;

const { startServer } = (await runnerImport(resolve('server/Server.ts'), { configFile: false, logLevel: 'warn' })).module;
const subir = () => startServer({ port: PORTA_JOGO, host: '127.0.0.1', dbContas: ':memory:', dirDados: dados, metricasToken: 'token-de-teste-do-aviso', log: () => {} });
let jogo = await subir();

const { chromium } = await import('playwright-core');
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5197, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
let browser;
const passos = [];
const ok = (cond, msg) => {
  passos.push(`${cond ? '✅' : '❌'} ${msg}`);
  console.log(passos.at(-1));
};
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
  page.on('pageerror', (e) => erros.add(String(e.message)));
  await page.goto(`${base}?sala=AVISO&servidor=ws://127.0.0.1:${PORTA_JOGO}&nome=Teste`);
  await page.waitForFunction(() => document.getElementById('cta')?.textContent?.includes('jogar'), null, { timeout: 180_000, polling: 500 }).catch(() => {});
  for (let i = 0; i < 4; i++) {
    await page.click('#cta').catch(() => {});
    await page.waitForTimeout(500);
  }
  const chip = () => page.evaluate(() => [...document.querySelectorAll('.net-status')].map((e) => e.textContent).join(' '));
  const aviso = () => page.evaluate(() => {
    const el = document.querySelector('.net-aviso');
    if (!el || !el.classList.contains('on')) return null;
    return { tom: el.dataset.tom, titulo: el.querySelector('.titulo')?.textContent, linha: el.querySelector('.linha')?.textContent, contador: el.querySelector('.contador')?.textContent, botao: !el.querySelector('.botao')?.hidden };
  });
  await page.waitForFunction(() => [...document.querySelectorAll('.net-status')].some((e) => e.textContent?.includes('SALA AVISO')), null, { timeout: 60_000 }).catch(() => {});
  ok((await chip()).includes('SALA AVISO'), `entrou na sala online (${await chip()})`);
  ok((await aviso()) === null, 'conectado e sem aviso: a tela não aparece');

  // 1) reinício COM aviso: 8 s de aviso, volta prevista em 60 s
  const fechando = jogo.fecharComAviso({ gracaS: 8, voltaEmS: 60 });
  await page.waitForFunction(() => document.querySelector('.net-aviso')?.dataset.tom === 'aviso', null, { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const a1 = await aviso();
  ok(a1?.tom === 'aviso' && /ATUALIZAÇÃO/.test(a1.titulo ?? ''), `aviso antes do corte: ${JSON.stringify(a1)}`);
  await page.screenshot({ path: resolve(saida, 'aviso-reinicio-1-aviso-claude.jpg'), type: 'jpeg', quality: 86 });
  await fechando;
  await page.waitForFunction(() => document.querySelector('.net-aviso')?.dataset.tom === 'espera', null, { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const a2 = await aviso();
  ok(a2?.tom === 'espera' && /REINICIANDO/.test(a2.titulo ?? '') && /^0:[2-5]\d$/.test(a2.contador ?? ''), `depois do corte, com a previsão descendo: ${JSON.stringify(a2)}`);
  await page.screenshot({ path: resolve(saida, 'aviso-reinicio-2-reiniciando-claude.jpg'), type: 'jpeg', quality: 86 });

  // 2) o servidor volta: a tela some sozinha e o jogador está na sala de novo
  jogo = await subir();
  await page.waitForFunction(() => !document.querySelector('.net-aviso.on') && [...document.querySelectorAll('.net-status')].some((e) => e.textContent?.includes('SALA AVISO')), null, { timeout: 90_000, polling: 500 }).catch(() => {});
  ok((await aviso()) === null && (await chip()).includes('SALA AVISO'), `servidor voltou: a tela sumiu e o jogador reentrou (${await chip()})`);

  // 3) queda SEM aviso: sem previsão, o contador sobe, e depois de 30 s aparece o botão de jogar offline
  await jogo.close();
  await page.waitForFunction(() => document.querySelector('.net-aviso')?.dataset.tom === 'queda', null, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const a3 = await aviso();
  ok(a3?.tom === 'queda' && /PERDIDA/.test(a3.titulo ?? '') && !a3.botao, `queda sem aviso, no começo: ${JSON.stringify(a3)}`);
  await page.waitForTimeout(32_000);
  const a4 = await aviso();
  ok(a4?.tom === 'queda' && a4.botao === true && /sem previsão/.test(a4.linha ?? ''), `depois de 30 s: sem previsão e com o botão offline: ${JSON.stringify(a4)}`);
  await page.screenshot({ path: resolve(saida, 'aviso-reinicio-3-conexao-perdida-claude.jpg'), type: 'jpeg', quality: 86 });
  jogo = await subir(); // deixa o servidor de teste de pé para o fechamento limpo
  ok(erros.size === 0, `erros de página: ${erros.size}${[...erros].map((e) => `\n   ${e}`).join('')}`);
} finally {
  await browser?.close();
  await vite.close();
  await jogo?.close().catch(() => {});
}
console.log(passos.every((p) => p.startsWith('✅')) ? 'TUDO OK' : 'HOUVE FALHA');
process.exit(passos.every((p) => p.startsWith('✅')) ? 0 : 1);
