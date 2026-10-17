/**
 * A MARCHA DO DRAGA-01 (ordem P180, `AMAZONIA.md` § 4): o andar de um **quadrúpede pesado em quatro tempos** (dianteira esquerda, traseira direita, dianteira direita, traseira esquerda:
 * sempre três pés no chão), tudo **função pura de números**: sem Three, sem DOM, sem relógio nem sorteio (G1/G2/G14). Quem desenha (`WalkerVisual.ts`) lê a pose e escreve nos ossos.
 *
 * **Por que quatro tempos e não trote:** uma máquina de 38 m e centenas de toneladas não pode tirar duas pernas do chão ao mesmo tempo sem parecer que cai. Com a pisada de 75% do
 * ciclo (`GAIT.duty`) há sempre **pelo menos três pés no chão**, e o passo, em **5 m**, casa com a velocidade: o pé não escorrega (`advancePhase`).
 *
 * Convenções (as do jogo): **quadril positivo leva o pé para a frente (-Z)**; `lift` é a dobra do joelho que **levanta o pé** (sempre ≥ 0: o sinal do osso é do rig, medido na carga);
 * a esquerda é a do robô (a do jogo, -X), a frente é -Z.
 */

export type LegId = 'fl' | 'fr' | 'rl' | 'rr';
export const LEG_IDS: readonly LegId[] = ['fl', 'fr', 'rl', 'rr'];

/** A altura do Draga em metros (o arquivo mede 0,9839 unidades de altura). Tamanho 5 do chassi: o Colossus v4 tem 20 m. */
export const WALKER_HEIGHT_M = 38;
export const WALKER_FILE_HEIGHT = 0.9839;
/** Metros por unidade do arquivo. */
export const WALKER_SCALE = WALKER_HEIGHT_M / WALKER_FILE_HEIGHT;
/** O comprimento da perna do quadril ao tornozelo (medido no arquivo: 0,296 unidades). */
export const LEG_LENGTH_M = 0.296 * WALKER_SCALE;

/** A ordem dos passos de um ciclo: FL, RR, FR, RL; o deslocamento de fase de cada perna (fração do ciclo). */
export const LEG_OFFSET: Readonly<Record<LegId, number>> = { fl: 0, rr: 0.25, fr: 0.5, rl: 0.75 };

export const GAIT = {
  /** A fração do ciclo em que o pé está no chão (75%: três pés sempre apoiados). */
  duty: 0.75,
  /** A amplitude do quadril (rad): ±12,6° a partir do repouso. */
  hipAmp: 0.22,
  /** A dobra do joelho no meio do balanço, que levanta o pé (rad). */
  kneeLift: 0.95,
  /** O quanto o casco desce quando uma perna cai por inteiro (m, por perna). */
  dropPerCollapsedLegM: 2.2,
  /** A dobra do joelho de uma perna caída por inteiro (rad). */
  collapseFold: 1.15,
} as const;

/** O passo em metros: a distância que o pé anda para trás, em relação ao casco, durante a pisada. */
export const STRIDE_M = 2 * LEG_LENGTH_M * Math.sin(GAIT.hipAmp);

const frac = (x: number): number => x - Math.floor(x);
/** Limita a [0, 1]; número torto (NaN) vira 0: nenhuma pose estoura por causa de um dado ruim. */
const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** A fase do ciclo (0 a 1) depois de `dt` s andando a `speedMs` m/s: o pé em pisada anda para trás na mesma velocidade que o casco anda para a frente (não escorrega). */
export function advancePhase(phase: number, speedMs: number, dt: number): number {
  if (!(speedMs > 0) || !(dt > 0)) return frac(phase);
  return frac(phase + (GAIT.duty * speedMs * dt) / STRIDE_M);
}

/** A velocidade (m/s) que dá o ciclo de `seconds` s por volta completa (a inversa de `advancePhase`). */
export function speedForCycle(seconds: number): number {
  return STRIDE_M / (GAIT.duty * seconds);
}

export interface LegSwing {
  /** O quadril (rad), positivo = o pé vai para a frente. */
  hip: number;
  /** A dobra do joelho que levanta o pé (rad, ≥ 0). */
  lift: number;
  /** O pé está no ar (balanço)? */
  swinging: boolean;
}

/**
 * Uma perna na fase `phase` (0 a 1) do ciclo do corpo; `moving` (0 a 1) é o quanto ele anda (0 = parado, a perna fica no repouso). Escreve em `out` (G4: nada de objeto novo por
 * quadro); sem `out`, devolve um objeto novo (o teste).
 */
export function legSwing(phase: number, leg: LegId, moving = 1, out: LegSwing = { hip: 0, lift: 0, swinging: false }): LegSwing {
  const t = frac(phase + LEG_OFFSET[leg]);
  const m = clamp01(moving);
  const amp = GAIT.hipAmp * m;
  if (t < GAIT.duty) {
    // pisada: o quadril vai de +amp (a perna à frente) a -amp (a perna atrás), em linha reta
    out.hip = amp * (1 - (2 * t) / GAIT.duty);
    out.lift = 0;
    out.swinging = false;
    return out;
  }
  // balanço: a perna volta, com o pé levantado no meio
  const s = (t - GAIT.duty) / (1 - GAIT.duty);
  out.hip = amp * (-1 + 2 * smooth(s));
  out.lift = GAIT.kneeLift * m * Math.sin(Math.PI * s);
  out.swinging = true;
  return out;
}

export interface WalkerPose {
  legs: Record<LegId, { hip: number; lift: number; fold: number }>;
  /** O casco desce (m, ≥ 0) com o balanço da passada e com as pernas caídas. */
  bodyDrop: number;
  /** A inclinação do casco (rad): arfagem (positivo = nariz para baixo) e rolagem (positivo = o lado esquerdo desce). */
  pitch: number;
  roll: number;
  deckYaw: number;
  /** O giro dos dois guindastes (esquerdo e direito) e do prato do radar (rad). */
  craneLeft: number;
  craneRight: number;
  radar: number;
}

const CRANE_AMP = 0.28;
const RADAR_SPEED = 1.1;

/** Uma pose em repouso, para reaproveitar quadro a quadro (`walkerPose` escreve nela). */
export function newWalkerPose(): WalkerPose {
  const leg = () => ({ hip: 0, lift: 0, fold: 0 });
  return { legs: { fl: leg(), fr: leg(), rl: leg(), rr: leg() }, bodyDrop: 0, pitch: 0, roll: 0, deckYaw: 0, craneLeft: 0, craneRight: 0, radar: 0 };
}

const _swing: LegSwing = { hip: 0, lift: 0, swinging: false };

/**
 * A pose inteira: pernas, casco, convés, guindastes e radar. `phase` (0 a 1) vem de `advancePhase`; `moving` (0 parado a 1 a toda) modula a passada e o balanço do casco;
 * `collapse` é a queda de cada perna (0 de pé, 1 caída); `deckYaw` gira o convés sobre o casco (positivo vira a frente para a esquerda); `time` (s) move guindastes e radar.
 * Pura e **sem alocar** quando se passa `out` (G4).
 */
export function walkerPose(phase: number, moving: number, collapse: Readonly<Record<LegId, number>>, deckYaw: number, time: number, out: WalkerPose = newWalkerPose()): WalkerPose {
  const m = clamp01(moving);
  let collapsedTotal = 0;
  let front = 0;
  let rear = 0;
  let left = 0;
  let right = 0;
  for (const id of LEG_IDS) {
    const c = clamp01(collapse[id]);
    legSwing(phase, id, m * (1 - c), _swing);
    const o = out.legs[id];
    o.hip = _swing.hip * (1 - c) + c * (id[0] === 'f' ? 0.22 : -0.22);
    o.lift = _swing.lift * (1 - c);
    o.fold = c * GAIT.collapseFold;
    collapsedTotal += c;
    if (id[0] === 'f') front += c;
    else rear += c;
    if (id[1] === 'l') left += c;
    else right += c;
  }
  const bobPhase = 8 * Math.PI * phase; // quatro passos por ciclo: o casco mergulha uma vez a cada passo
  const walking = m * (1 - collapsedTotal / 4); // com as quatro pernas caídas o casco não balança de andar
  out.bodyDrop = walking * (0.18 + 0.14 * Math.cos(bobPhase)) + collapsedTotal * GAIT.dropPerCollapsedLegM;
  out.pitch = walking * 0.006 * Math.sin(bobPhase) + (front - rear) * 0.07;
  out.roll = walking * 0.012 * Math.sin(2 * Math.PI * phase) + (left - right) * 0.07;
  out.deckYaw = deckYaw;
  out.craneLeft = CRANE_AMP * Math.sin(time * 0.45);
  out.craneRight = CRANE_AMP * Math.sin(time * 0.45 + 2.1);
  out.radar = time * RADAR_SPEED;
  return out;
}
