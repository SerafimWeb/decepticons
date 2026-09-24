/**
 * Site do projeto (público): painel de missão na raiz + jogo em ./jogar/. Destino: DEPLOY.md.
 *
 * Uso: npm run site              → monta .tmp/site/ (G15: nada fora do projeto)
 *      npm run site -- --check   → monta e testa no Chrome headless, servido em /cybermech/
 *                                  com os MESMOS cabeçalhos que o .htaccess aplica no servidor
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
    "connect-src 'self'",
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
};

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
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

function build() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  run('npx', ['vite', 'build', '--outDir', GAME, '--emptyOutDir', '--logLevel', 'warn']);
  run('node', ['scripts/painel.mjs', '--site', '--out', join(OUT, 'index.html')]);
  writeFileSync(join(OUT, '.htaccess'), htaccess());
  writeFileSync(join(GAME, 'assets', '.htaccess'), ASSETS_HTACCESS);
  const wasm = readdirSync(join(GAME, 'assets')).filter((f) => f.endsWith('.wasm'));
  for (const w of wasm) {
    const file = join(GAME, 'assets', w);
    writeFileSync(`${file}.gz`, gzipSync(readFileSync(file), { level: 9 }));
  }
  console.log(`site    ${OUT}  (painel na raiz, jogo em jogar/, ${wasm.length} .wasm)`);
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

/** Acentos e layout: UTF-8 e modo padrão (sem quirks), mesmo com o servidor mandando text/html sem charset. */
async function pageSane(page, name, failures) {
  const { charset, mode } = await page.evaluate(() => ({ charset: document.characterSet, mode: document.compatMode }));
  if (charset !== 'UTF-8') failures.push(`${name}: lido como ${charset} (acentos quebrados)`);
  if (mode !== 'CSS1Compat') failures.push(`${name}: modo quirks (falta o <!doctype html>)`);
}

async function check() {
  const prefix = '/cybermech/';
  const server = await serve(prefix);
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  const tmp = resolve('.tmp/site-check');
  mkdirSync(tmp, { recursive: true });
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmp;
  const { chromium } = await import('playwright-core');
  const failures = [];
  let browser;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      browser = await chromium.launch({ channel, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
      break;
    } catch {
      // tenta o próximo
    }
  }
  try {
    if (!browser) throw new Error('nenhum browser encontrado');
    const page = await browser.newPage();
    // Falha de fonte do Google (rede) não é erro nosso; violação de CSP e erro de script são.
    page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && failures.push(`console: ${m.text()}`));
    page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
    page.on('response', (r) => r.status() >= 400 && !/fonts.g/.test(r.url()) && failures.push(`HTTP ${r.status()}: ${r.url()}`));
    await page.goto(base);
    const title = await page.title();
    if (title !== 'Cyber-Mech Protocol') failures.push(`título da raiz: "${title}"`);
    await pageSane(page, 'painel', failures);
    // O codinome interno não aparece em material público.
    if (/decepticons/i.test(await page.evaluate(() => document.documentElement.outerHTML))) failures.push('painel: o codinome interno aparece na página pública');
    await page.click('a.play-btn');
    await page.waitForURL(`${base}jogar/`);
    await page.waitForFunction(() => document.getElementById('cta')?.textContent === '[ clique para jogar ]', null, {
      timeout: 60_000,
    });
    await pageSane(page, 'jogo', failures);
    // Configurações salvas no navegador são lidas e aplicadas na largada (contrato core/Settings.ts).
    await page.evaluate(() => localStorage.setItem('cybermech.settings.v1', JSON.stringify({ showPerf: false })));
    await page.reload();
    await page.waitForFunction(() => document.getElementById('cta')?.textContent === '[ clique para jogar ]', null, {
      timeout: 60_000,
    });
    if (!(await page.evaluate(() => document.getElementById('debug-panel')?.hidden))) {
      failures.push('configuração salva (showPerf: false) não foi aplicada');
    }
    console.log(`site    ok: painel em ${prefix}, "Jogar" abre ${prefix}jogar/, física e loop sobem com a CSP, configurações salvas valem`);
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
  if (!homeText.includes('Cyber-Mech Protocol')) failures.push(`${root}: não é o painel`);
  if (!/^<!doctype html>/i.test(homeText) || !/<meta charset="utf-8">/i.test(homeText.slice(0, 1024))) failures.push(`${root}: sem doctype ou <meta charset> no início (acentos quebram)`);
  if (!/utf-8/i.test(home.headers.get('content-type') ?? '')) console.warn(`::warning::${root}: servidor sem charset no Content-Type (a página declara o seu)`);
  if (!home.headers.get('content-security-policy')?.includes('wasm-unsafe-eval')) failures.push(`${root}: sem a CSP do .htaccess`);
  // O selvamkt.com.br responde 200 com uma página HTML para arquivo inexistente: status não basta.
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
  build();
  if (argv.includes('--check')) await check();
}
