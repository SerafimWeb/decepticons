import * as THREE from 'three';
import type { WeaponId } from '../combat/weapons';
import { GLOW } from '../core/palette';
import type { BurstOptions } from './ParticleSystem';
import { SHAPE } from './particleShapes';

/**
 * O que cada arma faz onde o tiro bate (dono, 11/10: *"melhorar o formato, a cor e a presença dos tiros, os impactos, o local onde eles batem"*).
 * Antes todo tiro, de qualquer arma, soltava a mesma nuvem de faíscas verdes e redondas: o gelo, a elétrica, o EMP e uma bala de metal pareciam
 * a mesma coisa. Agora cada família tem **a sua forma e a sua cor**:
 *
 * - **plasma e blaster** (energia): faíscas alongadas verdes, um clarão e um anelzinho;
 * - **elétrica**: raios em zigue-zague azuis e uma estrela de brilho;
 * - **gelo**: flocos de seis braços e cacos de cristal que se espalham e caem devagar;
 * - **EMP**: dois anéis que crescem e um hexágono (o campo que apaga os sistemas);
 * - **cinéticas** (trilho, escopeta, rotatória): faíscas de metal alaranjadas e rápidas, fagulhas e uma nuvem cinza de poeira (nada de brilho verde).
 *
 * São objetos criados uma vez (G4/G5): o impacto só os entrega ao `ParticleSystem.burst`. No máximo 20 partículas por impacto.
 * O `Record` obriga uma entrada por arma nova.
 */
const c = (r: number, g: number, b: number): THREE.Color => new THREE.Color(r, g, b);

const STEEL_SPARK = c(2.2, 1.15, 0.35);
const EMBER = c(2.0, 0.8, 0.2);
const DUST = c(0.3, 0.3, 0.3);
const ARC = c(0.8, 2.1, 2.6);
const ICE = c(1.1, 1.7, 2.0);
const ICE_DEEP = c(0.7, 1.4, 1.9);
const EMP = c(0.6, 1.5, 2.2);

const PLASMA: readonly BurstOptions[] = [
  { count: 9, color: GLOW.spark, speed: 26, life: 0.3, size: 2.2, spread: 0.9, gravity: 14, shape: SHAPE.streak },
  { count: 2, color: GLOW.core, speed: 4, life: 0.16, size: 1.6, expansion: 0.5, gravity: 0 },
  { count: 1, color: GLOW.spark, speed: 0, life: 0.24, size: 2.4, expansion: 2.4, gravity: 0, shape: SHAPE.ring },
];
const ELETRICA: readonly BurstOptions[] = [
  { count: 3, color: ARC, speed: 5, life: 0.26, size: 4.2, spread: 1.4, gravity: 0, spin: 9, shape: SHAPE.bolt },
  { count: 4, color: ARC, speed: 20, life: 0.2, size: 2, spread: 1.2, gravity: 4, shape: SHAPE.streak },
  { count: 1, color: GLOW.core, speed: 0, life: 0.16, size: 3.6, expansion: 1.2, gravity: 0, shape: SHAPE.star },
];
const GELO: readonly BurstOptions[] = [
  { count: 5, color: ICE, speed: 7, life: 0.9, size: 3.6, spread: 1.3, gravity: 2.5, spin: 5, shape: SHAPE.flake },
  { count: 5, color: ICE_DEEP, speed: 14, life: 0.5, size: 2, spread: 1.2, gravity: 14, spin: 6, shape: SHAPE.shard },
];
const EMP_FX: readonly BurstOptions[] = [
  { count: 1, color: EMP, speed: 0, life: 0.4, size: 3.4, expansion: 4.2, gravity: 0, shape: SHAPE.ring },
  { count: 1, color: EMP, speed: 0, life: 0.55, size: 2.2, expansion: 5.5, gravity: 0, shape: SHAPE.ring },
  { count: 1, color: EMP, speed: 0, life: 0.45, size: 4.2, expansion: 1.4, gravity: 0, spin: 1.5, shape: SHAPE.hex },
  { count: 2, color: ARC, speed: 7, life: 0.28, size: 3.4, spread: 1.4, gravity: 0, spin: 8, shape: SHAPE.bolt },
];
const CINETICA: readonly BurstOptions[] = [
  { count: 10, color: STEEL_SPARK, speed: 32, life: 0.4, size: 2.4, spread: 0.85, gravity: 20, shape: SHAPE.streak },
  { count: 4, color: EMBER, speed: 9, life: 0.5, size: 1.3, spread: 1.2, gravity: 10, shape: SHAPE.dot },
  { count: 2, color: DUST, speed: 4, life: 0.8, size: 3.6, expansion: 1.6, spread: 0.7, gravity: -1, shape: SHAPE.puff },
];

export const IMPACT_FX: Readonly<Record<WeaponId, readonly BurstOptions[]>> = {
  plasma: PLASMA,
  blaster: PLASMA,
  arc: ELETRICA,
  cryo: GELO,
  emp: EMP_FX,
  railgun: CINETICA,
  shotgun: CINETICA,
  rotary: CINETICA,
  // Foguetes, chuva de mísseis, serra e lança-chamas não batem por aqui: têm a explosão ou o contato deles.
  rockets: [],
  barrage: [],
  chainsaw: [],
  flamer: [],
};

/** Um floco que o tiro de gelo deixa no caminho a cada 1,6 m (um rastro de cristais girando e caindo). */
export const ICE_TRAIL: BurstOptions = { count: 1, color: ICE, speed: 0.6, life: 0.7, size: 3.2, spread: 0.6, gravity: 2.5, spin: 4, shape: SHAPE.flake };
/** Distância entre dois flocos do rastro (m). */
export const ICE_TRAIL_EVERY = 1.6;
