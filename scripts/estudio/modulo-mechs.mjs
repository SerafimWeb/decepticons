/**
 * Módulo MECHS 3D do Estúdio (P321, `ESTUDIO.md` § 3.3), primeiro corte: o MOVIMENTO dos Mechs. A prévia é uma página montada pelo Vite com o
 * MESMO código do jogo (`Vector09` → `MechBase.render`, `geracao3.ts`), a geração 2 ao lado da 3; o Comandante ajusta ao olho os números de gosto e o
 * Estúdio os grava no dado que o jogo lê (`client/src/entities/movimentoGen3.json`). Rotas em `/api/mechs/...`:
 *
 * - `POST /montar`   monta a prévia em `.tmp/estudio/mechs/` (só se algum fonte é mais novo que a montagem anterior);
 * - `GET  /app/...`  serve os arquivos montados (a página abre em `/api/mechs/app/index.html`, dentro da aba);
 * - `GET  /app/models/<nome>.glb`  serve a malha dos robôs importados direto de `client/public/models/` (a prévia mostra TODOS os robôs do jogo; nada é copiado para a montagem);
 * - `PUT  /ajustes`  valida e grava os ajustes (todas as chaves, cada uma na faixa de `movimentoGen3.faixas.json`; nada de chave desconhecida);
 * - `PUT  /desenho`  o mesmo para os números de desenho do Gavião-H3 (`desenhoGaviao.json`, faixas em `desenhoGaviao.faixas.json`);
 * - `GET  /app/pecas/<nome>.glb`  serve as peças do Blender (a Prova Blender, P329) de `.decepticons/pecas/`, com a mesma regra de nome simples dos modelos.
 *
 * O dado e as faixas moram no repositório (uma fonte só: o jogo, o teste e este módulo leem os mesmos arquivos). O Estúdio não publica: o que
 * ele grava aparece nas PENDÊNCIAS (commit e PR são do fluxo do projeto).
 */
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { corpoJson, gravarJson, lerJson } from './util.mjs';

const ARQ_AJUSTES = 'client/src/entities/movimentoGen3.json';
const ARQ_FAIXAS = 'client/src/entities/movimentoGen3.faixas.json';
/** O desenho do Gavião-H3 (os números que o painel DESENHO edita) e as faixas deles. */
const ARQ_DESENHO = 'client/src/entities/desenhoGaviao.json';
const ARQ_FAIXAS_DESENHO = 'client/src/entities/desenhoGaviao.faixas.json';
const SAIDA = '.tmp/estudio/mechs';
/** Onde o jogo guarda a malha dos robôs importados (`IMPORTED_CHASSIS`): a prévia a lê daqui pela rota `/app/models/`. */
const MODELOS = 'client/public/models';
/** Onde moram as peças do Blender (a Prova Blender, P329; `npm run mech:pecas` as regera): fora do `public/`, o jogo não as publica. */
const PECAS = '.decepticons/pecas';
/** Só um nome simples terminado em `.glb` (sem barra, sem `..`): nada sai da pasta dos modelos. */
const NOME_DE_MODELO = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.glb$/;
/** Onde estão os fontes da prévia: se algum for mais novo que a montagem, monta de novo. */
const FONTES = ['client/src', 'scripts/estudio/mechs', 'vite.config.ts'];

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * Valida os ajustes antes de gravar: um objeto com TODAS as chaves das faixas, cada uma um número finito dentro da faixa, e nenhuma chave a mais.
 * Devolve `{ ok: true, ajustes }` (na ordem das faixas) ou `{ ok: false, erro }`.
 */
export function validarAjustesDoMovimento(entrada, faixas) {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) return { ok: false, erro: 'os ajustes têm de ser um objeto' };
  for (const chave of Object.keys(entrada)) if (!(chave in faixas)) return { ok: false, erro: `ajuste desconhecido: ${chave}` };
  const ajustes = {};
  for (const [chave, [min, max]] of Object.entries(faixas)) {
    const v = entrada[chave];
    if (typeof v !== 'number' || !Number.isFinite(v)) return { ok: false, erro: `falta o ajuste ${chave} (um número)` };
    if (v < min || v > max) return { ok: false, erro: `${chave} fora da faixa (${min} a ${max}): ${v}` };
    ajustes[chave] = v;
  }
  return { ok: true, ajustes };
}

/** O mtime mais novo de uma pasta (recursivo, sem `node_modules` nem pastas de ponto) ou de um arquivo. */
function maisNovo(caminho) {
  if (!existsSync(caminho)) return 0;
  const st = statSync(caminho);
  if (!st.isDirectory()) return st.mtimeMs;
  let n = st.mtimeMs;
  for (const e of readdirSync(caminho, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    n = Math.max(n, maisNovo(join(caminho, e.name)));
  }
  return n;
}

/** Monta a prévia com o Vite (o mesmo `vite.config.ts` do jogo: o alias do Rapier e o plugin do Wasm). */
async function montarComVite({ raiz, saida }) {
  const { build } = await import('vite');
  await build({
    configFile: join(raiz, 'vite.config.ts'),
    root: join(raiz, 'scripts/estudio/mechs'),
    base: './',
    logLevel: 'warn',
    build: { outDir: saida, emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 5000 },
  });
}

/** `construir` troca a montagem (os testes não rodam o Vite). */
export function moduloMechs({ raiz, construir = montarComVite }) {
  const saida = resolve(raiz, SAIDA);
  const arquivoAjustes = join(raiz, ARQ_AJUSTES);
  const faixas = () => lerJson(join(raiz, ARQ_FAIXAS));
  const arquivoDesenho = join(raiz, ARQ_DESENHO);
  const faixasDoDesenho = () => lerJson(join(raiz, ARQ_FAIXAS_DESENHO));
  const pronta = () => existsSync(join(saida, 'index.html'));
  const desatualizada = () => !pronta() || FONTES.some((f) => maisNovo(join(raiz, f)) > statSync(join(saida, 'index.html')).mtimeMs);
  let montando = null;

  function estado() {
    try {
      return { ajustes: lerJson(arquivoAjustes), faixas: faixas(), desenho: lerJson(arquivoDesenho), faixasDoDesenho: faixasDoDesenho(), montado: pronta() };
    } catch (e) {
      // Um dado faltando ou quebrado não derruba o /api/estado dos outros módulos (sons, vozes): a aba mostra o erro.
      return { erro: String(e.message ?? e), montado: pronta() };
    }
  }

  async function montar() {
    if (!desatualizada()) return { montou: false };
    montando ??= (async () => {
      mkdirSync(saida, { recursive: true });
      const t0 = Date.now();
      await construir({ raiz, saida });
      return { montou: true, ms: Date.now() - t0 };
    })().finally(() => {
      montando = null;
    });
    return montando;
  }

  async function rotas({ req, res, responder, caminho }) {
    if (req.method === 'POST' && caminho === '/montar') {
      responder(200, await montar());
      return true;
    }
    if (req.method === 'GET' && caminho.startsWith('/app/')) {
      let rel;
      try {
        rel = decodeURIComponent(caminho.slice('/app/'.length));
      } catch {
        responder(404, { erro: 'não existe' });
        return true;
      }
      if (rel.startsWith('models/')) {
        const nome = rel.slice('models/'.length);
        const arquivo = join(resolve(raiz, MODELOS), nome);
        if (!NOME_DE_MODELO.test(nome) || !existsSync(arquivo) || !statSync(arquivo).isFile()) {
          responder(404, { erro: 'não existe' });
          return true;
        }
        responder(200, readFileSync(arquivo), 'model/gltf-binary');
        return true;
      }
      if (rel.startsWith('pecas/')) {
        const nome = rel.slice('pecas/'.length);
        const arquivo = join(resolve(raiz, PECAS), nome);
        if (!NOME_DE_MODELO.test(nome) || !existsSync(arquivo) || !statSync(arquivo).isFile()) {
          responder(404, { erro: 'não existe' });
          return true;
        }
        responder(200, readFileSync(arquivo), 'model/gltf-binary');
        return true;
      }
      const alvo = resolve(saida, rel === '' ? 'index.html' : rel);
      const tipo = TIPOS[extname(alvo)];
      // Só dentro da pasta montada, só tipos conhecidos, só arquivos (nunca `..`, nunca diretório).
      if (!alvo.startsWith(saida + sep) || !tipo || !existsSync(alvo) || !statSync(alvo).isFile()) {
        responder(404, { erro: 'não existe (monte a prévia primeiro)' });
        return true;
      }
      responder(200, readFileSync(alvo), tipo);
      return true;
    }
    if (req.method === 'PUT' && caminho === '/ajustes') {
      const corpo = await corpoJson(req);
      const r = validarAjustesDoMovimento(corpo?.ajustes, faixas());
      if (!r.ok) {
        responder(400, { erro: r.erro });
        return true;
      }
      gravarJson(arquivoAjustes, r.ajustes);
      responder(200, { ajustes: r.ajustes });
      return true;
    }
    if (req.method === 'PUT' && caminho === '/desenho') {
      const corpo = await corpoJson(req);
      const r = validarAjustesDoMovimento(corpo?.desenho, faixasDoDesenho());
      if (!r.ok) {
        responder(400, { erro: r.erro });
        return true;
      }
      gravarJson(arquivoDesenho, r.ajustes);
      responder(200, { desenho: r.ajustes });
      return true;
    }
    return false;
  }

  return { id: 'mechs', titulo: 'MECHS 3D', estado, rotas, pastasDoGit: [ARQ_AJUSTES, ARQ_DESENHO] };
}
