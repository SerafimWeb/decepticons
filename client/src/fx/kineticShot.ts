import * as THREE from 'three';
import { GLOW } from '../core/palette';

/**
 * O tiro de metal (dono, 11/10: *"sinto falta do tiro de aço, pois aparentemente todas as armas são de luz"*). Até aqui todo projétil era uma faixa
 * de luz aditiva; o canhão pesado e o automático ganham um **corpo sólido**: uma bala de aço (casco com ponta) que reflete a cor do aço, e só
 * a **cauda** é de luz (o rastro quente do ar aquecido atrás dela). Quem vê entende "isso é um pedaço de metal voando", não "um laser".
 *
 * Só desenho: a colisão, o alcance e o dano continuam sendo o raio do tick fixo (`ProjectileSystem.fixedUpdate`). A geometria é uma só,
 * compartilhada por todos os projéteis do pool (G4/G5); cada tiro só escala e orienta o corpo.
 */

/** As medidas do corpo e da cauda de cada tiro de metal (m). `radius` e `length` são do corpo de aço; `tail` e `tailWidth`, da faixa quente atrás dele. */
export interface KineticShape {
  radius: number;
  length: number;
  tail: number;
  tailWidth: number;
}

export const KINETIC: Readonly<Record<'shell' | 'slug', KineticShape>> = {
  /** Obus do canhão pesado: grosso e curto, com uma cauda quente mais fina que o corpo (a cauda larga lavava o aço e o obus virava um borrão branco). */
  shell: { radius: 0.2, length: 1.2, tail: 4.5, tailWidth: 0.3 },
  /** Projétil do canhão automático: fino, com uma cauda curta (5 por segundo, não pode virar uma cerca de luz). */
  slug: { radius: 0.065, length: 0.65, tail: 2.4, tailWidth: 0.1 },
};

/**
 * Uma bala: base reta, corpo cilíndrico e ponta arredondada, ao longo de Z com a ponta em +Z (para onde o tiro vai), de raio 1 e comprimento
 * 1 (o `Mesh` escala x e y pelo raio e z pelo comprimento). 8 segmentos × 5 faixas = 80 triângulos, compartilhados por todos os tiros.
 */
export function buildSlugGeometry(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0, -0.5),
    new THREE.Vector2(0.86, -0.5),
    new THREE.Vector2(1, -0.38),
    new THREE.Vector2(1, 0.08),
    new THREE.Vector2(0.72, 0.36),
    new THREE.Vector2(0, 0.5),
  ];
  const geometry = new THREE.LatheGeometry(profile, 8);
  geometry.rotateX(Math.PI / 2); // o eixo do torno (Y) vira o eixo do tiro (Z)
  return geometry;
}

/**
 * Aço do corpo: sem luz (o `MeshBasicMaterial` ignora as luzes e o bloom só acende o que passa de 1), então o projétil se vê sem ofuscar. O do jogador é
 * aço frio; o do inimigo, aço avermelhado: o jogador distingue de quem é pelo corpo e pela cauda.
 */
export const STEEL = {
  friendly: new THREE.Color(0.8, 0.86, 0.94),
  hostile: new THREE.Color(0.9, 0.46, 0.4),
} as const;

export function buildSteelMaterial(color: THREE.Color): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}

/** A cor da cauda quente: laranja-amarelado para o jogador, laranja-avermelhado para o inimigo. */
export const SLUG_TAIL = { friendly: GLOW.friendlySlug, hostile: GLOW.hostileSlug } as const;
