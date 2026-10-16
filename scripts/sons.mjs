/**
 * Prepara os sons de arma do jogo a partir das referências do Comandante (P146): apara, normaliza e converte, e grava em `client/public/audio/armas/`.
 *
 *   npm run sons                       # processa tudo o que está em scripts/sons-armas.json
 *   npm run sons -- --so arma_canhao   # só um (ou vários, separados por vírgula)
 *   npm run sons -- --origem <pasta>   # outra pasta de origem (padrão: .tmp/SOUNDS/ARMAS)
 *
 * Precisa do `ffmpeg` (no PATH, na variável FFMPEG, ou o do winget). Não gasta crédito de nada: é só processamento local.
 * Depois, `npm run ouvir` abre a página para ouvir cada som (e comparar com o de antes).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argsDaMedicao, argsDoFfmpeg, ganhoParaAlvo, lerMedicao, validarMapa } from './sonsLib.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valor = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const origem = resolve(valor('origem') ?? join(raiz, '.tmp/SOUNDS/ARMAS'));
const destinoDir = join(raiz, 'client/public/audio/armas');
const so = valor('so')?.split(',').map((s) => s.trim().replace(/\.mp3$/, '')).filter(Boolean);

function acharFfmpeg() {
  const candidatos = [process.env.FFMPEG, 'ffmpeg'].filter(Boolean);
  const winget = join(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Packages');
  if (existsSync(winget)) {
    for (const pacote of readdirSync(winget).filter((p) => p.startsWith('Gyan.FFmpeg'))) {
      const dir = join(winget, pacote);
      for (const sub of readdirSync(dir)) {
        const exe = join(dir, sub, 'bin', 'ffmpeg.exe');
        if (existsSync(exe)) candidatos.push(exe);
      }
    }
  }
  return candidatos.find((c) => spawnSync(c, ['-version'], { encoding: 'utf8' }).status === 0);
}

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
mkdirSync(destinoDir, { recursive: true });

let feitos = 0;
let falhas = 0;
console.log('destino                     duração   pico   média  ganho  tamanho   (de onde)');
for (const s of mapa.sons) {
  if (so && !so.includes(s.destino.replace(/\.mp3$/, ''))) continue;
  const entrada = join(origem, s.fonte);
  if (!existsSync(entrada)) {
    console.error(`  ✗ ${s.destino}: falta a fonte ${s.fonte}`);
    falhas++;
    continue;
  }
  const medida = spawnSync(ffmpeg, argsDaMedicao(s, entrada), { encoding: 'utf8' });
  const m = lerMedicao((medida.stderr ?? '') + (medida.stdout ?? ''));
  if (!m) {
    console.error(`  ✗ ${s.destino}: não consegui medir o trecho`);
    falhas++;
    continue;
  }
  const ganho = ganhoParaAlvo(m.mediaDb, m.picoDb, mapa.alvo);
  const saida = join(destinoDir, s.destino);
  const r = spawnSync(ffmpeg, argsDoFfmpeg(s, entrada, saida, ganho, mapa.alvo), { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(saida)) {
    console.error(`  ✗ ${s.destino}: o ffmpeg falhou\n${(r.stderr ?? '').split('\n').slice(-4).join('\n')}`);
    falhas++;
    continue;
  }
  const kb = (statSync(saida).size / 1024).toFixed(1);
  console.log(`${s.destino.padEnd(26)} ${(s.ate - s.de).toFixed(2).padStart(6)} s ${m.picoDb.toFixed(1).padStart(6)} ${m.mediaDb.toFixed(1).padStart(6)} ${(ganho >= 0 ? '+' : '') + ganho.toFixed(1).padStart(5)} ${kb.padStart(6)} KB  ${s.fonte}`);
  feitos++;
}
console.log(`\n${feitos} som(ns) pronto(s) em client/public/audio/armas/${falhas ? `, ${falhas} com falha` : ''}.`);
process.exit(falhas > 0 ? 1 : 0);
