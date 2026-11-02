import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * O CLIPE dos últimos 10 s no navegador de verdade (P309, a ordem "o clipe"). Liga com L, deixa a partida correr 14 s, salva com K e confere:
 *   - o arquivo baixado é um vídeo de verdade (WebM ou MP4), com 5 a 10 s de duração e 540 × 960 (9:16);
 *   - o CONTEÚDO não é preto: um quadro decodificado do próprio arquivo tem brilho médio, e esse quadro vira a foto para o dono (regra 16);
 *   - o robô do jogador cai dentro do recorte vertical (o enquadramento segue a ação);
 *   - a tela avisa "CLIPE LIGADO", depois "CLIPE SALVO", e o indicador volta.
 * A taxa de quadros é só informativa: o SwiftShader roda sem GPU (1 a 2 quadros por segundo), então não mede o custo real (o dono mede na GPU dele).
 * G15: temporários em `.tmp/`.
 *
 *   node .decepticons/medicoes/clipe-10s.mjs [chrome|msedge|brave]
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
const falhas = [];
const confere = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) falhas.push(texto);
};

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5201, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));

const medirFps = () =>
  page.evaluate(
    () =>
      new Promise((ok) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
          else ok(n / ((performance.now() - t0) / 1000));
        };
        requestAnimationFrame(tick);
      }),
  );

try {
  await page.goto(`${base}?mapa=arena&depurar`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 180_000 });
  await dormir(5000);
  for (let i = 0; i < 8; i++) {
    await page.click('#cta').catch(() => {});
    await dormir(400);
    if (await page.evaluate(() => !!document.pointerLockElement)) break;
  }
  await dormir(4000);

  const fpsDesligado = await medirFps();
  confere((await page.evaluate(() => window.__game.clips)) === null, 'antes da tecla L o clipe não está carregado (fora do pacote de partida)');
  await page.keyboard.press('KeyL');
  // O módulo do clipe carrega na primeira tecla (sob demanda): espera o aviso, não um tempo fixo.
  await page
    .waitForFunction(() => (document.getElementById('clip-aviso')?.textContent ?? '').includes('CLIPE LIGADO'), null, { timeout: 60_000 })
    .catch(() => {});
  const aviso1 = await page.evaluate(() => document.getElementById('clip-aviso')?.textContent ?? '');
  confere(aviso1.includes('CLIPE LIGADO'), `a tecla L liga o clipe e a tela avisa (aviso: "${aviso1}")`);
  confere(await page.evaluate(() => window.__game.clips.ligado), 'o buffer está ligado');

  // Deixa a partida correr 14 s: o buffer tem gravações de 5 a 10 s para salvar.
  await dormir(14000);
  const fpsLigado = await medirFps();
  console.log(
    `  quadros por segundo (só informativo: SwiftShader sem GPU): ${fpsDesligado.toFixed(1)} com o clipe desligado, ${fpsLigado.toFixed(1)} ligado`,
  );

  // O robô do jogador tem de cair dentro do recorte vertical (o enquadramento segue a ação).
  const enquadramento = await page.evaluate(() => {
    const g = window.__game;
    const v = g.mech.root.position.clone().project(g.camera);
    const largura = g.renderer.domElement.width;
    const r = g.clips.recorteAtual;
    return { x: ((v.x + 1) / 2) * largura, sx: r?.sx ?? null, sw: r?.sw ?? null };
  });
  confere(
    enquadramento.sx !== null && enquadramento.x >= enquadramento.sx && enquadramento.x <= enquadramento.sx + enquadramento.sw,
    `o robô cai dentro do recorte vertical (robô em x=${enquadramento.x?.toFixed(0)} px; recorte de ${enquadramento.sx} a ${(enquadramento.sx ?? 0) + (enquadramento.sw ?? 0)})`,
  );

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.keyboard.press('KeyK'),
  ]);
  // O aviso de "salvo" é lido logo depois do download (ele fica 2,4 s; depois volta o indicador de ligado).
  const aviso2 = await page.evaluate(() => document.getElementById('clip-aviso')?.textContent ?? '');
  confere(aviso2.includes('CLIPE SALVO'), `a tecla K salva e a tela avisa (aviso: "${aviso2}")`);

  const caminho = resolve(TMP, 'clipe.webm');
  await download.saveAs(caminho);
  const bytes = readFileSync(caminho);
  const nome = download.suggestedFilename();
  confere(/^cybermech-clipe-\d{8}-\d{6}\.(webm|mp4)$/.test(nome), `o arquivo sai com nome de clipe (${nome})`);
  confere(bytes.length > 20_000, `o arquivo tem conteúdo de vídeo (${(bytes.length / 1024).toFixed(0)} KB)`);
  const webm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  const mp4 = bytes.slice(4, 8).toString('latin1') === 'ftyp';
  confere(webm || mp4, 'o arquivo é um vídeo de verdade (cabeçalho WebM ou MP4)');

  // Duração, proporção e CONTEÚDO, lidos pelo próprio navegador a partir do arquivo salvo: um quadro do meio do clipe.
  const info = await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bin], { type: 'video/webm' }));
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = url;
    await new Promise((ok, no) => {
      v.onloadedmetadata = ok;
      v.onerror = () => no(new Error('o navegador não abriu o vídeo'));
    });
    let duracao = v.duration;
    if (!Number.isFinite(duracao)) {
      v.currentTime = 1e9;
      await new Promise((ok) => {
        v.ontimeupdate = ok;
      });
      v.currentTime = 0;
      duracao = v.duration;
    }
    const alvo = Math.max(0, Math.min(duracao / 2, duracao - 0.2));
    await new Promise((ok) => {
      v.onseeked = ok;
      v.currentTime = alvo;
    });
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const cx = c.getContext('2d');
    cx.drawImage(v, 0, 0);
    const d = cx.getImageData(0, 0, c.width, c.height).data;
    let soma = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      soma += d[i] + d[i + 1] + d[i + 2];
      n += 3;
    }
    return { largura: v.videoWidth, altura: v.videoHeight, duracao, brilho: soma / n, jpg: c.toDataURL('image/jpeg', 0.85) };
  }, bytes.toString('base64')).catch((e) => ({ erro: e.message }));
  if (info.erro) {
    confere(false, `o navegador abre o vídeo (${info.erro})`);
  } else {
    confere(info.largura === 540 && info.altura === 960, `o vídeo sai em 9:16 (${info.largura} × ${info.altura})`);
    confere(info.duracao >= 4.5 && info.duracao <= 10.5, `a duração é de 5 a 10 s (${info.duracao.toFixed(1)} s)`);
    confere(info.brilho > 8, `o conteúdo do clipe não é preto (brilho médio ${info.brilho.toFixed(0)} de 255)`);
    writeFileSync(resolve(saida, 'clipe-recorte-vertical-claude.jpg'), Buffer.from(info.jpg.split(',')[1], 'base64'));
  }

  await dormir(3000);
  const aviso3 = await page.evaluate(() => document.getElementById('clip-aviso')?.textContent ?? '');
  confere(aviso3.includes('CLIPE LIGADO'), 'depois de salvar, o indicador de ligado volta (o buffer continua)');

  await page.keyboard.press('KeyL');
  await dormir(500);
  confere(!(await page.evaluate(() => window.__game.clips.ligado)), 'a tecla L desliga o clipe');
  for (const e of erros) console.log(`  erro de página: ${e}`);
} catch (e) {
  falhas.push(`a bancada quebrou: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
  await vite.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);
