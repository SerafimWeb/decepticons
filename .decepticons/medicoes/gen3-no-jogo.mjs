/**
 * A geração 3 do movimento no JOGO de verdade (P330, 07/11): serve o `dist/` (faça `npm run build` antes), abre como jogador comum (sem `?comandante=1`), liga a partida, corre com o Mech do
 * jogador e mede, num A/B no mesmo navegador:
 *
 *   A. o padrão do código (`mech:gen3` público): a inclinação do pé (`rig.hullMaterials[0].userData.footPitch`, que SÓ a geração 3 mexe) tem de variar, e o ponto mais baixo da
 *      malha dos pés (com o giro do tornozelo emulado: a mesma conta do shader do lote) tem de ficar a poucos centímetros do chão;
 *   B. a mesma corrida com `mech:gen3` RESTRITO pelo cache da visibilidade (o que o painel faz): o pé não mexe (a inclinação fica em zero) e o ponto mais baixo afunda (a geração 2).
 *
 *   npm run build && node .decepticons/medicoes/gen3-no-jogo.mjs [--tela 1280x720]
 *
 * O ponto mais baixo é medido em relação ao `root` do Mech (com ele no chão, o `root` é o chão). G15: temporários em `.tmp/`.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const arg = (nome, padrao) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : padrao);
const [W, H] = arg('--tela', '1280x720').split('x').map(Number);

const RAIZ = resolve('dist');
const BASE = '/cybermech/jogar';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
if (!existsSync(join(RAIZ, 'index.html'))) throw new Error('faça `npm run build` antes (não achei dist/index.html)');
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.endsWith('/') || p === '') p += 'index.html';
  const file = join(RAIZ, p);
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end('404');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const porta = server.address().port;

let browser = null;
const flags = ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-frame-rate-limit', '--disable-gpu-vsync'];
for (const channel of ['chrome', 'msedge', undefined]) {
  try {
    browser = await chromium.launch({ channel, args: flags });
    break;
  } catch {
    /* próximo */
  }
}
if (!browser) throw new Error('nenhum navegador');

const falhas = [];
const confere = (ok, texto, detalhe = '') => {
  console.log(`${ok ? '✓' : '✗'} ${texto}${detalhe ? ` (${detalhe})` : ''}`);
  if (!ok) falhas.push(texto);
};

/** Corre uns 3 s com o Mech do jogador e devolve o que a geração 3 deixa de rastro. `restrito` põe `mech:gen3` restrito no cache da visibilidade, como o painel faz. */
async function correr(restrito) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript((r) => {
    try {
      localStorage.setItem('cybermech.settings.v1', JSON.stringify({ quality: 'baixa' }));
      if (r) localStorage.setItem('cybermech.visibilidade.v1', JSON.stringify({ versao: 1, itens: { 'mech:gen3': 'restrito' } }));
    } catch {
      /* sem storage */
    }
  }, restrito);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/ERR_CONNECTION_REFUSED|WebSocket|Failed to load resource/.test(m.text()) && erros.push(m.text()));
  // O servidor aponta para um endereço morto: sem isso o jogo pergunta a visibilidade ao servidor de jogo (se houver um nesta máquina) e a resposta dele vale mais que o cache e o padrão do código.
  await page.goto(`http://localhost:${porta}${BASE}/?depurar&servidor=ws://127.0.0.1:1`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 120_000 });
  await page.waitForTimeout(6000);
  for (let i = 0; i < 8; i++) {
    await page.click('#cta').catch(() => {});
    await page.waitForTimeout(400);
    if (await page.evaluate(() => !!document.pointerLockElement)) break;
  }
  await page.keyboard.down('w');
  // Espera o Mech ganhar velocidade de corrida (a máquina pode ser lenta: espera pelo número, não pelo relógio).
  await page.waitForFunction(() => {
    const v = window.__game?.mech?.velocity;
    return v && Math.hypot(v.x, v.z) > 4;
  }, null, { timeout: 90_000 }).catch(() => {});
  const amostras = [];
  for (let i = 0; i < 28; i++) {
    amostras.push(
      await page.evaluate(() => {
        const m = window.__game.mech;
        const r = m.rig;
        const fp = r.hullMaterials[0].userData.footPitch;
        r.model.updateMatrixWorld(true);
        let minimo = Infinity;
        r.model.traverse((o) => {
          if (!o.isMesh) return;
          const g = o.geometry;
          const marca = g.getAttribute('mechFoot');
          if (!marca || !g.getAttribute('mechHull')) return;
          const pos = g.getAttribute('position');
          const e = o.matrixWorld.elements;
          for (let i = 0; i < pos.count; i++) {
            let y = pos.getY(i);
            let z = pos.getZ(i);
            const x = pos.getX(i);
            const lado = marca.getX(i);
            if (lado !== 0) {
              const ay = (lado < 0 ? r.leftLeg.ankle : r.rightLeg.ankle).position.y;
              const a = lado < 0 ? fp.x : fp.y;
              const c = Math.cos(a);
              const s = Math.sin(a);
              const dy = y - ay;
              y = ay + c * dy - s * z;
              z = s * dy + c * z;
            }
            const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
            if (wy < minimo) minimo = wy;
          }
        });
        return { v: Math.hypot(m.velocity.x, m.velocity.z), pitch: Math.max(Math.abs(fp.x), Math.abs(fp.y)), piso: minimo - m.root.position.y, noChao: m.grounded };
      }),
    );
    await page.waitForTimeout(110);
  }
  await page.keyboard.up('w');
  await ctx.close();
  const correndo = amostras.filter((a) => a.v > 3 && a.noChao);
  return {
    amostras: amostras.length,
    correndo: correndo.length,
    vMax: Math.max(...amostras.map((a) => a.v)),
    pitchMax: Math.max(0, ...correndo.map((a) => a.pitch)),
    pisoMin: correndo.length ? Math.min(...correndo.map((a) => a.piso)) : NaN,
    erros,
  };
}

console.log('\nA geração 3 no jogo de verdade (jogador comum, o padrão do código)');
const A = await correr(false);
console.log(`  A (público):  ${A.correndo}/${A.amostras} amostras correndo no chão, v máx ${A.vMax.toFixed(1)} m/s, inclinação do pé máx ${A.pitchMax.toFixed(3)} rad, ponto mais baixo do pé ${(A.pisoMin * 100).toFixed(1)} cm`);
const B = await correr(true);
console.log(`  B (restrito): ${B.correndo}/${B.amostras} amostras correndo no chão, v máx ${B.vMax.toFixed(1)} m/s, inclinação do pé máx ${B.pitchMax.toFixed(3)} rad, ponto mais baixo do pé ${(B.pisoMin * 100).toFixed(1)} cm`);
console.log('');
confere(A.correndo >= 5 && B.correndo >= 5, 'o Mech do jogador correu nas duas rodadas (amostras suficientes)');
confere(A.pitchMax > 0.03, 'padrão do código: a geração 3 está ativa no jogo (o pé inclina)');
confere(B.pitchMax < 0.001, 'com `mech:gen3` restrito o pé não mexe (a geração 2): o interruptor do painel vale');
confere(A.pisoMin > B.pisoMin + 0.05, 'a geração 3 sai pelo menos 5 cm mais alto que a geração 2 no ponto mais baixo do pé', `${(A.pisoMin * 100).toFixed(1)} contra ${(B.pisoMin * 100).toFixed(1)} cm`);
confere(A.pisoMin > -0.06 * 5.3, 'a geração 3 não afunda mais que 6% da altura do Vector-09 no jogo');
confere(A.erros.length === 0 && B.erros.length === 0, 'nenhum erro de página nem de console', [...A.erros, ...B.erros].slice(0, 2).join(' | '));
await browser.close();
server.close();
console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s).` : '\nRESULTADO: todas as verificações ok.');
process.exit(falhas.length ? 1 : 0);
