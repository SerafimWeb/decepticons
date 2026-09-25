import type { MechInput } from '../entities/MechBase';

/**
 * Direção e giro para os cérebros de IA (BotController, TechnicianController). Convenção do jogo:
 * com yaw 0 a frente é -Z; yaw positivo gira para a esquerda. Funções puras, sem alocação.
 */

/** Ângulo levado para -π..π. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}

/** Yaw que faz o Mech olhar para a direção (dx, dz). */
export function yawOf(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

/** Gira `from` em direção a `to`, no máximo `maxStep` radianos. */
export function turnToward(from: number, to: number, maxStep: number): number {
  const d = wrapAngle(to - from);
  return wrapAngle(from + Math.max(-maxStep, Math.min(maxStep, d)));
}

/**
 * Movimento no mundo (x, z) → o MechInput no referencial do torso (frente = (-sin, -cos),
 * direita = (cos, -sin)), com o torso olhando para `yaw`. Escreve em `cmd`.
 */
export function setLocalMove(cmd: MechInput, worldX: number, worldZ: number, yaw: number): void {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  cmd.moveYaw = yaw;
  cmd.yaw = yaw;
  cmd.moveX = worldX * cos - worldZ * sin;
  cmd.moveZ = -worldX * sin - worldZ * cos;
}
