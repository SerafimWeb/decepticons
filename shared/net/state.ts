import { fromAngle, fromCm, fromFrac, fromPitch, toAngle, toCm, toFrac, toPitch, type Reader, type Writer } from './codec';

/**
 * Estado de uma unidade (Mech, andróide ou técnico) no pacote de estado do servidor, a 20 Hz (G11).
 * Quantizado: posição em cm, ângulos em 16 bits, vida de cada parte e calor em frações de 8 bits.
 * O que não muda a cada tick (nome, montagem, chassi) vai na lista de jogadores, não aqui.
 */
export const NET_PARTS = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;
export type NetPart = (typeof NET_PARTS)[number];

export interface UnitState {
  id: number;
  /** Pés da unidade (m). */
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** Vida de cada parte, como fração da máxima (0 = arrancada). */
  parts: Record<NetPart, number>;
  /** Calor, 0 a 1. */
  heat: number;
  alive: boolean;
  grounded: boolean;
  dashing: boolean;
  overheated: boolean;
  /** Aviso de carga (bit livre, mantém 19 bytes). Ausente em fixtures antigas = falso. */
  charging?: boolean;
  shield?: boolean;
}

/** Bytes de uma unidade: id, posição, 2 ângulos, 6 partes, calor e as flags. */
export const UNIT_BYTES = 19;

const ALIVE = 1;
const GROUNDED = 2;
const DASHING = 4;
const OVERHEATED = 8;
const CHARGING = 16;
const SHIELD = 32;

export function newUnitState(): UnitState {
  return {
    id: 0,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    parts: { torso: 1, head: 1, leftArm: 1, rightArm: 1, leftLeg: 1, rightLeg: 1 },
    heat: 0,
    alive: true,
    grounded: true,
    dashing: false,
    overheated: false,
    charging: false,
  };
}

export function writeUnit(w: Writer, s: UnitState): void {
  w.u8(s.id).i16(toCm(s.x)).i16(toCm(s.y)).i16(toCm(s.z)).u16(toAngle(s.yaw)).i16(toPitch(s.pitch));
  for (const p of NET_PARTS) w.u8(toFrac(s.parts[p]));
  w.u8(toFrac(s.heat)).u8((s.alive ? ALIVE : 0) | (s.grounded ? GROUNDED : 0) | (s.dashing ? DASHING : 0) | (s.overheated ? OVERHEATED : 0) | (s.charging ? CHARGING : 0) | (s.shield ? SHIELD : 0));
}

export function readUnit(r: Reader, out: UnitState): void {
  out.id = r.u8();
  out.x = fromCm(r.i16());
  out.y = fromCm(r.i16());
  out.z = fromCm(r.i16());
  out.yaw = fromAngle(r.u16());
  out.pitch = fromPitch(r.i16());
  for (const p of NET_PARTS) out.parts[p] = fromFrac(r.u8());
  out.heat = fromFrac(r.u8());
  const f = r.u8();
  if (f & ~(ALIVE | GROUNDED | DASHING | OVERHEATED | CHARGING | SHIELD)) r.bad = true;
  out.alive = (f & ALIVE) !== 0;
  out.grounded = (f & GROUNDED) !== 0;
  out.dashing = (f & DASHING) !== 0;
  out.overheated = (f & OVERHEATED) !== 0;
  out.charging = (f & CHARGING) !== 0;
  out.shield = (f & SHIELD) !== 0;
}
