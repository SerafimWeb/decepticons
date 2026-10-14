import type { WeaponStats } from './weapons';

/**
 * Perfil de mira (ordem P121 do Comandante: *"combinar a mira da ponta da arma com a mira no alvo... cada arma deve ter o
 * seu tempo pra mirar, alcance, amplitude"*).
 *
 * O que faz: a mira **assenta** — abre ao erguer a arma e fecha com o gatilho firme, cada arma no seu tempo. É a
 * identidade que o Comandante descreve (a de linha pede calma, a de perto quase não espera).
 *
 * **Cuidado (o acerto validado não muda):** a amplitude da mira **aberta** (`aimSpread`) está em **zero** para todas as
 * armas — hoje o "assentar" é só o desenho da mira, sem tocar em onde o tiro cai. Ligar a dispersão é uma linha por arma.
 *
 * Regra de simulação (G1/G2): só o `dt` do tick; determinístico, sem sorteio.
 */

/** Tempo de mira por faixa (s): a arma de linha assenta devagar, a de perto quase na hora. */
export const AIM_TIME_LINHA = 0.5;
export const AIM_TIME_MEDIA = 0.32;
export const AIM_TIME_PERTO = 0.18;

/**
 * O tempo (s) que a mira leva para assentar com esta arma na mão. Arma que declara `aimTime` manda; senão vale a faixa
 * pelo alcance ótimo. Corpo a corpo, chama e giro de cano **não assentam** (0): o corte é de encostar, a chama é um fluxo
 * e a rotatória já tem o tempo dela no giro do cano.
 */
export function aimTimeOf(w: WeaponStats): number {
  if (w.kind === 'melee' || w.spin !== undefined || w.flame !== undefined) return 0;
  if (w.aimTime !== undefined) return Math.max(0, w.aimTime);
  if (w.optimalRange >= 90) return AIM_TIME_LINHA;
  if (w.optimalRange >= 40) return AIM_TIME_MEDIA;
  return AIM_TIME_PERTO;
}

/** A amplitude da mira **aberta** (rad): a dispersão máxima que fecha a zero com a mira firme. Hoje toda arma está em 0. */
export function aimSpreadOf(w: WeaponStats): number {
  return Math.max(0, w.aimSpread ?? 0);
}

/**
 * Um passo do "assentar": `nivel` 0 = aberta (recém-erguida), 1 = firme. Sobe **segurando o gatilho** (em `time` s) e cai ao
 * soltar, na metade do tempo (soltar desassenta mais rápido do que assenta).
 */
export function settleStep(nivel: number, dt: number, held: boolean, time: number): number {
  if (time <= 0) return 1;
  const passo = dt / (held ? time : time * 0.5);
  return Math.max(0, Math.min(1, nivel + (held ? passo : -passo)));
}

/** A dispersão com a mira a `nivel`: a amplitude cheia em 0 (aberta), zero em 1 (firme). */
export function settleSpread(amplitude: number, nivel: number): number {
  const n = Math.max(0, Math.min(1, nivel));
  return amplitude * (1 - n);
}
