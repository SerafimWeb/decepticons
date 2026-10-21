import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';
import { gerarWav, tokenDeConta } from './vozLib.mjs';

/**
 * OS CANAIS DE VOZ no Chrome de verdade (P237 PR 3, ordem do Comandante em 20/10: "se falo só com meu time, se falo para todos ouvirem, ou se falo com um jogador escolhido"): cinco navegadores,
 * o `VoiceChat` e o envio por Web Audio do jogo; só o ALFA fala (um tom), os outros só ouvem. O que se mede é o que cada ouvinte RECEBE de verdade (o pico do áudio que sai dele).
 *  1. todos: os quatro ouvem;
 *  2. privado: só o jogador escolhido ouve (BRAVO), os outros nada; solta e todos voltam a ouvir;
 *  3. time: só o time ouve (BRAVO, do mesmo time); os do outro time nada;
 *  4. sala SEM times: o canal do time não fala com ninguém (falha fechada, nunca vira "todos");
 *  5. um colega que ENTRA no meio de um sussurro não ouve nada (a porta dele nasce fechada) e, soltando, ouve.
 *
 *   node .decepticons/medicoes/voz-canais.mjs     # sai com 1 se algo falhar; grava medicoes/voz-canais-<data>.json
 *
 * G15: temporários em `.tmp/`.
 */
const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const tom = gerarWav('tom.wav', 0.5, 6);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const PORTA = 2592;

const verificacoes = [];
const medidas = {};
const conferir = (nome, ok, detalhe = '') => {
  verificacoes.push({ nome, ok: !!ok, detalhe });
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
const jogo = await startServer({ port: PORTA, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 200, total: 400, msgs: 200, burst: 200 }, log: () => {} });
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5191, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const SERVIDOR = `ws://127.0.0.1:${PORTA}`;
const PAGINA = resolve('.decepticons', 'medicoes', 'voz-bancada.html').split(String.fromCharCode(92)).join('/');
const erros = [];

async function lancar() {
  const flags = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${tom}`, '--autoplay-policy=no-user-gesture-required'];
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch({ channel, args: flags });
    } catch {
      // próximo
    }
  }
  throw new Error('nenhum navegador');
}
/** Uma página da bancada na sala; `ouvinte` = "segurar para falar" solto (só escuta). */
async function bancada(browser, nome, ouvinte) {
  const pagina = await browser.newPage();
  pagina.on('pageerror', (e) => erros.push(`${nome}: ${e.message}`));
  await pagina.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  const q = new URLSearchParams({ servidor: SERVIDOR, sala: 'CANAIS', nome, dsp: '0', token: await tokenDeConta(PORTA, nome.toLowerCase()), ...(ouvinte ? { modo: 'ptt' } : {}) });
  await pagina.goto(`${base}@fs/${PAGINA}?${q}`);
  await pagina.waitForFunction(() => !!window.__voz, null, { timeout: 120_000 });
  return pagina;
}
const estado = (p) => p.evaluate(() => window.__voz.estado());
/** O pico do que cada ouvinte recebe numa janela, todos ao mesmo tempo. */
async function ouvir(paginas, ms = 2500) {
  await Promise.all(paginas.map((p) => p.evaluate(() => window.__voz.zerarPico())));
  await dormir(ms);
  return Promise.all(paginas.map((p) => p.evaluate(() => window.__voz.pico())));
}
const OUVE = 0.02;
const NADA = 0.002;
const fmt = (xs, casas = 3) => xs.map((x) => x.toFixed(casas)).join(' / ');

let browser;
try {
  browser = await lancar();
  const alfa = await bancada(browser, 'ALFA', false);
  const bravo = await bancada(browser, 'BRAVO', true);
  const charlie = await bancada(browser, 'CHARLIE', true);
  const delta = await bancada(browser, 'DELTA', true);
  const ouvintes = [bravo, charlie, delta];
  const ligaram = await ate(async () => (await estado(alfa)).ligados >= 3, 120_000);
  conferir('ALFA se liga aos três ouvintes pelo WebRTC', !!ligaram, JSON.stringify(await estado(alfa)));
  const id = {};
  for (const [nome, p] of [['alfa', alfa], ['bravo', bravo], ['charlie', charlie], ['delta', delta]]) id[nome] = (await estado(p)).id;
  const disp = await alfa.evaluate(() => window.__voz.canalAtual());
  conferir('os canais estão disponíveis (o envio vai pelo grafo de Web Audio, uma porta por colega)', disp.disponiveis === true, JSON.stringify(disp));

  // 1. todos
  await dormir(2000);
  const p1 = await ouvir(ouvintes);
  medidas.todos = p1;
  conferir('todos: BRAVO, CHARLIE e DELTA ouvem ALFA', p1.every((x) => x > OUVE), fmt(p1));

  // 2. privado
  await alfa.evaluate((i) => window.__voz.escolherAlvo(i), id.bravo);
  await alfa.evaluate(() => window.__voz.canal('privado', true));
  await dormir(800);
  const p2 = await ouvir(ouvintes);
  medidas.privado = p2;
  const c2 = await alfa.evaluate(() => window.__voz.canalAtual());
  conferir('privado: o canal é o privado e o alvo é o BRAVO', c2.canal === 'privado' && c2.alvo === id.bravo, JSON.stringify(c2));
  conferir('privado: só o BRAVO ouve; CHARLIE e DELTA não recebem nada', p2[0] > OUVE && p2[1] < NADA && p2[2] < NADA, fmt(p2, 4));
  await alfa.evaluate(() => window.__voz.canal('privado', false));
  await dormir(800);
  const p2b = await ouvir(ouvintes);
  conferir('soltando a tecla do privado os três voltam a ouvir (todos)', p2b.every((x) => x > OUVE), fmt(p2b));

  // 3. time (BRAVO é do time de ALFA; CHARLIE e DELTA, do outro)
  const times = { [id.alfa]: 1, [id.bravo]: 1, [id.charlie]: 2, [id.delta]: 2 };
  await alfa.evaluate((t) => window.__voz.definirTimes(t), times);
  await alfa.evaluate(() => window.__voz.canal('time', true));
  await dormir(800);
  const p3 = await ouvir(ouvintes);
  medidas.time = p3;
  conferir('time: só o BRAVO (do meu time) ouve; CHARLIE e DELTA (do outro time) não recebem nada', p3[0] > OUVE && p3[1] < NADA && p3[2] < NADA, fmt(p3, 4));
  await alfa.evaluate(() => window.__voz.canal('time', false));

  // 4. sala sem times: o canal do time não fala com ninguém
  await alfa.evaluate(() => window.__voz.definirTimes({}));
  await alfa.evaluate(() => window.__voz.canal('time', true));
  await dormir(800);
  const p4 = await ouvir(ouvintes);
  medidas.semTimes = p4;
  const c4 = await alfa.evaluate(() => window.__voz.canalAtual());
  conferir('sala SEM times: ALFA está no canal do time e NINGUÉM ouve (falha fechada: nunca vira "todos")', c4.canal === 'time' && c4.temTimes === false && p4.every((x) => x < NADA), `${JSON.stringify(c4)} ${fmt(p4, 4)}`);
  await alfa.evaluate(() => window.__voz.canal('time', false));

  // 5. um colega que entra no meio de um sussurro
  await alfa.evaluate((i) => window.__voz.escolherAlvo(i), id.bravo);
  await alfa.evaluate(() => window.__voz.canal('privado', true));
  const echo = await bancada(browser, 'ECHO', true);
  const entrou = await ate(async () => (await estado(echo)).ligados >= 1 && (await estado(alfa)).ligados >= 4, 120_000);
  conferir('ECHO entra na sala no meio do sussurro e se liga a ALFA', !!entrou, JSON.stringify(await estado(alfa)));
  await dormir(1500);
  const p5 = await ouvir([bravo, echo], 3000);
  medidas.entrouNoMeio = p5;
  conferir('o colega que entrou no meio do sussurro NÃO ouve nada (a porta dele nasceu fechada); o BRAVO segue ouvindo', p5[0] > OUVE && p5[1] < NADA, fmt(p5, 4));
  await alfa.evaluate(() => window.__voz.canal('privado', false));
  await dormir(800);
  const p5b = await ouvir([bravo, echo]);
  conferir('soltando o sussurro, o ECHO passa a ouvir', p5b.every((x) => x > OUVE), fmt(p5b));
  conferir('nenhum erro de página', erros.length === 0, erros.slice(0, 3).join(' | '));
} finally {
  await browser?.close().catch(() => {});
  await vite.close();
  await jogo.close();
}
const falhas = verificacoes.filter((v) => !v.ok);
const dia = new Date().toISOString().slice(0, 10);
writeFileSync(`.decepticons/medicoes/voz-canais-${dia}.json`, JSON.stringify({ data: dia, medidas, verificacoes }, null, 1));
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : `\nTUDO CERTO: ${verificacoes.length} verificações`);
process.exitCode = falhas.length ? 1 : 0;
