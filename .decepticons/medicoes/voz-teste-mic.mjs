import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';
import { apontarJogoPara, gerarWav, guardarSessao, tokenDeConta } from './vozLib.mjs';

/**
 * O TESTE DO MICROFONE E O AVISO DE "SOZINHO NA VOZ" no jogo de verdade (P212): Chrome com microfone FALSO (um tom), o jogo online numa sala **sozinho**, depois com um colega (uma página da bancada).
 * Prova: o indicador avisa que ninguém mais está na voz e some quando o colega entra; o painel das Configurações abre o microfone, a barra mexe, o texto diz "funcionando", "ouvir a minha voz" não dá
 * erro, e **parar solta o microfone de verdade** (as faixas terminam), assim como fechar as Configurações e trocar de aba; e, num Chrome que não deixa usar o microfone, o painel diz por quê.
 *
 *   node .decepticons/medicoes/voz-teste-mic.mjs     # sai com 1 se algo falhar; foto em arte/voz-teste-microfone-claude.png; grava medicoes/voz-teste-mic-<data>.json
 *
 * G15: temporários em `.tmp/`.
 */
const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const tom = gerarWav('tom.wav', 0.5, 6);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const verificacoes = [];
const conferir = (nome, ok, detalhe = '') => {
  verificacoes.push({ nome, ok, detalhe });
  console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
};
async function ate(fn, ms = 60000, passo = 300) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await dormir(passo);
  }
}

const { startServer } = (await runnerImport(resolve('server/Server.ts'), { configFile: false, logLevel: 'warn' })).module;
const jogo = await startServer({ port: 2596, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 200, total: 400, msgs: 200, burst: 200 }, log: () => {} });
apontarJogoPara(2596);
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5194, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const PAGINA = resolve('.decepticons', 'medicoes', 'voz-bancada.html').split(String.fromCharCode(92)).join('/');
const FLAGS_BASE = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${tom}`, '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'];
async function lancar(flagsExtras) {
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch({ channel, args: [...FLAGS_BASE, ...flagsExtras] });
    } catch {
      // próximo
    }
  }
  throw new Error('nenhum navegador');
}
/** Registra toda faixa de microfone que a página abre, para provar depois que foram soltas. */
const GRAVA_FAIXAS = () => {
  window.__faixas = [];
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    const f = await original(c);
    window.__faixas.push(...f.getTracks());
    return f;
  };
};
const faixasVivas = (page) => page.evaluate(() => (window.__faixas ?? []).filter((t) => t.readyState === 'live').length);

const erros = new Set();
let b1;
let b2;
try {
  b1 = await lancar(['--use-fake-ui-for-media-stream']);
  const page = await b1.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => erros.add(e.message));
  await page.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await page.addInitScript(GRAVA_FAIXAS);
  // A voz e o teste do microfone são só de conta de maior de idade (P211): o jogador da bancada entra com uma, que o jogo restaura sozinho.
  await guardarSessao(page, 2596, await tokenDeConta(2596, 'dan'));
  await page.goto(`${base}?sala=MICTESTE&nome=DAN&servidor=ws://127.0.0.1:2596&comandante=1`);
  await page.waitForFunction(() => document.getElementById('cta')?.textContent?.includes('jogar'), null, { timeout: 240_000, polling: 500 }).catch(() => {});
  for (let i = 0; i < 4; i++) {
    await page.click('#cta').catch(() => {});
    await page.waitForTimeout(500);
  }

  // ---- sozinho na voz: o aviso
  const aviso = await ate(() => page.evaluate(() => document.querySelector('.voz-rede')?.textContent?.includes('NINGUÉM MAIS NA VOZ') ?? false), 120_000);
  conferir('sozinho na voz o indicador avisa que ninguém mais está nela e manda testar o microfone', !!aviso, await page.evaluate(() => document.querySelector('.voz-rede')?.textContent ?? ''));
  conferir('o indicador de estado diz "MICROFONE ABERTO" (o microfone funciona; o aviso explica o silêncio)', await page.evaluate(() => (document.querySelector('.voz-estado')?.textContent ?? '').startsWith('MICROFONE ABERTO')));

  // ---- um colega entra: o aviso some
  const colega = await b1.newPage();
  colega.on('pageerror', (e) => erros.add(`colega: ${e.message}`));
  await colega.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await colega.goto(`${base}@fs/${PAGINA}?${new URLSearchParams({ servidor: 'ws://127.0.0.1:2596', sala: 'MICTESTE', nome: 'BRAVO', dsp: '0', token: await tokenDeConta(2596, 'bravo') })}`);
  const sumiu = await ate(() => page.evaluate(() => (document.querySelector('.voz-rede')?.textContent ?? 'x') === ''), 120_000);
  conferir('quando um colega entra na voz o aviso de "sozinho" some', !!sumiu);
  await colega.close();

  // ---- o painel do teste
  await page.evaluate(() => document.getElementById('btn-settings')?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('.settings-tab[data-tab="graficos"]')?.click();
    document.getElementById('btn-voz-testar')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  const vivasAntes = await faixasVivas(page);
  await page.evaluate(() => document.getElementById('btn-voz-testar').click());
  const ok = await ate(() => page.evaluate(() => document.getElementById('voz-teste')?.getAttribute('data-estado') === 'ok'), 30000);
  const painel = await page.evaluate(() => ({
    visivel: !document.getElementById('voz-teste').hidden,
    barra: document.getElementById('voz-nivel-barra').style.width,
    status: document.getElementById('voz-teste-status').textContent,
    botao: document.getElementById('btn-voz-testar').textContent,
  }));
  conferir('o painel do teste abre, a barra mexe e o texto diz "funcionando"', !!ok && painel.visivel && Number.parseInt(painel.barra, 10) > 0 && painel.status.startsWith('Funcionando'), JSON.stringify(painel));
  conferir('o botão vira "PARAR O TESTE"', painel.botao === '[ PARAR O TESTE ]');
  const usando = await page.evaluate(() => document.getElementById('voz-teste-aparelho')?.textContent ?? '');
  conferir('o painel diz qual aparelho o navegador abriu ("Aparelho em uso: …", P229)', usando.startsWith('Aparelho em uso: ') && usando.length > 20, usando);
  const vivasTeste = await faixasVivas(page);
  conferir('o teste abriu o microfone (uma faixa a mais, além da do chat de voz)', vivasTeste === vivasAntes + 1, `${vivasAntes} -> ${vivasTeste}`);
  const aparelhos = await page.evaluate(() => [...document.getElementById('setting-voz-aparelho').options].map((o) => o.textContent));
  conferir('depois da permissão a lista de aparelhos ganha o microfone com nome', aparelhos.length >= 2 && aparelhos[0] === 'Padrão do sistema', JSON.stringify(aparelhos));
  await page.screenshot({ path: resolve('.decepticons', 'arte', 'voz-teste-microfone-claude.png') });
  await page.evaluate(() => {
    const c = document.getElementById('voz-ouvir');
    c.checked = true;
    c.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  conferir('"ouvir a minha voz" liga sem erro', erros.size === 0, [...erros].join(' | '));

  await page.evaluate(() => document.getElementById('btn-voz-testar').click());
  await page.waitForTimeout(500);
  const parou = await page.evaluate(() => ({ escondido: document.getElementById('voz-teste').hidden, botao: document.getElementById('btn-voz-testar').textContent, ouvir: document.getElementById('voz-ouvir').checked }));
  conferir('parar o teste esconde o painel, volta o botão e desmarca "ouvir a minha voz"', parou.escondido && parou.botao === '[ TESTAR ]' && !parou.ouvir, JSON.stringify(parou));
  conferir('parar SOLTA o microfone de verdade (a faixa do teste termina)', (await faixasVivas(page)) === vivasAntes, `${await faixasVivas(page)} vivas, esperava ${vivasAntes}`);

  // fechar as Configurações com o teste ligado
  await page.evaluate(() => document.getElementById('btn-voz-testar').click());
  await ate(() => page.evaluate(() => document.getElementById('voz-teste')?.getAttribute('data-estado') === 'ok'), 30000);
  await page.evaluate(() => document.getElementById('btn-settings-close')?.click());
  await page.waitForTimeout(500);
  conferir('fechar as Configurações com o teste ligado solta o microfone', (await faixasVivas(page)) === vivasAntes);

  // trocar de aba com o teste ligado
  await page.evaluate(() => document.getElementById('btn-settings')?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelector('.settings-tab[data-tab="graficos"]')?.click();
    document.getElementById('btn-voz-testar').click();
  });
  await ate(() => page.evaluate(() => document.getElementById('voz-teste')?.getAttribute('data-estado') === 'ok'), 30000);
  await page.evaluate(() => document.querySelector('.settings-tab[data-tab="controles"]')?.click());
  await page.waitForTimeout(500);
  conferir('trocar de aba com o teste ligado solta o microfone', (await faixasVivas(page)) === vivasAntes);
  await page.evaluate(() => document.getElementById('btn-settings-close')?.click());
  conferir('nenhum erro de página no jogo', erros.size === 0, [...erros].slice(0, 3).join(' | '));
  await b1.close();
  b1 = null;

  // ---- o Chrome não deixa usar o microfone: o painel diz por quê (sem a flag que aceita sozinha)
  b2 = await lancar([]);
  const p2 = await b2.newPage({ viewport: { width: 1280, height: 720 } });
  p2.on('pageerror', (e) => erros.add(`bloqueado: ${e.message}`));
  await p2.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await guardarSessao(p2, 2596, await tokenDeConta(2596, 'dan2'));
  await p2.goto(`${base}?comandante=1`);
  await p2.waitForFunction(() => document.getElementById('cta')?.textContent?.includes('jogar'), null, { timeout: 240_000, polling: 500 }).catch(() => {});
  await p2.evaluate(() => document.getElementById('btn-settings')?.click());
  await p2.waitForTimeout(400);
  await p2.evaluate(() => {
    document.querySelector('.settings-tab[data-tab="graficos"]')?.click();
    document.getElementById('btn-voz-testar')?.click();
  });
  const negado = await ate(() => p2.evaluate(() => ['negado', 'outra', 'semAparelho', 'emUso'].includes(document.getElementById('voz-teste')?.getAttribute('data-estado') ?? '')), 30000);
  const estadoNegado = await p2.evaluate(() => ({ estado: document.getElementById('voz-teste')?.getAttribute('data-estado'), texto: document.getElementById('voz-teste-status')?.textContent, botao: document.getElementById('btn-voz-testar')?.textContent }));
  conferir('sem permissão do navegador o painel explica o motivo em vez de ficar mudo, e o botão volta a "testar"', !!negado && (estadoNegado.texto ?? '').length > 20 && estadoNegado.botao === '[ TESTAR ]', JSON.stringify(estadoNegado));
} finally {
  await b1?.close().catch(() => {});
  await b2?.close().catch(() => {});
  await vite.close();
  await jogo.close();
}
const data = new Date().toLocaleDateString('sv');
writeFileSync(resolve('.decepticons', 'medicoes', `voz-teste-mic-${data}.json`), `${JSON.stringify({ data, verificacoes }, null, 2)}\n`);
const falhas = verificacoes.filter((v) => !v.ok);
console.log(`\n${verificacoes.length - falhas.length}/${verificacoes.length} verificações`);
process.exit(falhas.length ? 1 : 0);
