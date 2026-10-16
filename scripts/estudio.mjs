/**
 * O ESTÚDIO (P150, P155): a ferramenta local onde o Comandante edita o que o jogo toca e mostra, ao lado da Mesa de vídeo (`npm run mesa`). Hoje: SONS (cortar na onda,
 * efeitos, importar, escolher o som de cada arma). Depois, no mesmo lugar: VOZES (gravar e tratar as falas do narrador), TIROS E ARMAS (cor, forma, cauda, explosão, força)
 * e MECHS 3D. Ver `.decepticons/ESTUDIO.md`: cada módulo é um arquivo de dados + validador + prévia + processador.
 *
 *   npm run estudio                    # abre http://127.0.0.1:5199 no navegador
 *   npm run estudio -- --porta 6000 --sem-abrir
 *
 * **Segurança (é um servidor de arquivos no seu PC):** escuta só em 127.0.0.1; recusa `Host` e `Origin` que não sejam o dele (contra DNS rebinding e página de fora);
 * só lê/grava arquivos com nome simples nas pastas dos módulos; valida tudo antes de gravar; corpo com teto de tamanho. A guarda mora aqui, uma vez, para todos os módulos.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { moduloSons } from './estudio/modulo-sons.mjs';
import { acharFfmpeg } from './sonsRodar.mjs';

const ESTATICOS = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

/** As mudanças ainda não commitadas (ou seja, que ainda não foram para o jogo) nos caminhos dados. Sem git, devolve `{ git: false }`. */
export function pendenciasDoGit(raiz, caminhos) {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...caminhos], { cwd: raiz, encoding: 'utf8' });
  if (r.status !== 0) return { git: false, arquivos: [] };
  const arquivos = r.stdout
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => ({ situacao: l.slice(0, 2).trim() || '?', arquivo: l.slice(3).trim() }));
  return { git: true, arquivos };
}

/**
 * Cria o servidor do Estúdio (sem ouvir ainda). `origem` = a pasta das referências brutas de som; `ffmpeg` = o executável (ou `undefined`: processar e prévia
 * ficam indisponíveis). `modulos` troca a lista de módulos (os testes usam); o padrão é o de sons.
 */
export function criarEstudio({ raiz, origem, ffmpeg, modulos }) {
  const lista = modulos ?? [moduloSons({ raiz, origem, ffmpeg })];
  const porId = new Map(lista.map((m) => [m.id, m]));
  const pagina = join(raiz, 'scripts/estudio/index.html');
  const pastasDoGit = lista.flatMap((m) => m.pastasDoGit ?? []);

  const servidor = createServer(async (req, res) => {
    const responder = (codigo, dados, tipo = 'application/json; charset=utf-8') => {
      res.writeHead(codigo, { 'content-type': tipo, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(typeof dados === 'string' || Buffer.isBuffer(dados) ? dados : JSON.stringify(dados));
    };
    try {
      // Só o próprio Estúdio fala com ele: Host e Origin de fora (DNS rebinding, página de terceiros) levam 403.
      const porta = servidor.address()?.port;
      const hostOk = [`127.0.0.1:${porta}`, `localhost:${porta}`].includes(req.headers.host ?? '');
      const origemOk = req.headers.origin === undefined || [`http://127.0.0.1:${porta}`, `http://localhost:${porta}`].includes(req.headers.origin);
      if (!hostOk || !origemOk) return responder(403, { erro: 'só o próprio estúdio pode falar com ele' });

      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const caminho = url.pathname;

      if (req.method === 'GET' && caminho === '/') return responder(200, readFileSync(pagina), 'text/html; charset=utf-8');

      // Os scripts e o estilo da página: só nomes simples da própria pasta do estúdio.
      const estatico = /^\/estudio\/([a-z0-9-]+\.(?:js|css))$/.exec(caminho);
      if (req.method === 'GET' && estatico) {
        const arq = join(raiz, 'scripts/estudio', estatico[1]);
        if (!existsSync(arq)) return responder(404, { erro: 'não existe' });
        return responder(200, readFileSync(arq), ESTATICOS[extname(arq)]);
      }

      if (req.method === 'GET' && caminho === '/api/estado') {
        const estado = { ffmpeg: Boolean(ffmpeg), modulos: lista.map((m) => ({ id: m.id, titulo: m.titulo })), rubberband: Boolean(lista.find((m) => m.caps)?.caps.rubberband) };
        for (const m of lista) estado[m.id] = m.estado();
        return responder(200, estado);
      }
      if (req.method === 'GET' && caminho === '/api/pendencias') return responder(200, pendenciasDoGit(raiz, pastasDoGit));

      const rota = /^\/api\/([a-z]+)(\/.*)?$/.exec(caminho);
      const modulo = rota ? porId.get(rota[1]) : undefined;
      if (modulo) {
        const tratou = await modulo.rotas({ req, res, responder, caminho: rota[2] ?? '/', url });
        if (tratou) return;
      }
      return responder(404, { erro: 'não existe' });
    } catch (e) {
      const status = e.status ?? (e instanceof SyntaxError ? 400 : 500);
      return responder(status, { erro: e instanceof SyntaxError ? 'JSON inválido' : String(e.message ?? e) });
    }
  });
  return servidor;
}

// ── Executado direto (`npm run estudio`): sobe o servidor e abre o navegador ──────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const valor = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
  const origem = resolve(valor('origem') ?? join(raiz, '.tmp/SOUNDS/ARMAS'));
  const ffmpeg = acharFfmpeg();
  if (!ffmpeg) console.warn('⚠ ffmpeg não encontrado: dá para cortar e ouvir, mas "Processar" e "Prévia" ficam indisponíveis (winget install Gyan.FFmpeg).');
  const servidor = criarEstudio({ raiz, origem, ffmpeg });
  const porta = Number(valor('porta') ?? 5199);
  servidor.listen(porta, '127.0.0.1', () => {
    const endereco = `http://127.0.0.1:${servidor.address().port}/`;
    console.log(`ESTÚDIO em ${endereco}  (Ctrl+C para fechar)\nreferências de som: ${origem}`);
    if (!args.includes('--sem-abrir')) spawn('cmd', ['/c', 'start', '""', endereco], { stdio: 'ignore', detached: true, windowsVerbatimArguments: true }).unref();
  });
  servidor.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `✗ a porta ${porta} já está em uso (o estúdio já está aberto? use --porta <outra>)` : `✗ ${e.message}`);
    process.exit(1);
  });
}
