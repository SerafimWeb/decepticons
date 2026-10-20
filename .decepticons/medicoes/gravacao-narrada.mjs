import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { acharFfmpeg } from '../../scripts/sonsRodar.mjs';

/**
 * A NARRAÇÃO NO CHROME DE VERDADE (P230): o `GameRecorder` do jogo grava um canvas animado com dois tons conhecidos (o "jogo", 300 Hz, e a "voz", 1000 Hz) e o ffmpeg mede o ARQUIVO baixado.
 * Duas rodadas: com a voz (F10) e sem (F9, o controle). Prova: o arquivo tem vídeo e áudio; **a voz só está no arquivo da narração**; o jogo está nos dois; **a voz nunca chega à saída do jogo**
 * (o alto-falante); e o microfone é solto ao parar. O microfone aqui é um fluxo de teste (o que se prova é a MISTURA e a SOLTURA, não o hardware: o hardware real é o `mic-real.mjs`).
 *
 *   node .decepticons/medicoes/gravacao-narrada.mjs     # sai com 1 se algo falhar; arquivos em .tmp/gravacao-narrada/
 *
 * G15: nada fora do projeto.
 */
const TMP = resolve('.tmp', 'gravacao-narrada');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const ffmpeg = acharFfmpeg();
if (!ffmpeg) throw new Error('ffmpeg não encontrado (a bancada mede o arquivo com ele)');

const verificacoes = [];
const conferir = (nome, ok, detalhe = '') => {
  verificacoes.push({ nome, ok, detalhe });
  console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
};

/**
 * O volume (dB) do que há perto de `hz` no arquivo: três passa-faixas estreitos em cascata + volumedetect. -91 dB é o silêncio. Um filtro só é frouxo: o tom de 300 Hz do jogo vazava para a faixa de
 * 1000 Hz (-45 dB no arquivo sem voz, que parecia voz); em cascata o mesmo arquivo mede -85 dB.
 */
function nivelNaFaixa(arquivo, hz) {
  const faixa = `bandpass=f=${hz}:width_type=h:w=60`;
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', arquivo, '-vn', '-af', `${faixa},${faixa},${faixa},volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(r.stderr ?? '');
  return m ? Number(m[1]) : -Infinity;
}
function fluxos(arquivo) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', arquivo], { encoding: 'utf8' });
  const t = r.stderr ?? '';
  return { video: /Stream #.*Video:/.test(t), audio: /Stream #.*Audio:/.test(t) };
}

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5197, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const PAGINA = resolve('.decepticons', 'medicoes', 'gravacao-narrada.html').split(String.fromCharCode(92)).join('/');
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });

  async function rodada(comVoz, segundos, efeito = 'normal') {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('erro de página:', e.message));
    page.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && !m.text().includes('Failed to load resource') && console.log('console:', m.text()));
    await page.goto(`${base}@fs/${PAGINA}`);
    await page.waitForFunction(() => typeof window.__gravar === 'function', null, { timeout: 180_000 });
    const baixou = page.waitForEvent('download', { timeout: 60_000 });
    const resultado = await page.evaluate(([v, s, e]) => window.__gravar(v, s, e), [comVoz, segundos, efeito]);
    const download = await baixou;
    const arquivo = resolve(TMP, comVoz ? (efeito === 'normal' ? 'narracao.webm' : `narracao-${efeito}.webm`) : 'controle.webm');
    await download.saveAs(arquivo);
    await ctx.close();
    return { resultado, arquivo };
  }

  const SEG = 4;
  const com = await rodada(true, SEG);
  const sem = await rodada(false, SEG);
  const fx = await rodada(true, SEG, 'sombrio'); // com o efeito: o tom de 1000 Hz da "voz" deve sair do arquivo em ~744 Hz (5 semitons abaixo)
  console.log('\nnarração :', JSON.stringify(com.resultado));
  console.log('controle :', JSON.stringify(sem.resultado));

  const f = fluxos(com.arquivo);
  conferir('o arquivo da narração tem vídeo e áudio', f.video && f.audio, `${Math.round(statSync(com.arquivo).size / 1024)} KB`);
  const vozCom = nivelNaFaixa(com.arquivo, 1000);
  const jogoCom = nivelNaFaixa(com.arquivo, 300);
  const vozSem = nivelNaFaixa(sem.arquivo, 1000);
  const jogoSem = nivelNaFaixa(sem.arquivo, 300);
  console.log(`\nnível em 1000 Hz (a voz): narração ${vozCom} dB | controle ${vozSem} dB`);
  console.log(`nível em  300 Hz (o jogo): narração ${jogoCom} dB | controle ${jogoSem} dB\n`);
  conferir('a voz ESTÁ no arquivo da narração', vozCom > -45, `${vozCom} dB em 1000 Hz`);
  conferir('a voz NÃO está no arquivo sem narração (F9)', vozSem < -60, `${vozSem} dB em 1000 Hz`);
  conferir('o som do jogo está nos dois arquivos', jogoCom > -45 && jogoSem > -45, `${jogoCom} dB / ${jogoSem} dB em 300 Hz`);
  conferir('a voz é mais alta que o chiado do arquivo sem narração em pelo menos 30 dB', vozCom - vozSem > 30, `${(vozCom - vozSem).toFixed(1)} dB de diferença`);
  conferir('a voz NUNCA chegou à saída do jogo (o alto-falante)', com.resultado.vozNaSaidaDb < -90, `${com.resultado.vozNaSaidaDb.toFixed(1)} dB em 1000 Hz na saída`);
  conferir('o jogo chegou à saída (a medida funciona)', com.resultado.jogoNaSaidaDb > -60, `${com.resultado.jogoNaSaidaDb.toFixed(1)} dB em 300 Hz na saída`);
  conferir('a gravação começou e o arquivo foi baixado', com.resultado.gravando === true && sem.resultado.gravando === true && com.resultado.baixou && sem.resultado.baixou);
  conferir('parar soltou o microfone (a faixa terminou)', com.resultado.faixaDoMic === 'ended', String(com.resultado.faixaDoMic));
  // ---- o efeito de voz (P231), pela gravação de verdade ----
  const vozFx1000 = nivelNaFaixa(fx.arquivo, 1000);
  const vozFx744 = nivelNaFaixa(fx.arquivo, 1000 * 2 ** (-5 / 12));
  const jogoFx = nivelNaFaixa(fx.arquivo, 300);
  console.log(`\ncom o efeito sombrio: 1000 Hz ${vozFx1000} dB | 744 Hz ${vozFx744} dB | jogo (300 Hz) ${jogoFx} dB`);
  conferir('com o efeito, a voz sai do arquivo no tom mais grave (744 Hz de 1000 Hz)', vozFx744 > -45, `${vozFx744} dB em 744 Hz`);
  conferir('com o efeito, o tom original (1000 Hz) praticamente some do arquivo (pelo menos 20 dB abaixo do tom novo)', vozFx744 - vozFx1000 >= 20, `${(vozFx744 - vozFx1000).toFixed(1)} dB de diferença`);
  conferir('o efeito não mexe no som do jogo (300 Hz continua no arquivo, até 3 dB do normal)', Math.abs(jogoFx - jogoCom) <= 3, `${jogoFx} dB contra ${jogoCom} dB`);
  conferir('o efeito foi desligado ao parar e o microfone foi solto', fx.resultado.faixaDoMic === 'ended' && fx.resultado.baixou, String(fx.resultado.faixaDoMic));
  conferir('o vídeo tem quadros', f.video && com.resultado.quadros > SEG * 10, `${com.resultado.quadros} quadros desenhados`);
} finally {
  await browser?.close().catch(() => {});
  await vite.close();
}
const falhas = verificacoes.filter((v) => !v.ok);
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : `\nTUDO CERTO: ${verificacoes.length} verificações`);
process.exitCode = falhas.length ? 1 : 0;
