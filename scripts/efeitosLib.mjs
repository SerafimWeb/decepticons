/**
 * O motor de efeitos do Estúdio (P155): a cadeia de filtros do ffmpeg que cada clipe de som (e, depois, cada fala gravada) recebe. Funções puras: o teste não
 * precisa do ffmpeg, e a **prévia e o arquivo final usam exatamente a mesma cadeia** (`scripts/sonsLib.mjs` a monta, `scripts/sonsRodar.mjs` a roda).
 *
 * Um clipe guarda os efeitos num objeto opcional `efeitos`; campo ausente = efeito desligado. Tudo é limitado (`LIMITES`) para o arquivo importado
 * ou o JSON editado à mão nunca virar um filtro absurdo.
 */

export const LIMITES = {
  /** Velocidade (×): 0,5 estica para o dobro da duração; 2 comprime para a metade. Muda a duração, não o tom (com o `rubberband`). */
  velocidade: [0.5, 2],
  /** Tom em semitons (±12 = uma oitava). */
  pitch_st: [-12, 12],
  graves_db: [-12, 12],
  agudos_db: [-12, 12],
  /** 0 = desligado; senão corta abaixo desta frequência (Hz). */
  passa_alta_hz: [0, 2000],
  /** 0 = desligado; senão corta acima desta frequência (Hz). */
  passa_baixa_hz: [0, 16000],
  /** Redução de ruído em dB (0 = desligado): para gravação de microfone. */
  ruido_db: [0, 40],
  /** 0 a 1: o quanto o som é "esmagado" (saturação). */
  saturacao: [0, 1],
  /** Eco: atraso em ms (0 = desligado) e quanto cada repetição cai (0 a 0,8). */
  eco_ms: [0, 400],
  eco_decay: [0, 0.8],
  /** Fade de entrada em ms (o de saída é do próprio clipe, `fade_ms`). */
  fade_in_ms: [0, 2000],
};

/** O compressor de dinâmica em três forças (nome → filtro): segura os picos e levanta o miolo. */
export const COMPRESSORES = {
  leve: 'acompressor=threshold=0.35:ratio=2:attack=15:release=150:makeup=1.4',
  medio: 'acompressor=threshold=0.2:ratio=4:attack=10:release=120:makeup=2',
  forte: 'acompressor=threshold=0.1:ratio=8:attack=5:release=90:makeup=3',
};

const CAMPOS = new Set([...Object.keys(LIMITES), 'compressor', 'reverso']);

/** Confere o objeto de efeitos de um clipe; devolve os problemas (vazia = ok). `quem` é o nome do clipe, para a mensagem. */
export function validarEfeitos(e, quem = 'clipe') {
  const erros = [];
  if (e === undefined) return erros;
  if (e === null || typeof e !== 'object' || Array.isArray(e)) return [`${quem}: "efeitos" tem de ser um objeto`];
  for (const k of Object.keys(e)) if (!CAMPOS.has(k)) erros.push(`${quem}: efeito desconhecido "${k}"`);
  for (const [k, [min, max]] of Object.entries(LIMITES)) {
    if (e[k] === undefined) continue;
    if (typeof e[k] !== 'number' || !Number.isFinite(e[k]) || e[k] < min || e[k] > max) erros.push(`${quem}: ${k} tem de ficar entre ${min} e ${max}`);
  }
  if (e.passa_alta_hz > 0 && e.passa_alta_hz < 20) erros.push(`${quem}: passa_alta_hz abaixo de 20 Hz não faz nada (use 0 para desligar)`);
  if (e.passa_baixa_hz > 0 && e.passa_baixa_hz < 1000) erros.push(`${quem}: passa_baixa_hz abaixo de 1000 Hz abafa tudo (use 0 para desligar)`);
  if (e.eco_ms > 0 && e.eco_ms < 20) erros.push(`${quem}: eco_ms abaixo de 20 ms vira chiado (use 0 para desligar)`);
  if (e.compressor !== undefined && e.compressor !== 0 && !(e.compressor in COMPRESSORES)) erros.push(`${quem}: compressor tem de ser leve, medio ou forte`);
  if (e.reverso !== undefined && typeof e.reverso !== 'boolean') erros.push(`${quem}: reverso tem de ser verdadeiro ou falso`);
  return erros;
}

/** A velocidade de um clipe (1 se não há). */
export const velocidadeDe = (clip) => clip.efeitos?.velocidade ?? 1;

/** A duração do clipe depois dos efeitos (a velocidade muda a duração): é a que vale para o limite de 4 s, o fade e a duração máxima da arma. */
export const duracaoFinal = (clip) => (clip.ate - clip.de) / velocidadeDe(clip);

/** Os passos do `atempo` para um fator qualquer: o filtro só aceita de 0,5 a 2 por vez, então 0,3 vira 0,5 × 0,6. */
export function passosDeAtempo(fator) {
  const passos = [];
  let f = fator;
  while (f < 0.5) { passos.push(0.5); f /= 0.5; }
  while (f > 2) { passos.push(2); f /= 2; }
  passos.push(f);
  return passos;
}

/**
 * Tempo e tom independentes. Com o `rubberband` (qualidade de estúdio), é um filtro só; sem ele, o tom muda por `asetrate` (que muda a velocidade junto) e a
 * velocidade é corrigida com `atempo`. A taxa de 44,1 kHz é fixada antes (`aresample`), então a conta do `asetrate` vale para qualquer arquivo de origem.
 */
export function filtroDeTempoETom(velocidade, pitchSt, rubberband) {
  const p = Math.pow(2, pitchSt / 12);
  if (rubberband) return [`rubberband=tempo=${velocidade.toFixed(4)}:pitch=${p.toFixed(4)}`];
  const filtros = [];
  if (Math.abs(pitchSt) > 1e-9) filtros.push(`asetrate=${Math.round(44100 * p)}`, 'aresample=44100');
  const fator = velocidade / p;
  if (Math.abs(fator - 1) > 1e-9) for (const passo of passosDeAtempo(fator)) filtros.push(`atempo=${passo.toFixed(4)}`);
  return filtros;
}

/**
 * A cadeia de efeitos (depois do corte), na ordem que soa bem: reverso, limpeza (ruído, passa-alta, passa-baixa), tom e velocidade, equalização, saturação,
 * compressor e eco por último (para o compressor não "pisar" na cauda do eco). `caps.rubberband` diz se o ffmpeg tem o filtro de estúdio.
 */
export function filtrosDeEfeitos(e = {}, caps = { rubberband: false }) {
  const f = [];
  if (e.reverso) f.push('areverse');
  if (e.ruido_db > 0) f.push(`afftdn=nr=${e.ruido_db}:nf=-35`);
  if (e.passa_alta_hz > 0) f.push(`highpass=f=${e.passa_alta_hz}`);
  if (e.passa_baixa_hz > 0) f.push(`lowpass=f=${e.passa_baixa_hz}`);
  const velocidade = e.velocidade ?? 1;
  const pitch = e.pitch_st ?? 0;
  if (velocidade !== 1 || pitch !== 0) f.push(...filtroDeTempoETom(velocidade, pitch, caps.rubberband));
  if (e.graves_db) f.push(`bass=g=${e.graves_db}:f=110:w=0.7`);
  if (e.agudos_db) f.push(`treble=g=${e.agudos_db}:f=3200:w=0.7`);
  if (e.saturacao > 0) f.push(`volume=${(e.saturacao * 14).toFixed(1)}dB`, 'asoftclip=type=tanh', `volume=${(-e.saturacao * 6).toFixed(1)}dB`);
  if (e.compressor) f.push(COMPRESSORES[e.compressor]);
  if (e.eco_ms > 0) f.push(`aecho=0.8:0.7:${Math.round(e.eco_ms)}:${(e.eco_decay ?? 0.3).toFixed(2)}`);
  return f;
}

/** Os efeitos que estão ligados, em frases (para a tela e para o relatório): ["tom +3 st", "compressor forte", ...]. */
export function resumoDosEfeitos(e = {}) {
  const r = [];
  if (e.velocidade && e.velocidade !== 1) r.push(`velocidade ×${e.velocidade}`);
  if (e.pitch_st) r.push(`tom ${e.pitch_st > 0 ? '+' : ''}${e.pitch_st} st`);
  if (e.graves_db) r.push(`graves ${e.graves_db > 0 ? '+' : ''}${e.graves_db} dB`);
  if (e.agudos_db) r.push(`agudos ${e.agudos_db > 0 ? '+' : ''}${e.agudos_db} dB`);
  if (e.passa_alta_hz > 0) r.push(`passa-alta ${e.passa_alta_hz} Hz`);
  if (e.passa_baixa_hz > 0) r.push(`passa-baixa ${e.passa_baixa_hz} Hz`);
  if (e.ruido_db > 0) r.push(`ruído −${e.ruido_db} dB`);
  if (e.saturacao > 0) r.push(`saturação ${Math.round(e.saturacao * 100)}%`);
  if (e.compressor) r.push(`compressor ${e.compressor}`);
  if (e.eco_ms > 0) r.push(`eco ${e.eco_ms} ms`);
  if (e.reverso) r.push('reverso');
  return r;
}
