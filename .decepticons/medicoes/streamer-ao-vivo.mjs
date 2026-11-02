import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';

/**
 * O MODO STREAMER (P310, "modo streamer") no servidor de verdade: `?stream=1` leva à sala de código fixo AO-VIVO, com a faixa AO VIVO, o
 * COPIAR LINK e o clipe ligado quando a partida começa.
 *   - Streamer (ANA): abre `?stream=1`; a faixa aparece com a sala fixa; o primeiro clique começa a partida e o clipe liga sozinho; o
 *     COPIAR LINK põe o link na área de transferência (confere o que sai lá).
 *   - Espectador (PILOTO): abre o link copiado, sem sala nem nome. Tem de cair na MESMA sala: cada um vê o outro.
 *   - Controle: uma página sem `?stream=1` (offline) não mostra a faixa e não carrega o clipe.
 * Foto para o dono (regra 16): a faixa no jogo do streamer, em `.decepticons/arte/streamer-ao-vivo-claude.jpg`.
 *
 *   node .decepticons/medicoes/streamer-ao-vivo.mjs [chrome|msedge|brave]
 *
 * SwiftShader (sem GPU): lento, mas a rede e a interface são as de verdade. G15: temporários em `.tmp/`.
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

const PORTA = 2599;
const { startServer } = (await runnerImport(resolve('server/Server.ts'), { configFile: false, logLevel: 'warn' })).module;
const jogo = await startServer({ port: PORTA, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 200, total: 400, msgs: 200, burst: 200 }, log: () => {} });
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5199, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const origem = new URL(base).origin;

const falhas = [];
const confere = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) falhas.push(texto);
};

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctxA.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: origem });
const pageA = await ctxA.newPage();
pageA.on('pageerror', (e) => erros.push(`A: ${e.message}`));
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctxB.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: origem });
const pageB = await ctxB.newPage();
pageB.on('pageerror', (e) => erros.push(`B: ${e.message}`));
const ctxC = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const pageC = await ctxC.newPage();
pageC.on('pageerror', (e) => erros.push(`C: ${e.message}`));

try {
  // --- A: o streamer. O link leva ?stream=1 (e o servidor da bancada, já que o PC é localhost).
  await pageA.goto(`${base}?stream=1&nome=ANA&servidor=ws://127.0.0.1:${PORTA}&depurar`);
  await pageA.waitForFunction(() => !!window.__game?.online, null, { timeout: 180_000 });
  await dormir(3000);
  const faixa = await pageA.evaluate(() => document.getElementById('stream-faixa')?.textContent ?? null);
  confere(faixa !== null && faixa.includes('AO VIVO') && faixa.includes('AO-VIVO'), `o streamer vê a faixa AO VIVO com a sala fixa (${faixa ?? 'sem faixa'})`);

  // O primeiro clique começa a partida: o clipe do streamer liga sozinho (o áudio já existe nesse momento).
  for (let i = 0; i < 6; i++) {
    await pageA.click('#cta').catch(() => {});
    await dormir(600);
    if ((await pageA.evaluate(() => document.getElementById('clip-aviso')?.textContent ?? '')).includes('CLIPE LIGADO')) break;
  }
  await pageA.waitForFunction(() => (document.getElementById('clip-aviso')?.textContent ?? '').includes('CLIPE LIGADO'), null, { timeout: 120_000 }).catch(() => {});
  confere(await pageA.evaluate(() => window.__game.clips?.ligado === true), 'o clipe liga sozinho quando a partida começa (modo streamer)');
  // A foto sai com o clipe desligado (L): na 1ª rodada, com o clipe ligado, a captura de tela do SwiftShader estourou 90 s. A faixa é a mesma.
  await pageA.keyboard.press('KeyL');
  await pageA.waitForFunction(() => (document.getElementById('clip-aviso')?.textContent ?? '').includes('CLIPE DESLIGADO'), null, { timeout: 30_000 }).catch(() => {});
  await dormir(2000);
  await pageA.screenshot({ path: resolve(saida, 'streamer-ao-vivo-claude.jpg'), type: 'jpeg', quality: 80, timeout: 180_000 });

  // COPIAR LINK: solta o mouse (o jogo o prende), clica o botão e lê a área de transferência de volta.
  await pageA.evaluate(() => document.exitPointerLock?.());
  await pageA.locator('#stream-faixa button').click({ timeout: 30_000 });
  await dormir(500);
  const lido = await pageA.evaluate(() => navigator.clipboard.readText());
  const esperado = `${base}?stream=1&servidor=ws%3A%2F%2F127.0.0.1%3A${PORTA}`;
  confere(lido === esperado, `o COPIAR LINK põe o link do streamer na área de transferência (${lido})`);
  confere((await pageA.evaluate(() => document.querySelector('#stream-faixa button')?.textContent ?? '')) === 'LINK COPIADO', 'o botão confirma: LINK COPIADO');

  // --- B: o espectador abre o link copiado (sem sala nem nome: cai na sala fixa, com o nome padrão).
  // O clipe do streamer fica desligado daqui em diante: na 2ª rodada, com ele ligado, a página do espectador não entrou em 180 s
  // (a máquina sem GPU, SwiftShader, tem a CPU toda no navegador do streamer). O resultado com o clipe ligado já está acima.
  await pageB.goto(`${lido}&depurar`);
  const entrou = await pageB.waitForFunction(() => !!window.__game?.online, null, { timeout: 180_000 }).then(() => true, async () => {
    const estado = await pageB.evaluate(() => ({ jogo: !!window.__game, online: !!window.__game?.online, texto: document.body.innerText.slice(0, 160) })).catch(() => null);
    console.log('  espectador sem entrar; estado da página:', JSON.stringify(estado));
    return false;
  });
  confere(entrou, 'o espectador entra no servidor pelo link copiado');
  const veem = (pagina, nome) => pagina.waitForFunction((n) => {
    const on = window.__game?.online;
    return !!on && [...on.names.values()].includes(n);
  }, nome, { timeout: 240_000 }).then(() => true, () => false);
  const viuANA = entrou && (await veem(pageB, 'ANA'));
  const viuPiloto = entrou && (await veem(pageA, 'PILOTO'));
  confere(viuANA && viuPiloto, 'o link copiado leva o espectador à mesma sala: cada um vê o outro (ANA e PILOTO)');

  // --- C: controle. Sem ?stream=1, o jogo é o de sempre: offline, sem faixa, sem o clipe carregado.
  await pageC.goto(`${base}?mapa=arena&depurar`);
  await pageC.waitForFunction(() => !!window.__game, null, { timeout: 180_000 });
  await dormir(3000);
  const controle = await pageC.evaluate(() => ({
    faixa: !!document.getElementById('stream-faixa'),
    clipeCarregado: window.__game.clips !== null,
    online: !!window.__game.online,
  }));
  confere(!controle.faixa && !controle.clipeCarregado && !controle.online, 'sem ?stream=1 o jogo é o de sempre: sem faixa, sem clipe carregado, offline');
} catch (e) {
  falhas.push(`a bancada quebrou: ${e.message}`);
  console.error(e);
} finally {
  for (const e of erros) console.log(`  erro de página: ${e}`);
  await browser.close();
  await vite.close();
  await jogo.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);
