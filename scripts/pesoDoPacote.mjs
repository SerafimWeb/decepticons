/**
 * O QUE ESTÁ DENTRO DOS 500 KB (P228): mostra quanto cada arquivo-fonte pesa (gzip, estimado) no **pacote de partida**, o que todo jogador baixa para abrir o jogo (`orcamentoDeJs.mjs`). Serve para
 * responder "isto precisa estar aqui?" com número, antes de escolher o que tirar do pacote e baixar sob demanda (o padrão da Amazônia, da Praça e da Praia: `environment/mapasSobDemanda.ts`).
 *
 * Uso: `npm run peso` (monta em `.tmp/peso/` com sourcemap, sem tocar no `dist/`) ou `node scripts/pesoDoPacote.mjs [--dist pasta] [--top 40]` sobre um build que já tenha `.map`.
 * O gzip por arquivo-fonte é uma **estimativa** (a razão de compressão do pedaço, aplicada aos bytes de cada fonte): serve para ordenar e comparar, não para fechar a conta.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chunksDePartida, entradaDoHtml, JS_PARTIDA_KB } from './orcamentoDeJs.mjs';

const args = process.argv.slice(2);
const valor = (nome, padrao) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : padrao);
const TOP = Number(valor('--top', '40'));
let dist = valor('--dist', '');

if (!dist) {
  dist = resolve('.tmp', 'peso');
  console.log('montando com sourcemap em .tmp/peso/ (não toca no dist/)…');
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--sourcemap', '--outDir', dist, '--emptyOutDir'], { stdio: 'ignore' });
}

const require = createRequire(import.meta.url);
const { SourceMapConsumer } = require('source-map-js');
const assets = join(dist, 'assets');
if (!existsSync(assets)) throw new Error(`sem ${assets}: monte o jogo antes (npm run build)`);

const jsFiles = readdirSync(assets).filter((f) => f.endsWith('.js'));
const codigos = new Map(jsFiles.map((f) => [f, readFileSync(join(assets, f), 'utf8')]));
const partida = chunksDePartida(codigos, entradaDoHtml(readFileSync(join(dist, 'index.html'), 'utf8')));
const gzDe = (f) => gzipSync(readFileSync(join(assets, f))).length;

const total = [...partida].reduce((s, f) => s + gzDe(f), 0);
const porFonte = new Map();
for (const f of partida) {
  const codigo = codigos.get(f);
  const mapaDoArquivo = join(assets, `${f}.map`);
  if (!existsSync(mapaDoArquivo)) continue;
  const mapa = new SourceMapConsumer(JSON.parse(readFileSync(mapaDoArquivo, 'utf8')));
  const razao = gzDe(f) / Buffer.byteLength(codigo);
  const linhas = codigo.split('\n');
  const marcas = [];
  mapa.eachMapping((m) => marcas.push(m));
  marcas.sort((a, b) => a.generatedLine - b.generatedLine || a.generatedColumn - b.generatedColumn);
  for (let i = 0; i < marcas.length; i++) {
    const m = marcas[i];
    const prox = marcas[i + 1];
    const n = prox && prox.generatedLine === m.generatedLine ? prox.generatedColumn - m.generatedColumn : (linhas[m.generatedLine - 1]?.length ?? 0) - m.generatedColumn + (prox ? 1 : 0);
    const fonte = (m.source ?? '(sem fonte)').replace(/^.*?(client|shared|node_modules)/, '$1').replace(/\\/g, '/');
    porFonte.set(fonte, (porFonte.get(fonte) ?? 0) + Math.max(0, n) * razao);
  }
}

console.log(`pacote de partida: ${(total / 1024).toFixed(1)} KB gzip de ${JS_PARTIDA_KB} KB (${partida.size} pedaços); folga ${((JS_PARTIDA_KB * 1024 - total) / 1024).toFixed(2)} KB`);
const lista = [...porFonte].sort((a, b) => b[1] - a[1]);
for (const [fonte, bytes] of lista.slice(0, TOP)) console.log(`${(bytes / 1024).toFixed(1).padStart(7)} KB  ${fonte}`);
const praia = lista.filter(([f]) => /Praia|Cabos|Estacao|QuadroDeLuz|Nucleo/.test(f)).reduce((s, [, b]) => s + b, 0);
console.log(`\n(dos quais, só da Estação dos Cabos: ${(praia / 1024).toFixed(1)} KB)`);
