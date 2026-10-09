import * as THREE from 'three';

/**
 * Cauda dos tiros de energia: uma faixa fina que some para trás, em vez do elipsoide liso de antes. Só desenho: a colisão, o
 * alcance e o dano continuam sendo o raio do tick fixo (`ProjectileSystem.fixedUpdate`). Troca a esfera (80 triângulos) por
 * duas faixas cruzadas (4 triângulos) por tiro, então custa menos que o desenho anterior.
 * Referência de qualidade: `.decepticons/REFERENCIA_VISUAL.md` (o rastro com cauda dos tiros do MechArena).
 */

/** Quanto tempo de voo a cauda cobre: a 140 m/s (plasma), 5,6 m. */
export const STREAK_SECONDS = 0.04;
/** Limites do comprimento, em metros: o tiro lento ainda tem cauda e o muito rápido não vira um raio. */
export const STREAK_MIN = 2;
export const STREAK_MAX = 9;
/** Largura da faixa na cabeça e no fim da cauda, em metros (o elipsoide antigo tinha 0,4). */
export const STREAK_HEAD_WIDTH = 0.5;
export const STREAK_TAIL_WIDTH = 0.12;
/** A cabeça nasce na boca: a cauda só aparece conforme o tiro anda, para não atravessar o robô que atirou. */
const BIRTH_LENGTH = 0.4;

/** Comprimento da cauda de um tiro a `speed` m/s. */
export function streakLength(speed: number): number {
  return Math.min(STREAK_MAX, Math.max(STREAK_MIN, speed * STREAK_SECONDS));
}

/** Comprimento visível agora: cresce com a distância já percorrida até o completo. */
export function growingLength(full: number, traveled: number): number {
  return Math.min(full, Math.max(0, traveled) + BIRTH_LENGTH);
}

/**
 * Duas faixas cruzadas (uma deitada, uma em pé) ao longo de -Z: a cabeça em z = 0, largura 1 e alfa 1; o fim em z = -1, largura
 * menor e alfa 0. O `Mesh` escala x e y pela largura e z pelo comprimento, e `lookAt` aponta +Z para onde o tiro vai.
 * A cor sai do material (HDR, para o bloom); o alfa de cada vértice vem do atributo `color` com 4 componentes.
 */
export function buildStreakGeometry(): THREE.BufferGeometry {
  const head = 0.5;
  const tail = (head * STREAK_TAIL_WIDTH) / STREAK_HEAD_WIDTH;
  // Faixa A (largura em x) e faixa B (largura em y): cabeça (esq, dir) e fim (esq, dir).
  const positions = new Float32Array([
    -head, 0, 0, head, 0, 0, tail, 0, -1, -tail, 0, -1,
    0, -head, 0, 0, head, 0, 0, tail, -1, 0, -tail, -1,
  ]);
  const alpha = [1, 1, 0, 0, 1, 1, 0, 0];
  const colors = new Float32Array(alpha.length * 4);
  alpha.forEach((a, i) => colors.set([1, 1, 1, a], i * 4));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return geometry;
}

/** Material da faixa: soma luz (aditivo), sem escrever profundidade, nos dois lados, com o alfa de cada vértice. */
export function buildStreakMaterial(color: THREE.Color): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
