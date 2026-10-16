/**
 * Varre o mapa da praia numa GPU REAL contando os pixels NÃO FINITOS (NaN ou infinito) do buffer HDR da cena (P130/P136, 15/10).
 *
 * Por que existe: um NaN num pixel só, nascido de um shader (um `pow` de base negativa numa borda de triângulo com MSAA), é espalhado pelo bloom
 * e a tela vira um retângulo preto. O SwiftShader (a bancada `praia.mjs`, o smoke, o CI) **não vê isso**: só a GPU de verdade. Foi achado aqui
 * (a cortina das zonas: 197 de 216 poses com NaN antes da correção, 0 depois). **Rode depois de mexer em shader de efeito (halo, cortina, névoa,
 * água, céu, janela).** Sai com código 1 se achar algum pixel não finito.
 *
 *   npm run build && node .decepticons/medicoes/varrer-nan.mjs                  # o mapa da praia, 10 posições
 *   node .decepticons/medicoes/varrer-nan.mjs --w 1549 --h 925 --q alta           # o tamanho da janela e a qualidade
 *   node .decepticons/medicoes/varrer-nan.mjs --posicoes 0,20;-200,10;250,20      # x,z de cada ponto (separados por ;)
 *   node .decepticons/medicoes/varrer-nan.mjs --efeitos                           # com os efeitos de arma acesos em volta (P160: explosão, fumaça,
 *                                                                                  # fitas, marcas, cartazes, feixes) a cada 6 poses
 *
 * Como: serve o `dist/`, abre `?mapa=praia&depurar` (o `main.ts` expõe `window.__game` só com esse parâmetro), desliga o bloom (para ver o
 * NaN na cena e não já espalhado), teletransporta o Mech e gira a câmera (yaw × pitch), e lê o buffer pelo `readRenderTargetPixels`.
 * G15: tudo em `.tmp/`. A máquina tem a GPU integrada AMD (Vega 11): o Chrome precisa de `--use-angle=d3d11` (não é o SwiftShader do smoke).
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const largura = Number(opt('w', '1549'));
const altura = Number(opt('h', '925'));
const qualidade = opt('q', 'alta');
const guinadas = Number(opt('yaws', '24'));
const comBloom = args.includes('--bloom'); // mede com o bloom ligado: prova a rede de segurança (sem ela, um NaN toma a tela inteira)
const comEfeitos = args.includes('--efeitos'); // acende os efeitos de arma em volta do Mech (P160): os shaders novos só entram na conta se estiverem na tela
const build = opt('build', 'v1.marauder.blaster-0.blaster-0.seeker-0');
const posicoes = opt('posicoes', '295,10;240,-20;150,15;60,-10;20,20;0,-5;-80,10;-160,-15;-240,15;-300,0')
  .split(';')
  .map((p) => p.split(',').map(Number));

const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
if (!existsSync('dist/index.html')) throw new Error('rode `npm run build` antes: esta bancada serve o dist/');
const { chromium } = await import('playwright-core');

const RAIZ = 'dist';
const BASE = '/cybermech/jogar';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.otf': 'font/otf' };
const servidor = createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.endsWith('/') || p === '') p += 'index.html';
  const arquivo = join(RAIZ, p);
  if (!existsSync(arquivo) || !statSync(arquivo).isFile()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(arquivo)] ?? 'application/octet-stream' });
  res.end(readFileSync(arquivo));
});
await new Promise((r) => servidor.listen(0, r));
const url = `http://localhost:${servidor.address().port}${BASE}/?mapa=praia&depurar&build=${build}`;

let navegador;
for (const channel of ['chrome', 'msedge', undefined]) {
  try { navegador = await chromium.launch({ channel, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] }); break; } catch { /* tenta o próximo */ }
}
if (!navegador) throw new Error('nenhum navegador encontrado');
const ctx = await navegador.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1 });
await ctx.addInitScript((q) => { try { localStorage.setItem('cybermech.settings.v1', JSON.stringify({ quality: q })); } catch { /* sem storage */ } }, qualidade);
const pagina = await ctx.newPage();
const errosDePagina = [];
pagina.on('pageerror', (e) => errosDePagina.push(String(e.message)));
await pagina.goto(url);
await pagina.waitForFunction(() => !!window.__game, null, { timeout: 120_000 });
await pagina.waitForTimeout(6000);
for (let i = 0; i < 8; i++) {
  await pagina.click('#cta').catch(() => {});
  await pagina.waitForTimeout(400);
  if (await pagina.evaluate(() => !!document.pointerLockElement)) break;
}
await pagina.waitForTimeout(2500);

const resultado = await pagina.evaluate(async ({ posicoes, guinadas, comBloom, comEfeitos }) => {
  const g = window.__game;
  /**
   * Os efeitos de arma (P160) num anel em volta do Mech, para todo shader novo estar na tela em alguma pose: explosões no chão e no ar, a do Mech
   * destruído, mísseis com fita de fumaça e fogo, tiros com brilho e marca (furo, geada, queimado), o raio do trilho e o feixe do laser.
   */
  const efeitos = () => {
    const fx = g.weaponFx;
    if (!fx) return;
    const V = g.mech.root.position.constructor;
    const c = g.mech.simPosition;
    const base = g.mech.loadout.primary;
    const arma = (id, extra = {}) => ({ ...base, id, ...extra });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const at = new V(c.x + Math.cos(a) * 16, c.y + 0.5, c.z + Math.sin(a) * 16);
      fx.explosion(at, arma('rockets', { blastRadius: k % 2 ? 6 : 2.2 }));
      const alto = new V(at.x, at.y + 14, at.z);
      fx.explosion(alto, arma('cruise', { blastRadius: 9 }));
      const n = new V(-Math.cos(a), 0, -Math.sin(a));
      const chao = new V(at.x, c.y + 0.05, at.z);
      for (const id of ['plasma', 'railgun', 'cryo', 'autocannon', 'laser']) fx.impact(chao, new V(0, 1, 0), arma(id), k % 2 === 1, true);
      const boca = new V(c.x + Math.cos(a) * 4, c.y + 3, c.z + Math.sin(a) * 4);
      const dir = new V(Math.cos(a), 0.15, Math.sin(a)).normalize();
      for (const id of ['rockets', 'seeker', 'swarm', 'cruise', 'cannon']) {
        const t = fx.fired(boca, dir, arma(id), false);
        for (let s = 1; s < 12; s++) fx.flying(t, new V(boca.x + dir.x * s * 2, boca.y + dir.y * s * 2, boca.z + dir.z * s * 2), arma(id), false);
        fx.landed(t, boca, at, arma(id), false);
      }
      for (const id of ['plasma', 'arc', 'emp', 'shotgun', 'railgun']) fx.flying(-1, new V(boca.x + dir.x * 6, boca.y + 1, boca.z + dir.z * 6), arma(id), k % 2 === 0);
      fx.landed(-1, boca, at, arma('railgun'), false);
      g.match.beams.spawn(boca, at, k % 2 === 1, 0.6);
    }
    fx.wreck(new V(c.x + 10, c.y, c.z), 6.5);
  };
  g.bloomPass.enabled = comBloom; // por padrão desligado: o NaN da cena, e não o já espalhado pelo bloom
  const quadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const contar = () => {
    const rt = g.composer.readBuffer;
    const w = rt.width, h = rt.height;
    const buf = new Uint16Array(w * h * 4);
    g.renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    let n = 0;
    for (let i = 0; i < w * h; i++) {
      if (((buf[i * 4] & 0x7c00) === 0x7c00) || ((buf[i * 4 + 1] & 0x7c00) === 0x7c00) || ((buf[i * 4 + 2] & 0x7c00) === 0x7c00)) n++;
    }
    return n;
  };
  const V3 = g.mech.root.position.constructor;
  const saida = [];
  for (const [x, z] of posicoes) {
    g.mech.respawn(new V3(x, 14, z));
    for (let i = 0; i < 70; i++) await quadro(); // o Mech cai e assenta
    let poses = 0, comNaN = 0, pior = 0, piorPose = null;
    for (const pitch of [-0.2, 0.1]) {
      for (let k = 0; k < guinadas; k++) {
        if (comEfeitos && k % 6 === 0) efeitos();
        const yaw = (k / guinadas) * Math.PI * 2;
        g.rig.look.yaw = yaw;
        g.rig.look.pitch = pitch;
        await quadro();
        const n = contar();
        poses++;
        if (n > 0) { comNaN++; if (n > pior) { pior = n; piorPose = { yaw: +yaw.toFixed(2), pitch }; } }
      }
    }
    saida.push({ x, z, poses, comNaN, pior, piorPose });
  }
  return saida;
}, { posicoes, guinadas, comBloom, comEfeitos });

await navegador.close();
servidor.close();

let total = 0, ruins = 0;
for (const r of resultado) {
  total += r.poses;
  ruins += r.comNaN;
  console.log(`(${String(r.x).padStart(4)}, ${String(r.z).padStart(4)})  ${String(r.comNaN).padStart(3)}/${r.poses} poses com pixel não finito${r.pior ? `  (pior: ${r.pior} px, ${JSON.stringify(r.piorPose)})` : ''}`);
}
console.log(`${ruins}/${total} poses com NaN ou infinito no buffer HDR (${largura}×${altura}, qualidade ${qualidade}, bloom ${comBloom ? 'LIGADO' : 'desligado'}${comEfeitos ? ', efeitos de arma acesos' : ''}; a tela inteira são ${largura * altura} px)`);
if (errosDePagina.length) console.log('erros de página:', [...new Set(errosDePagina)].slice(0, 3));
mkdirSync('.tmp/nan-gpu', { recursive: true });
writeFileSync('.tmp/nan-gpu/ultimo.json', JSON.stringify({ largura, altura, qualidade, resultado }, null, 1));
process.exitCode = ruins ? 1 : 0;
