/**
 * OTIMIZA UM VÍDEO PARA UM TELÃO (P254): recorta um trecho de uma gravação (ex.: `D:\imagens cybermech\*.webm`, fora do
 * repositório) e reencoda para um `.mp4` pequeno, pronto para `client/public/telao/` — o Comandante escolhe o trecho
 * (não o agente: só ele sabe quais gravações são boas), a ferramenta faz o recorte e a compressão. Reaproveita o
 * mesmo `ffmpeg` do projeto (`scripts/sonsRodar.mjs`, o mesmo do Estúdio e de `scripts/cutscene.mjs`).
 *
 *   node scripts/otimizar-video-telao.mjs --entrada "D:\imagens cybermech\arquivo.webm" --inicio 12 --duracao 8 --saida arena-trailer.mp4
 *   node scripts/otimizar-video-telao.mjs --entrada ... --inicio 5 --duracao 6 --saida marauder.mp4 --largura 1280 --bitrate 2500k
 *
 * Depois de pronto: uma linha nova em `ARQUIVOS_DE_TELAO` (`shared/telao.ts`) liga o arquivo ao painel TELÕES ▸.
 */
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { acharFfmpeg } from './sonsRodar.mjs';

const args = process.argv.slice(2);
const valor = (chave) => (args.includes(chave) ? args[args.indexOf(chave) + 1] : null);

const entrada = valor('--entrada');
const saidaNome = valor('--saida');
const inicio = Number(valor('--inicio') ?? '0');
const duracao = Number(valor('--duracao') ?? '8');
const largura = Number(valor('--largura') ?? '960');
const bitrate = valor('--bitrate') ?? '1500k';

if (!entrada || !saidaNome) {
  console.error('uso: node scripts/otimizar-video-telao.mjs --entrada <arquivo.webm> --saida <nome.mp4> [--inicio s] [--duracao s] [--largura px] [--bitrate ex.:1500k]');
  process.exit(1);
}
if (!existsSync(entrada)) {
  console.error(`não achei o arquivo de entrada: ${entrada}`);
  process.exit(1);
}
// O nome de saída vira o caminho dentro de client/public/telao/: nunca aceita pasta nem ".." (teria que escapar dali).
if (!/^[a-z0-9][a-z0-9_-]*\.mp4$/i.test(saidaNome)) {
  console.error('--saida precisa ser só um nome de arquivo (letras, números, - ou _) terminando em .mp4, sem pasta');
  process.exit(1);
}
if (!Number.isFinite(inicio) || inicio < 0 || !Number.isFinite(duracao) || duracao <= 0 || duracao > 30) {
  console.error('--inicio precisa ser >= 0 e --duracao entre 0 e 30 s (é uma tela de fundo em loop, não um filme)');
  process.exit(1);
}

const ffmpeg = acharFfmpeg();
if (!ffmpeg) {
  console.error('ffmpeg não encontrado no PATH (nem em FFMPEG=, nem no winget): instale o ffmpeg e rode de novo.');
  process.exit(1);
}

const pastaDeSaida = resolve('client', 'public', 'telao');
mkdirSync(pastaDeSaida, { recursive: true });
const saida = resolve(pastaDeSaida, saidaNome);

// -an (sem áudio: a tela é sempre muda), -vf scale (reduz resolução), -b:v (teto de bitrate: controla o tamanho final),
// loop no vídeo é feito pelo navegador (HTMLVideoElement.loop), não aqui: o arquivo em si não se repete sozinho.
const r = spawnSync(
  ffmpeg,
  ['-y', '-ss', String(inicio), '-i', entrada, '-t', String(duracao), '-vf', `scale=${largura}:-2`, '-an', '-c:v', 'libx264', '-b:v', bitrate, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', saida],
  { encoding: 'utf8' },
);
if (r.status !== 0 || !existsSync(saida)) {
  console.error('o ffmpeg falhou:', (r.stderr ?? '').split('\n').slice(-8).join('\n'));
  process.exit(1);
}
const kb = (statSync(saida).size / 1024).toFixed(0);
console.log(`vídeo pronto: ${saida} (${kb} KB)`);
console.log(`próximo passo: acrescentar '${saidaNome}' em ARQUIVOS_DE_TELAO (shared/telao.ts) e commitar o arquivo.`);
