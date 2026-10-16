/**
 * ESTÚDIO DE SONS (P146): a página onde o Comandante corta os sons na onda, ajusta fade, ganho e altura, escolhe qual som toca em cada arma e ouve no ritmo de tiro da arma.
 *
 *   npm run estudio                    # abre http://127.0.0.1:5199 no navegador
 *   npm run estudio -- --porta 6000 --sem-abrir
 *
 * O que ele edita: os cortes (`scripts/sons-armas.json`) e a tabela de armas (`client/src/audio/armasSom.json`); "Processar" roda o mesmo `ffmpeg` do `npm run sons` e
 * grava os `.mp3` em `client/public/audio/armas/`. As referências brutas ficam em `.tmp/SOUNDS/ARMAS` (importar arrasta o arquivo para lá).
 *
 * **Segurança (é um servidor de arquivos no seu PC):** escuta só em 127.0.0.1; recusa `Host` e `Origin` que não sejam o dele (contra DNS rebinding e página de fora);
 * só lê/grava arquivos de áudio com nome simples nas duas pastas de sons; valida tudo antes de gravar; corpo com teto de tamanho.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validarArmas, validarMapa } from './sonsLib.mjs';
import { acharFfmpeg, duracaoDoArquivo, processarSom } from './sonsRodar.mjs';

const TIPOS = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.aac': 'audio/aac' };
const NOME_SEGURO = /^[A-Za-z0-9][A-Za-z0-9._ ()-]{0,120}$/;
const TETO_JSON = 1024 * 1024;
const TETO_AUDIO = 25 * 1024 * 1024;

function gravarJson(arquivo, dados) {
  const tmp = `${arquivo}.tmp`;
  writeFileSync(tmp, JSON.stringify(dados, null, 2) + '\n');
  renameSync(tmp, arquivo);
}

function lerCorpo(req, teto) {
  return new Promise((resolver, rejeitar) => {
    const partes = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > teto) {
        rejeitar(Object.assign(new Error('corpo grande demais'), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(c);
    });
    req.on('end', () => resolver(Buffer.concat(partes)));
    req.on('error', rejeitar);
  });
}

/** Cria o servidor do estúdio (sem ouvir ainda). `origem` = a pasta das referências brutas; `ffmpeg` = o executável (ou `undefined`: processar fica indisponível). */
export function criarEstudio({ raiz, origem, ffmpeg }) {
  const caminhos = {
    mapa: join(raiz, 'scripts/sons-armas.json'),
    armas: join(raiz, 'client/src/audio/armasSom.json'),
    info: join(raiz, 'scripts/estudio/armas-info.json'),
    pagina: join(raiz, 'scripts/estudio/index.html'),
    saidas: join(raiz, 'client/public/audio/armas'),
  };
  const lerJson = (arq) => JSON.parse(readFileSync(arq, 'utf8'));
  const duracoes = new Map(); // arquivo+mtime -> segundos

  function listarFontes() {
    if (!existsSync(origem)) return [];
    return readdirSync(origem)
      .filter((a) => TIPOS[extname(a).toLowerCase()] && NOME_SEGURO.test(a))
      .sort()
      .map((nome) => {
        const arq = join(origem, nome);
        const st = statSync(arq);
        const chave = `${nome}|${st.mtimeMs}`;
        if (!duracoes.has(chave)) duracoes.set(chave, ffmpeg ? duracaoDoArquivo(ffmpeg, arq) : Number.NaN);
        const d = duracoes.get(chave);
        return { nome, kb: Math.round(st.size / 102.4) / 10, duracao: Number.isFinite(d) ? Math.round(d * 100) / 100 : null };
      });
  }

  function estado() {
    const mapa = lerJson(caminhos.mapa);
    return {
      fontes: listarFontes(),
      mapa: { alvo: mapa.alvo, sons: mapa.sons },
      armas: lerJson(caminhos.armas).armas,
      info: lerJson(caminhos.info).armas,
      saidas: existsSync(caminhos.saidas) ? readdirSync(caminhos.saidas).filter((a) => a.endsWith('.mp3')) : [],
      ffmpeg: Boolean(ffmpeg),
      origem,
    };
  }

  /** Valida o que a página mandou salvar; devolve `{ erros }` ou `{ mapa, armas }` prontos para gravar. */
  function validar(corpo) {
    const atual = lerJson(caminhos.mapa);
    const info = lerJson(caminhos.info).armas;
    const mapa = { ...atual, sons: corpo.sons };
    const erros = Array.isArray(corpo.sons) ? validarMapa(mapa) : ['"sons" tem de ser uma lista'];
    if (Array.isArray(corpo.sons)) {
      for (const s of corpo.sons) if (s.fonte && !existsSync(join(origem, s.fonte))) erros.push(`${s.destino}: a fonte "${s.fonte}" não está em ${origem}`);
    }
    if (!corpo.armas || typeof corpo.armas !== 'object') erros.push('"armas" tem de ser um objeto');
    else if (Array.isArray(corpo.sons)) {
      const nominal = (clipe) => {
        const s = corpo.sons.find((x) => x.destino === `${clipe}.mp3`);
        return s ? s.ate - s.de : Number.NaN;
      };
      erros.push(...validarArmas(corpo.armas, info.map((a) => a.id), corpo.sons.map((s) => String(s.destino).replace(/\.mp3$/, '')), nominal));
      for (const id of Object.keys(corpo.armas)) if (info.find((a) => a.id === id && !a.aceita)) erros.push(`${id}: esta arma tem som contínuo próprio e ainda não aceita amostra`);
    }
    return erros.length ? { erros } : { mapa, armas: corpo.armas };
  }

  const servidor = createServer(async (req, res) => {
    const responder = (codigo, dados, tipo = 'application/json; charset=utf-8') => {
      res.writeHead(codigo, { 'content-type': tipo, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(typeof dados === 'string' || Buffer.isBuffer(dados) ? dados : JSON.stringify(dados));
    };
    try {
      // Só o próprio estúdio fala com ele: Host e Origin de fora (DNS rebinding, página de terceiros) levam 403.
      const porta = servidor.address()?.port;
      const hostOk = [`127.0.0.1:${porta}`, `localhost:${porta}`].includes(req.headers.host ?? '');
      const origemOk = req.headers.origin === undefined || [`http://127.0.0.1:${porta}`, `http://localhost:${porta}`].includes(req.headers.origin);
      if (!hostOk || !origemOk) return responder(403, { erro: 'só o próprio estúdio pode falar com ele' });

      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const caminho = url.pathname;

      if (req.method === 'GET' && caminho === '/') return responder(200, readFileSync(caminhos.pagina), 'text/html; charset=utf-8');
      if (req.method === 'GET' && caminho === '/api/estado') return responder(200, estado());

      const arquivo = /^\/api\/(fonte|saida)\/(.+)$/.exec(caminho);
      if (req.method === 'GET' && arquivo) {
        const nome = decodeURIComponent(arquivo[2]);
        const dir = arquivo[1] === 'fonte' ? origem : caminhos.saidas;
        const tipo = TIPOS[extname(nome).toLowerCase()];
        if (!NOME_SEGURO.test(nome) || !tipo) return responder(400, { erro: 'nome de arquivo inválido' });
        const alvo = join(dir, nome);
        if (!existsSync(alvo)) return responder(404, { erro: 'arquivo não encontrado' });
        res.writeHead(200, { 'content-type': tipo, 'content-length': statSync(alvo).size, 'cache-control': 'no-store' });
        return createReadStream(alvo).pipe(res);
      }

      if (req.method === 'POST' && caminho === '/api/salvar') {
        const corpo = JSON.parse((await lerCorpo(req, TETO_JSON)).toString('utf8'));
        const v = validar(corpo);
        if (v.erros) return responder(400, { erros: v.erros });
        gravarJson(caminhos.mapa, v.mapa);
        const antigo = lerJson(caminhos.armas);
        gravarJson(caminhos.armas, { ...antigo, armas: v.armas });
        return responder(200, { ok: true, sons: v.mapa.sons.length, armas: Object.keys(v.armas).length });
      }

      if (req.method === 'POST' && caminho === '/api/processar') {
        if (!ffmpeg) return responder(503, { erro: 'ffmpeg não encontrado neste computador' });
        const corpo = JSON.parse((await lerCorpo(req, TETO_JSON)).toString('utf8') || '{}');
        const mapa = lerJson(caminhos.mapa);
        const alvos = corpo.destino ? mapa.sons.filter((s) => s.destino === corpo.destino) : mapa.sons;
        if (alvos.length === 0) return responder(404, { erro: 'clipe não encontrado (salve antes de processar)' });
        const resultados = alvos.map((som) => ({ destino: som.destino, ...processarSom({ ffmpeg, origem, destinoDir: caminhos.saidas, mapa, som }) }));
        return responder(200, { resultados });
      }

      if (req.method === 'POST' && caminho === '/api/importar') {
        const nome = url.searchParams.get('nome') ?? '';
        if (!NOME_SEGURO.test(nome) || !TIPOS[extname(nome).toLowerCase()]) return responder(400, { erro: 'nome inválido: use só letras, números, espaço, ponto, hífen e parênteses, com extensão de áudio' });
        const destino = join(origem, nome);
        if (existsSync(destino) && url.searchParams.get('sobrescrever') !== '1') return responder(409, { erro: 'já existe um arquivo com esse nome' });
        const bytes = await lerCorpo(req, TETO_AUDIO);
        if (bytes.length < 100) return responder(400, { erro: 'arquivo vazio' });
        mkdirSync(origem, { recursive: true });
        writeFileSync(destino, bytes);
        return responder(200, { ok: true, nome });
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
  if (!ffmpeg) console.warn('⚠ ffmpeg não encontrado: dá para cortar e ouvir, mas "Processar" fica indisponível (winget install Gyan.FFmpeg).');
  const servidor = criarEstudio({ raiz, origem, ffmpeg });
  const porta = Number(valor('porta') ?? 5199);
  servidor.listen(porta, '127.0.0.1', () => {
    const endereco = `http://127.0.0.1:${servidor.address().port}/`;
    console.log(`ESTÚDIO DE SONS em ${endereco}  (Ctrl+C para fechar)\nreferências: ${origem}`);
    if (!args.includes('--sem-abrir')) spawn('cmd', ['/c', 'start', '""', endereco], { stdio: 'ignore', detached: true, windowsVerbatimArguments: true }).unref();
  });
  servidor.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `✗ a porta ${porta} já está em uso (o estúdio já está aberto? use --porta <outra>)` : `✗ ${e.message}`);
    process.exit(1);
  });
}
