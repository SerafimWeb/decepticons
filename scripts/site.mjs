/**
 * Site do projeto (público). Destino: DEPLOY.md.
 *   /cybermech/             landing do jogo (scripts/landing.mjs)
 *   /cybermech/sala-de-controle/  o case do desenvolvimento (scripts/painel.mjs --site)
 *   /cybermech/bastidores/  o endereço antigo: página que leva para a sala de controle
 *   /cybermech/jogar/       o jogo (vite build)
 *   /cybermech/capturas/    imagens do jogo, feitas jogando o build (só com --capturas)
 *
 * Uso: npm run site                  → monta .tmp/site/ (G15: nada fora do projeto)
 *      npm run site -- --capturas    → idem, e antes entra no jogo headless e fotografa (o deploy usa)
 *      npm run site -- --check       → monta e testa no Chrome headless, servido em /cybermech/
 *                                      com os MESMOS cabeçalhos que o .htaccess aplica no servidor
 *      node scripts/site.mjs --verify <url> → confere o site publicado (roda no deploy)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const OUT = resolve('.tmp/site');
const GAME = join(OUT, 'jogar');
const argv = process.argv.slice(2);

/**
 * Cabeçalhos de segurança: fonte única para o .htaccess e para o servidor de teste local.
 * CSP: 'wasm-unsafe-eval' é obrigatório para o Rapier; 'unsafe-inline' cobre o script e o
 * style do painel; as fontes do painel vêm do Google Fonts.
 * Sem HSTS: vale para o domínio inteiro (selvamkt.com.br), então é decisão do dono do domínio.
 */
const HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    // Multiplayer (M4): o servidor no próprio PC (ws://localhost) ou por túnel/hospedagem (wss://).
    "connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * .htaccess de jogar/assets/: cache longo (nomes com hash) e .wasm pré-comprimido. O LiteSpeed da
 * Hostinger comprime JS e CSS sozinho, mas serve o .wasm cru (2,2 MB em vez de ~735 KB): quem aceita
 * gzip recebe o .wasm.gz, com o tipo e a codificação certos.
 */
const ASSETS_HTACCESS = `<IfModule mod_headers.c>
  Header set Cache-Control "${IMMUTABLE}"
</IfModule>
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTP:Accept-Encoding} gzip
  RewriteCond %{REQUEST_FILENAME}.gz -f
  RewriteRule ^(.+\\.wasm)$ $1.gz [L]
</IfModule>
<FilesMatch "\\.wasm\\.gz$">
  ForceType application/wasm
  <IfModule mod_headers.c>
    Header set Content-Encoding gzip
    Header append Vary Accept-Encoding
  </IfModule>
</FilesMatch>
`;

// O .html vai sem charset, como o servidor mandava até 24/09: a página tem que declarar o seu.
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
};

/** Build do jogo lido do git (tag, commits desde ela e hash); argumentos em lista, sem shell. */
function buildId() {
  const r = spawnSync('git', ['describe', '--tags', '--always'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'dev';
}

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', env: env ? { ...process.env, ...env } : process.env });
  if (r.status !== 0) {
    console.error(`❌ falhou: ${cmd} ${args.join(' ')}`);
    process.exit(1);
  }
}

function htaccess() {
  const set = Object.entries(HEADERS)
    .map(([k, v]) => `  Header always set ${k} "${v}"`)
    .join('\n');
  return `# Gerado por scripts/site.mjs: não edite no servidor, edite o script.
AddType application/wasm .wasm
# Sem isto o LiteSpeed manda text/html sem charset (as páginas também declaram o seu).
AddDefaultCharset UTF-8
AddCharset UTF-8 .html .css .js .json
<IfModule mod_headers.c>
${set}
  <FilesMatch "\\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/wasm
</IfModule>
`;
}

/** Página do endereço antigo dos bastidores: leva para a sala de controle (sem script: vale com a CSP). */
const MOVED = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=../sala-de-controle/">
<link rel="canonical" href="../sala-de-controle/">
<title>Sala de controle · CYBERMECH</title>
</head>
<body style="background:#0b0c0a;color:#e8e2cf;font-family:monospace;padding:24px">
<p>Os bastidores agora são a <a style="color:#ffb000" href="../sala-de-controle/">sala de controle</a>.</p>
</body>
</html>
`;

async function build() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  run('npx', ['vite', 'build', '--outDir', GAME, '--emptyOutDir', '--logLevel', 'warn'], { VITE_BUILD: buildId() });
  // As capturas vêm antes das páginas: a landing só mostra as imagens que existirem.
  if (argv.includes('--capturas')) await capture();
  run('node', ['scripts/painel.mjs', '--site', '--out', join(OUT, 'sala-de-controle', 'index.html')]);
  // Endereço antigo (até 25/09): quem tiver o link cai na sala de controle.
  mkdirSync(join(OUT, 'bastidores'), { recursive: true });
  writeFileSync(join(OUT, 'bastidores', 'index.html'), MOVED);
  run('node', ['scripts/landing.mjs', '--out', join(OUT, 'index.html')]);
  run('node', ['scripts/oficina.mjs', '--out', join(OUT, 'oficina', 'index.html')]);
  writeFileSync(join(OUT, '.htaccess'), htaccess());
  writeFileSync(join(GAME, 'assets', '.htaccess'), ASSETS_HTACCESS);
  const wasm = readdirSync(join(GAME, 'assets')).filter((f) => f.endsWith('.wasm'));
  for (const w of wasm) {
    const file = join(GAME, 'assets', w);
    writeFileSync(`${file}.gz`, gzipSync(readFileSync(file), { level: 9 }));
  }
  console.log(`site    ${OUT}  (landing na raiz, sala-de-controle/, jogo em jogar/, ${wasm.length} .wasm)`);
}

/** Servidor estático em /cybermech/ com os cabeçalhos do .htaccess, só para o teste local. */
function serve(prefix) {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
      if (!url.startsWith(prefix)) return res.writeHead(404).end();
      let file = join(OUT, url.slice(prefix.length));
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!file.startsWith(OUT) || !existsSync(file)) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...HEADERS });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => ok(server));
  });
}

/**
 * Celular deitado (844×390, toque): o toque na pausa começa a partida, o direcional anda, FOGO segura
 * com o outro polegar no direcional, e a pausa volta à tela de pausa. Em 24/09 os controles de toque
 * cobriam a pausa e o jogo nunca começava no celular; este teste existe para isso não voltar.
 */
async function mobile(browser, url, failures) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  try {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => failures.push(`celular: ${e.message}`));
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    const shown = (sel) => page.evaluate((q) => {
      const e = document.querySelector(q);
      return !!e && getComputedStyle(e).display !== 'none';
    }, sel);
    const controlsOn = () => page.evaluate(() => document.getElementById('touch-controls')?.classList.contains('on') ?? false);
    const vel = () => page.evaluate(() => Number(/VEL\s+([\d.]+)/.exec(document.getElementById('stats')?.textContent ?? '')?.[1] ?? -1));

    await page.goto(url);
    await page.waitForFunction(() => document.getElementById('cta')?.textContent === '[ toque para jogar ]', null, { timeout: 60_000, polling: 250 }).catch(async (e) => { throw new Error('celular: tela de pausa não ficou pronta para o toque (cta: ' + (await page.textContent('#cta').catch(() => '?')) + ')'); });
    if (await shown('.calib-open')) failures.push('celular: o botão de calibrar mouse aparece no toque');
    const title = await page.locator('#overlay h1').boundingBox();
    await page.touchscreen.tap(title.x + title.width / 2, title.y + title.height / 2);
    // Primeira partida: a vinheta da marca (~1,9 s) vem antes; a partida começa quando ela termina.
    await page.waitForTimeout(300);
    if (!(await shown('#brand-splash'))) failures.push('celular: a vinheta da marca não apareceu na primeira partida');
    await page.waitForFunction(() => document.getElementById('touch-controls')?.classList.contains('on'), null, { timeout: 6_000, polling: 100 }).catch(() => {});
    if (await shown('#overlay')) return void failures.push('celular: tocar na pausa não começou a partida');
    if (!(await controlsOn())) return void failures.push('celular: a partida começou sem os controles de toque');

    // Polegar esquerdo empurra o direcional para cima; o outro segura FOGO.
    await touch('touchStart', [{ x: 120, y: 300, id: 1 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: 120, y: 300 - i * 12, id: 1 }]);
    const fire = await page.locator('.tc-fire').boundingBox();
    await touch('touchStart', [{ x: 120, y: 228, id: 1 }, { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 2 }]);
    await page.waitForFunction(() => /VEL\s+([1-9]|0\.[1-9])/.test(document.getElementById('stats')?.textContent ?? ''), null, { timeout: 10_000, polling: 100 }).catch(() => {});
    if (!((await vel()) > 0)) failures.push('celular: o direcional não fez o Mech andar');
    if (!(await page.evaluate(() => document.querySelector('.tc-fire')?.classList.contains('pressed')))) failures.push('celular: FOGO não segura com o outro polegar no direcional');
    await touch('touchEnd', []);

    const pause = await page.locator('.tc-pause').boundingBox();
    await page.touchscreen.tap(pause.x + pause.width / 2, pause.y + pause.height / 2);
    await page.waitForTimeout(300);
    if (!(await shown('#overlay')) || (await controlsOn())) failures.push('celular: o botão de pausa não voltou para a tela de pausa');
  } finally {
    await ctx.close();
  }
}

/** Página pública: sem o codinome interno e sem link interno quebrado. */
async function publicPage(page, name, failures) {
  if (/decepticons/i.test(await page.evaluate(() => document.documentElement.outerHTML))) failures.push(`${name}: o codinome interno aparece na página pública`);
  const links = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => h.startsWith(location.origin)))]);
  for (const href of links) {
    const r = await page.request.get(href);
    if (r.status() >= 400) failures.push(`${name}: link quebrado ${href} (HTTP ${r.status()})`);
  }
}

/** Acentos e layout: UTF-8 e modo padrão (sem quirks), mesmo com o servidor mandando text/html sem charset. */
async function pageSane(page, name, failures) {
  const { charset, mode } = await page.evaluate(() => ({ charset: document.characterSet, mode: document.compatMode }));
  if (charset !== 'UTF-8') failures.push(`${name}: lido como ${charset} (acentos quebrados)`);
  if (mode !== 'CSS1Compat') failures.push(`${name}: modo quirks (falta o <!doctype html>)`);
}

/** Chrome/Edge do sistema (headless, WebGL por software). Temporários do browser em .tmp/ (G15). */
async function launchBrowser() {
  const tmp = resolve('.tmp/site-check');
  mkdirSync(tmp, { recursive: true });
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmp;
  const { chromium } = await import('playwright-core');
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch({ channel, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    } catch {
      // tenta o próximo
    }
  }
  throw new Error('nenhum browser encontrado (Chrome ou Edge)');
}

const CTA_READY = () => document.getElementById('cta')?.textContent === '[ clique para jogar ]';

/**
 * Entra no jogo headless e fotografa as três câmeras para a landing e a prévia do link. Custo: ~30 s
 * de build, só no deploy. Falhar aqui não derruba o site: a landing sai sem imagens e o log avisa.
 */
async function capture() {
  const dir = join(OUT, 'capturas');
  mkdirSync(dir, { recursive: true });
  const prefix = '/cybermech/';
  const server = await serve(prefix);
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://127.0.0.1:${server.address().port}${prefix}jogar/`);
    // Sem o painel de desempenho no canto da foto.
    await page.evaluate(() => localStorage.setItem('cybermech.settings.v1', JSON.stringify({ showPerf: false })));
    await page.reload();
    await page.waitForFunction(CTA_READY, null, { timeout: 60_000 });
    // Clique no título (não nos botões da pausa) = começa a partida com o mouse preso.
    const title = await page.locator('#overlay h1').boundingBox();
    await page.mouse.click(title.x + title.width / 2, title.y + title.height / 2);
    // O primeiro clique abre a vinheta da marca (~2 s); a partida começa quando ela acaba.
    await page.waitForFunction(() => !document.querySelector('#brand-splash.on'), null, { timeout: 8000 });
    const shot =(name) => page.screenshot({ path: join(dir, name), type: 'jpeg', quality: 80 });
    // Anda um pouco e troca tiros até os bots chegarem.
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyW');
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(640 + (i % 2 ? 60 : -60), 360);
      await page.mouse.down();
      await page.waitForTimeout(400);
      await page.mouse.up();
      await page.waitForTimeout(900);
    }
    await page.mouse.down();
    await page.waitForTimeout(300);
    await shot('capa.jpg');
    await page.mouse.up();
    await page.keyboard.press('KeyV');
    await page.waitForTimeout(1200);
    await page.mouse.down();
    await page.waitForTimeout(350);
    await shot('primeira-pessoa.jpg');
    await page.mouse.up();
    await page.keyboard.press('KeyV');
    await page.waitForTimeout(2500);
    await shot('tatica.jpg');
    console.log(`capturas ${readdirSync(dir).join(', ')}`);
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    console.warn(`::warning::capturas do jogo falharam (a landing sai sem imagens): ${err instanceof Error ? err.message : err}`);
  } finally {
    await browser?.close();
    server.close();
  }
}

async function check() {
  const prefix = '/cybermech/';
  const server = await serve(prefix);
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  const failures = [];
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    // Falha de fonte do Google (rede) não é erro nosso; violação de CSP e erro de script são.
    page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && failures.push(`console: ${m.text()}`));
    page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
    page.on('response', (r) => r.status() >= 400 && !/fonts.g/.test(r.url()) && failures.push(`HTTP ${r.status()}: ${r.url()}`));
    // Sala de controle: página própria, links internos vivos, sem o codinome.
    await page.goto(`${base}sala-de-controle/`);
    if ((await page.title()) !== 'Sala de controle · CYBERMECH') failures.push(`título da sala de controle: "${await page.title()}"`);
    await pageSane(page, 'sala de controle', failures);
    await publicPage(page, 'sala de controle', failures);
    // Gestão: quadro, burn-up e linha do tempo saem do histórico do ROADMAP (precisa do git inteiro).
    if ((await page.locator('section[aria-labelledby="gestao"] .lane').count()) < 2) failures.push('sala de controle: a seção de gestão sumiu (sem o histórico do ROADMAP no git?)');
    // Novidades e fichas de design saem dos documentos: sem elas, o parser não achou as tabelas.
    if ((await page.locator('.news li').count()) < 2) failures.push('sala de controle: sem novidades (decisões e entregas)');
    if ((await page.locator('.sheets li').count()) < 1) failures.push('sala de controle: sem as fichas de design');
    // Endereço antigo: leva para a sala de controle.
    await page.goto(`${base}bastidores/`);
    await page.waitForURL(/sala-de-controle\/$/, { timeout: 5000 }).catch(() => failures.push('bastidores/: não levou para a sala de controle'));
    // Oficina: a bancada tem de sair com os gráficos da simulação (sem eles, os dados do jogo não carregaram).
    await page.goto(`${base}oficina/`);
    if ((await page.title()) !== 'Oficina · CYBERMECH') failures.push(`título da oficina: "${await page.title()}"`);
    await pageSane(page, 'oficina', failures);
    await publicPage(page, 'oficina', failures);
    if ((await page.locator('.minis .g').count()) < 6) failures.push('oficina: faltam os gráficos da bancada (a simulação do jogo não carregou)');
    // Landing na raiz: é por ela que se entra no jogo.
    await page.goto(base);
    const title = await page.title();
    if (title !== 'CYBERMECH') failures.push(`título da raiz: "${title}"`);
    await pageSane(page, 'landing', failures);
    await publicPage(page, 'landing', failures);
    // Hangar: os números saem do código do jogo; se o carregamento falhar, a seção some sem erro. Aqui é erro.
    if ((await page.locator('table.builds td.fit a').count()) < 3) failures.push('landing: a grade de montagens do Hangar sumiu (validação do Hangar não carregou)');
    if ((await page.locator('section[aria-labelledby="hangar"] .wpn').count()) < 2) failures.push('landing: a seção do Hangar sumiu (o site não conseguiu ler o arsenal do código do jogo)');
    // Online: os números saem do código da rede (shared/net) e as etapas, do ROADMAP.
    if ((await page.locator('section[aria-labelledby="online"] .stages li').count()) < 3) failures.push('landing: a seção do multiplayer sumiu (o site não leu a rede ou a fase 4 do ROADMAP)');
    // Abertura da marca: roda na primeira visita da sessão e sai da frente sozinha (senão cobre o botão).
    if (!(await page.evaluate(() => sessionStorage.getItem('cybermech.intro') === '1'))) failures.push('landing: a abertura da marca não rodou');
    await page.waitForFunction(() => !document.getElementById('intro'), null, { timeout: 8000 });
    await page.click('a.play-btn');
    await page.waitForURL(`${base}jogar/`);
    await page.waitForFunction(CTA_READY, null, { timeout: 60_000 });
    await pageSane(page, 'jogo', failures);
    // Configurações salvas no navegador são lidas e aplicadas na largada (contrato core/Settings.ts).
    await page.evaluate(() => localStorage.setItem('cybermech.settings.v1', JSON.stringify({ showPerf: false })));
    await page.reload();
    await page.waitForFunction(CTA_READY, null, { timeout: 60_000 });
    if (!(await page.evaluate(() => document.getElementById('debug-panel')?.hidden))) {
      failures.push('configuração salva (showPerf: false) não foi aplicada');
    }
    // Uma página por vez: a de trás não desenha, e o jogo do celular ficaria parado.
    await page.close();
    await mobile(browser, `${base}jogar/`, failures);
    console.log(`site    ok: landing em ${prefix} com a abertura da marca, o Hangar e o online, oficina/ com a bancada, sala-de-controle/ (e bastidores/ levando para ela), "Entrar no cockpit" abre jogar/, física e loop sobem com a CSP, configurações salvas valem, links internos vivos, celular joga pelo toque`);
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err));
  } finally {
    await browser?.close();
    server.close();
  }
  if (failures.length) {
    console.error('❌ SITE FALHOU');
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }
}

/** Confere o site publicado: páginas no ar, .wasm com o tipo certo, CSP aplicada. */
async function verify(url) {
  const root = url.endsWith('/') ? url : `${url}/`;
  const failures = [];
  // Mesmo cuidado do deploy do CAPTIA no selvamkt: UA de navegador, e desafio da Cloudflare ao
  // IP do runner não é falha do site (só não dá para verificar do CI).
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
  const get = async (u, method = 'GET') => {
    const r = await fetch(u, { method, redirect: 'follow', headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, br' } });
    if (r.headers.get('cf-mitigated') || (r.status === 403 && r.headers.get('server')?.includes('cloudflare'))) {
      console.warn(`::warning::Cloudflare desafiou o runner em ${u}; conferir no navegador.`);
      process.exit(0);
    }
    if (!r.ok) failures.push(`${u}: HTTP ${r.status}`);
    return r;
  };
  const home = await get(root);
  const homeText = await home.text();
  if (!homeText.includes('ENTRAR NO COCKPIT')) failures.push(`${root}: não é a landing do jogo`);
  if (!/^<!doctype html>/i.test(homeText) || !/<meta charset="utf-8">/i.test(homeText.slice(0, 1024))) failures.push(`${root}: sem doctype ou <meta charset> no início (acentos quebram)`);
  if (!/utf-8/i.test(home.headers.get('content-type') ?? '')) console.warn(`::warning::${root}: servidor sem charset no Content-Type (a página declara o seu)`);
  if (!home.headers.get('content-security-policy')?.includes('wasm-unsafe-eval')) failures.push(`${root}: sem a CSP do .htaccess`);
  // O selvamkt.com.br responde 200 com uma página HTML para arquivo inexistente: status não basta.
  const shop = await get(`${root}oficina/`);
  if (!(await shop.text()).includes('Oficina · CYBERMECH')) failures.push(`${root}oficina/: não é a oficina`);
  const control = await get(`${root}sala-de-controle/`);
  if (!(await control.text()).includes('SALA DE CONTROLE')) failures.push(`${root}sala-de-controle/: não é a sala de controle`);
  const old = await get(`${root}bastidores/`);
  if (!(await old.text()).includes('sala-de-controle/')) failures.push(`${root}bastidores/: não leva para a sala de controle`);
  const cover = await get(`${root}capturas/capa.jpg`, 'HEAD');
  if (!(cover.headers.get('content-type') ?? '').startsWith('image/')) console.warn(`::warning::${root}capturas/capa.jpg não é imagem: a landing está sem capturas`);
  const game = await get(`${root}jogar/`);
  if (!(await game.text()).includes('id="cta"')) failures.push(`${root}jogar/: não é a página do jogo`);
  const wasm = readdirSync(join(GAME, 'assets')).find((f) => f.endsWith('.wasm'));
  if (wasm) {
    const r = await get(`${root}jogar/assets/${wasm}`, 'HEAD');
    const type = r.headers.get('content-type') ?? '';
    if (!type.startsWith('application/wasm')) failures.push(`.wasm servido como "${type}" (precisa de application/wasm)`);
    if (!/gzip|br/.test(r.headers.get('content-encoding') ?? '')) failures.push('.wasm servido sem compressão (2,2 MB em vez de ~735 KB)');
  }
  if (failures.length) {
    console.error('❌ SITE PUBLICADO COM PROBLEMA');
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }
  console.log(`site    publicado ok: ${root}`);
}

if (argv.includes('--verify')) {
  await verify(argv[argv.indexOf('--verify') + 1]);
} else {
  await build();
  if (argv.includes('--check')) await check();
}
