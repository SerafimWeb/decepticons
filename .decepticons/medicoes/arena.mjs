/**
 * Bancada da CIDADE NEON (P164, parte E): fotografa a Arena real de vistas-chave, com o transformador do Banco Vorcaris nos três estados e a cidade escurecendo com a energia, e mede o que
 * a cena gasta (desenhos e triângulos). Mesmo molde de `praia.mjs`: Vite dev + Chrome/Edge headless (SwiftShader: só contagem, não tempo). G15: temporários em `.tmp/`.
 *
 *   node .decepticons/medicoes/arena.mjs --vistas transformador,banco          # fotos em .tmp/fotos-arena/
 *   node .decepticons/medicoes/arena.mjs --arte --sufixo e1 --vistas banco      # .decepticons/arte/arena-<vista>-e1-claude.jpg
 *   node .decepticons/medicoes/arena.mjs --quadro "1:0.4:0.4" --vistas banco   # o transformador sabotado (estado:vida:energia)
 *   node .decepticons/medicoes/arena.mjs --quadro "2:0:0" --vistas banco       # apagado: a cidade no escuro
 *   node .decepticons/medicoes/arena.mjs --chefe "-5,-12" --vistas chefe       # o Colossus (com a máscara; --sem-mascara a tira)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arte = args.includes('--arte');
const sufixo = args.includes('--sufixo') ? `-${args[args.indexOf('--sufixo') + 1]}` : '';
const quadroPedido = args.includes('--quadro') ? args[args.indexOf('--quadro') + 1] : null;
const androidesPedidos = args.includes('--androides') ? args[args.indexOf('--androides') + 1] : null;
const chefePedido = args.includes('--chefe') ? args[args.indexOf('--chefe') + 1] : null;
const semMascara = args.includes('--sem-mascara');
const semTransformador = args.includes('--sem-transformador');
const vistasPedidas = args.includes('--vistas') ? new Set(args[args.indexOf('--vistas') + 1].split(',')) : null;

const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');

const saida = arte ? resolve('.decepticons', 'arte') : resolve('.tmp', 'fotos-arena');
mkdirSync(saida, { recursive: true });

/** As vistas-chave: de perto no transformador, o banco com o transformador ao lado, a cidade do meio da arena e de cima. */
const VISTAS = {
  geral: { cam: '0,110,70', mira: '0,0,-14', fov: 60 },
  transformador: { cam: '-13,2.4,-22', mira: '-13,2.4,-33', fov: 62 },
  banco: { cam: '-2,6,-8', mira: '-24,6,-31', fov: 68 },
  cidade: { cam: '4,9,34', mira: '-14,14,-40', fov: 72 },
  chefe: { cam: '8,6,-2', mira: '-8,6,-14', fov: 62 },
};

const server = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5198, strictPort: false, open: false } });
await server.listen();
const base = server.resolvedUrls.local[0];
const html = resolve('.decepticons', 'medicoes', 'arena-bancada.html').split(String.fromCharCode(92)).join('/');
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
    const url = `${base}@fs/${html}?cam=${v.cam}&mira=${v.mira}&fov=${v.fov}${quadroPedido ? `&quadro=${quadroPedido}` : ''}${androidesPedidos ? `&androides=${androidesPedidos}` : ''}${chefePedido ? `&chefe=${chefePedido}` : ''}${semMascara ? '&mascara=0' : ''}${semTransformador ? '&transformador=0' : ''}`;
    await page.goto(url);
    await page.waitForFunction(() => window.__pronto || window.__erro, null, { timeout: 120_000 });
    const erro = await page.evaluate(() => window.__erro);
    if (erro) throw new Error(`vista ${nome}: ${erro}`);
    await page.waitForTimeout(300);
    const estado = quadroPedido ? `-q${quadroPedido.split(':').join('_')}` : '';
    await page.screenshot({ path: join(saida, arte ? `arena-${nome}${sufixo}${estado}-claude.jpg` : `${nome}${estado}.jpg`), type: 'jpeg', quality: 86 });
    const info = await page.evaluate(() => window.__info);
    medidas[nome + estado] = { desenhos: info.calls, triangulos: info.triangles, construcaoMs: info.construcaoMs };
    console.log(`${nome}${estado}: ${info.calls} desenhos, ${info.triangles} triângulos, construção ${info.construcaoMs} ms`);
  }
} finally {
  await browser?.close();
  await server.close();
}
const data = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const arquivo = resolve('.decepticons', 'medicoes', `arena-${data}.json`);
// Uma rodada nova soma às medições do dia (não apaga as vistas que uma rodada anterior fotografou).
const anteriores = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')).vistas ?? {} : {};
writeFileSync(arquivo, JSON.stringify({ data, tela: '1280x720', render: 'SwiftShader (sem GPU: só contagem, não tempo)', vistas: { ...anteriores, ...medidas }, errosDePagina: [...erros] }, null, 2));
console.log(`erros de página: ${erros.size}`);
for (const e of erros) console.log('  ', e);
process.exitCode = erros.size ? 1 : 0;
