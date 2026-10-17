/**
 * Bancada da PRAIA DOS CABOS (P127): fotografa o mapa real de várias vistas-chave e mede o que a cena gasta em cada uma (desenhos e
 * triângulos), no render igual ao do jogo. Roda o Vite dev + o Chrome/Edge headless (SwiftShader: sem GPU de verdade, então NÃO
 * mede tempo de GPU — para p50/p95 numa GPU integrada, ver o método do `medicoes/BUNKER.md`). G15: perfil e temporários em `.tmp/`.
 *
 *   node .decepticons/medicoes/praia.mjs                 # fotos em .tmp/fotos-praia/ e o JSON em medicoes/
 *   node .decepticons/medicoes/praia.mjs --arte          # as fotos vão para .decepticons/arte/praia-<vista>-claude.jpg
 *   node .decepticons/medicoes/praia.mjs --arte --sufixo luz   # ... praia-<vista>-luz-claude.jpg (uma rodada nova sem trocar as fotos da anterior)
 *   node .decepticons/medicoes/praia.mjs --vistas orla,porto
 *   node .decepticons/medicoes/praia.mjs --dias 0,0.5,1 --vistas orla    # a hora do dia (P161): 0 = pôr do sol, 1 = noite; uma foto por hora (sufixo -d0, -d50, -d100)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arte = args.includes('--arte');
const sufixo = args.includes('--sufixo') ? `-${args[args.indexOf('--sufixo') + 1]}` : '';
const cabosPedidos = args.includes('--cabos') ? args[args.indexOf('--cabos') + 1] : null; // P162: estado:injecao:vida de cada cabo, ex.: 1:0.6:1,2:1:0.7,3:0:0
const portasPedidas = args.includes('--portas') ? args[args.indexOf('--portas') + 1] : null; // P163: estado:vida de cada porta, ex.: 1:0.5,2:0
const gentePedida = args.includes('--manifestantes') ? args[args.indexOf('--manifestantes') + 1] : null; // P163: x,z;x,z
const androidesPedidos = args.includes('--androides') ? args[args.indexOf('--androides') + 1] : null;
const desembarquePedido = args.includes('--desembarque'); // P164: abre as portas dos contêineres de desembarque
const quadroPedido = args.includes('--quadro') ? args[args.indexOf('--quadro') + 1] : null; // P164: estado:vida:energia do quadro de luz, ex.: 1:0.4:0.4
const chefePedido = args.includes('--chefe') ? args[args.indexOf('--chefe') + 1] : null; // P165: x,z do Colossus (com a máscara; `--sem-mascara` a tira)
const semMascara = args.includes('--sem-mascara');
const dias = args.includes('--dias') ? args[args.indexOf('--dias') + 1].split(',').map(Number) : [null];
const vistasPedidas = args.includes('--vistas') ? new Set(args[args.indexOf('--vistas') + 1].split(',')) : null;

const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');

const saida = arte ? resolve('.decepticons', 'arte') : resolve('.tmp', 'fotos-praia');
mkdirSync(saida, { recursive: true });

/** As vistas-chave: de cima, da beira d'água, do calçadão, da avenida, da ponte, do porto, da estação e da rua da cidade. */
const VISTAS = {
  geral: { cam: '0,150,-70', mira: '0,0,20', fov: 60 },
  cabos: { cam: '257,4.5,24', mira: '257,4,42', fov: 62 },
  cabecadochefe: { cam: '20,17.5,8', mira: '20,12.4,27', fov: 30 },
  chefe: { cam: '34,9,-12', mira: '20,6.5,27', fov: 62 },
  conteineres: { cam: '-221,3.6,-14', mira: '-244,2.2,-32', fov: 70 },
  quadro: { cam: '-300,2.6,12', mira: '-312,1.8,4', fov: 64 },
  portafrente: { cam: '288,3.2,36', mira: '288,2.2,50', fov: 64 },
  portafundos: { cam: '288,3.2,93', mira: '288,2.2,78', fov: 64 },
  manifestantes: { cam: '181,1.9,14', mira: '188,1.2,27', fov: 60 },
  cabosdalinha: { cam: '257,6,2', mira: '257,2,40', fov: 66 },
  sol: { cam: '0,8,-20', mira: '-46,9,-106', fov: 70 },
  mar: { cam: '20,12,-100', mira: '40,6,0', fov: 70 },
  praia: { cam: '-30,5.5,-24', mira: '90,6,-14', fov: 70 },
  orla: { cam: '40,7,8', mira: '140,8,16', fov: 72 },
  avenida: { cam: '-60,8,27', mira: '60,10,27', fov: 72 },
  ponte: { cam: '-50,6,-14', mira: '-70,4,-60', fov: 70 },
  porto: { cam: '-215,9,-6', mira: '-290,12,-50', fov: 72 },
  estacao: { cam: '236,8,-12', mira: '280,10,50', fov: 70 },
  pateo: { cam: '256,7,10', mira: '288,9,60', fov: 70 },
  rua: { cam: '20,6,44', mira: '20,8,110', fov: 70 },
  barraca: { cam: '40,4.5,-30', mira: '46,3,-13', fov: 62 },
  portao: { cam: '200,8,27', mira: '250,8,30', fov: 70 },
  cais: { cam: '-225,9,-20', mira: '-272,4,-40', fov: 70 },
  hatch: { cam: '262,8.5,-2', mira: '282,9,50', fov: 66 },
  sombra: { cam: '120,4,-26', mira: '-60,6,-10', fov: 72 },
  pierfim: { cam: '-72,8,-70', mira: '-70,4,-104', fov: 66 },
  zona: { cam: '34,6,-4', mira: '20,0,11', fov: 72 },
  zonapatio: { cam: '240,13,6', mira: '252,0,30', fov: 66 },
  gente: { cam: '-30,2.4,9.4', mira: '60,1.6,11', fov: 62 },
  banhistas: { cam: '0,2.6,-24', mira: '0,0,-42', fov: 66 },
  pipas: { cam: '-70,2,-18', mira: '-60,40,-38', fov: 62 },
};

const server = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5199, strictPort: false, open: false } });
await server.listen();
const base = server.resolvedUrls.local[0];
const html = resolve('.decepticons', 'medicoes', 'praia-bancada.html').split(String.fromCharCode(92)).join('/');
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
    for (const dia of dias) {
    await page.goto(`${base}@fs/${html}?cam=${v.cam}&mira=${v.mira}&fov=${v.fov}&t=3${dia === null ? '' : `&dia=${dia}`}${cabosPedidos ? `&cabos=${cabosPedidos}` : ''}${portasPedidas ? `&portas=${portasPedidas}` : ''}${gentePedida ? `&manifestantes=${gentePedida}` : ''}${androidesPedidos ? `&androides=${androidesPedidos}` : ''}${desembarquePedido ? '&desembarque=1' : ''}${chefePedido ? `&chefe=${chefePedido}` : ''}${semMascara ? '&mascara=0' : ''}${quadroPedido ? `&quadro=${quadroPedido}` : ''}`);
    await page.waitForFunction(() => window.__pronto || window.__erro, null, { timeout: 120_000 });
    const erro = await page.evaluate(() => window.__erro);
    if (erro) throw new Error(`vista ${nome}: ${erro}`);
    await page.waitForTimeout(300);
    const hora = dia === null ? '' : `-d${Math.round(dia * 100)}`;
    await page.screenshot({ path: join(saida, arte ? `praia-${nome}${sufixo}${hora}-claude.jpg` : `${nome}${hora}.jpg`), type: 'jpeg', quality: 86 });
    const info = await page.evaluate(() => window.__info);
    medidas[nome + hora] = { desenhos: info.calls, triangulos: info.triangles, construcaoMs: info.construcaoMs };
    console.log(`${nome}${hora}: ${info.calls} desenhos, ${info.triangles} triângulos, construção ${info.construcaoMs} ms`);
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
// A data local (a do Comandante), não a UTC: à noite a UTC já virou o dia.
const data = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
writeFileSync(resolve('.decepticons', 'medicoes', `praia-${data}.json`), JSON.stringify({ data, tela: '1280x720', render: 'SwiftShader (sem GPU: só contagem, não tempo)', vistas: medidas, errosDePagina: [...erros] }, null, 2));
console.log(`erros de página: ${erros.size}`);
for (const e of erros) console.log('  ', e);
process.exitCode = erros.size ? 1 : 0;
