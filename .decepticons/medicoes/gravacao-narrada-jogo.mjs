import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';
import { acharFfmpeg } from '../../scripts/sonsRodar.mjs';
import { apontarJogoPara, gerarWav, guardarSessao, tokenDeConta } from './vozLib.mjs';

/**
 * A NARRAÇÃO NO JOGO DE VERDADE (P230): o jogo offline aberto no Chrome (microfone FALSO: um tom de 440 Hz), a tecla F10, o aparelho escolhido, a regra de idade e o arquivo baixado.
 * A outra bancada (`gravacao-narrada.mjs`) prova a mistura com o `GameRecorder` sozinho; esta prova a COLA no `Game.ts`, que teste unitário não alcança.
 *   1. convidado: F10 NÃO abre o microfone e diz por quê (maior de 18 anos); F9 grava só o jogo ("REC", sem narração)
 *   2. conta de adulto, jogo OFFLINE: F10 grava com a narração ("REC · NARRAÇÃO"); parar baixa o arquivo, e o tom da "voz" está nele (só nele: o arquivo do F9 do convidado não o tem)
 *
 *   node .decepticons/medicoes/gravacao-narrada-jogo.mjs     # sai com 1 se algo falhar; arquivos em .tmp/gravacao-narrada-jogo/
 *
 * Tira a foto `.decepticons/arte/narracao-f10-claude.png` (o indicador com a narração ligada). SwiftShader (sem GPU): o jogo roda devagar e o `MediaRecorder` pode terminar sem quadros de vídeo; se não houver arquivo, a bancada diz (a prova do indicador e da idade vale do mesmo jeito). G15: nada fora do projeto.
 */
const TMP = resolve('.tmp', 'gravacao-narrada-jogo');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const ffmpeg = acharFfmpeg();
const tom = gerarWav('tom-440.wav', 0.5, 6);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const verificacoes = [];
const conferir = (nome, ok, detalhe = '') => {
  verificacoes.push({ nome, ok, detalhe });
  console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
};

/** O nível (dB) em torno de `hz` no arquivo: três passa-faixas estreitos em cascata (um só deixa passar a ponta de outros tons). -91 dB é silêncio. */
function nivelNaFaixa(arquivo, hz) {
  if (!ffmpeg) return null;
  const faixa = `bandpass=f=${hz}:width_type=h:w=40`;
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', arquivo, '-vn', '-af', `${faixa},${faixa},${faixa},volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(r.stderr ?? '');
  return m ? Number(m[1]) : null;
}

const { startServer } = (await runnerImport(resolve('server/Server.ts'), { configFile: false, logLevel: 'warn' })).module;
const jogo = await startServer({ port: 2598, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 200, total: 400, msgs: 200, burst: 200 }, log: () => {} });
apontarJogoPara(2598);
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5198, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
let browser;
try {
  const flags = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${tom}`, '--autoplay-policy=no-user-gesture-required'];
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      browser = await chromium.launch({ channel, args: flags });
      break;
    } catch {
      // próximo
    }
  }
  if (!browser) throw new Error('nenhum navegador');

  /** Abre o jogo offline, entra na partida (o primeiro gesto liga o áudio) e devolve a página. */
  async function abrirJogo(token) {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
    await ctx.grantPermissions(['microphone'], { origin: new URL(base).origin });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    page.on('console', (m) => m.type() === 'warning' && m.text().includes('GameRecorder') && console.log('console:', m.text()));
    await page.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
    if (token) await guardarSessao(page, 2598, token);
    await page.goto(base);
    await page.waitForFunction(() => document.getElementById('cta')?.textContent?.includes('jogar'), null, { timeout: 300_000, polling: 500 }).catch(() => {});
    for (let i = 0; i < 4; i++) {
      await page.click('#cta').catch(() => {});
      await page.waitForTimeout(500);
    }
    return { page, ctx, erros };
  }
  const indicador = (page) =>
    page.evaluate(() => {
      const el = [...document.querySelectorAll('body > div')].find((d) => d.style.top === '12px' && d.textContent.includes('REC'));
      return el ? el.textContent : null;
    });
  const aviso = (page) =>
    page.evaluate(() => {
      const el = [...document.querySelectorAll('body > div')].find((d) => d.style.top === '48px' && d.textContent.includes('NARRAÇÃO'));
      return el ? el.textContent : null;
    });
  const ate = async (fn, ms) => {
    const t0 = Date.now();
    for (;;) {
      const v = await fn().catch(() => null);
      if (v) return v;
      if (Date.now() - t0 > ms) return null;
      await dormir(300);
    }
  };

  // ---------- 1. o convidado ----------
  console.log('\n--- convidado (sem conta) ---');
  const conv = await abrirJogo(null);
  await conv.page.keyboard.press('F10');
  const avisoConv = await ate(() => aviso(conv.page), 8000);
  conferir('convidado: F10 diz que o microfone só vale para maior de 18 anos', !!avisoConv && avisoConv.includes('maior de 18'), String(avisoConv));
  conferir('convidado: F10 não começou a gravar', (await indicador(conv.page)) === null);
  await conv.page.keyboard.press('F9');
  const indF9 = await ate(() => indicador(conv.page), 10_000);
  conferir('convidado: F9 grava só o jogo (REC, sem narração)', !!indF9 && !indF9.includes('NARRAÇÃO'), String(indF9));
  await conv.page.waitForTimeout(5000);
  const baixouConv = conv.page.waitForEvent('download', { timeout: 90_000 }).catch(() => null);
  await conv.page.keyboard.press('F9');
  const dConv = await baixouConv;
  let arquivoConv = null;
  if (dConv) {
    arquivoConv = resolve(TMP, 'f9-convidado.webm');
    await dConv.saveAs(arquivoConv);
  }
  conferir('convidado: F9 parou e o indicador sumiu', (await indicador(conv.page)) === null);
  await conv.ctx.close();

  // ---------- 2. a conta de adulto, jogo offline ----------
  console.log('\n--- conta de adulto, jogo offline ---');
  const ad = await abrirJogo(await tokenDeConta(2598, 'narrador'));
  // a sessão é restaurada pela rede depois do carregamento: enquanto o aviso de idade aparecer, espera e tenta de novo
  let ind = null;
  for (let tentativa = 0; tentativa < 12 && !ind; tentativa++) {
    await ad.page.keyboard.press('F10');
    ind = await ate(() => indicador(ad.page), 4000);
    if (!ind) await ad.page.waitForTimeout(2500);
  }
  conferir('adulto: F10 grava com a narração (REC · NARRAÇÃO), o microfone abriu', !!ind && ind.includes('NARRAÇÃO'), String(ind));
  await ad.page.waitForTimeout(6000);
  await ad.page.screenshot({ path: resolve('.decepticons', 'arte', 'narracao-f10-claude.png') }); // a foto para o Comandante julgar por olho (regra 16)
  const baixouAd = ad.page.waitForEvent('download', { timeout: 90_000 }).catch(() => null);
  await ad.page.keyboard.press('F10');
  const dAd = await baixouAd;
  conferir('adulto: F10 de novo parou e o indicador sumiu', (await indicador(ad.page)) === null);
  let arquivoAd = null;
  if (dAd) {
    arquivoAd = resolve(TMP, 'f10-adulto.webm');
    await dAd.saveAs(arquivoAd);
  }
  conferir('adulto: parar baixou o arquivo', !!arquivoAd, arquivoAd ? 'ok' : 'sem arquivo (SwiftShader pode terminar sem quadros)');
  if (arquivoAd && ffmpeg) {
    const voz = nivelNaFaixa(arquivoAd, 440);
    const controle = arquivoConv ? nivelNaFaixa(arquivoConv, 440) : null;
    console.log(`\nnível em 440 Hz (a voz de teste): narração do adulto ${voz} dB | F9 do convidado ${controle} dB`);
    conferir('adulto: a voz (440 Hz) está no arquivo da narração', voz !== null && voz > -50, `${voz} dB`);
    // O jogo tem som próprio perto de 440 Hz e ele varia de uma rodada para outra (-51 e -44 dB medidos), então o F9 não é silêncio aqui; a prova estrita de "sem voz = silêncio" é a de tons puros
    // (`gravacao-narrada.mjs`, -77 dB). Aqui a narração tem de somar bem mais que o jogo sozinho.
    if (controle !== null) conferir('a narração soma pelo menos 12 dB sobre o F9 (o jogo sozinho)', voz - controle >= 12, `${voz} dB contra ${controle} dB (${(voz - controle).toFixed(1)} dB de folga)`);
  }
  console.log(`\nerros de página: ${conv.erros.length + ad.erros.length}`);
  for (const e of [...conv.erros, ...ad.erros]) console.log('  ', e);
  conferir('nenhum erro de página', conv.erros.length + ad.erros.length === 0);
  await ad.ctx.close();
} finally {
  await browser?.close().catch(() => {});
  await vite.close();
  await jogo.close();
}
const falhas = verificacoes.filter((v) => !v.ok);
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : `\nTUDO CERTO: ${verificacoes.length} verificações`);
process.exitCode = falhas.length ? 1 : 0;
