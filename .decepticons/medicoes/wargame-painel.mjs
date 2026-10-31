import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * O PAINEL WARGAME no jogo de verdade (P290, 30/10: "o menu do wargame tá muito cru, não sei qual mech vai em cada ponto"). Abre o jogo no modo Comandante, abre a janela WARGAME e confere, num Chrome de
 * verdade: o "quem é quem" (uma ficha por robô, com número, chassi e nome), o QUEM de cada batida (o lado inteiro ou UM robô), o ponto marcado no mapa (descrito perto de um marco), o anel numerado e a seta
 * no mapa, o link com o alvo e a ordem de um robô só na partida real (EXECUTAR: só o robô escolhido anda). Fotografa em `.decepticons/arte/`. G15: temporários em `.tmp/`.
 * (`page.$eval`, `$$eval` e `evaluate` são a API do Playwright: leem o DOM do navegador de teste, nada de `eval()` de texto.)
 *
 *   node .decepticons/medicoes/wargame-painel.mjs [chrome|msedge|brave]
 */
const quem = process.argv[2] ?? 'chrome';
const EXE = {
  chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  brave: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  msedge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
}[quem];
if (!EXE) throw new Error('use chrome, brave ou msedge');
const { chromium } = await import('playwright-core');

const falhas = [];
const confere = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) falhas.push(texto);
};

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5194, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text().slice(0, 140)}`); });

try {
  await page.goto(`${base}?comandante=1&depurar`);
  await page.waitForSelector('#cc-wargame', { state: 'visible', timeout: 120_000 });
  await page.click('#cc-wargame');
  await page.waitForSelector('.wargame-placa', { timeout: 30_000 });
  await page.waitForSelector('.wargame-mapa canvas');

  const fichas = await page.$$eval('.wargame-ficha', (fs) => fs.map((f) => f.textContent));
  confere(fichas.length >= 4, `o "quem é quem" lista os robôs do elenco padrão: ${fichas.join(' | ').slice(0, 140)}`);
  confere((await page.$$eval('.wargame-lado-inimigo .wargame-ficha i', (is) => is.map((i) => i.textContent))).join() === '1,2,3,4', 'os inimigos são numerados 1, 2, 3, 4 (a posição na lista do esquadrão)');

  // uma batida nova: escolher UM robô e marcar o ponto no mapa
  await page.click('text=+ NOVA BATIDA');
  const opcoes = await page.$$eval('.wargame-quem-select option', (os) => os.map((o) => ({ v: o.value, t: o.textContent })));
  confere(opcoes.some((o) => o.v === 'inimigo:*') && opcoes.some((o) => o.v === 'inimigo:0') && opcoes.some((o) => o.v === 'aliado:0'), `o QUEM oferece o lado inteiro e cada robô: ${opcoes.length} opções`);
  confere(!opcoes.some((o) => /TÉCNICO/.test(o.t ?? '')), 'o técnico não aparece (não recebe ordem de posição)');
  await page.selectOption('.wargame-quem-select', 'inimigo:0');
  const dica = await page.$eval('.wargame-mensagem', (m) => m.textContent);
  confere(/clique no mapa/i.test(dica ?? ''), `escolher o robô arma o clique no mapa: "${dica}"`);
  const mapa = await page.$('.wargame-mapa canvas');
  const caixa = await mapa.boundingBox();
  await page.mouse.click(caixa.x + caixa.width * 0.7, caixa.y + caixa.height * 0.3);
  const ponto = await page.$eval('.wargame-ponto', (p) => p.textContent);
  confere(/\(-?\d+, -?\d+\)/.test(ponto ?? ''), `o ponto marcado aparece em palavras: ${ponto}`);
  const msg = await page.$eval('.wargame-mensagem', (m) => m.textContent);
  confere(/vai o INIMIGO 1/.test(msg ?? ''), `a mensagem diz quem vai: ${msg}`);
  confere((await page.$eval('.wargame-linha', (l) => l.classList.contains('wargame-foco'))) === true, 'a batida marcada fica em foco (é a das setas do mapa)');

  // uma segunda batida: o lado inteiro dos aliados
  await page.click('text=+ NOVA BATIDA');
  await page.selectOption('.wargame-linha:nth-child(2) .wargame-quem-select', 'aliado:*');
  await page.mouse.click(caixa.x + caixa.width * 0.3, caixa.y + caixa.height * 0.7);
  await page.screenshot({ path: resolve('.decepticons/arte/wargame-painel-claude.png') });

  // legenda e câmera ficam recolhidas, e o resumo diz o que está ligado
  const aberto = await page.$eval('.wargame-linha .wargame-extra', (d) => d.open);
  confere(aberto === false, 'a legenda e a câmera começam recolhidas');
  await page.click('.wargame-linha .wargame-extra summary');
  await page.fill('.wargame-linha .wargame-extra input[type=text]', 'Abertura do episódio');
  confere(/legenda/.test(await page.$eval('.wargame-linha .wargame-extra summary', (s) => s.textContent)), 'o resumo da legenda e da câmera diz o que está ligado');

  // o link leva o alvo; executar abre a partida e SÓ o robô escolhido recebe a ordem
  await page.fill('.wargame-nome', 'Teste do alvo');
  const link = await page.evaluate(() => new Promise((ok) => {
    const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (t) => { ok(t); return orig(t).catch(() => {}); };
    [...document.querySelectorAll('.wargame-rodape button')].find((b) => /COPIAR LINK/.test(b.textContent)).click();
    setTimeout(() => ok(''), 3000);
  }));
  confere(/wargame=[^&]*:a0:/.test(link), `o link leva o alvo (a0): ${String(link).slice(0, 120)}`);

  await page.goto(String(link));
  await page.waitForFunction(() => window.__game?.match?.bots?.mechs?.length > 0, null, { timeout: 120_000 });
  const ordens = await page.evaluate(async () => {
    const m = window.__game.match;
    // A partida começa parada atrás do console ("clique para jogar"): dá uns ticks de simulação à mão (a batida do segundo 0 dispara no primeiro).
    for (let i = 0; i < 30; i++) m.step(1 / 60);
    return m.bots.mechs.map((x) => m.bots.brainOf(x)?.order);
  });
  confere(ordens[0] === 'hold' && ordens.slice(1).every((o) => o !== 'hold'), `só o robô 1 recebeu a ordem de segurar: ${JSON.stringify(ordens)}`);
} catch (e) {
  confere(false, `a bancada quebrou: ${e.message.slice(0, 220)}`);
  await page.screenshot({ path: resolve('.tmp/wargame-painel-erro.png') }).catch(() => {});
}
confere(erros.length === 0, erros.length ? `erros da página: ${erros.slice(0, 4).join(' | ')}` : 'nenhum erro na página');
await browser.close();
await vite.close();
console.log(falhas.length ? `\n${falhas.length} verificação(ões) falharam` : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
