/**
 * Site do projeto (público), na raiz de cybermech.online. Destino: DEPLOY.md.
 *   /                  landing do jogo (scripts/landing.mjs)
 *   /sala-de-controle/ o case do desenvolvimento (scripts/painel.mjs --site)
 *   /bastidores/       o endereço antigo: página que leva para a sala de controle
 *   /metricas/         métricas privadas do dono (scripts/metricas.mjs): só abre com o token do servidor
 *   /jogar/            o jogo (vite build)
 *   /capturas/         imagens do jogo, feitas jogando o build (só com --capturas)
 *
 * Uso: npm run site                  → monta .tmp/site/ (G15: nada fora do projeto)
 *      npm run site -- --capturas    → idem, e antes entra no jogo headless e fotografa (o deploy usa)
 *      npm run site -- --check       → monta e testa no Chrome headless, servido na raiz (como em produção)
 *                                      com os MESMOS cabeçalhos que o .htaccess aplica no servidor
 *      node scripts/site.mjs --verify <url> → confere o site publicado (roda no deploy)
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
 * Sem HSTS por enquanto: o domínio é só do jogo, então dá para ligar depois que o HTTPS estiver estável (decisão do dono do domínio).
 */
/**
 * Origem do servidor de jogo, liberada no `connect-src` para a página poder perguntar o status dele
 * (`GET /status`, contrato em `shared/net/status.ts`) — jogar já era liberado por `wss:`. É a origem exata
 * do `GAME_SERVER_URL`, não um `https:` aberto; sem a variável no build, nada é liberado.
 */
const GAME_ORIGIN = (() => {
  const raw = process.env.VITE_GAME_SERVER?.trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const scheme = u.protocol === 'ws:' || u.protocol === 'http:' ? 'http:' : 'https:';
    return ` ${scheme}//${u.host}`;
  } catch {
    console.warn(`::warning::GAME_SERVER_URL não é um endereço válido (${raw}): a página não vai mostrar o status do servidor`);
    return '';
  }
})();

const HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // 'self' (P135, 15/10): a fonte Azonix do título do jogo é servida pelo próprio site. Sem o 'self',
    // o navegador bloqueia o .otf e o título cai na monoespaçada do sistema (visto no DevTools do Comandante).
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://www.googletagmanager.com https://*.google-analytics.com",
    // Multiplayer (M4): o servidor no próprio PC (ws://localhost) ou por túnel/hospedagem (wss://).
    // O `http://localhost` e a origem do túnel são o `GET /status` que a página usa para dizer se há gente jogando.
    // `blob:` (30/09): o GLTFLoader decodifica textura de um .glb criando um object URL local e buscando
    // nele — sem isso no connect-src, o chassi de malha importada carrega sem nenhuma textura.
    `connect-src 'self' https://ihebiuxobusmbflliiwn.supabase.co blob: ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:* wss:${GAME_ORIGIN} https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com`,
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
  // `CYBERMECH_CAPTURAS_CACHE` (a publicação pelo PC, `publicar-site.mjs`): as fotos feitas com --capturas ficam guardadas e voltam nas montagens sem Chrome (a landing não perde as imagens).
  const cache = process.env.CYBERMECH_CAPTURAS_CACHE;
  if (argv.includes('--capturas')) {
    await capture();
    if (cache && existsSync(join(OUT, 'capturas')) && readdirSync(join(OUT, 'capturas')).length) cpSync(join(OUT, 'capturas'), cache, { recursive: true, force: true });
  } else if (cache && existsSync(cache) && readdirSync(cache).length) {
    cpSync(cache, join(OUT, 'capturas'), { recursive: true, force: true });
    console.log(`capturas guardadas reaproveitadas: ${readdirSync(cache).join(', ')}`);
  }
  run('node', ['scripts/painel.mjs', '--site', '--out', join(OUT, 'sala-de-controle', 'index.html')]);
  // Endereço antigo (até 25/09): quem tiver o link cai na sala de controle.
  mkdirSync(join(OUT, 'bastidores'), { recursive: true });
  writeFileSync(join(OUT, 'bastidores', 'index.html'), MOVED);
  run('node', ['scripts/landing.mjs', '--out', join(OUT, 'index.html')]);
  run('node', ['scripts/oficina.mjs', '--out', join(OUT, 'oficina', 'index.html')]);
  // Privada: sem link em nenhum menu, fora da busca, e só mostra algo com o token do servidor (DEPLOY.md).
  run('node', ['scripts/metricas.mjs', '--out', join(OUT, 'metricas', 'index.html')]);
  writeFileSync(join(OUT, '.htaccess'), htaccess());
  writeFileSync(join(GAME, 'assets', '.htaccess'), ASSETS_HTACCESS);
  const wasm = readdirSync(join(GAME, 'assets')).filter((f) => f.endsWith('.wasm'));
  for (const w of wasm) {
    const file = join(GAME, 'assets', w);
    writeFileSync(`${file}.gz`, gzipSync(readFileSync(file), { level: 9 }));
  }
  console.log(`site    ${OUT}  (landing na raiz, sala-de-controle/, metricas/ privada, jogo em jogar/, ${wasm.length} .wasm)`);
}

/** Servidor estático em `prefix` (a raiz, como em produção) com os cabeçalhos do .htaccess, só para o teste local. */
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

/**
 * Anti-cópia (pedido do dono, 27/09/2026): o texto público não pode ser selecionado nem copiado.
 * A prova é no navegador, não no CSS: o estilo computado tem de ser `none`, um "selecionar tudo" não
 * pode pegar caractere nenhum, e um evento de cópia disparado à mão tem de voltar bloqueado.
 * Isto é fricção contra clone manual; não é segurança (quem lê o HTML continua lendo, e isso é esperado).
 */
async function antiCopy(page, name, failures) {
  const r = await page.evaluate(() => {
    const wrap = document.querySelector('.wrap');
    const ev = new Event('copy', { cancelable: true, bubbles: true });
    document.body.dispatchEvent(ev);
    document.execCommand('selectAll');
    const texto = String(window.getSelection() ?? '').trim();
    window.getSelection()?.removeAllRanges();
    return { select: wrap ? getComputedStyle(wrap).userSelect : 'sem .wrap', chars: texto.length, bloqueado: ev.defaultPrevented };
  });
  if (r.select !== 'none') failures.push(`anti-cópia (${name}): o texto público é selecionável (user-select: ${r.select})`);
  if (r.chars > 0) failures.push(`anti-cópia (${name}): o "selecionar tudo" ainda pegou ${r.chars} caracteres`);
  if (!r.bloqueado) failures.push(`anti-cópia (${name}): o evento de cópia não foi bloqueado`);
}

/**
 * Métricas (privada): contra um servidor de mentira que responde no formato REAL do contrato (os números vêm do `Telemetria`
 * de verdade). Prova: sem token nada aparece; token errado é recusado; token certo mostra cartões, funil, dias e países;
 * o token fica guardado só para aquele servidor; nome de país hostil vira texto, nunca HTML; a página não entra em busca
 * e não carrega o Google Analytics.
 */
async function metricasPage(browser, base, failures) {
  const { runnerImport } = await import('vite');
  const load = async (p) => (await runnerImport(resolve(p), { configFile: false, logLevel: 'silent' })).module;
  const { Telemetria } = await load('server/telemetria.ts');
  const tel = await load('shared/net/telemetry.ts');
  const TOKEN = 'token-de-teste-do-check-0123456789';
  const agora = Date.now();
  const t = new Telemetria(agora);
  for (const [nome, pais, n] of [['boot_ok', 'BR', 5], ['boot_ok', 'US', 2], ['partida_iniciada', 'BR', 4], ['landing_view', 'PT', 3]]) {
    for (let i = 0; i < n; i++) t.registrar(nome, `10.0.${pais.charCodeAt(0)}.${i}`, agora, pais);
  }
  for (let i = 0; i < 3; i++) t.contar('conexao_online', 'BR', agora);
  t.contar('entrou_na_sala', 'BR', agora);
  t.contar('recusa_versao', 'US', agora);
  t.pico(2, agora);
  const corpo = t.metricas(agora);
  const { PlayMetrics } = await load('server/PlayMetrics.ts');
  const play = new PlayMetrics();
  const report = {v:1,id:'site-check-normal',release:'site-check',mode:'deathmatch',online:false,build:'v2.vector09.plasma-0.rockets-0.-.frontal',assisted:false,outcome:'completed',seconds:60,frames:3600,slowFrames:36,kills:2,deaths:1,damage:100,firstKillS:12};
  play.record(report); play.record({...report,id:'site-check-assisted',assisted:true});
  corpo.play = play.snapshot();
  corpo.dias.at(-1).eventos.boot_ok['<img src=x onerror=window.__xss=1>'] = 1; // um servidor comprometido não vira HTML na tela
  const servidor = createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': tel.METRICAS_HEADER };
    if (req.method === 'OPTIONS') return void res.writeHead(204, cors).end();
    if (req.url?.split('?')[0] !== tel.METRICAS_PATH) return void res.writeHead(404, cors).end();
    if (req.headers[tel.METRICAS_HEADER] !== TOKEN) return void res.writeHead(401, cors).end();
    res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify(corpo));
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => failures.push(`métricas: ${e.message}`));
    const url = `${base}metricas/?servidor=${encodeURIComponent(`http://127.0.0.1:${servidor.address().port}`)}`;
    await page.goto(url);
    if ((await page.title()) !== 'Métricas · CYBERMECH') failures.push(`título das métricas: "${await page.title()}"`);
    await pageSane(page, 'métricas', failures);
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    if (/decepticons/i.test(html)) failures.push('métricas: o codinome interno aparece na página');
    if (!/<meta name="robots" content="noindex/.test(html)) failures.push('métricas: a página privada não pede para ficar fora da busca');
    if (/googletagmanager/.test(html)) failures.push('métricas: a página privada carrega o Google Analytics');
    if (!(await page.locator('#painel').isHidden())) failures.push('métricas: mostrou números sem token');
    await page.fill('#token', 'errado-errado-errado');
    await page.click('#acesso button[type=submit]');
    await page.waitForFunction(() => /recusado/i.test(document.getElementById('estado')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => failures.push('métricas: token errado não foi recusado na tela'));
    if (!(await page.locator('#painel').isHidden())) failures.push('métricas: mostrou números com o token errado');
    await page.fill('#token', TOKEN);
    await page.click('#acesso button[type=submit]');
    await page.waitForSelector('#painel:not([hidden])', { timeout: 5000 }).catch(() => failures.push('métricas: o token certo não abriu o painel'));
    if ((await page.locator('#cards .card').count()) !== 5) failures.push('métricas: faltam os cartões de hoje');
    if ((await page.locator('#funil .barra').count()) !== 7) failures.push('métricas: faltam os passos do funil');
    if ((await page.locator('#dias rect').count()) < 3) failures.push('métricas: o gráfico por dia saiu vazio');
    const partidas = await page.locator('#partidas').textContent();
    if (!partidas.includes('site-check') || !partidas.includes('Normal') || !partidas.includes('Assistida') || !partidas.includes('1.0%')) failures.push('métricas: resumos por versão/assistência não chegaram à tabela');
    const paises = await page.locator('#paises tbody tr').allTextContents();
    if (paises.length < 3) failures.push(`métricas: a tabela de países saiu com ${paises.length} linhas`);
    if (!/Brasil/.test(paises[0] ?? '')) failures.push(`métricas: o país que mais joga devia ser o Brasil, veio "${paises[0]}"`);
    if ((await page.locator('#paises img').count()) || (await page.evaluate(() => window.__xss))) failures.push('métricas: um nome de país com HTML virou HTML na tela');
    const guardados = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cybermech.metricas.token')));
    if (guardados.length !== 1 || !guardados[0].includes('127.0.0.1')) failures.push(`métricas: o token devia ficar guardado para aquele servidor só: ${JSON.stringify(guardados)}`);
    // Volta sozinha com o token guardado; um link para outro servidor não recebe o token guardado; "esquecer" apaga.
    const chaves = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cybermech.metricas.token')).length);
    await page.reload();
    await page.waitForSelector('#painel:not([hidden])', { timeout: 5000 }).catch(() => failures.push('métricas: não reabriu com o token guardado'));
    await page.click('#esquecer');
    if ((await chaves()) !== 0 || !(await page.locator('#painel').isHidden())) failures.push('métricas: "esquecer o token" não apagou nem escondeu o painel');
    await page.fill('#token', TOKEN);
    await page.click('#acesso button[type=submit]');
    await page.waitForSelector('#painel:not([hidden])', { timeout: 5000 }).catch(() => failures.push('métricas: não voltou a abrir depois de esquecer'));
    await page.goto(`${base}metricas/?servidor=${encodeURIComponent('http://localhost:9')}`);
    await page.waitForTimeout(300);
    if (!(await page.locator('#painel').isHidden())) failures.push('métricas: o token guardado foi usado em outro servidor');
    // Servidor de antes da porta de métricas (o de produção em 04/10, medido): /metricas devolve 200 com o texto de boas-vindas
    // e SEM cabeçalho de CORS (o navegador bloqueia), enquanto o /status público responde com CORS. A tela tem de dizer que ele é antigo,
    // não "fora do ar".
    const antigo = createServer((req, res) => {
      const texto = { 'content-type': 'text/plain; charset=utf-8' };
      if (req.url?.split('?')[0] === '/status') return void res.writeHead(200, { 'access-control-allow-origin': '*', 'content-type': 'application/json' }).end('{"protocol":1,"players":0,"rooms":0,"roomSize":8,"uptimeS":64714}');
      res.writeHead(200, texto).end('CYBERMECH · servidor de jogo · 0 sala(s)\n');
    });
    await new Promise((ok) => antigo.listen(0, '127.0.0.1', ok));
    try {
      await page.goto(`${base}metricas/?servidor=${encodeURIComponent(`http://127.0.0.1:${antigo.address().port}`)}`);
      await page.fill('#token', TOKEN);
      await page.click('#acesso button[type=submit]');
      await page.waitForFunction(() => /vers[ãa]o antiga/i.test(document.getElementById('estado')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => failures.push('métricas: servidor antigo (200 com texto) não foi explicado na tela'));
      if (!(await page.locator('#painel').isHidden())) failures.push('métricas: mostrou o painel com a resposta de um servidor antigo');
    } finally {
      antigo.close();
    }
  } finally {
    await ctx.close();
    servidor.close();
  }
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
  const prefix = '/';
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
    await page.bringToFront();
    /*
     * Achado (29/09): o Pointer Lock às vezes não é concedido nem depois do clique — medido até com
     * Chrome de verdade, não só o Chromium empacotado do CI. O clique acontece, mas o jogo nunca sai
     * da pausa, e as três fotos saem idênticas (a tela de pausa, três vezes). Sem um jeito de forçar
     * o Pointer Lock, o jeito é tentar de novo várias vezes, com a aba em primeiro plano, e CONFERIR
     * de verdade que travou antes de continuar — nunca assumir que um clique bastou.
     */
    let travou = false;
    for (let tentativa = 0; tentativa < 8 && !travou; tentativa++) {
      if (tentativa > 0) await page.waitForTimeout(500);
      // Relê o retângulo a cada tentativa: o layout pode ter mudado (ex.: status do servidor chegou).
      const title = await page.locator('#overlay h1').boundingBox();
      /*
       * Achado (07/10): sem título, a pausa já saiu — o clique anterior valeu um instante depois da janela de espera
       * (1,2 s). Antes isto era um `null.x` que derrubava o passo inteiro, e o `rsync --delete` do deploy apagava do
       * site a pasta `capturas/` (a landing ficou sem imagens até refazer o deploy). Se a partida de fato não começou,
       * o teste do overlay logo depois do laço recusa com a mensagem certa.
       */
      if (!title) {
        travou = true;
        break;
      }
      await page.mouse.click(title.x + title.width / 2, title.y + title.height / 2);
      travou = await page
        .waitForFunction(() => !!document.pointerLockElement, null, { timeout: 1200 })
        .then(() => true)
        .catch(() => false);
    }
    if (!travou) throw new Error('Pointer Lock nunca foi concedido depois de 8 cliques — sem isso o jogo fica preso na pausa e a captura sairia toda igual');
    // O primeiro clique abre a vinheta da marca (~2 s); a partida começa quando ela acaba.
    await page.waitForFunction(() => !document.querySelector('#brand-splash.on'), null, { timeout: 8000 });
    if (await page.locator('#overlay').isVisible()) throw new Error('a partida não começou (tela de pausa ainda visível depois da vinheta) — capturaria a pausa, não o jogo');
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
  const prefix = '/';
  const server = await serve(prefix);
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  const failures = [];
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    // Fonte do Google que não carrega não é erro nosso: a página cai no monoespaçado do sistema, e o
    // aviso de rede não interrompe nada. O console **não diz qual recurso falhou**, então
    // "Failed to load resource" fica por conta do handler de response, que traz a URL — foi ele que
    // derrubou o check da `main` em 27/09/2026: um 404 de woff2 do Google Fonts virou
    // `console: Failed to load resource`, o filtro de fonte não achou a URL no texto e o deploy não saiu.
    page.on('console', (m) => {
      const texto = m.text();
      if (texto.includes('Failed to load resource')) return;
      if (m.type() === 'error' && !/fonts\.g/.test(texto)) failures.push(`console: ${texto}`);
    });
    page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
    page.on('response', (r) => r.status() >= 400 && !/fonts.g/.test(r.url()) && failures.push(`HTTP ${r.status()}: ${r.url()}`));
    // Sala de controle: página própria, links internos vivos, sem o codinome.
    await page.goto(`${base}sala-de-controle/`);
    if ((await page.title()) !== 'Sala de controle · CYBERMECH') failures.push(`título da sala de controle: "${await page.title()}"`);
    await pageSane(page, 'sala de controle', failures);
    await publicPage(page, 'sala de controle', failures);
    await antiCopy(page, 'sala de controle', failures);
    // Gestão: quadro, burn-up e linha do tempo saem do histórico do ROADMAP (precisa do git inteiro).
    if ((await page.locator('section[aria-labelledby="gestao"] .lane').count()) < 2) failures.push('sala de controle: a seção de gestão sumiu (sem o histórico do ROADMAP no git?)');
    // Novidades e fichas de design saem dos documentos: sem elas, o parser não achou as tabelas.
    if ((await page.locator('.news li').count()) < 2) failures.push('sala de controle: sem novidades (decisões e entregas)');
    if ((await page.locator('.sheets li').count()) < 1) failures.push('sala de controle: sem as fichas de design');
    // Endereço antigo: leva para a sala de controle.
    await page.goto(`${base}bastidores/`);
    await page.waitForURL(/sala-de-controle\/$/, { timeout: 20000 }).catch(() => failures.push('bastidores/: não levou para a sala de controle'));
    // Oficina: a bancada tem de sair com os gráficos da simulação (sem eles, os dados do jogo não carregaram).
    await page.goto(`${base}oficina/`);
    if ((await page.title()) !== 'Oficina · CYBERMECH') failures.push(`título da oficina: "${await page.title()}"`);
    await pageSane(page, 'oficina', failures);
    await publicPage(page, 'oficina', failures);
    await antiCopy(page, 'oficina', failures);
    if ((await page.locator('.minis .g').count()) < 6) failures.push('oficina: faltam os gráficos da bancada (a simulação do jogo não carregou)');
    // O mapa da arquitetura (SVG gerado no build): tem de sair com os módulos e as ligações.
    const arqMods = await page.locator('.arq .mod').count();
    const arqEdges = await page.locator('.arq .edge').count();
    if (arqMods < 10) failures.push(`oficina: o mapa da arquitetura saiu com ${arqMods} módulos`);
    if (arqEdges < 20) failures.push(`oficina: o mapa da arquitetura saiu com ${arqEdges} ligações`);
    // O ícone de cada módulo (um por tipo de elemento, a ideia do grafo do ABBADON): um por chip, um por frente.
    const arqIcones = await page.locator('.arq .mod svg').count();
    const legendaIcones = await page.locator('.arq-legenda svg').count();
    if (arqIcones < arqMods) failures.push(`oficina: o mapa saiu com ${arqIcones} ícones para ${arqMods} módulos`);
    if (legendaIcones < 8) failures.push(`oficina: a legenda do mapa saiu com ${legendaIcones} ícones de frente`);
    // A saúde técnica, lida do repositório no build: os indicadores e a lista de onde ainda falta teste.
    const saudeCards = await page.locator('.saude .read').count();
    const saudeRows = await page.locator('.saude tbody tr').count();
    if (saudeCards < 4) failures.push(`oficina: a saúde técnica saiu com ${saudeCards} indicadores`);
    if (saudeRows < 1) failures.push('oficina: a saúde técnica saiu sem a lista dos módulos sem teste');
    // O guia (robôs, arsenal, escudos) é lido do código do jogo e do quadro de estado: vazio, é porque algum dos dois mudou de formato.
    const cartoesRobo = await page.locator('[data-workshop-chassis]').count();
    const linhasArma = await page.locator('table.arsenal tbody tr').count();
    const linhasEscudo = await page.locator('section[aria-labelledby="defesas"] table.resist tbody tr').count();
    const selosEstado = await page.locator('section .combat-card .selo, h2 .selo').count();
    if (cartoesRobo < 8) failures.push(`oficina: o guia saiu com ${cartoesRobo} robôs`);
    if (linhasArma < 6) failures.push(`oficina: a tabela do arsenal saiu com ${linhasArma} armas`);
    if (linhasEscudo < 4) failures.push(`oficina: a tabela de resistências saiu com ${linhasEscudo} escudos metálicos`);
    if (selosEstado < 3) failures.push(`oficina: só ${selosEstado} selos de estado (o STATUS_REAL.md mudou de formato ou as linhas mudaram de nome)`);
    // O mapa tem de ser clicável (bug de 06/10: os ícones da legenda estouravam, cobriam o mapa e engoliam os cliques).
    const iconeMax = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.arq-legenda svg')].map((s) => s.getBoundingClientRect().width)));
    if (!(iconeMax > 0 && iconeMax <= 24)) failures.push(`oficina: ícone da legenda do mapa com ${Math.round(iconeMax)}px de largura (devia ter 14)`);
    await page.locator('#mapa > summary').click();
    const alvoMapa = page.locator('.arq .mod').first();
    await alvoMapa.scrollIntoViewIfNeeded();
    const caixa = await alvoMapa.boundingBox();
    if (!caixa) failures.push('oficina: o primeiro módulo do mapa não tem caixa na tela');
    else {
      await page.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
      const fixados = await page.locator('.arq .mod.pin').count();
      const painelMapa = (await page.locator('#arq-detalhe').innerText()).toLowerCase();
      const nomeMapa = ((await alvoMapa.getAttribute('aria-label')) ?? '').split(':')[0].toLowerCase();
      if (fixados !== 1) failures.push(`oficina: o clique no módulo do mapa não o fixou (${fixados} fixados): algo cobre o mapa?`);
      if (!nomeMapa || !painelMapa.includes(nomeMapa) || !painelMapa.includes('usado por')) failures.push(`oficina: o painel do mapa não mostrou o módulo clicado ("${nomeMapa}")`);
      await page.keyboard.press('Escape');
      if ((await page.locator('.arq .mod.pin').count()) !== 0) failures.push('oficina: Esc não soltou o módulo fixado do mapa');
    }
    // Landing na raiz: é por ela que se entra no jogo.
    await page.goto(base);
    const title = await page.title();
    if (title !== 'CYBERMECH') failures.push(`título da raiz: "${title}"`);
    await pageSane(page, 'landing', failures);
    await publicPage(page, 'landing', failures);
    await antiCopy(page, 'landing', failures);
    // Hangar: os números saem do código do jogo; se o carregamento falhar, a seção some sem erro. Aqui é erro.
    if ((await page.locator('table.builds td.fit a').count()) < 3) failures.push('landing: a grade de montagens do Hangar sumiu (validação do Hangar não carregou)');
    if ((await page.locator('section[aria-labelledby="hangar"] .wpn').count()) < 2) failures.push('landing: a seção do Hangar sumiu (o site não conseguiu ler o arsenal do código do jogo)');
    // Online: o ritmo da rede sai do código (shared/net) e a contagem de etapas, do ROADMAP.
    if ((await page.locator('section[aria-labelledby="online"] .read').count()) < 3) failures.push('landing: a seção do multiplayer sumiu (o site não leu a rede ou a fase 4 do ROADMAP)');
    if ((await page.locator('section[aria-labelledby="horizonte"] .feature').count()) !== 5) failures.push('landing: a seção de ideias futuras sumiu ou não tem os cinco conceitos registrados');
    if (await page.locator('section[aria-labelledby="horizonte"] .kicker').textContent() !== '// ideias em estudo · sem data prometida') failures.push('landing: ideias futuras precisam estar marcadas como estudo sem data prometida');
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
    await metricasPage(browser, base, failures);
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
  // Só depois de saber que não houve falha: antes, esta linha saía junto do "❌ SITE FALHOU" e dizia
  // "ok" para um check vermelho (visto em 27/09/2026, no log do CI da `main`).
  console.log(`site    ok: landing em ${prefix} com a abertura da marca, o Hangar e o online, oficina/ com a bancada, sala-de-controle/ (e bastidores/ levando para ela), "Entrar no cockpit" abre jogar/, física e loop sobem com a CSP, configurações salvas valem, links internos vivos, texto não selecionável e sem cópia nas três páginas, celular joga pelo toque, metricas/ privada (sem token nada aparece, token errado é recusado, país hostil vira texto)`);
}

/** Confere o site publicado: páginas no ar, .wasm com o tipo certo, CSP aplicada. */
async function verify(url) {
  const root = url.endsWith('/') ? url : `${url}/`;
  const failures = [];
  // UA de navegador (como no deploy do CAPTIA), e desafio da Cloudflare ao
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
  // Anti-cópia: a página publicada tem de trazer o CSS que impede selecionar o texto.
  if (!/user-select:\s*none/.test(homeText)) failures.push(`${root}: a landing saiu sem a camada anti-cópia (texto selecionável)`);
  // A hospedagem responde 200 com uma página HTML para arquivo inexistente: status não basta.
  const shop = await get(`${root}oficina/`);
  if (!(await shop.text()).includes('Oficina · CYBERMECH')) failures.push(`${root}oficina/: não é a oficina`);
  const control = await get(`${root}sala-de-controle/`);
  if (!(await control.text()).includes('SALA DE CONTROLE')) failures.push(`${root}sala-de-controle/: não é a sala de controle`);
  const metricas = await get(`${root}metricas/`);
  const metricasHtml = await metricas.text();
  if (!metricasHtml.includes('Métricas · CYBERMECH')) failures.push(`${root}metricas/: não é a página de métricas`);
  if (!/<meta name="robots" content="noindex/.test(metricasHtml)) failures.push(`${root}metricas/: a página privada saiu sem noindex`);
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
