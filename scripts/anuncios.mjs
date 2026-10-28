/**
 * A MESA DE ANÚNCIOS (P266): renderiza os outdoors da marca (Olho do Pai, Serafim Web Software Bureau, a logo) e os grava em WebP, prontos para o jogo.
 *
 * A arte de cada anúncio é uma página HTML de 512×1024 (`scripts/anuncios/<id>.html`: CSS e SVG, com o texto de verdade em Chakra Petch/Barlow, as fontes OFL do projeto); o
 * Chrome do sistema a fotografa e o próprio Chrome a converte para WebP em `client/public/anuncios/<id>.webp`. **Por que não desenhar em canvas na hora do jogo:** o texto e o
 * brilho ficam muito melhores em CSS, o jogador não gasta CPU desenhando na abertura, e a mesma imagem serve a qualquer mapa (a Estação dos Cabos, depois) sem redesenhar.
 * O catálogo (quais anúncios existem, o texto, a URL) mora em `client/src/brand/anuncios.ts`; o teste `anuncios.test.ts` confere que cada um tem imagem e fonte aqui.
 *
 * **A logo:** o arquivo mestre (`vetorserafim.png`, 500×500 com transparência, a logo oficial da Serafim) mora em `scripts/anuncios/marca/` (fonte; não vai para o jogador). Os anúncios o
 * usam direto; o jogo só leva a textura do holograma, `client/public/brand/serafim-logo-holo.webp` (RGB sobre preto: a mistura aditiva só precisa da luz, e sem transparência pesa bem menos).
 *
 *   node scripts/anuncios.mjs                    # todos os anúncios (scripts/anuncios/*.html -> client/public/anuncios/*.webp) e a textura do holograma
 *   node scripts/anuncios.mjs --so odp-olho      # só um anúncio
 *   node scripts/anuncios.mjs --folha            # também uma folha de contato com todos, em .tmp/anuncios/folha.png (para olhar juntos)
 *   node scripts/anuncios.mjs --logo "D:/SERAFIMHUB/serafim13/vetorserafim.png"   # troca o arquivo mestre da logo (e refaz tudo)
 *
 * G15: os temporários vão para `.tmp/` (o PNG de cada anúncio fica em `.tmp/anuncios/` para conferência). Só lê o arquivo que você passar em `--logo`; nunca escreve fora do projeto.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const LARGURA = 512;
const ALTURA = 1024;
/** A qualidade do WebP dos anúncios: o fundo é escuro com brilho (degradê suave); abaixo de ~0,8 aparecem faixas. */
const QUALIDADE = Number(process.argv.includes('--q') ? process.argv[process.argv.indexOf('--q') + 1] : 0.72);
/** O teto de cada imagem (KB): são baixadas por todo jogador da fase; passou disso, simplifique a arte. */
const TETO_KB = 140;

const args = process.argv.slice(2);
const opt = (nome) => (args.includes(`--${nome}`) ? args[args.indexOf(`--${nome}`) + 1] : null);

const RAIZ = resolve('.');
const FONTES = resolve(RAIZ, 'scripts', 'anuncios');
const MESTRE = resolve(FONTES, 'marca', 'vetorserafim.png');
const SAIDA = resolve(RAIZ, 'client', 'public', 'anuncios');
const HOLOGRAMA = resolve(RAIZ, 'client', 'public', 'brand', 'serafim-logo-holo.webp');
const TMP = resolve(RAIZ, '.tmp', 'anuncios');
mkdirSync(TMP, { recursive: true });
mkdirSync(SAIDA, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP; // G15: o Chrome não grava no temp do sistema

const novaLogo = opt('logo');
if (novaLogo) {
  mkdirSync(dirname(MESTRE), { recursive: true });
  copyFileSync(resolve(novaLogo), MESTRE);
  console.log(`logo   mestre atualizada: ${MESTRE}`);
}

const { chromium } = await import('playwright-core');
let navegador = null;
for (const channel of ['chrome', 'msedge', undefined]) {
  try {
    navegador = await chromium.launch({ channel, args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--allow-file-access-from-files'] });
    break;
  } catch {
    /* tenta o próximo */
  }
}
if (!navegador) throw new Error('nenhum Chrome/Edge para renderizar os anúncios');

/** PNG (base64) -> WebP (base64), pelo próprio Chrome (não há biblioteca de imagem no projeto). `fundo`: cor opaca sob a imagem (sem ele, a transparência é mantida). */
async function paraWebp(pagina, pngBase64, qualidade, largura = null, altura = null, fundo = null) {
  return pagina.evaluate(
    async ([b64, q, w, h, bg]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w ?? img.naturalWidth;
      c.height = h ?? img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/webp', q));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    },
    [pngBase64, qualidade, largura, altura, fundo],
  );
}

const pagina = await navegador.newPage({ viewport: { width: LARGURA, height: ALTURA } });
const conversor = await navegador.newPage();
await conversor.setContent('<canvas></canvas>');
const so = opt('so');

// --- a textura do holograma: o arquivo mestre em RGB sobre preto, 512×512
if (existsSync(MESTRE) && !so) {
  const webp = Buffer.from(await paraWebp(conversor, readFileSync(MESTRE).toString('base64'), 0.85, 512, 512, '#000'), 'base64');
  writeFileSync(HOLOGRAMA, webp);
  console.log(`holo   serafim-logo-holo.webp  ${(webp.length / 1024).toFixed(1)} KB`);
}

// --- os anúncios
const ids = readdirSync(FONTES)
  .filter((f) => f.endsWith('.html') && !f.startsWith('_'))
  .map((f) => basename(f, '.html'))
  .filter((id) => !so || id === so);
if (!ids.length) throw new Error(so ? `não há scripts/anuncios/${so}.html` : 'não há anúncios em scripts/anuncios/');
const feitos = [];
for (const id of ids) {
  await pagina.goto(pathToFileURL(resolve(FONTES, `${id}.html`)).href);
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await pagina.waitForTimeout(150); // um respiro para o filtro de brilho assentar
  const png = await pagina.screenshot({ type: 'png', clip: { x: 0, y: 0, width: LARGURA, height: ALTURA } });
  writeFileSync(resolve(TMP, `${id}.png`), png);
  const webp = Buffer.from(await paraWebp(conversor, png.toString('base64'), QUALIDADE), 'base64');
  const destino = resolve(SAIDA, `${id}.webp`);
  writeFileSync(destino, webp);
  const kb = webp.length / 1024;
  console.log(`${kb > TETO_KB ? 'GRANDE' : 'ok    '} ${id}.webp  ${kb.toFixed(1)} KB`);
  if (kb > TETO_KB) process.exitCode = 1;
  feitos.push(id);
}

// A folha de contato: todos os anúncios lado a lado, para julgar o conjunto de uma olhada.
if (args.includes('--folha')) {
  const celulas = feitos.map((id) => `<figure><img src="data:image/png;base64,${readFileSync(resolve(TMP, `${id}.png`)).toString('base64')}"><figcaption>${id}</figcaption></figure>`).join('');
  const folha = await navegador.newPage({ viewport: { width: 2100, height: 760 } });
  await folha.setContent(`<body style="margin:0;background:#111;display:flex;flex-wrap:wrap;gap:10px;padding:10px;width:2080px;font:12px monospace;color:#8ab"><style>figure{margin:0}img{width:200px;height:400px;display:block}</style>${celulas}</body>`);
  await folha.waitForTimeout(500);
  await folha.screenshot({ path: resolve(TMP, 'folha.png'), fullPage: true });
  console.log(`folha  ${resolve(TMP, 'folha.png')}`);
}
await navegador.close();
