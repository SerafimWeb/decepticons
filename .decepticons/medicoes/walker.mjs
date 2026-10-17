/**
 * Bancada do DRAGA-01 (P178): fotografa o robô riggado do jogo (o mesmo .glb e a mesma marcha pura) de vistas-chave e em fases da marcha, ao lado do Vector-09 (a régua de escala), e mede
 * o que ele gasta (desenhos e triângulos). Mesmo molde de `praia.mjs`: Vite dev + Chrome headless (SwiftShader: só contagem, não tempo). G15: temporários em `.tmp/`.
 *
 *   node .decepticons/medicoes/walker.mjs --vistas lado,tres-quartos            # fotos em .tmp/fotos-walker/
 *   node .decepticons/medicoes/walker.mjs --arte --sufixo a1 --vistas lado      # .decepticons/arte/walker-<vista>-a1-claude.jpg
 *   node .decepticons/medicoes/walker.mjs --fases 0,0.2,0.4,0.6 --vistas lado   # uma foto por fase da marcha (-f0, -f20...)
 *   node .decepticons/medicoes/walker.mjs --colapso fl,rr --vistas tres-quartos # pernas caídas
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arte = args.includes('--arte');
const sufixo = args.includes('--sufixo') ? `-${args[args.indexOf('--sufixo') + 1]}` : '';
const colapso = args.includes('--colapso') ? args[args.indexOf('--colapso') + 1] : null;
const giro = args.includes('--giro') ? args[args.indexOf('--giro') + 1] : null;
const fases = args.includes('--fases') ? args[args.indexOf('--fases') + 1].split(',').map(Number) : [0];
const semEscala = args.includes('--sem-escala');
const vistasPedidas = args.includes('--vistas') ? new Set(args[args.indexOf('--vistas') + 1].split(',')) : null;

const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');

const saida = arte ? resolve('.decepticons', 'arte') : resolve('.tmp', 'fotos-walker');
mkdirSync(saida, { recursive: true });

/** O Draga fica na origem com a frente em -Z; o Vector-09 em (-26, -14). */
const VISTAS = {
  lado: { cam: '95,17,0', mira: '0,16,0', fov: 46 },
  'tres-quartos': { cam: '-62,28,-72', mira: '0,15,0', fov: 52 },
  frente: { cam: '0,15,-95', mira: '0,16,0', fov: 52 },
  tras: { cam: '30,24,80', mira: '0,18,0', fov: 56 },
  cima: { cam: '0,140,2', mira: '0,0,0', fov: 46 },
  pernas: { cam: '40,6,-30', mira: '-6,6,-2', fov: 62 },
  escala: { cam: '-40,4,-34', mira: '-14,12,-8', fov: 60 },
};

const server = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5196, strictPort: false, open: false } });
await server.listen();
const base = server.resolvedUrls.local[0];
const html = resolve('.decepticons', 'medicoes', 'walker-bancada.html').split(String.fromCharCode(92)).join('/');
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
    for (const fase of fases) {
      const url = `${base}@fs/${html}?cam=${v.cam}&mira=${v.mira}&fov=${v.fov}&fase=${fase}${colapso ? `&colapso=${colapso}` : ''}${giro ? `&giro=${giro}` : ''}${semEscala ? '&escala=0' : ''}`;
      await page.goto(url);
      await page.waitForFunction(() => window.__pronto || window.__erro, null, { timeout: 120_000 });
      const erro = await page.evaluate(() => window.__erro);
      if (erro) throw new Error(`vista ${nome}: ${erro}`);
      await page.waitForTimeout(300);
      const marca = fases.length > 1 ? `-f${Math.round(fase * 100)}` : '';
      const extra = colapso ? `-c${colapso.split(',').join('')}` : '';
      await page.screenshot({ path: join(saida, arte ? `walker-${nome}${sufixo}${marca}${extra}-claude.jpg` : `${nome}${marca}${extra}.jpg`), type: 'jpeg', quality: 86 });
      const info = await page.evaluate(() => window.__info);
      medidas[nome + marca + extra] = { desenhos: info.calls, triangulos: info.triangles, construcaoMs: info.construcaoMs };
      console.log(`${nome}${marca}${extra}: ${info.calls} desenhos, ${info.triangles} triângulos, carga+montagem ${info.construcaoMs} ms`);
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
const data = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const arquivo = resolve('.decepticons', 'medicoes', `walker-${data}.json`);
const anteriores = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')).vistas ?? {} : {};
writeFileSync(arquivo, JSON.stringify({ data, tela: '1280x720', render: 'SwiftShader (sem GPU: só contagem, não tempo)', vistas: { ...anteriores, ...medidas }, errosDePagina: [...erros] }, null, 2));
console.log(`erros de página: ${erros.size}`);
for (const e of erros) console.log('  ', e);
process.exitCode = erros.size ? 1 : 0;
