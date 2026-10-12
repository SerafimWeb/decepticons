/**
 * Inspetor de robô importado.
 *
 *   npm run mech:inspecionar -- client/public/models/novo.glb [--id novo] [--altura 5.3] [--saida .tmp/inspecao/novo]
 *
 * Carrega o `.glb` num Chrome/Edge headless com o MESMO carregador do jogo, confere o contrato de
 * `.decepticons/MECHS_IMPORTADOS.md` (malha com skin, ossos, antebraço, frente, pose de repouso, tamanho), checa a
 * convenção da animação (perna, joelho e mira no sentido certo), fotografa o robô e imprime a entrada pronta do
 * `IMPORTED_CHASSIS`. Sai com código 1 se achar um erro: dá para entrar no CI depois.
 *
 * Temporários só dentro do projeto (G15): `.tmp/` e um arquivo descartável em `client/`.
 */
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const flag = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};
const arquivo = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!arquivo || !/\.glb$/i.test(arquivo) || !existsSync(arquivo)) {
  console.error('uso: npm run mech:inspecionar -- caminho/do/arquivo.glb [--id nome] [--altura 5.3] [--saida pasta]');
  process.exit(2);
}
const nome = basename(arquivo);
const id = flag('id', nome.replace(/\.glb$/i, '').replace(/[^a-zA-Z0-9]/g, '').replace(/^./, (c) => c.toLowerCase()) || 'novo');
const altura = Number(flag('altura', '5.3'));
const saida = resolve(flag('saida', `.tmp/inspecao/${id}`));
const bytes = statSync(arquivo).size;

const TMP = resolve('.tmp', 'inspecao');
const PAGE = resolve('client', '.tmp-inspecionar.html');
const COPIA = resolve('client', '.tmp-inspecionar.glb');
mkdirSync(saida, { recursive: true });
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
copyFileSync(arquivo, COPIA);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#1b1e22;font:600 15px Consolas,monospace;color:#e6edf3}
  #wrap{position:relative;width:1600px;height:900px}
  canvas{display:block;position:absolute;left:0;top:0}
  .l{position:absolute;padding:4px 8px;background:rgba(0,0,0,.55);border-radius:4px}
</style></head><body><div id="wrap"><canvas id="c"></canvas></div><script type="module">
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  import { formatarSugestao, inspecionarMech, verificarConvencao } from '/src/entities/inspecaoMech.ts';
  import { instantiateImportedMechRig, preloadImportedMechAsset } from '/src/entities/importedMechRig.ts';
  import { weapon } from '/src/combat/weapons.ts';
  const URL_GLB = '/.tmp-inspecionar.glb';
  const ALTURA = ${JSON.stringify(altura)};
  const resultado = { relatorio: null, checagens: [], erro: null, snippet: '' };
  try {
    const gltf = await new GLTFLoader().loadAsync(URL_GLB);
    resultado.relatorio = inspecionarMech(gltf.scene, ${JSON.stringify(bytes)});
    const s = resultado.relatorio.sugestao;
    resultado.snippet = formatarSugestao(${JSON.stringify(id)}, ${JSON.stringify(nome)}, s);
    const asset = await preloadImportedMechAsset(URL_GLB, { targetHeight: ALTURA, rotationY: s.rotationY, boneNames: s.boneNames, armRest: s.armRest, weaponMounts: s.weaponMounts });
    resultado.checagens = verificarConvencao(asset, ALTURA);

    // Fotos: as mesmas fórmulas de passada e mira de MechBase.animate/applyFacing.
    const W = 1600, H = 900;
    const canvas = document.getElementById('c');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H, false); renderer.setScissorTest(true); renderer.setClearColor(0x1b1e22);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(6, 10, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 1.5); rim.position.set(-6, 6, -8); scene.add(rim);
    scene.add(new THREE.GridHelper(40, 40, 0x35505f, 0x24323b));
    const rig = instantiateImportedMechRig(asset, ALTURA);
    scene.add(rig.model);
    rig.mountWeapons?.({ primary: weapon('plasma'), secondary: weapon('rockets') });
    const box = new THREE.Box3().setFromObject(rig.model);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const pose = (phase, pitch) => {
      const sw = Math.sin(phase), cw = Math.cos(phase);
      rig.leftLeg.hip.rotation.x = sw * 0.7; rig.rightLeg.hip.rotation.x = -sw * 0.7;
      rig.leftLeg.knee.rotation.x = -Math.max(0, cw) * 1.1; rig.rightLeg.knee.rotation.x = -Math.max(0, -cw) * 1.1;
      rig.torso.rotation.y = sw * 0.06; rig.torso.rotation.x = pitch * 0.25;
      rig.rightArm.rotation.x = pitch * 0.75; rig.leftArm.rotation.x = pitch * 0.75;
    };
    const stand = (pitch) => { pose(0, pitch); rig.leftLeg.hip.rotation.x = 0; rig.rightLeg.hip.rotation.x = 0; rig.leftLeg.knee.rotation.x = 0; rig.rightLeg.knee.rotation.x = 0; rig.torso.rotation.y = 0; };
    const P = Math.PI;
    const painéis = [
      { label: 'frente · repouso', ang: 0, f: () => stand(0) },
      { label: 'frente 3/4 · repouso', ang: 35, f: () => stand(0) },
      { label: 'lateral · repouso (frente para a direita)', ang: 90, f: () => stand(0) },
      { label: 'costas · repouso', ang: 180, f: () => stand(0) },
      { label: 'lateral · passo 90° (E à frente)', ang: 90, f: () => pose(P / 2, 0) },
      { label: 'lateral · passo 270° (D à frente)', ang: 90, f: () => pose(3 * P / 2, 0) },
      { label: 'lateral · mira para cima (pitch +0.7)', ang: 90, f: () => stand(0.7) },
      { label: 'lateral · mira para baixo (pitch -0.45)', ang: 90, f: () => stand(-0.45) },
    ];
    const cols = 4, rows = 2, pw = W / cols, ph = H / rows;
    const cam = new THREE.PerspectiveCamera(30, pw / ph, 0.1, 400);
    const dist = Math.max(size.y, size.x) * 2.5;
    painéis.forEach((p, i) => {
      p.f();
      const a = (p.ang * Math.PI) / 180;
      cam.position.set(c.x + Math.sin(a) * dist, c.y + size.y * 0.04, c.z - Math.cos(a) * dist);
      cam.lookAt(c);
      const col = i % cols, row = Math.floor(i / cols);
      const x = col * pw, y = (rows - 1 - row) * ph;
      renderer.setViewport(x, y, pw, ph); renderer.setScissor(x, y, pw, ph);
      renderer.render(scene, cam);
      const el = document.createElement('div');
      el.className = 'l'; el.textContent = p.label;
      el.style.left = (x + 8) + 'px'; el.style.top = (row * ph + 8) + 'px';
      document.getElementById('wrap').appendChild(el);
    });
  } catch (e) { resultado.erro = String((e && e.message) || e); }
  window.resultado = resultado;
  window.pronto = true;
</script></body></html>`;
writeFileSync(PAGE, html, 'utf8');

const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 4217, strictPort: true, open: false } });
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
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const falhasDePagina = [];
  page.on('pageerror', (e) => falhasDePagina.push(e.message));
  await page.goto(`${server.resolvedUrls.local[0]}.tmp-inspecionar.html`);
  await page.waitForFunction(() => window.pronto === true, null, { timeout: 120_000 });
  const { relatorio: r, checagens, erro, snippet } = await page.evaluate(() => window.resultado);
  const foto = resolve(saida, 'inspecao.png');
  if (!erro) await page.screenshot({ path: foto });

  const linha = (t = '') => console.log(t);
  linha(`\nINSPEÇÃO · ${nome} · altura de referência ${altura} m`);
  if (r) {
    linha(`  Arquivo     ${(r.bytes / 1024).toFixed(0)} KB · ${r.malhas.triangulos} triângulos · ${r.malhas.total} malha(s) (${r.malhas.comSkin} com skin) · ${r.malhas.materiais} material(is) · ${r.malhas.texturas ? `${r.malhas.texturas} textura(s), a maior com ${r.malhas.maiorTextura || '?'} px` : 'sem textura'}`);
    linha(`  Tamanho     ${r.tamanho.x.toFixed(2)} × ${r.tamanho.y.toFixed(2)} × ${r.tamanho.z.toFixed(2)} (unidades do arquivo)`);
    linha(`  Esqueleto   ${r.esqueleto.tipo} · ${r.esqueleto.ossos} ossos${r.esqueleto.faltando.length ? ` · FALTAM: ${r.esqueleto.faltando.join(', ')}` : ''}`);
    linha(`  Braços      ${r.antebraco ? 'com antebraço' : 'SEM antebraço'} · dedos ${r.dedos.esquerda}/${r.dedos.direita} · repouso ${r.pose.tipo} (${r.pose.angulo}° da vertical)`);
    linha(`  Frente      ${r.frente.eixo}, certeza ${r.frente.certeza} (pé ${r.frente.deslocamento >= 0 ? '+' : ''}${r.frente.deslocamento} da altura à frente do tornozelo)`);
    linha('\n  Achados');
    for (const a of r.achados) linha(`    ${a.severidade === 'erro' ? 'ERRO ' : a.severidade === 'aviso' ? 'AVISO' : 'info '}  ${a.mensagem}`);
    if (r.achados.some((a) => a.severidade === 'erro')) codigo = 1;
  }
  if (erro) {
    linha(`\n  ERRO ao montar o robô com a sugestão: ${erro}`);
    codigo = 1;
  } else {
    linha('\n  Convenção da animação (com a sugestão aplicada)');
    for (const c of checagens) {
      linha(`    ${c.ok ? 'ok    ' : 'FALHA '}  ${c.nome}  (${c.valor >= 0 ? '+' : ''}${c.valor.toFixed(2)} m)`);
      if (!c.ok) codigo = 1;
    }
    linha('\n  Entrada sugerida para IMPORTED_CHASSIS (entities/importedMechAssets.ts)');
    linha(snippet);
    linha(`\n  Foto (frente, 3/4, lado, costas, passada, mira): ${foto}`);
    linha('  Lembre: CHASSIS, ARM_SLOTS e o Hangar (ui/HangarMenu.ts) também precisam do chassi novo. Roteiro: .decepticons/MECHS_IMPORTADOS.md');
  }
  if (falhasDePagina.length) linha(`\n  Erros de página: ${falhasDePagina.join(' | ')}`);
  linha(codigo ? '\nRESULTADO: há erros a corrigir antes de usar este arquivo.' : '\nRESULTADO: sem erros. Confira a foto antes de abrir o PR (regra 16 do AGENTS.md).');
} finally {
  await browser?.close();
  await server.close();
  rmSync(PAGE, { force: true });
  rmSync(COPIA, { force: true });
}
process.exit(codigo);
