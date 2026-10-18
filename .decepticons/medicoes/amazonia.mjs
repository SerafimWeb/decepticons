/**
 * Bancada da AMAZÔNIA (P180, parte B): fotografa o mapa real (o mesmo código e o mesmo pipeline do jogo) de vistas-chave, com a **frente do rio** onde se pedir (a montante limpo, a jusante morto),
 * e mede o que a cena gasta (desenhos e triângulos). Mesmo molde de `praia.mjs`: Vite dev + Chrome/Edge headless (SwiftShader: só contagem, não tempo). G15: temporários em `.tmp/`.
 *
 *   node .decepticons/medicoes/amazonia.mjs --vistas geral,aldeia          # fotos em .tmp/fotos-amazonia/
 *   node .decepticons/medicoes/amazonia.mjs --arte --sufixo b1 --vistas geral   # .decepticons/arte/amazonia-<vista>-b1-claude.jpg
 *   node .decepticons/medicoes/amazonia.mjs --frente 1000 --vistas rio     # a frente em x = 1000 (o rio curado até lá)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arte = args.includes('--arte');
const sufixo = args.includes('--sufixo') ? `-${args[args.indexOf('--sufixo') + 1]}` : '';
const frente = args.includes('--frente') ? args[args.indexOf('--frente') + 1] : null;
const semDraga = args.includes('--sem-draga');
const vistasPedidas = args.includes('--vistas') ? new Set(args[args.indexOf('--vistas') + 1].split(',')) : null;

const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');

const saida = arte ? resolve('.decepticons', 'arte') : resolve('.tmp', 'fotos-amazonia');
mkdirSync(saida, { recursive: true });

/** As vistas-chave: o mapa de cima, a aldeia, o rio descendo, o Draga, a cava, a planta e a lagoa. */
const VISTAS = {
  geral: { cam: '-100,1500,1000', mira: '0,0,0', fov: 60, semNevoa: true },
  aldeia: { cam: '-960,14,-185', mira: '-830,8,-40', fov: 62 },
  rio: { cam: '120,45,-130', mira: '700,15,25', fov: 58 },
  draga: { cam: '430,24,32', mira: '700,16,25', fov: 58, escala: true }, // sobre a água, rio abaixo: o limpo à esquerda, o morto à direita, o Draga na frente
  montante: { cam: '-300,35,-160', mira: '300,10,10', fov: 62 },
  jusante: { cam: '900,40,-200', mira: '1150,5,-50', fov: 62 },
  mina: { cam: '120,70,70', mira: '330,-10,270', fov: 66 },
  planta: { cam: '-120,25,100', mira: '20,3,190', fov: 62 },
  lagoa: { cam: '600,40,120', mira: '700,-3,250', fov: 62 },
  // Os geradores do escudo do Draga (parte D): o da cerca de perto (com um Mech ao lado para dar a escala) e os três da planta ao longe.
  gerador: { cam: '-100,13,118', mira: '-100,7,143', fov: 58, geradores: true, escala: true, semDraga: true },
  geradores: { cam: '-40,60,60', mira: '80,8,140', fov: 62, geradores: true, semDraga: true },
  // A força de defesa e as torres armadas (parte D2): a cerca com os Mechs e androides nos postos, vista da margem sul.
  // A escotilha aberta do Draga com a carga a 45% e a Resistência junto do casco (parte E).
  escotilha: { cam: '672,9,-14', mira: '700,6,14', fov: 66, escotilha: true },
  guarda: { cam: '-62,9,118', mira: '-100,8,155', fov: 70, geradores: true, guarda: true, semDraga: true },
};

const server = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5194, strictPort: false, open: false } });
await server.listen();
const base = server.resolvedUrls.local[0];
const html = resolve('.decepticons', 'medicoes', 'amazonia-bancada.html').split(String.fromCharCode(92)).join('/');
let browser;
const medidas = {};
const erros = new Set();
try {
  const flags = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      browser = await chromium.launch({ channel, args: flags });
      break;
    } catch {
      // tenta o próximo
    }
  }
  if (!browser) throw new Error('nenhum browser encontrado');
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => erros.add(String(e.message)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.add(m.text().slice(0, 1200));
  });
  for (const [nome, v] of Object.entries(VISTAS)) {
    if (vistasPedidas && !vistasPedidas.has(nome)) continue;
    const url = `${base}@fs/${html}?cam=${v.cam}&mira=${v.mira}&fov=${v.fov}${frente ? `&frente=${frente}` : ''}${semDraga ? '&draga=0' : ''}${v.semNevoa ? '&semnevoa=1' : ''}${v.escala ? '&escala=1' : ''}${v.geradores ? '&geradores=1' : ''}${v.guarda ? '&guarda=1' : ''}${v.escotilha ? '&escotilha=1' : ''}${v.semDraga ? '&draga=0' : ''}`;
    await page.goto(url);
    await page.waitForFunction(() => window.__pronto || window.__erro, null, { timeout: 180_000 });
    const erro = await page.evaluate(() => window.__erro);
    if (erro) throw new Error(`vista ${nome}: ${erro}`);
    await page.waitForTimeout(300);
    const marca = frente ? `-f${frente}` : '';
    await page.screenshot({ path: join(saida, arte ? `amazonia-${nome}${sufixo}${marca}-claude.jpg` : `${nome}${marca}.jpg`), type: 'jpeg', quality: 86 });
    const info = await page.evaluate(() => window.__info);
    medidas[nome + marca] = { desenhos: info.calls, triangulos: info.triangles, construcaoMs: info.construcaoMs };
    console.log(`${nome}${marca}: ${info.calls} desenhos, ${info.triangles} triângulos, montagem ${info.construcaoMs} ms`);
  }
} finally {
  await browser?.close();
  await server.close();
}
const data = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const arquivo = resolve('.decepticons', 'medicoes', `amazonia-${data}.json`);
const anteriores = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')).vistas ?? {} : {};
writeFileSync(arquivo, JSON.stringify({ data, tela: '1280x720', render: 'SwiftShader (sem GPU: só contagem, não tempo)', vistas: { ...anteriores, ...medidas }, errosDePagina: [...erros] }, null, 2));
console.log(`erros de página: ${erros.size}`);
for (const e of erros) console.log('  ', e);
process.exitCode = erros.size ? 1 : 0;
