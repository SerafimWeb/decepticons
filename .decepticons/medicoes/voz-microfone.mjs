import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';
import { gerarWav, tokenDeConta } from './vozLib.mjs';

/**
 * O MICROFONE QUE NÃO ESTÁ BEM, no Chrome de verdade (P237, ordem do Comandante em 20/10: o Captain 300 soa baixo e "novamente o microfone parou de funcionar"): dois navegadores, o `VoiceChat` e o envio
 * por Web Audio do jogo, microfone FALSO (um tom baixo, ou silêncio total). Prova:
 *  1. o **ganho** escala o que o OUTRO lado ouve (x3 sobe ~9,5 dB; x0,5 desce ~6 dB) e o envio vai pelo grafo de Web Audio;
 *  2. o microfone que **cai** (o fone Bluetooth some) é **reaberto sozinho** e a voz volta a chegar;
 *  3. um microfone aberto que só entrega **silêncio total** é acusado pela saúde ("sem-som") depois de 8 s, e o mudo desliga o aviso.
 *
 *   node .decepticons/medicoes/voz-microfone.mjs     # sai com 1 se algo falhar; grava medicoes/voz-microfone-<data>.json
 *
 * G15: temporários em \`.tmp/\`.
 */
const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const tomBaixo = gerarWav('tom-baixo.wav', 0.05, 6);
const silencio = gerarWav('silencio.wav', 0, 6);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const PORTA = 2593;

const verificacoes = [];
const medidas = {};
const conferir = (nome, ok, detalhe = '') => {
  verificacoes.push({ nome, ok: !!ok, detalhe });
  console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
};
async function ate(fn, ms = 40000, passo = 300) {
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
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5192, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const SERVIDOR = `ws://127.0.0.1:${PORTA}`;
const PAGINA = resolve('.decepticons', 'medicoes', 'voz-bancada.html').split(String.fromCharCode(92)).join('/');
const erros = [];

async function lancar(wav) {
  const flags = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'];
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch({ channel, args: flags });
    } catch {
      // próximo
    }
  }
  throw new Error('nenhum navegador');
}
/** Uma página da bancada: o `VoiceChat` do jogo com o microfone falso, SEM o processamento do navegador (eco, ruído e ganho automáticos alterariam o tom que se mede). */
async function bancada(browser, sala, nome, extra = {}) {
  const pagina = await browser.newPage();
  pagina.on('pageerror', (e) => erros.push(`${nome}: ${e.message}`));
  await pagina.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  const q = new URLSearchParams({ servidor: SERVIDOR, sala, nome, dsp: '0', token: await tokenDeConta(PORTA, nome.toLowerCase()), ...extra });
  await pagina.goto(`${base}@fs/${PAGINA}?${q}`);
  await pagina.waitForFunction(() => !!window.__voz, null, { timeout: 120_000 });
  return pagina;
}
const estado = (p) => p.evaluate(() => window.__voz.estado());
const picoApos = async (p, ms) => {
  await p.evaluate(() => window.__voz.zerarPico());
  await dormir(ms);
  return p.evaluate(() => window.__voz.pico());
};

let browser;
try {
  // ---------------- 1. e 2. o ganho e a reabertura (tom baixo: 0,05 de amplitude)
  browser = await lancar(tomBaixo);
  const alfa = await bancada(browser, 'GANHO', 'ALFA');
  const bravo = await bancada(browser, 'GANHO', 'BRAVO');
  const ligaram = await ate(async () => (await estado(alfa)).ligados >= 1 && (await estado(bravo)).ligados >= 1, 90_000);
  conferir('ALFA e BRAVO se ligam pelo WebRTC com o envio por Web Audio', !!ligaram, JSON.stringify(await estado(alfa)));
  const d0 = await alfa.evaluate(() => window.__voz.diagnostico());
  conferir('o envio de ALFA vai pelo grafo de Web Audio (não pela faixa crua)', d0.viaWebAudio === true && d0.ajusteDeGanho === 1, JSON.stringify({ via: d0.viaWebAudio, ganho: d0.ajusteDeGanho }));

  await dormir(2000);
  const p1 = await picoApos(bravo, 3000);
  medidas.picoGanho1 = p1;
  conferir('com ganho x1 BRAVO ouve o tom de ALFA (o tom é baixo: 0,05)', p1 > 0.005 && p1 < 0.08, `RMS de pico ${p1.toFixed(4)}`);
  await alfa.evaluate(() => window.__voz.mudarGanho(3));
  await dormir(1000);
  const p3 = await picoApos(bravo, 3000);
  medidas.picoGanho3 = p3;
  const razao3 = p3 / p1;
  conferir('com ganho x3 BRAVO ouve cerca de 3 vezes mais (entre 2,3x e 3,7x)', razao3 > 2.3 && razao3 < 3.7, `${p1.toFixed(4)} -> ${p3.toFixed(4)} (${razao3.toFixed(2)}x, ${(20 * Math.log10(razao3)).toFixed(1)} dB)`);
  await alfa.evaluate(() => window.__voz.mudarGanho(0.5));
  await dormir(1000);
  const p05 = await picoApos(bravo, 3000);
  medidas.picoGanho05 = p05;
  const razao05 = p05 / p1;
  conferir('com ganho x0,5 BRAVO ouve cerca da metade (entre 0,38x e 0,65x)', razao05 > 0.38 && razao05 < 0.65, `${razao05.toFixed(2)}x, ${(20 * Math.log10(razao05)).toFixed(1)} dB`);
  const d1 = await alfa.evaluate(() => window.__voz.diagnostico());
  conferir('o diagnóstico mostra o ganho aplicado', d1.ajusteDeGanho === 0.5, String(d1.ajusteDeGanho));

  // o nível que o HUD lê: o RMS do que sai, já com o ganho
  await alfa.evaluate(() => window.__voz.mudarGanho(2));
  await dormir(500);
  const nivel = await alfa.evaluate(async () => {
    window.__voz.saude();
    await new Promise((r) => setTimeout(r, 300));
    window.__voz.saude();
    return window.__voz.nivelDoMic();
  });
  conferir('o nível do microfone (a barra do HUD) acompanha o ganho: o tom de 0,05 com x2 dá RMS ~0,07', nivel > 0.04 && nivel < 0.11, nivel.toFixed(4));

  // 2. o microfone cai e o jogo reabre sozinho
  await alfa.evaluate(() => window.__voz.mudarGanho(3));
  await dormir(800);
  const t0 = Date.now();
  const derrubou = await alfa.evaluate(() => window.__voz.derrubarMic());
  const logoDepois = await estado(alfa);
  conferir('o microfone cai (o aparelho some): o jogo larga o microfone na hora', derrubou && logoDepois.mic === 'sem', JSON.stringify({ derrubou, mic: logoDepois.mic }));
  const voltou = await ate(async () => (await estado(alfa)).mic === 'ativo', 15_000, 200);
  conferir('o jogo REABRE o microfone sozinho em alguns segundos (1,5 s de espera + o pedido)', !!voltou, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await dormir(2500);
  const pVolta = await picoApos(bravo, 3000);
  medidas.picoDepoisDeReabrir = pVolta;
  conferir('depois de reabrir, BRAVO volta a ouvir ALFA, com o mesmo ganho (x3)', pVolta > p1 * 2.0, `${pVolta.toFixed(4)} (antes do ganho: ${p1.toFixed(4)})`);
  const d2 = await alfa.evaluate(() => window.__voz.diagnostico());
  conferir('as ligações continuam de pé (ninguém precisou entrar de novo na sala)', d2.ligacoes.length === 1 && d2.ligacoes[0].estado === 'conectada', JSON.stringify(d2.ligacoes.map((l) => l.estado)));
  await browser.close();
  browser = null;

  // ---------------- 3. silêncio total com o microfone aberto
  browser = await lancar(silencio);
  const muda = await bancada(browser, 'SILENCIO', 'CHARLIE');
  const ouve = await bancada(browser, 'SILENCIO', 'DELTA');
  await ate(async () => (await estado(muda)).ligados >= 1, 90_000);
  const ini = Date.now();
  const primeiro = await muda.evaluate(() => window.__voz.saude());
  conferir('microfone aberto com silêncio total: nos primeiros segundos ainda está "ok" (o aviso espera)', primeiro === 'ok', primeiro);
  const acusou = await ate(async () => (await muda.evaluate(() => window.__voz.saude())) === 'sem-som', 20_000, 500);
  const quando = (Date.now() - ini) / 1000;
  medidas.segundosAteAcusar = quando;
  conferir('depois de ~8 s de zero absoluto a saúde acusa "sem-som"', !!acusou && quando >= 7.5 && quando < 14, `${quando.toFixed(1)} s`);
  const dm = await muda.evaluate(() => window.__voz.diagnostico());
  conferir('o diagnóstico registra a saúde "sem-som" (a conclusão em português parte dela)', dm.saude === 'sem-som', dm.saude);
  await muda.evaluate(() => window.__voz.mudarModo('ptt')); // "segurar para falar" solto: o silêncio é o esperado
  await dormir(500);
  const emPtt = await muda.evaluate(() => window.__voz.saude());
  conferir('no "segurar para falar" solto o silêncio é esperado: o aviso some', emPtt === 'ok', emPtt);
  conferir('quem escuta não ouve nada (o silêncio é de verdade)', (await picoApos(ouve, 2000)) < 0.0005);
  conferir('nenhum erro de página', erros.length === 0, erros.slice(0, 3).join(' | '));
} finally {
  await browser?.close().catch(() => {});
  await vite.close();
  await jogo.close();
}
const falhas = verificacoes.filter((v) => !v.ok);
const dia = new Date().toISOString().slice(0, 10);
writeFileSync(`.decepticons/medicoes/voz-microfone-${dia}.json`, JSON.stringify({ data: dia, medidas, verificacoes }, null, 1));
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : `\nTUDO CERTO: ${verificacoes.length} verificações`);
process.exitCode = falhas.length ? 1 : 0;
