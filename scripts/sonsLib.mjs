/**
 * O miolo do preparador de sons de arma (P146): funções puras (o teste não precisa do ffmpeg). O comando é `scripts/sons.mjs` (`npm run sons`), o estúdio é
 * `scripts/estudio-sons.mjs` (`npm run estudio`), o mapa de quais referências viram quais clipes é `scripts/sons-armas.json` e o de qual clipe toca em qual arma é
 * `client/src/audio/armasSom.json`.
 */

/** Confere o mapa de clipes: destinos únicos e em `.mp3`, corte válido, fade coerente, ganho extra limitado, alvos de nível plausíveis. Devolve os problemas (vazia = ok). */
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
    if (!s.fonte || s.fonte !== String(s.fonte).replace(/[\\/]/g, '')) erros.push(`${quem}: a fonte tem de ser só o nome de um arquivo da pasta de origem`);
    if (!(s.de >= 0) || !(s.ate > s.de)) erros.push(`${quem}: corte inválido (de ${s.de} até ${s.ate})`);
    else if (s.ate - s.de > 4) erros.push(`${quem}: corte de mais de 4 s não é som de arma`);
    if (!(s.fade_ms >= 0) || s.fade_ms / 1000 > (s.ate - s.de) / 2) erros.push(`${quem}: o fade não pode passar de metade do corte`);
    if (s.ganho_db !== undefined && !(s.ganho_db >= -24 && s.ganho_db <= 12)) erros.push(`${quem}: o ganho extra tem de ficar entre -24 e +12 dB`);
  }
  return erros;
}

/**
 * Confere a tabela de armas: cada arma tem de existir no jogo (`idsConhecidos`), apontar para um clipe que o mapa produz (`clipes`) e ter ganho, altura e duração plausíveis.
 * A duração máxima não pode passar do que o clipe dura na altura dada (`duracaoDe(clipe)`, em segundos), senão o fade do fim nunca é ouvido.
 */
export function validarArmas(armas, idsConhecidos, clipes, duracaoDe = () => Infinity) {
  const erros = [];
  const conhecidos = new Set(idsConhecidos);
  const existentes = new Set(clipes);
  for (const [id, a] of Object.entries(armas ?? {})) {
    if (!conhecidos.has(id)) erros.push(`${id}: arma que o jogo não conhece`);
    if (!existentes.has(a.clipe)) erros.push(`${id}: o clipe "${a.clipe}" não existe no mapa de sons`);
    if (!(a.ganho > 0 && a.ganho <= 1.5)) erros.push(`${id}: ganho entre 0 e 1,5`);
    if (!(a.pitch >= 0.5 && a.pitch <= 2)) erros.push(`${id}: altura (pitch) entre 0,5 e 2`);
    if (!(a.maxS >= 0.1 && a.maxS <= 6)) erros.push(`${id}: duração máxima entre 0,1 e 6 s`);
    else if (a.maxS > duracaoDe(a.clipe) / a.pitch + 0.01) erros.push(`${id}: a duração máxima (${a.maxS} s) passa do que o clipe dura nessa altura (${(duracaoDe(a.clipe) / a.pitch).toFixed(2)} s)`);
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
