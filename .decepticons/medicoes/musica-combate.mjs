import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * A MÚSICA DE COMBATE no navegador de verdade (P315, corte 1). Mede o som que a música manda para a saída (um analisador RMS na cadeia de
 * áudio), porque o gosto é do ouvido do Comandante; a bancada confere que a música existe, que sobe com o combate e que cala na pausa.
 *   - Partida na Cidade Neon: o primeiro clique começa a partida e a música toca (o colchão do pad, mesmo calmo).
 *   - Calmo: nível 0, e o som da música já é audível.
 *   - Um abate do jogador (o Game ouve o abate pelo mesmo caminho do combate): o nível vai a 2, e o som fica mais cheio que no calmo.
 *   - Pausa: a música cala.
 *
 *   node .decepticons/medicoes/musica-combate.mjs [chrome|msedge|brave]
 *
 * G15: temporários em `.tmp/`.
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
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const falhas = [];
const confere = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) falhas.push(texto);
};

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5205, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => erros.push(e.message));

/** O nível sonoro médio de `n` leituras espaçadas por `intervaloMs`. */
const mediaSonora = async (n, intervaloMs) => {
  let soma = 0;
  for (let i = 0; i < n; i++) {
    soma += await page.evaluate(() => window.__game.musica?.nivelSonoro() ?? 0);
    await dormir(intervaloMs);
  }
  return soma / n;
};

try {
  await page.goto(`${base}?mapa=arena&depurar`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 180_000 });
  // Cada voz que começa (o "Combate!" do narrador, o rádio) abaixa a música (P316): a bancada registra quando, para nunca medir o nível da música com uma voz por cima.
  await page.evaluate(() => {
    const audio = window.__game.audio;
    const original = audio.aoFalar;
    window.__vozes = [];
    audio.aoFalar = (d) => {
      window.__vozes.push({ t: performance.now(), d });
      original?.(d);
    };
  });
  await dormir(3000);
  // O primeiro clique começa a partida (e o áudio): a música entra depois, quando o contexto de áudio existe.
  for (let i = 0; i < 6; i++) {
    await page.click('#cta').catch(() => {});
    await dormir(500);
    if (await page.evaluate(() => !!window.__game.musica)) break;
  }
  await page.waitForFunction(() => !!window.__game.musica?.tocando, null, { timeout: 120_000 }).catch(() => {});
  confere(await page.evaluate(() => !!window.__game.musica?.tocando), 'a música de combate liga com a partida');
  await dormir(2500);
  // A abertura da rodada fala "Combate!" (o único clipe gravado do narrador): espera ela tocar e a música voltar, para o calmo e o combate serem medidos sem voz por cima.
  await page.waitForFunction(() => window.__vozes.length > 0, null, { timeout: 10_000 }).catch(() => {});
  const semVoz = () =>
    page.waitForFunction(() => {
      const ultima = window.__vozes[window.__vozes.length - 1];
      return !ultima || performance.now() > ultima.t + ultima.d * 1000 + 1500;
    }, null, { timeout: 15_000 });
  await semVoz();
  const vozesAntes = await page.evaluate(() => window.__vozes.length);
  console.log(`vozes antes das medidas: ${vozesAntes} (a música só é medida 1,5 s depois da última)`);

  // O compasso da música dura 2,2 s (108 BPM): uma janela de 8 leituras (~0,7 s de som) cai em pontos diferentes do padrão a cada rodada e o RMS oscila (o mesmo código deu 1,11× e 1,23× no
  // mesmo PC). A medida do calmo e do combate cobre dois compassos inteiros (30 leituras de 150 ms, ~4,5 s), para o RMS comparar o padrão inteiro com o padrão inteiro.
  const LEITURAS_DE_DOIS_COMPASSOS = 30;
  const calmo = await mediaSonora(LEITURAS_DE_DOIS_COMPASSOS, 150);
  confere((await page.evaluate(() => window.__game.musica.nivel)) === 0, 'no calmo, a música fica no nível 0 (só o colchão do pad)');
  confere(calmo > 0.001, `o colchão do pad é audível no calmo (RMS ${calmo.toFixed(4)})`);

  // Um abate do jogador: o caminho do combate (o Game ouve pelo mesmo callback) sobe a energia de uma vez.
  await page.evaluate(() => {
    const g = window.__game;
    g.match.onMechKilled(g.match.bots.mechs[0], g.mech.root.position, g.mech);
  });
  confere((await page.evaluate(() => window.__game.musica.nivel)) === 2, 'um abate do jogador leva a música ao nível 2 (o combate)');
  // Uma morte só segura o combate por ~3 s (energia 6, meia-vida de 4 s, limiar 3,5) e a medida tem ~5 s: mais duas mortes, pelo caminho público da música, seguram o nível 2 até o fim.
  await page.evaluate(() => { window.__game.musica.registrarAbate(); window.__game.musica.registrarAbate(); });
  await dormir(800);
  const combate = await mediaSonora(LEITURAS_DE_DOIS_COMPASSOS, 150);
  const vozesNoCombate = (await page.evaluate(() => window.__vozes.length)) - vozesAntes;
  console.log(`vozes durante a medida do combate: ${vozesNoCombate}`);
  confere((await page.evaluate(() => window.__game.musica.nivel)) === 2, 'o combate segurou o nível 2 até o fim da medida (a janela não atravessou uma descida de nível)');
  confere(combate > calmo * 1.3, `no combate, a música soa mais cheia que no calmo (RMS ${combate.toFixed(4)} contra ${calmo.toFixed(4)}; ${vozesNoCombate} voz por cima)`);

  // A mixagem (P316): toda voz que começa (narrador, rádio de campo) avisa o AudioSystem, e a música desce pelo tempo da fala e volta depois.
  confere(await page.evaluate(() => typeof window.__game.audio.aoFalar === 'function'), 'o AudioSystem avisa a música quando uma voz começa (aoFalar ligado pelo Game)');
  await page.evaluate(() => window.__game.audio.aoFalar(1.6));
  await dormir(450);
  const sobAVoz = await mediaSonora(5, 150);
  confere(sobAVoz < combate * 0.6, `sob a voz, a música desce (RMS ${sobAVoz.toFixed(4)} contra ${combate.toFixed(4)} no combate)`);
  await dormir(2600);
  const depoisDaVoz = await mediaSonora(6, 150);
  confere(depoisDaVoz > sobAVoz * 1.5, `depois da fala, a música volta (RMS ${depoisDaVoz.toFixed(4)} contra ${sobAVoz.toFixed(4)} sob a voz)`);

  // Pausa no MEIO de uma fala: a música cala e a volta que a fala tinha agendado não a traz de novo com o jogo parado.
  await page.evaluate(() => window.__game.audio.aoFalar(2.5));
  await dormir(200);
  await page.evaluate(() => window.__game.setPlaying(false));
  await dormir(3500);
  const pausado = await mediaSonora(3, 200);
  confere(!(await page.evaluate(() => window.__game.musica.tocando)) && pausado < calmo * 0.25, `na pausa (mesmo no meio de uma fala) a música cala e não volta (RMS ${pausado.toFixed(4)})`);
  confere(erros.length === 0, `sem erro de página${erros.length ? ` (${erros.join(' | ')})` : ''}`);
} catch (e) {
  falhas.push(`a bancada quebrou: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
  await vite.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);
