/**
 * O miolo do preparador de sons de arma (P146): funções puras (o teste não precisa do ffmpeg). O comando é `scripts/sons.mjs` (`npm run sons`) e o mapa de
 * quais referências viram quais sons é `scripts/sons-armas.json`.
 */

/** Confere o mapa: destinos únicos e em `.mp3`, corte válido, fade coerente, alvos de nível plausíveis. Devolve a lista de problemas (vazia = ok). */
export function validarMapa(mapa) {
  const erros = [];
  const alvo = mapa.alvo ?? {};
  if (!(alvo.media_db < alvo.pico_db) || alvo.pico_db > 0) erros.push('alvo: a média tem de ser menor que o pico e o pico não pode passar de 0 dBFS');
  if (alvo.media_db < -40) erros.push('alvo: média abaixo de -40 dB some no jogo');
  const vistos = new Set();
  for (const s of mapa.sons ?? []) {
    const quem = s.destino ?? '(sem destino)';
    if (!/^arma_[a-z0-9_]+\.mp3$/.test(s.destino ?? '')) erros.push(`${quem}: o destino tem de ser arma_<nome>.mp3`);
    if (vistos.has(s.destino)) erros.push(`${quem}: destino repetido`);
    vistos.add(s.destino);
    if (!s.fonte) erros.push(`${quem}: sem fonte`);
    if (!(s.de >= 0) || !(s.ate > s.de)) erros.push(`${quem}: corte inválido (de ${s.de} até ${s.ate})`);
    else if (s.ate - s.de > 4) erros.push(`${quem}: corte de mais de 4 s não é som de arma`);
    if (!(s.fade_ms >= 0) || s.fade_ms / 1000 > (s.ate - s.de) / 2) erros.push(`${quem}: o fade não pode passar de metade do corte`);
  }
  return erros;
}

/**
 * O ganho (dB) que leva a média ao alvo sem estourar o pico: o menor entre "chegar na média" e "o pico encostar no teto". Um som já mais baixo que o alvo sobe;
 * um muito dinâmico (pico alto, média baixa) sobe só até o pico caber, em vez de estourar.
 */
export function ganhoParaAlvo(mediaDb, picoDb, alvo) {
  return Math.min(alvo.media_db - mediaDb, alvo.pico_db - picoDb);
}

/** Os argumentos do ffmpeg para um som: corta, aplica o ganho, fade de saída (e de entrada de 3 ms contra clique), limita o pico, mono, mp3. */
export function argsDoFfmpeg(s, entrada, saida, ganhoDb, alvo) {
  const dur = s.ate - s.de;
  const fade = s.fade_ms / 1000;
  const filtros = [
    `atrim=start=${s.de}:end=${s.ate}`,
    'asetpts=PTS-STARTPTS',
    `volume=${ganhoDb.toFixed(2)}dB`,
    'afade=t=in:st=0:d=0.003',
    `afade=t=out:st=${Math.max(0, dur - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
    `alimiter=limit=${Math.pow(10, alvo.pico_db / 20).toFixed(3)}:level=disabled`,
  ].join(',');
  return ['-hide_banner', '-nostats', '-y', '-i', entrada, '-af', filtros, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', saida];
}

/** Os argumentos da medição (pico e média) do trecho cortado, antes do ganho. */
export function argsDaMedicao(s, entrada) {
  return ['-hide_banner', '-nostats', '-i', entrada, '-af', `atrim=start=${s.de}:end=${s.ate},asetpts=PTS-STARTPTS,volumedetect`, '-f', 'null', '-'];
}

/** Lê pico e média do texto que o `volumedetect` escreve. */
export function lerMedicao(texto) {
  const pico = /max_volume: (-?[\d.]+) dB/.exec(texto)?.[1];
  const media = /mean_volume: (-?[\d.]+) dB/.exec(texto)?.[1];
  if (pico === undefined || media === undefined) return null;
  return { picoDb: Number(pico), mediaDb: Number(media) };
}
