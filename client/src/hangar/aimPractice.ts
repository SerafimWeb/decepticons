/** Metros por lado e velocidade do alvo móvel no treino do Hangar. */
export const AIM_TARGET_HALF_LANE = 4.5;
export const AIM_TARGET_SPEED = 2.4;

/** Posição triangular, determinística e sem estado: o alvo percorre a faixa sem parar nos extremos. */
export function aimTargetXAt(seconds: number): number {
  const span = AIM_TARGET_HALF_LANE * 2;
  const distance = (Math.max(0, seconds) * AIM_TARGET_SPEED) % (span * 2);
  return distance <= span ? -AIM_TARGET_HALF_LANE + distance : AIM_TARGET_HALF_LANE - (distance - span);
}

/** Direção do passo no instante `seconds` (-1 = esquerda, +1 = direita). */
export function aimTargetDirectionAt(seconds: number): number {
  const span = AIM_TARGET_HALF_LANE * 2;
  const distance = (Math.max(0, seconds) * AIM_TARGET_SPEED) % (span * 2);
  return distance < span ? 1 : -1;
}
