/**
 * Mede o quadro da Amazônia (TERRAS RARAS, P180) na GPU integrada desta máquina e acha o que pesa (G15: temporários em `.tmp/`; o resultado vai para `medicoes/amazonia-gpu-<data>.json`).
 * Serve o `dist/` (faça `npm run build` antes) e abre `?mapa=amazonia&modo=survival&depurar` no Chrome/Edge do sistema com `--use-angle=d3d11` e sem limite de quadros nem vsync, então o fps é o que a
 * máquina aguenta de verdade (o SwiftShader do CI não mostra isto). Para cada qualidade e tela mede PARADO e ANDANDO e, na `alta`, esconde **uma categoria por vez** (árvores, terreno, água,
 * estruturas, céu, tudo) para ver quanto cada uma custa: fps, p95, o pior quadro, desenhos e triângulos do quadro.
 *
 *   npm run build && node .decepticons/medicoes/amazonia-gpu.mjs                  # alta e baixa, 1280×720
 *   node .decepticons/medicoes/amazonia-gpu.mjs --telas 1280x720,1920x1080          # mais de uma tela
 *   node .decepticons/medicoes/amazonia-gpu.mjs --so-alta --experimentos            # só a qualidade alta, com a conta categoria por categoria
 *   node .decepticons/medicoes/amazonia-gpu.mjs --salvar                            # grava medicoes/amazonia-gpu-<data>.json
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
/** `1549x925@1.25` = a janela do Comandante com a escala do Windows (o jogo renderiza 1936×1156 pixels na `alta`); sem `@`, escala 1. */
const telas = (args.includes('--telas') ? args[args.indexOf('--telas') + 1] : '1280x720').split(',').map((t) => {
  const [dim, dpr] = t.split('@');
  const [w, h] = dim.split('x').map(Number);
  return [w, h, Number(dpr ?? 1)];
});
const qualidades = args.includes('--qualidades') ? args[args.indexOf('--qualidades') + 1].split(',') : args.includes('--so-alta') ? ['alta'] : ['alta', 'baixa'];
const mapa = args.includes('--mapa') ? args[args.indexOf('--mapa') + 1] : 'amazonia';
const modo = args.includes('--modo') ? args[args.indexOf('--modo') + 1] : 'survival';
const experimentos = args.includes('--experimentos');
const salvar = args.includes('--salvar');
const matriz = args.includes('--matriz');
const marcha = args.includes('--marcha') ? args[args.indexOf('--marcha') + 1] : '0.5';

const RAIZ = resolve('dist');
const BASE = '/cybermech/jogar';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.otf': 'font/otf', '.mp3': 'audio/mpeg' };
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

/** Mede `ms` de quadros: fps médio, p50/p95/p99, o pior e quantos passaram de 33 ms (abaixo de 30 fps). Devolve também os desenhos e triângulos do último quadro. */
const medir = (page, ms) =>
  page.evaluate(
    (dur) =>
      new Promise((resolvido) => {
        const t = [];
        let ult = performance.now();
        const ini = ult;
        const passo = (agora) => {
          t.push(agora - ult);
          ult = agora;
          if (agora - ini < dur) requestAnimationFrame(passo);
          else {
            t.shift();
            const s = [...t].sort((a, b) => a - b);
            const media = t.reduce((a, b) => a + b, 0) / t.length;
            const info = window.__game?.renderer?.info?.render;
            resolvido({
              quadros: t.length,
              fps: +(1000 / media).toFixed(1),
              p50: +s[Math.floor(s.length * 0.5)].toFixed(1),
              p95: +s[Math.floor(s.length * 0.95)].toFixed(1),
              p99: +s[Math.floor(s.length * 0.99)].toFixed(1),
              pior: +s[s.length - 1].toFixed(1),
              acima33ms: t.filter((x) => x > 33).length,
              desenhos: info?.calls ?? null,
              triangulos: info?.triangles ?? null,
            });
          }
        };
        requestAnimationFrame(passo);
      }),
    ms,
  );

/** Esconde (ou mostra) os objetos da cena cujo nome casa com a expressão; devolve quantos mexeu. */
const esconder = (page, padrao, visivel) =>
  page.evaluate(
    ([re, v]) => {
      const rx = new RegExp(re);
      let n = 0;
      window.__game.scene.traverse((o) => {
        if (o.name && rx.test(o.name)) {
          o.visible = v;
          n++;
        }
      });
      return n;
    },
    [padrao, visivel],
  );

/** Instala o cronômetro do render (composer.render + gl.finish = o custo de GPU do quadro, sem o resto da partida) e devolve uma função que lê e zera as amostras. */
const instalarCronometro = (page) =>
  page.evaluate(() => {
    const g = window.__game;
    if (g.__cronometro) return;
    g.__cronometro = [];
    const original = g.composer.render.bind(g.composer);
    const gl = g.renderer.getContext();
    g.composer.render = (dt) => {
      const t0 = performance.now();
      original(dt);
      gl.finish();
      g.__cronometro.push(performance.now() - t0);
    };
  });
const lerCronometro = (page) =>
  page.evaluate(() => {
    const v = window.__game.__cronometro.splice(0);
    if (!v.length) return null;
    v.sort((a, b) => a - b);
    return +v[Math.floor(v.length / 2)].toFixed(1);
  });

const resultados = {};
for (const [w, h, dpr] of telas) {
  for (const q of qualidades) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await ctx.addInitScript((qualidade) => {
      try {
        localStorage.setItem('cybermech.settings.v1', JSON.stringify({ quality: qualidade }));
      } catch {
        /* sem storage */
      }
    }, q);
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(`http://localhost:${porta}${BASE}/?mapa=${mapa}&modo=${modo}&marcha=${marcha}&depurar`);
    await page.waitForFunction(() => !!window.__game, null, { timeout: 120_000 });
    await page.waitForTimeout(8000);
    for (let i = 0; i < 8; i++) {
      await page.click('#cta').catch(() => {});
      await page.waitForTimeout(400);
      if (await page.evaluate(() => !!document.pointerLockElement)) break;
    }
    await page.waitForTimeout(2500);
    const chave = `${mapa}/${q}@${w}x${h}x${dpr}`;
    const r = { parado: await medir(page, 6000) };
    // Andando: segura W e gira a câmera devagar (o detalhe das árvores segue a câmera: andar é o caso difícil).
    await page.keyboard.down('w');
    r.andando = await medir(page, 6000);
    await page.keyboard.up('w');
    // Do alto: a vista que mais árvores mostra (o Mech no meio do mapa, olhando o rio de cima).
    if (mapa === 'amazonia') {
      await page.evaluate(() => {
        const g = window.__game;
        const V = g.mech.root.position.constructor;
        g.mech.respawn(new V(-300, 6, -120));
        g.rig.look.yaw = -Math.PI / 2;
        g.rig.look.pitch = -0.05;
      });
      await page.waitForTimeout(2500);
      r.noMeioDoMapa = await medir(page, 6000);
    }
    if (matriz) {
      // A conta do pós-processamento: pixelRatio, bloom e MSAA do alvo de render (o que o iGPU paga por pixel). Mede PARADO, no ponto de partida, 4 s cada.
      r.matriz = {};
      const casos = {
        'agora (FXAA, sem MSAA, bloom, ratio 1.25)': {},
        'sem FXAA (sem nenhum AA)': { fxaa: false },
        'com MSAA 4 (o que era antes), sem FXAA': { msaa: 4, fxaa: false },
        'agora, sem bloom': { bloom: false },
        'agora, ratio 1.0': { ratio: 1 },
        'agora, ratio 0.85': { ratio: 0.85 },
        'agora, ratio 0.75 sem bloom': { ratio: 0.75, bloom: false },
      };
      // O iGPU divide a máquina com o navegador e o editor abertos: o fps de uma rodada só varia muito. Alterna as configurações em RODADAS e fica com a MEDIANA de cada uma.
      const aplicar = (cfg) =>
        page.evaluate((c) => {
          const g = window.__game;
          g.quality.setAdaptive(false);
          g.setPixelRatio(c.ratio ?? Math.min(window.devicePixelRatio, 1.5));
          g.bloomPass.enabled = c.bloom !== false;
          g.fxaaPass.enabled = c.fxaa !== false;
          for (const rt of [g.composer.renderTarget1, g.composer.renderTarget2]) {
            const amostras = c.msaa ?? 0;
            if (rt.samples !== amostras) {
              rt.samples = amostras;
              rt.dispose();
            }
          }
        }, cfg);
      await instalarCronometro(page);
      const amostrasDe = Object.fromEntries(Object.keys(casos).map((n) => [n, []]));
      const rodadas = Number(args.includes('--rodadas') ? args[args.indexOf('--rodadas') + 1] : 3);
      for (let k = 0; k < rodadas; k++) {
        for (const [nome, c] of Object.entries(casos)) {
          await aplicar(c);
          await page.waitForTimeout(900);
          await lerCronometro(page);
          const m = await medir(page, 2500);
          m.renderMs = await lerCronometro(page);
          amostrasDe[nome].push(m);
        }
      }
      const mediana = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
      for (const [nome, lista] of Object.entries(amostrasDe)) {
        r.matriz[nome] = { fps: mediana(lista.map((m) => m.fps)), p95: mediana(lista.map((m) => m.p95)), renderMs: mediana(lista.map((m) => m.renderMs ?? 0)), rodadas: lista.map((m) => m.renderMs) };
        console.log(' ', nome.padEnd(34), 'render', String(r.matriz[nome].renderMs).padEnd(6), 'ms  | fps', String(r.matriz[nome].fps).padEnd(6), 'p95', String(r.matriz[nome].p95).padEnd(6), JSON.stringify(r.matriz[nome].rodadas));
      }
    }
    if (experimentos && q === 'alta' && mapa === 'amazonia') {
      r.sem = {};
      const casos = {
        arvores: '^arvores-',
        terreno: '^terreno-',
        agua: '^(rio|lagoa-de-rejeitos)$',
        estruturas: '^estruturas$',
        ceu: '^ceu$',
        tudoDoMapa: '^(arvores-|terreno-|rio$|lagoa-de-rejeitos$|estruturas$|ceu$)',
      };
      for (const [nome, re] of Object.entries(casos)) {
        const n = await esconder(page, re, false);
        await page.waitForTimeout(800);
        r.sem[nome] = { objetos: n, ...(await medir(page, 4000)) };
        await esconder(page, re, true);
      }
    }
    resultados[chave] = { ...r, erros: erros.slice(0, 3) };
    console.log(chave, JSON.stringify(resultados[chave], null, 1));
    await ctx.close();
  }
}
await browser.close();
server.close();
if (salvar) {
  const arquivo = resolve('.decepticons', 'medicoes', `amazonia-gpu-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(arquivo, `${JSON.stringify({ data: new Date().toISOString().slice(0, 10), marcha, mapa, gpu: 'AMD Vega 11 (ANGLE D3D11), sem vsync', resultados }, null, 1)}\n`);
  console.log('gravado em', arquivo);
}
