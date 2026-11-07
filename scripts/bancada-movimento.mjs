/**
 * Bancada do movimento (P321, geração 3 dos Mechs): o Mech de verdade (`MechBase.animate`) num roteiro fixo, a geração 2 ao
 * lado da geração 3.
 *
 *   npm run mech:movimento -- [--chassi vector09|arara|onca|colossus01] [--saida .tmp/movimento/<chassi>] [--video]
 *
 * Imprime métricas (número vale mais que foto): o escorregão do pé no chão, a ponta do pé abaixo do piso, os passos por segundo,
 * o vai e vem da pelve, a inclinação do tronco, o quanto agacha ao pousar e o custo de CPU por Mech. Grava a folha de fotos
 * (`folha.png`) e, com `--video`, o vídeo lado a lado (`antes-depois.mp4`, geração 2 à esquerda e geração 3 à direita).
 *
 * O roteiro é função pura do quadro (60 Hz fixos): a mesma rodada dá o mesmo resultado. Sem física: a bancada integra a posição
 * e chama `render(dt, 1)`, como o Hangar faz. Temporários só dentro do projeto (G15): `.tmp/` e uma página descartável em `client/`.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const flag = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : padrao;
};
const COM_VIDEO = args.includes('--video');
const CHASSI = flag('chassi', 'vector09');
if (!['vector09', 'arara', 'onca', 'colossus01'].includes(CHASSI)) {
  console.error('uso: npm run mech:movimento -- [--chassi vector09|arara|onca|colossus01] [--saida pasta] [--video]');
  process.exit(2);
}
const saida = resolve(flag('saida', `.tmp/movimento/${CHASSI}`));
const TMP = resolve('.tmp', 'movimento');
const PAGE = resolve('client', '.tmp-movimento.html');
mkdirSync(saida, { recursive: true });
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;

// A página não usa crases nem `${`: o código dela vai dentro de um modelo de texto do Node.
const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#1b1e22}</style></head><body><script type="module">
import * as THREE from 'three';
import { Vector09 } from '/src/entities/Vector09.ts';
import { CHASSIS } from '/src/entities/chassis.ts';
import { BLUEPRINT_BY_CHASSIS } from '/src/entities/blueprintByChassis.ts';
import { MEDIUM_MECH_BLUEPRINT } from '/src/entities/mechBlueprint.ts';
import { MECH_GRAVITY } from '/src/entities/MechBase.ts';
import { carregarGeracao3, setMovimentoGen3 } from '/src/entities/movimentoGen3.ts';
import { medirGeometriaDaPerna } from '/src/entities/passadaRig.ts';
import { comandoDoRoteiro, DT, integrar, novoEstado, QUADROS } from '/src/entities/roteiroDeMovimento.ts';

const CHASSI = ${JSON.stringify(CHASSI)};
const COM_VIDEO = ${JSON.stringify(COM_VIDEO)};
const stats = CHASSIS[CHASSI];
const bp = BLUEPRINT_BY_CHASSIS[CHASSI] || MEDIUM_MECH_BLUEPRINT;
const ALTURA = stats.height;
const W = 1600, H = 600;
const F = (s) => Math.round(s / DT);
const VMAX = stats.moveSpeed;
const RAD = 180 / Math.PI;

const v3 = new THREE.Vector3();
const pos = (o) => { o.getWorldPosition(v3); return { x: v3.x, y: v3.y, z: v3.z }; };

function sondas(mech) {
  const g = medirGeometriaDaPerna(mech.rig);
  if (!g) throw new Error('a perna do rig nao foi medida');
  const pe = bp.legs.footLength;
  const zc = -pe * 0.12; // o centro do pe no blueprint (mechBlueprint.ts)
  // O tornozelo gira o pe (P322): as sondas ficam no no dele, que acompanha a inclinacao do pe; a sola esta a altura do tornozelo abaixo do eixo.
  const mk = (no, z) => { const o = new THREE.Object3D(); o.position.set(0, -g.tornozelo, z); no.add(o); return o; };
  const de = (no) => ({ c: mk(no, zc), p: mk(no, zc - pe / 2), t: mk(no, zc + pe / 2) });
  return { L: de(mech.rig.leftLeg.ankle), R: de(mech.rig.rightLeg.ankle) };
}

function criarLado(gen3, nome) {
  const mech = new Vector09({ stats: stats, blueprint: bp });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1e22);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(6, 10, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.5); rim.position.set(-6, 6, -8); scene.add(rim);
  const g1 = new THREE.GridHelper(400, 400, 0x2f414c, 0x2f414c); scene.add(g1);
  const g5 = new THREE.GridHelper(400, 80, 0x86aabd, 0x86aabd); g5.position.y = 0.004; scene.add(g5);
  scene.add(mech.root);
  const cam = new THREE.PerspectiveCamera(30, (W / 2) / H, 0.1, 800);
  const lado = {
    gen3: gen3, nome: nome, mech: mech, scene: scene, cam: cam, i: 0, passos: [], prev: null, prevJ: null, prevPelve: 0,
    sim: novoEstado(),
    sondas: sondas(mech),
    m: { slip: [], pisoMin: Infinity, pelveMin: Infinity, pelveMax: -Infinity, torsoMin: Infinity, torsoMax: -Infinity,
         freioMin: Infinity, freioMax: -Infinity, alturaParado: 0, pousoMin: Infinity, saltoJunta: 0, tSaltoJunta: 0, saltoPelve: 0, tSaltoPelve: 0 },
  };
  mech.grounded = true;
  mech.onFootstep = () => { lado.passos.push(lado.i); };
  return lado;
}

function avancar(l, i) {
  setMovimentoGen3(l.gen3);
  l.i = i;
  const e = comandoDoRoteiro(i, VMAX);
  const s = l.sim, m = l.mech;
  integrar(s, e, stats, MECH_GRAVITY, i);
  m.dashTimeLeft = Math.max(0, s.dash);
  m.velocity.set(s.vx, s.vy, s.vz);
  m.grounded = s.grounded;
  m.applyFacing(s.yaw, 0);
  if (e.tiro) { m.recoil = 1; m.leftRecoil = 1; }
  m.render(DT, 1);
  m.root.position.set(s.x, s.y, s.z);
  m.root.updateMatrixWorld(true);
  l.cam.position.set(s.x + ALTURA * 2.9, ALTURA * 0.55, s.z);
  l.cam.lookAt(s.x, ALTURA * 0.45, s.z);
  medir(l, i);
}

function medir(l, i) {
  const m = l.m;
  const cL = pos(l.sondas.L.c), cR = pos(l.sondas.R.c);
  const pelve = pos(l.mech.rig.pelvis).y;
  const torso = l.mech.rig.torso.rotation.x;
  // Estalo: o maior salto de uma junta da perna (rad) e da pelve (m, local) de um quadro para o seguinte, nas transições do roteiro.
  const rig = l.mech.rig;
  const pelveLocal = rig.pelvis.position.y;
  const j = [rig.leftLeg.hip.rotation.x, rig.leftLeg.knee.rotation.x, rig.rightLeg.hip.rotation.x, rig.rightLeg.knee.rotation.x];
  // Só as transições contam: no meio da corrida estável a perna balança rápido de verdade (velocidade, não estalo).
  const corrida = i >= F(1.8) && i < F(3.9);
  if (l.prevJ && !corrida) {
    for (let q = 0; q < 4; q++) { const d = Math.abs(j[q] - l.prevJ[q]); if (d > m.saltoJunta) { m.saltoJunta = d; m.tSaltoJunta = i * DT; } }
    const dp = Math.abs(pelveLocal - l.prevPelve);
    if (dp > m.saltoPelve) { m.saltoPelve = dp; m.tSaltoPelve = i * DT; }
  }
  l.prevJ = j; l.prevPelve = pelveLocal;
  m.torsoMin = Math.min(m.torsoMin, torso); m.torsoMax = Math.max(m.torsoMax, torso);
  if (i >= F(4.0) && i < F(4.8)) { m.freioMin = Math.min(m.freioMin, torso); m.freioMax = Math.max(m.freioMax, torso); }
  if (i === F(4.95)) m.alturaParado = pelve;
  if (l.sim.tPouso >= 0 && i >= l.sim.tPouso && i < l.sim.tPouso + F(0.7)) m.pousoMin = Math.min(m.pousoMin, pelve);
  if (i >= F(1.8) && i < F(3.9)) {
    m.pelveMin = Math.min(m.pelveMin, pelve); m.pelveMax = Math.max(m.pelveMax, pelve);
    const pL = pos(l.sondas.L.p), tL = pos(l.sondas.L.t), pR = pos(l.sondas.R.p), tR = pos(l.sondas.R.t);
    m.pisoMin = Math.min(m.pisoMin, pL.y, tL.y, pR.y, tR.y, cL.y, cR.y);
    if (l.prev) {
      // O pe que esta no chao (o de ponta mais baixa): a velocidade horizontal do centro dele em relacao ao chao, que e fixo. Plantado = zero.
      const baixoL = Math.min(cL.y, pL.y, tL.y) <= Math.min(cR.y, pR.y, tR.y);
      const a = baixoL ? cL : cR, b = baixoL ? l.prev.cL : l.prev.cR;
      m.slip.push(Math.hypot(a.x - b.x, a.z - b.z) / DT);
    }
  }
  l.prev = { cL: cL, cR: cR };
}

function resumo(l) {
  const m = l.m;
  const s = m.slip.slice().sort((a, b) => a - b);
  const media = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
  const janela = (F(3.9) - F(1.8)) * DT;
  const passos = l.passos.filter((p) => p >= F(1.8) && p < F(3.9)).length;
  return {
    slipMedio: media, slipP95: s[Math.floor(s.length * 0.95)] || 0, pisoMin: m.pisoMin,
    passosPorS: passos / janela, pelveVaiEVem: m.pelveMax - m.pelveMin,
    troncoGraus: [m.torsoMin * RAD, m.torsoMax * RAD], freioGraus: [m.freioMin * RAD, m.freioMax * RAD],
    agachaAoPousar: m.alturaParado - m.pousoMin,
    saltoJunta: m.saltoJunta, tSaltoJunta: m.tSaltoJunta, saltoPelve: m.saltoPelve, tSaltoPelve: m.tSaltoPelve,
  };
}

function bancadaCpu() {
  const N = 16;
  const mechs = [];
  for (let k = 0; k < N; k++) { const m = new Vector09({ stats: stats, blueprint: bp }); m.grounded = true; m.velocity.set(0, 0, -VMAX); mechs.push(m); }
  const bloco = (gen3, quadros) => {
    setMovimentoGen3(gen3);
    const t0 = performance.now();
    for (let q = 0; q < quadros; q++) for (const m of mechs) { m.applyFacing(0.3, 0.1); m.render(DT, 1); }
    return ((performance.now() - t0) * 1000) / (quadros * N);
  };
  bloco(false, 200); bloco(true, 200);
  let g2 = Infinity, g3 = Infinity;
  for (let r = 0; r < 4; r++) { g2 = Math.min(g2, bloco(false, 400)); g3 = Math.min(g3, bloco(true, 400)); }
  return { g2: g2, g3: g3, mechs: N };
}

const EVENTOS = [
  [1.75, 'corrida: um passo'], [2.2, 'corrida: o passo seguinte'], [4.25, 'freando'],
  [5.4, 'no ar'], [6.0, 'pousando'], [8.3, 'depois do tiro'],
];
const TELAS = new Set(EVENTOS.map((e) => F(e[0])));

try {
  await carregarGeracao3();
  const lados = [criarLado(false, 'GERACAO 2 (hoje)'), criarLado(true, 'GERACAO 3 (mech:gen3)')];
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false); renderer.setScissorTest(true); renderer.setClearColor(0x1b1e22);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  const folha = document.createElement('canvas'); folha.width = 1600; folha.height = 330 * 3;
  const fctx = folha.getContext('2d');
  fctx.fillStyle = '#101214'; fctx.fillRect(0, 0, folha.width, folha.height);
  const quadros = [];
  window.quadros = quadros;
  const desenhar = (i) => {
    lados.forEach((l, k) => {
      const x = k * (W / 2);
      renderer.setViewport(x, 0, W / 2, H); renderer.setScissor(x, 0, W / 2, H);
      renderer.render(l.scene, l.cam);
    });
    ctx.drawImage(canvas, 0, 0);
    ctx.font = 'bold 22px Consolas, monospace';
    lados.forEach((l, k) => {
      const x = k * (W / 2);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x + 8, 8, 330, 62);
      ctx.fillStyle = l.gen3 ? '#6dff9a' : '#ffd36b';
      ctx.fillText(l.nome, x + 16, 32);
      ctx.fillStyle = '#e6edf3';
      ctx.fillText('t=' + (i * DT).toFixed(2) + 's  v=' + Math.hypot(l.sim.vx, l.sim.vz).toFixed(1) + ' m/s', x + 16, 58);
    });
    ctx.fillStyle = '#86aabd'; ctx.fillRect(W / 2 - 1, 0, 2, H);
  };
  let tile = 0;
  for (let i = 0; i <= QUADROS; i++) {
    for (const l of lados) avancar(l, i);
    const tela = TELAS.has(i);
    const video = COM_VIDEO && i % 2 === 0;
    if (tela || video) {
      desenhar(i);
      if (video) quadros.push(out.toDataURL('image/jpeg', 0.82).slice(23));
      if (tela) {
        const tx = (tile % 2) * 800, ty = Math.floor(tile / 2) * 330;
        fctx.drawImage(out, 0, 0, W, H, tx, ty, 800, 300);
        fctx.fillStyle = '#e6edf3'; fctx.font = 'bold 18px Consolas, monospace';
        fctx.fillText(EVENTOS[tile][1], tx + 10, ty + 322);
        tile++;
      }
    }
  }
  window.resultado = { chassi: CHASSI, g2: resumo(lados[0]), g3: resumo(lados[1]), cpu: bancadaCpu(), folha: folha.toDataURL('image/png').slice(22), nQuadros: quadros.length, erro: null };
} catch (e) {
  window.resultado = { erro: String((e && e.stack) || e) };
}
window.pronto = true;
</script></body></html>`;
writeFileSync(PAGE, html, 'utf8');

const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 4218, strictPort: true, open: false } });
let browser;
let codigo = 0;
try {
  await server.listen();
  const { chromium } = await import('playwright-core');
  const flags = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  if (process.env.SMOKE_BROWSER) browser = await chromium.launch({ executablePath: process.env.SMOKE_BROWSER, args: flags });
  else {
    for (const channel of ['chrome', 'msedge', undefined]) {
      try {
        browser = await chromium.launch({ channel, args: flags });
        break;
      } catch {
        /* próximo navegador */
      }
    }
  }
  if (!browser) throw new Error('nenhum browser encontrado (defina SMOKE_BROWSER ou rode `npx playwright install chromium`)');
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const falhas = [];
  page.on('pageerror', (e) => falhas.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') falhas.push(m.text()); });
  await page.goto(`${server.resolvedUrls.local[0]}.tmp-movimento.html`);
  await page.waitForFunction(() => window.pronto === true, null, { timeout: 900_000 });
  const r = await page.evaluate(() => window.resultado);
  if (r.erro) {
    console.error(`ERRO na bancada: ${r.erro}`);
    codigo = 1;
  } else {
    writeFileSync(resolve(saida, 'folha.png'), Buffer.from(r.folha, 'base64'));
    const { folha: _folha, ...semFolha } = r;
    writeFileSync(resolve(saida, 'metricas.json'), JSON.stringify(semFolha, null, 2));
    const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : 'n/d');
    const linha = (rotulo, a, b, unidade = '') => console.log(`  ${rotulo.padEnd(46)} ${String(a).padStart(11)} ${String(b).padStart(11)}  ${unidade}`);
    console.log(`\nBANCADA DO MOVIMENTO · ${CHASSI} · ${f(VELOCIDADE_NOTA(CHASSI), 1)} m/s de corrida\n`);
    console.log(`  ${''.padEnd(46)} ${'GERAÇÃO 2'.padStart(11)} ${'GERAÇÃO 3'.padStart(11)}`);
    linha('escorregão do pé no chão, média (pé plantado = 0)', f(r.g2.slipMedio), f(r.g3.slipMedio), 'm/s');
    linha('escorregão do pé no chão, 95%', f(r.g2.slipP95), f(r.g3.slipP95), 'm/s');
    linha('ponta/calcanhar mais fundo no piso (negativo afunda)', f(r.g2.pisoMin, 3), f(r.g3.pisoMin, 3), 'm');
    linha('passos por segundo (as duas pernas)', f(r.g2.passosPorS), f(r.g3.passosPorS), '/s');
    linha('vai e vem da pelve na corrida', f(r.g2.pelveVaiEVem, 3), f(r.g3.pelveVaiEVem, 3), 'm');
    linha('tronco, inclinação mínima e máxima (todo o roteiro)', `${f(r.g2.troncoGraus[0], 1)}/${f(r.g2.troncoGraus[1], 1)}`, `${f(r.g3.troncoGraus[0], 1)}/${f(r.g3.troncoGraus[1], 1)}`, 'graus');
    linha('tronco ao frear, mínima e máxima', `${f(r.g2.freioGraus[0], 1)}/${f(r.g2.freioGraus[1], 1)}`, `${f(r.g3.freioGraus[0], 1)}/${f(r.g3.freioGraus[1], 1)}`, 'graus');
    linha('agacha ao pousar', f(r.g2.agachaAoPousar, 3), f(r.g3.agachaAoPousar, 3), 'm');
    linha('estalo: maior salto de junta por quadro (t da pior)', `${f(r.g2.saltoJunta, 3)}@${f(r.g2.tSaltoJunta, 1)}`, `${f(r.g3.saltoJunta, 3)}@${f(r.g3.tSaltoJunta, 1)}`, 'rad');
    linha('estalo: maior salto da pelve por quadro (t da pior)', `${f(r.g2.saltoPelve, 3)}@${f(r.g2.tSaltoPelve, 1)}`, `${f(r.g3.saltoPelve, 3)}@${f(r.g3.tSaltoPelve, 1)}`, 'm');
    linha(`custo de CPU por Mech por quadro (${r.cpu.mechs} Mechs)`, f(r.cpu.g2, 1), f(r.cpu.g3, 1), 'µs');
    console.log(`\n  Folha de fotos: ${resolve(saida, 'folha.png')}`);
    if (COM_VIDEO) {
      const frames = resolve(saida, 'frames');
      rmSync(frames, { recursive: true, force: true });
      mkdirSync(frames, { recursive: true });
      for (let q = 0; q < r.nQuadros; q++) {
        const b64 = await page.evaluate((k) => window.quadros[k], q);
        writeFileSync(resolve(frames, `${String(q).padStart(4, '0')}.jpg`), Buffer.from(b64, 'base64'));
      }
      const mp4 = resolve(saida, 'antes-depois.mp4');
      const ff = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', resolve(frames, '%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
      if (ff.status === 0) {
        rmSync(frames, { recursive: true, force: true });
        console.log(`  Vídeo (geração 2 à esquerda, geração 3 à direita): ${mp4} (${readdirSync(saida).length} arquivos na pasta)`);
      } else {
        console.error('  ffmpeg falhou: os quadros ficaram em', frames);
        codigo = 1;
      }
    }
  }
  if (falhas.length) console.log(`\n  Erros de página: ${[...new Set(falhas)].slice(0, 5).join(' | ')}`);
} finally {
  await browser?.close();
  await server.close();
  rmSync(PAGE, { force: true });
}
process.exit(codigo);

/** A velocidade de corrida do chassi, só para o título (a conta de verdade está na página). */
function VELOCIDADE_NOTA(chassi) {
  return { vector09: 9, arara: 13, onca: 6, colossus01: 5 }[chassi];
}
