/**
 * Prepara os sons de arma do jogo a partir das referências do Comandante (P146): apara, normaliza e converte, e grava em `client/public/audio/armas/`.
 *
 *   npm run sons                       # processa tudo o que está em scripts/sons-armas.json
 *   npm run sons -- --so arma_canhao   # só um (ou vários, separados por vírgula)
 *   npm run sons -- --origem <pasta>   # outra pasta de origem (padrão: .tmp/SOUNDS/ARMAS)
 *
 * Precisa do `ffmpeg` (no PATH, na variável FFMPEG, ou o do winget). Não gasta crédito de nada: é só processamento local.
 * Para ajustar à mão (cortar na onda, escolher o som de cada arma): `npm run estudio`. Para ouvir: `npm run ouvir`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarMapa } from './sonsLib.mjs';
import { acharFfmpeg, processarSom } from './sonsRodar.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valor = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const origem = resolve(valor('origem') ?? join(raiz, '.tmp/SOUNDS/ARMAS'));
const destinoDir = join(raiz, 'client/public/audio/armas');
const so = valor('so')?.split(',').map((s) => s.trim().replace(/\.mp3$/, '')).filter(Boolean);

const mapa = JSON.parse(readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8'));
const problemas = validarMapa(mapa);
if (problemas.length > 0) {
  console.error(`✗ o mapa tem problema:\n  - ${problemas.join('\n  - ')}`);
  process.exit(1);
}
const ffmpeg = acharFfmpeg();
if (!ffmpeg) {
  console.error('✗ ffmpeg não encontrado (instale com `winget install Gyan.FFmpeg` ou aponte a variável FFMPEG).');
  process.exit(1);
}
if (!existsSync(origem)) {
  console.error(`✗ a pasta de origem não existe: ${origem}\n  Largue os arquivos em .tmp/SOUNDS/ARMAS (ou use --origem <pasta>).`);
  process.exit(1);
}

let feitos = 0;
let falhas = 0;
console.log('destino                     duração   pico   média  ganho  tamanho   (de onde)');
for (const som of mapa.sons) {
  if (so && !so.includes(som.destino.replace(/\.mp3$/, ''))) continue;
  const r = processarSom({ ffmpeg, origem, destinoDir, mapa, som });
  if (!r.ok) {
    console.error(`  ✗ ${som.destino}: ${r.erro}`);
    falhas++;
    continue;
  }
  console.log(`${som.destino.padEnd(26)} ${r.duracao.toFixed(2).padStart(6)} s ${r.picoDb.toFixed(1).padStart(6)} ${r.mediaDb.toFixed(1).padStart(6)} ${(r.ganhoDb >= 0 ? '+' : '') + r.ganhoDb.toFixed(1).padStart(5)} ${r.kb.toFixed(1).padStart(6)} KB  ${som.fonte}`);
  feitos++;
}
console.log(`\n${feitos} som(ns) pronto(s) em client/public/audio/armas/${falhas ? `, ${falhas} com falha` : ''}.`);
process.exit(falhas > 0 ? 1 : 0);
