import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';
import { apontarJogoPara, gerarWav, guardarSessao, tokenDeConta } from './vozLib.mjs';

/**
 * O JOGO DIZ POR QUE A VOZ NÃO FUNCIONA (P237, ordem do Comandante em 20/10: com dois PCs lado a lado o microfone funcionava no teste e a voz não chegou ao outro, e nada na tela dizia por quê).
 * Chrome com microfone FALSO, o jogo de verdade online numa sala com um colega (uma página da bancada, falando um tom), em três cenários:
 *  A. CONVIDADO numa sala com um adulto na voz: aviso no canto da tela com o motivo; sem indicador de voz; sem pedir o microfone;
 *  B. ADULTO + colega adulto: ligados; o diagnóstico mostra a ligação, a rota de rede e conclui "Tudo certo";
 *  C. ADULTO + colega CONVIDADO (o caso do Comandante): o HUD diz "n na sala sem voz" e o diagnóstico conclui que a outra pessoa precisa de conta de maior de 18 anos.
 * É a versão focada da `voz-idade.mjs` (que prova o portão de idade inteiro): cabe na folga de memória da máquina compartilhada.
 *
 *   node .decepticons/medicoes/voz-diagnostico.mjs     # sai com 1 se algo falhar; fotos em arte/voz-aviso-claude.png e arte/voz-diagnostico-claude.png
 *
 * G15: temporários em `.tmp/`.
 */
const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const tom = gerarWav('tom.wav', 0.5, 6);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const PORTA = 2594;
const SALA = 'DIAG';
const ARTE = resolve('.decepticons', 'arte');

const verificacoes = [];
const conferir = (nome, ok, detalhe = '') => {
  verificacoes.push({ nome, ok: !!ok, detalhe });
  console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
};
async function ate(fn, ms = 90000, passo = 400) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await dormir(passo);
  }
}

const { startServer } = (await runnerImport(resolve('server/Server.ts'), { configFile: false, logLevel: 'warn' })).module;
const jogo = await startServer({ port: PORTA, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 300, total: 600, msgs: 200, burst: 200 }, limiteLogin: { teto: 1000 }, log: () => {} });
apontarJogoPara(PORTA);
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5195, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const PAGINA = resolve('.decepticons', 'medicoes', 'voz-bancada.html').split(String.fromCharCode(92)).join('/');
const FLAGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${tom}`, '--autoplay-policy=no-user-gesture-required'];
const erros = new Set();

/** Conta quantas vezes o jogo pediu o microfone ao navegador. */
const CONTA_PEDIDOS = () => {
  window.__pedidos = 0;
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => {
    window.__pedidos++;
    return original(c);
  };
};

/** O colega da bancada na mesma sala; `token` indefinido = convidado (sem voz). */
async function colegaDaBancada(browser, nome, token) {
  const pagina = await browser.newPage();
  pagina.on('pageerror', (e) => erros.add(`${nome}: ${e.message}`));
  await pagina.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  const q = new URLSearchParams({ servidor: `ws://127.0.0.1:${PORTA}`, sala: SALA, nome, dsp: '0', ...(token === undefined ? {} : { token }) });
  await pagina.goto(`${base}@fs/${PAGINA}?${q}`);
  await pagina.waitForFunction(() => !!window.__voz, null, { timeout: 120_000 });
  return pagina;
}
/** Abre o jogo como um jogador (com a sessão guardada, ou convidado), entra na partida e devolve a página. */
async function entrar(browser, rotulo, token) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => erros.add(`${rotulo}: ${e.message}`));
  await page.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await page.addInitScript(CONTA_PEDIDOS);
  if (token) await guardarSessao(page, PORTA, token);
  await page.goto(`${base}?sala=${SALA}&nome=${rotulo}&servidor=ws://127.0.0.1:${PORTA}&comandante=1`, { timeout: 300_000 });
  await page.waitForFunction(() => document.getElementById('cta')?.textContent?.includes('jogar'), null, { timeout: 300_000, polling: 500 }).catch(() => {});
  for (let i = 0; i < 4; i++) {
    await page.click('#cta', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  return page;
}
const tela = (page) =>
  page.evaluate(() => ({
    aviso: document.querySelector('.voz-aviso:not([hidden])')?.textContent ?? '',
    estado: document.querySelector('.voz-hud:not(.voz-aviso):not([hidden]) .voz-estado')?.textContent ?? '',
    rede: document.querySelector('.voz-rede')?.textContent ?? '',
    pedidos: window.__pedidos ?? 0,
  }));
async function abrirConfiguracoes(page) {
  await page.evaluate(() => document.getElementById('btn-settings')?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('.settings-tab[data-tab="graficos"]')?.click());
  await page.waitForTimeout(400);
}
/** Clica no botão do diagnóstico e devolve o texto quando `serve(texto)` aceita (o relatório é refeito a cada clique). */
async function relatorio(page, serve, ms = 60_000) {
  return ate(async () => {
    await page.evaluate(() => document.getElementById('btn-voz-diag').click());
    await dormir(1500);
    const txt = await page.evaluate(() => document.getElementById('voz-diag').textContent ?? '');
    return serve(txt) ? txt : null;
  }, ms, 500);
}

let browser;
try {
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      browser = await chromium.launch({ channel, args: FLAGS });
      break;
    } catch {
      // próximo
    }
  }
  if (!browser) throw new Error('nenhum navegador');
  const tokenAdulto = await tokenDeConta(PORTA, 'adulto', '1990-01');

  // ---------------- A. convidado numa sala com um adulto na voz
  let colega = await colegaDaBancada(browser, 'BRAVO', await tokenDeConta(PORTA, 'bravo'));
  const convidado = await entrar(browser, 'CONVIDADO', null);
  const avisou = await ate(async () => (await tela(convidado)).aviso.includes('ENTRE COM UMA CONTA DE MAIOR DE 18 ANOS'), 120_000);
  const tA = await tela(convidado);
  conferir('A. CONVIDADO: o jogo avisa na tela por que está sem voz (o que faltava ao outro PC do Comandante)', !!avisou, JSON.stringify(tA.aviso));
  conferir('A. CONVIDADO: sem indicador de voz e o jogo nunca pediu o microfone', tA.estado === '' && tA.pedidos === 0, JSON.stringify({ estado: tA.estado, pedidos: tA.pedidos }));
  await convidado.screenshot({ path: resolve(ARTE, 'voz-aviso-claude.png') });
  await convidado.close();

  // ---------------- B. adulto + colega adulto: ligados, e o diagnóstico conclui "Tudo certo"
  const adulto = await entrar(browser, 'ADULTO', tokenAdulto);
  const ligou = await ate(async () => (await adulto.evaluate(() => document.querySelector('.voz-estado')?.textContent ?? '')).includes('MICROFONE ABERTO'), 180_000);
  conferir('B. ADULTO: o indicador de voz aparece com o microfone aberto', !!ligou);
  const tB = await tela(adulto);
  conferir('B. ADULTO na voz: nenhum aviso de "sem voz" (a voz está ligada)', tB.aviso === '', tB.aviso);
  await abrirConfiguracoes(adulto);
  await ate(() => adulto.evaluate(() => !document.getElementById('voz-controles').hidden), 90_000);
  const bom = await relatorio(adulto, (txt) => txt.includes('CONCLUSÃO: Tudo certo'));
  conferir('B. o diagnóstico mostra a ligação com BRAVO, a rota de rede e conclui "Tudo certo"', !!bom && bom.includes('BRAVO: conectada') && /rota (host|srflx|relay)/.test(bom), (bom ?? (await adulto.evaluate(() => document.getElementById('voz-diag').textContent))).replace(/\n/g, ' | ').slice(0, 420));
  if (bom) console.log(bom.split('\n').map((l) => `    ${l}`).join('\n'));
  const copiou = await adulto.evaluate(() => document.getElementById('btn-voz-diag').textContent);
  conferir('B. o botão fica com o rótulo de copiado ou volta ao normal (nunca quebra)', typeof copiou === 'string' && copiou.length > 0, copiou);

  // ---------------- C. o caso do Comandante: o outro PC é convidado
  await colega.close();
  colega = await colegaDaBancada(browser, 'CHARLIE', undefined);
  const viu = await ate(async () => (await tela(adulto)).rede.includes('NA SALA SEM VOZ'), 120_000);
  const tC = await tela(adulto);
  conferir('C. o HUD do adulto diz quantos da sala estão fora da voz (em vez de mandar testar um microfone que estava bom)', !!viu && tC.rede.includes('1 NA SALA SEM VOZ'), JSON.stringify(tC.rede));
  const ruim = await relatorio(adulto, (txt) => txt.includes('nenhum está na voz'));
  conferir('C. o diagnóstico conclui que a outra pessoa precisa de conta de maior de 18 anos com a voz ligada', !!ruim && ruim.includes('conta de maior de 18 anos') && ruim.includes('FORA da voz: CHARLIE'), (ruim ?? (await adulto.evaluate(() => document.getElementById('voz-diag').textContent))).replace(/\n/g, ' | ').slice(0, 420));
  if (ruim) console.log(ruim.split('\n').map((l) => `    ${l}`).join('\n'));
  await adulto.evaluate(() => document.getElementById('voz-diag').scrollIntoView({ block: 'center' }));
  await adulto.waitForTimeout(300);
  await adulto.screenshot({ path: resolve(ARTE, 'voz-diagnostico-claude.png') });

  conferir('nenhum erro de página', erros.size === 0, [...erros].slice(0, 3).join(' | '));
} finally {
  await browser?.close().catch(() => {});
  await vite.close();
  await jogo.close();
}
const falhas = verificacoes.filter((v) => !v.ok);
const dia = new Date().toISOString().slice(0, 10);
writeFileSync(`.decepticons/medicoes/voz-diagnostico-${dia}.json`, JSON.stringify({ data: dia, verificacoes }, null, 1));
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : `\nTUDO CERTO: ${verificacoes.length} verificações`);
process.exitCode = falhas.length ? 1 : 0;
