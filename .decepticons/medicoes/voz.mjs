import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';

/**
 * A bancada do CHAT DE VOZ (P205): dois ou mais Chrome de verdade, um servidor de jogo de verdade e o mesmo `NetClient` + `VoiceChat` + áudio espacial do jogo, com microfone FALSO
 * (um arquivo WAV: um tom, ou silêncio). Prova o que os testes de unidade não provam: **o áudio atravessa o WebRTC** de um navegador ao outro, o mudo e o PTT cortam de verdade, a distância
 * baixa o volume e o `outbound-rtp` mostra o que a voz custa na rede (a economia do DTX em silêncio é MEDIDA aqui, não suposta).
 *
 *   node .decepticons/medicoes/voz.mjs          # roda tudo e grava .decepticons/medicoes/voz-<data>.json; sai com 1 se algo falhar
 *
 * G15: o Chrome e o perfil dele em `.tmp/`. Sem GPU (a página não desenha nada).
 */
const TMP = resolve('.tmp', 'captura');
const DADOS = resolve('.tmp', 'voz');
mkdirSync(TMP, { recursive: true });
mkdirSync(DADOS, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');

/** Um WAV mono de 16 bits a 48 kHz: um seno (`amp` > 0) ou silêncio. É o que o Chrome toca no lugar do microfone. */
function wav(nome, amp, segundos) {
  const hz = 48000;
  const n = hz * segundos;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(hz, 24);
  buf.writeUInt32LE(hz * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(amp * 32767 * Math.sin((2 * Math.PI * 440 * i) / hz)), 44 + i * 2);
  const caminho = resolve(DADOS, nome);
  writeFileSync(caminho, buf);
  return caminho;
}
const tom = wav('tom.wav', 0.5, 6);
const silencio = wav('silencio.wav', 0, 6);

const verificacoes = [];
const medidas = {};
function conferir(nome, ok, detalhe = '') {
  verificacoes.push({ nome, ok, detalhe });
  console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function ate(fn, ms = 25000, passo = 250) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await dormir(passo);
  }
}

const { startServer } = (await runnerImport(resolve('server/Server.ts'), { configFile: false, logLevel: 'warn' })).module;
const jogo = await startServer({ port: 2598, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 200, total: 400, msgs: 200, burst: 200 }, log: () => {} });
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5197, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const SERVIDOR = 'ws://127.0.0.1:2598';
const PAGINA = resolve('.decepticons', 'medicoes', 'voz-bancada.html').split(String.fromCharCode(92)).join('/');

async function lancar(arquivoWav) {
  const flags = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${arquivoWav}`, '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'];
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch({ channel, args: flags });
    } catch {
      // próximo
    }
  }
  throw new Error('nenhum navegador');
}

const erros = [];
/** Abre um jogador da bancada; devolve a página e atalhos para o estado dele. */
async function abrir(browser, nome, params = {}) {
  const page = await browser.newPage();
  // O navegador pede /favicon.ico sozinho e o servidor de desenvolvimento responde 404: não é da voz, e polui o console.
  await page.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  page.on('pageerror', (e) => { erros.push(`${nome}: ${e.message}`); console.log(`  [${nome}] erro de página: ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error' || process.env.VOZ_DEBUG) console.log(`  [${nome}] console.${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('response', (r) => { if (r.status() >= 400) console.log(`  [${nome}] HTTP ${r.status()} ${r.url().slice(0, 160)}`); });
  const q = new URLSearchParams({ servidor: SERVIDOR, sala: 'VOZ1', nome, dsp: '0', ...params });
  await page.goto(`${base}@fs/${PAGINA}?${q}`);
  await page.waitForFunction(() => !!window.__voz, null, { timeout: Number(process.env.VOZ_ESPERA ?? 60000) });
  const j = {
    nome,
    page,
    estado: () => page.evaluate(() => window.__voz.estado()),
    mundo: (meu, outros) => page.evaluate(({ meu, outros }) => { Object.assign(window.__voz.mundo.meu, meu); for (const [k, v] of Object.entries(outros)) window.__voz.mundo.outros[k] = v; }, { meu: meu ?? {}, outros: outros ?? {} }),
    pico: async (ms) => {
      await page.evaluate(() => window.__voz.zerarPico());
      await dormir(ms);
      return page.evaluate(() => window.__voz.pico());
    },
    enviado: () => page.evaluate(() => window.__voz.enviado()),
    tecla: async (descer) => {
      await page.bringToFront();
      await (descer ? page.keyboard.down('KeyT') : page.keyboard.up('KeyT'));
    },
    toque: async () => {
      await j.tecla(true);
      await j.tecla(false);
    },
  };
  return j;
}
const falaDe = async (ouvinte, id, ms = 20000) => !!(await ate(async () => (await ouvinte.estado()).falando.includes(id), ms));
const calou = async (ouvinte, id, ms = 6000) => !!(await ate(async () => !(await ouvinte.estado()).falando.includes(id), ms));

let browser;
try {
  // ---------------------------------------------------------------- 1. dois jogadores, tom
  browser = await lancar(tom);
  const a = await abrir(browser, 'ALFA');
  const b = await abrir(browser, 'BRAVO');
  const ligados = await ate(async () => (await a.estado()).ligados === 1 && (await b.estado()).ligados === 1, 40000);
  conferir('dois navegadores se ligam por WebRTC (a sinalização passou pelo servidor, o áudio vai direto)', !!ligados, JSON.stringify([await a.estado(), await b.estado()]));
  const ea = await a.estado();
  const eb = await b.estado();
  conferir('o microfone falso foi aceito nos dois (estado "ativo")', ea.mic === 'ativo' && eb.mic === 'ativo', `${ea.mic}/${eb.mic}`);
  conferir('o áudio de ALFA chega a BRAVO (o analisador do outro lado vê a voz)', await falaDe(b, ea.id));
  conferir('o áudio de BRAVO chega a ALFA', await falaDe(a, eb.id));

  // ---------------------------------------------------------------- 2. o custo na rede com voz
  const e0 = await a.enviado();
  await dormir(4000);
  const e1 = await a.enviado();
  const pps = (e1.pacotes - e0.pacotes) / 4;
  const kbps = ((e1.bytes - e0.bytes) * 8) / 4000;
  medidas.falando = { pacotesPorSegundo: Math.round(pps), kbpsComCabecalhos: Math.round(kbps) };
  conferir('falando, a voz custa ~50 pacotes/s e cabe em ~40 kbps por colega (carga + cabeçalhos)', pps > 30 && kbps < 45, `${Math.round(pps)} pacotes/s, ${Math.round(kbps)} kbps`);

  // ---------------------------------------------------------------- 3. mudo (modo "sempre": a tecla alterna)
  await a.toque();
  conferir('mudo: ALFA aperta T e a faixa fecha', (await a.estado()).transmitindo === false);
  conferir('mudo: BRAVO deixa de ouvir ALFA', await calou(b, ea.id));
  await a.toque();
  conferir('abrir de novo: BRAVO volta a ouvir ALFA', await falaDe(b, ea.id));

  // ---------------------------------------------------------------- 4. áudio espacial: o volume cai com a distância
  await b.mundo({ x: 0, y: 0, z: 0, yaw: 0 }, { [ea.id]: { x: 5, y: 0, z: 0 } });
  await dormir(600);
  const perto = await b.pico(1500);
  await b.mundo(undefined, { [ea.id]: { x: 100, y: 0, z: 0 } });
  await dormir(600);
  const meio = await b.pico(1500);
  await b.mundo(undefined, { [ea.id]: { x: 200, y: 0, z: 0 } });
  await dormir(600);
  const longe = await b.pico(1500);
  medidas.espacial = { perto: +perto.toFixed(4), meio: +meio.toFixed(4), longe: +longe.toFixed(4) };
  conferir('espacial: a 5 m a voz sai no volume cheio', perto > 0.05, `RMS ${perto.toFixed(4)}`);
  conferir('espacial: a 100 m cai para ~40% (queda em linha reta entre 12 m e 160 m)', meio / perto > 0.25 && meio / perto < 0.6, `${(meio / perto).toFixed(2)} do volume de perto`);
  conferir('espacial: a 200 m (além do alcance) não se ouve', longe / perto < 0.05, `${(longe / perto).toFixed(3)} do volume de perto`);
  await b.mundo(undefined, { [ea.id]: { x: 5, y: 0, z: 0 } });

  // ---------------------------------------------------------------- 5. apertar para falar
  await b.page.evaluate(() => window.__voz.mudarModo('ptt'));
  conferir('ptt: com a tecla solta o microfone não transmite', (await b.estado()).transmitindo === false);
  conferir('ptt: ALFA deixa de ouvir BRAVO', await calou(a, eb.id));
  await b.tecla(true);
  conferir('ptt: segurando T, ALFA ouve BRAVO', await falaDe(a, eb.id));
  await b.tecla(false);
  conferir('ptt: soltando T, ALFA deixa de ouvir', await calou(a, eb.id));

  // ---------------------------------------------------------------- 6. quem sai some
  await a.page.close();
  const sumiu = await ate(async () => { const s = await b.estado(); return s.ligados === 0 && s.ouvindo === 0; }, 15000);
  conferir('quem fecha a aba some da voz dos outros (a ligação é desfeita)', !!sumiu, JSON.stringify(await b.estado()));
  await b.page.evaluate(() => window.__voz.mudarModo('sempre'));

  // ---------------------------------------------------------------- 7. microfone recusado: só ouve
  const c = await abrir(browser, 'CHARLIE', { mic: 'negar' });
  const bId = (await b.estado()).id;
  const ligouC = await ate(async () => (await b.estado()).ligados === 1 && (await c.estado()).ligados === 1, 40000);
  conferir('microfone recusado: ainda se liga (o navegador e a sala deixam entrar como ouvinte)', !!ligouC, JSON.stringify(await c.estado()));
  conferir('microfone recusado: o estado diz "negado"', (await c.estado()).mic === 'negado');
  conferir('microfone recusado: CHARLIE ouve BRAVO (a ligação sem faixa própria recebe)', await falaDe(c, bId));
  const cId = (await c.estado()).id;
  await dormir(2500);
  conferir('microfone recusado: BRAVO não ouve CHARLIE (ele não manda nada)', !(await b.estado()).falando.includes(cId));
  await c.page.close();
  await ate(async () => (await b.estado()).ligados === 0, 15000);

  // ---------------------------------------------------------------- 8. microfone que chega depois da ligação (replaceTrack, sem renegociar)
  const d = await abrir(browser, 'DELTA', { mic: 'tarde' });
  const ligouD = await ate(async () => (await b.estado()).ligados === 1 && (await d.estado()).ligados === 1, 40000);
  conferir('microfone tardio: a ligação nasce antes de ele existir (o microfone ainda está pedindo)', !!ligouD && (await d.estado()).mic === 'pedindo', JSON.stringify(await d.estado()));
  const dId = (await d.estado()).id;
  conferir('microfone tardio: DELTA já ouve BRAVO enquanto espera o microfone', await falaDe(d, bId));
  conferir('microfone tardio: quando o microfone chega, BRAVO ouve DELTA sem renegociar a ligação', await falaDe(b, dId, 25000));
  await d.page.close();
  await b.page.close();
  await browser.close();
  browser = null;

  // ---------------------------------------------------------------- 9. silêncio: o DTX
  browser = await lancar(silencio);
  // Aqui valem as restrições de verdade do jogo (eco, ruído e ganho automático ligados): o silêncio passa por elas igual.
  const s1 = await abrir(browser, 'SIL1', { sala: 'VOZ2', dsp: '1' });
  const s2 = await abrir(browser, 'SIL2', { sala: 'VOZ2', dsp: '1' });
  await ate(async () => (await s1.estado()).ligados === 1 && (await s2.estado()).ligados === 1, 40000);
  conferir('as restrições reais do microfone do jogo (eco, ruído e ganho automático) são aceitas pelo Chrome', (await s1.estado()).mic === 'ativo' && (await s2.estado()).mic === 'ativo', `${(await s1.estado()).mic}/${(await s2.estado()).mic}`);
  await dormir(2000);
  const q0 = await s1.enviado();
  await dormir(6000);
  const q1 = await s1.enviado();
  const ppsMudo = (q1.pacotes - q0.pacotes) / 6;
  const kbpsMudo = ((q1.bytes - q0.bytes) * 8) / 6000;
  medidas.silencio = { pacotesPorSegundo: +ppsMudo.toFixed(1), kbpsComCabecalhos: +kbpsMudo.toFixed(1) };
  conferir('silêncio: com o DTX o microfone aberto quase não manda pacote (sem DTX seriam ~50/s)', ppsMudo < 12, `${ppsMudo.toFixed(1)} pacotes/s, ${kbpsMudo.toFixed(1)} kbps`);
} finally {
  await browser?.close().catch(() => {});
  await vite.close();
  await jogo.close();
}

conferir('nenhum erro de página nas bancadas', erros.length === 0, erros.slice(0, 3).join(' | '));
const data = new Date().toLocaleDateString('sv'); // a data daqui (AAAA-MM-DD), não a UTC
const arquivo = resolve('.decepticons', 'medicoes', `voz-${data}.json`);
writeFileSync(arquivo, `${JSON.stringify({ data, medidas, verificacoes }, null, 2)}\n`);
const falhas = verificacoes.filter((v) => !v.ok);
console.log(`\n${verificacoes.length - falhas.length}/${verificacoes.length} verificações; medidas em ${arquivo}`);
process.exit(falhas.length ? 1 : 0);
