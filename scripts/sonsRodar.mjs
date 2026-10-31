/**
 * Quem roda o ffmpeg para o preparador de sons (`scripts/sons.mjs`) e para o Estúdio (`scripts/estudio.mjs`): uma função só, para o "Processar" do estúdio,
 * a prévia e o `npm run sons` darem exatamente o mesmo arquivo.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { argsDaMedicao, argsDoFfmpeg, ganhoParaAlvo, lerMedicao } from './sonsLib.mjs';
import { duracaoFinal } from './efeitosLib.mjs';

/** O `ffmpeg` do PATH, da variável FFMPEG, ou o do winget; `undefined` se não houver. */
export function acharFfmpeg() {
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

/** O que este ffmpeg sabe fazer: hoje, se tem o `rubberband` (tom e velocidade independentes, com qualidade de estúdio). */
export function capacidadesDoFfmpeg(ffmpeg) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-filters'], { encoding: 'utf8' });
  return { rubberband: / rubberband /.test((r.stdout ?? '') + (r.stderr ?? '')) };
}

/** A duração (s) de um arquivo, lida do próprio `ffmpeg` (`Duration: hh:mm:ss.xx`). `NaN` se não conseguir. */
export function duracaoDoArquivo(ffmpeg, arquivo) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', arquivo], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec((r.stderr ?? '') + (r.stdout ?? ''));
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number.NaN;
}

/** O pico (dBFS) de um arquivo inteiro, lido do `volumedetect` do ffmpeg (`-Infinity` para o zero absoluto). `NaN` se não conseguir medir. */
export function picoDoArquivo(ffmpeg, arquivo) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', arquivo, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /max_volume: (-inf|-?[\d.]+) dB/.exec((r.stderr ?? '') + (r.stdout ?? ''));
  return m ? (m[1] === '-inf' ? Number.NEGATIVE_INFINITY : Number(m[1])) : Number.NaN;
}

/**
 * Processa um clipe: mede o trecho (já com os efeitos), calcula o ganho até o alvo (mais o ganho extra do clipe) e grava o mp3 em `destinoDir`.
 * Devolve `{ ok: true, destino, duracao, picoDb, mediaDb, ganhoDb, kb }` ou `{ ok: false, erro }`. `duracao` é a de depois dos efeitos.
 */
export function processarSom({ ffmpeg, caps, origem, destinoDir, mapa, som }) {
  const entrada = join(origem, som.fonte);
  if (!existsSync(entrada)) return { ok: false, erro: `falta a fonte ${som.fonte}` };
  const c = caps ?? capacidadesDoFfmpeg(ffmpeg);
  const medida = spawnSync(ffmpeg, argsDaMedicao(som, entrada, c), { encoding: 'utf8' });
  const m = lerMedicao((medida.stderr ?? '') + (medida.stdout ?? ''));
  if (!m) return { ok: false, erro: 'não consegui medir o trecho' };
  const ganhoDb = ganhoParaAlvo(m.mediaDb, m.picoDb, mapa.alvo) + (som.ganho_db ?? 0);
  mkdirSync(destinoDir, { recursive: true });
  const saida = join(destinoDir, som.destino);
  const r = spawnSync(ffmpeg, argsDoFfmpeg(som, entrada, saida, ganhoDb, mapa.alvo, c), { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(saida)) return { ok: false, erro: `o ffmpeg falhou: ${(r.stderr ?? '').split('\n').slice(-3).join(' ').slice(0, 200)}` };
  return { ok: true, destino: som.destino, duracao: duracaoFinal(som), picoDb: m.picoDb, mediaDb: m.mediaDb, ganhoDb, kb: statSync(saida).size / 1024 };
}
