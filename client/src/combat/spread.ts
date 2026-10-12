import * as THREE from 'three';

/** Desvio do tiro em relação à mira, em radianos: `x` para a direita, `y` para cima. */
export interface Spread {
  x: number;
  y: number;
}

/** Sem desvio: o que todo tiro que não é da rotatória recebe. */
export const NO_SPREAD: Readonly<Spread> = Object.freeze({ x: 0, y: 0 });

const GOLDEN_ANGLE = 2.399963229728653;
const GOLDEN_RATIO = 0.6180339887498949;
const UP = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

/**
 * Onde cai o tiro número `shot` dentro de um cone de abertura `cone` (rad): um girassol de ângulo áureo, que preenche o círculo
 * por igual sem repetir lugar e **sem sorteio** (G1/G2: o mesmo número de tiro dá o mesmo desvio no servidor e no cliente).
 */
export function spreadAt(shot: number, cone: number, out: Spread): Spread {
  const radius = cone * Math.sqrt((shot * GOLDEN_RATIO) % 1);
  const angle = shot * GOLDEN_ANGLE;
  out.x = Math.cos(angle) * radius;
  out.y = Math.sin(angle) * radius;
  return out;
}

/** Desvia `dir` (normalizada) por `s`, no plano perpendicular a ela. Sem alocação (G4). */
export function applySpread(dir: THREE.Vector3, s: Readonly<Spread>): THREE.Vector3 {
  if (s.x === 0 && s.y === 0) return dir;
  _right.crossVectors(dir, UP);
  if (_right.lengthSq() < 1e-8) _right.set(1, 0, 0); // mirando reto para cima ou para baixo: qualquer lado serve
  else _right.normalize();
  _up.crossVectors(_right, dir);
  return dir.addScaledVector(_right, s.x).addScaledVector(_up, s.y).normalize();
}
