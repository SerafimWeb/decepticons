import { fromAngle, fromAxis, fromPitch, toAngle, toAxis, toPitch, type Reader, type Writer } from './codec';

/**
 * Comando de um tick, do cliente para o servidor (G13: o cliente manda só comando, nunca número de jogo).
 * É o `MechInput` da simulação mais o que o tiro precisa: inclinação da mira e os dois gatilhos.
 * O tick não viaja em cada comando: o pacote leva o primeiro, e os seguintes são consecutivos.
 */
export interface NetInput {
  /** Tick da simulação a que este comando se aplica. */
  tick: number;
  /** -1 a 1, direita positiva. */
  moveX: number;
  /** -1 a 1, frente positiva. */
  moveZ: number;
  /** Referencial do WASD (câmera). */
  moveYaw: number;
  /** Para onde o torso aponta (a mira). */
  yaw: number;
  /** Inclinação da mira (-π/2 a π/2): o tiro sai na direção de yaw e pitch. */
  pitch: number;
  jump: boolean;
  dash: boolean;
  /** Gatilho da arma do braço direito. */
  fire: boolean;
  /** Gatilho da arma do braço esquerdo (foguetes ou motosserra). */
  secondary: boolean;
}

/** Bytes de um comando no pacote: 2 eixos, 3 ângulos e os botões. */
export const INPUT_BYTES = 9;

const JUMP = 1;
const DASH = 2;
const FIRE = 4;
const SECONDARY = 8;

export function newNetInput(): NetInput {
  return { tick: 0, moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, pitch: 0, jump: false, dash: false, fire: false, secondary: false };
}

export function writeInput(w: Writer, i: NetInput): void {
  w.i8(toAxis(i.moveX))
    .i8(toAxis(i.moveZ))
    .u16(toAngle(i.moveYaw))
    .u16(toAngle(i.yaw))
    .i16(toPitch(i.pitch))
    .u8((i.jump ? JUMP : 0) | (i.dash ? DASH : 0) | (i.fire ? FIRE : 0) | (i.secondary ? SECONDARY : 0));
}

/** Lê um comando para dentro de `out` (sem alocar). Bits desconhecidos nos botões: comando ruim. */
export function readInput(r: Reader, tick: number, out: NetInput): void {
  out.tick = tick;
  out.moveX = fromAxis(r.i8());
  out.moveZ = fromAxis(r.i8());
  out.moveYaw = fromAngle(r.u16());
  out.yaw = fromAngle(r.u16());
  out.pitch = fromPitch(r.i16());
  const b = r.u8();
  if (b & ~(JUMP | DASH | FIRE | SECONDARY)) r.bad = true;
  out.jump = (b & JUMP) !== 0;
  out.dash = (b & DASH) !== 0;
  out.fire = (b & FIRE) !== 0;
  out.secondary = (b & SECONDARY) !== 0;
}
