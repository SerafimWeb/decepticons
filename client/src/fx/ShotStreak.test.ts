import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { weapon } from '../combat/weapons';
import {
  buildStreakGeometry,
  buildStreakMaterial,
  growingLength,
  STREAK_HEAD_WIDTH,
  STREAK_MAX,
  STREAK_MIN,
  STREAK_SECONDS,
  STREAK_TAIL_WIDTH,
  streakLength,
} from './ShotStreak';

describe('comprimento da cauda', () => {
  it('cobre um tempo de voo fixo, com piso e teto: o tiro lento tem cauda e o muito rápido não vira um raio', () => {
    expect(streakLength(140)).toBeCloseTo(140 * STREAK_SECONDS, 6); // plasma
    expect(streakLength(120)).toBeCloseTo(120 * STREAK_SECONDS, 6); // blaster e escopeta
    expect(streakLength(1)).toBe(STREAK_MIN);
    expect(streakLength(100_000)).toBe(STREAK_MAX);
    let previous = 0;
    for (let v = 0; v <= 400; v += 10) {
      const l = streakLength(v);
      expect(l).toBeGreaterThanOrEqual(previous);
      expect(l).toBeGreaterThanOrEqual(STREAK_MIN);
      expect(l).toBeLessThanOrEqual(STREAK_MAX);
      previous = l;
    }
  });

  it('as armas que usam a faixa têm cauda de verdade, mais longa que o elipsoide antigo (2,4 m)', () => {
    for (const id of ['plasma', 'blaster', 'shotgun'] as const) {
      expect(streakLength(weapon(id).speed), id).toBeGreaterThan(2.4);
    }
  });

  it('nasce curta e cresce com o caminho andado até o comprimento cheio (não atravessa o robô que atirou)', () => {
    const full = 5.6;
    expect(growingLength(full, 0)).toBeLessThan(1); // na boca quase não há cauda
    expect(growingLength(full, 0)).toBeGreaterThan(0);
    let previous = 0;
    for (let d = 0; d <= 10; d += 0.5) {
      const l = growingLength(full, d);
      expect(l).toBeGreaterThanOrEqual(previous);
      expect(l).toBeLessThanOrEqual(full);
      previous = l;
    }
    expect(growingLength(full, 100)).toBe(full);
    expect(growingLength(full, -3)).toBe(growingLength(full, 0)); // distância negativa não encolhe nem inverte
  });
});

describe('geometria da faixa', () => {
  const geo = buildStreakGeometry();
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('color');

  it('são duas faixas cruzadas, 8 vértices e 4 triângulos (a esfera antiga tinha 80)', () => {
    expect(pos.count).toBe(8);
    expect(geo.getIndex()!.count / 3).toBe(4);
    // Uma deitada (y = 0) e uma em pé (x = 0): de qualquer ângulo ao redor do eixo do tiro uma delas aparece.
    const flat = [0, 1, 2, 3].every((i) => pos.getY(i) === 0);
    const upright = [4, 5, 6, 7].every((i) => pos.getX(i) === 0);
    expect(flat && upright).toBe(true);
  });

  it('a cabeça fica em z = 0, larga e opaca; o fim em z = -1, mais fino e transparente', () => {
    for (const [head, tail] of [[[0, 1], [2, 3]], [[4, 5], [6, 7]]] as const) {
      for (const i of head) { expect(pos.getZ(i)).toBe(0); expect(col.getW(i)).toBe(1); }
      for (const i of tail) { expect(pos.getZ(i)).toBe(-1); expect(col.getW(i)).toBe(0); }
    }
    expect(col.itemSize).toBe(4); // RGBA: o alfa por vértice é o que apaga a cauda
    const headHalf = pos.getX(1);
    const tailHalf = pos.getX(2);
    expect(headHalf * 2).toBeCloseTo(1, 6); // largura unitária: o `Mesh` escala pela largura real
    expect(tailHalf / headHalf).toBeCloseTo(STREAK_TAIL_WIDTH / STREAK_HEAD_WIDTH, 6);
    expect(tailHalf).toBeLessThan(headHalf);
  });

  it('todo índice aponta para um vértice que existe', () => {
    const idx = geo.getIndex()!;
    for (let i = 0; i < idx.count; i++) expect(idx.getX(i)).toBeLessThan(pos.count);
  });
});

describe('material da faixa', () => {
  it('desenha numa passada só: o three faria duas (costas e frente, dois programas) num material transparente de dois lados', () => {
    const m = buildStreakMaterial(new THREE.Color(1, 1, 1));
    expect(m.transparent && m.side === THREE.DoubleSide).toBe(true); // o caso que o three desenha em duas passadas
    expect(m.forceSinglePass).toBe(true); // uma passada: um programa a compilar e um desenho por tiro
  });

  it('soma luz, não escreve profundidade, aparece dos dois lados e usa o alfa de cada vértice', () => {
    const m = buildStreakMaterial(new THREE.Color(0.9, 4, 1.5));
    expect(m.blending).toBe(THREE.AdditiveBlending);
    expect(m.depthWrite).toBe(false);
    expect(m.transparent).toBe(true);
    expect(m.vertexColors).toBe(true);
    expect(m.side).toBe(THREE.DoubleSide);
    expect(m.color.g).toBeGreaterThan(1); // HDR: passa do limiar do bloom
  });
});
