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
 * - **cinéticas** (trilho, escopeta, rotatória): faíscas de metal alaranjadas e rápidas, fagulhas e uma nuvem cinza de poeira (nada de brilho verde);
 * - **canhão automático**: a mesma família em menor (uma pancada seca por tiro, cinco por segundo);
 * - **canhão pesado**: o maior impacto do arsenal (um tiro a cada 2,6 s): chuva de faíscas de aço, brasas, uma onda de choque que se abre, o clarão e a poeira grossa.
 *
 * São objetos criados uma vez (G4/G5): o impacto só os entrega ao `ParticleSystem.burst`. No máximo 20 partículas por impacto (o canhão pesado, que bate
 * a cada 2,6 s, tem teto de 24).
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
const FLASH = c(2.4, 1.5, 0.6);
const SHOCK = c(1.4, 1.3, 1.1);

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

const AUTOMATICO: readonly BurstOptions[] = [
  { count: 6, color: STEEL_SPARK, speed: 26, life: 0.3, size: 1.9, spread: 0.8, gravity: 18, shape: SHAPE.streak },
  { count: 2, color: EMBER, speed: 7, life: 0.4, size: 1.1, spread: 1.2, gravity: 10, shape: SHAPE.dot },
  { count: 1, color: DUST, speed: 3, life: 0.5, size: 2.4, expansion: 1.2, spread: 0.7, gravity: -1, shape: SHAPE.puff },
];
const CANHAO: readonly BurstOptions[] = [
  { count: 12, color: STEEL_SPARK, speed: 40, life: 0.5, size: 3, spread: 0.95, gravity: 22, shape: SHAPE.streak },
  { count: 4, color: EMBER, speed: 12, life: 0.7, size: 1.6, spread: 1.3, gravity: 12, shape: SHAPE.dot },
  { count: 4, color: DUST, speed: 6, life: 1.3, size: 6, expansion: 3, spread: 0.9, gravity: -1, shape: SHAPE.puff },
  { count: 1, color: SHOCK, speed: 0, life: 0.32, size: 3, expansion: 10, gravity: 0, shape: SHAPE.ring },
  { count: 1, color: FLASH, speed: 0, life: 0.14, size: 6, expansion: 2.5, gravity: 0 },
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
  autocannon: AUTOMATICO,
  cannon: CANHAO,
  siege: CANHAO, // o titã bate com o mesmo aço do canhão, em dobro
  // Foguetes, chuva de mísseis, serra, lança-chamas e a onda sônica não batem por aqui: têm a explosão, o contato ou o cone deles.
  sonic: [],
  rockets: [],
  seeker: [],
  barrage: [],
  chainsaw: [],
  flamer: [],
};

/**
 * O rastro do tiro de gelo (dono, 11/10: "o rastro dele soltasse frio, partículas menores, pra dar mais a sensação de gelo frio"): uma **bruma de frio**
 * (fagulhas de gelo minúsculas, pálidas e que caem, mais um vapor azulado que sobe devagar) a cada metro do caminho, e só de vez em quando um floco
 * pequeno girando (a cada 3,5 m; antes era um floco grande a cada 1,6 m, que parecia pétala, não frio). Tudo abaixo de 1,2 de brilho: o frio é
 * pálido, nunca ofusca.
 */
const FROST_DUST = c(0.5, 0.78, 0.95);
const FROST_VAPOR = c(0.32, 0.5, 0.64);
const FROST_FLAKE = c(0.7, 0.95, 1.1);
export const ICE_MIST: readonly BurstOptions[] = [
  { count: 2, color: FROST_DUST, speed: 0.8, life: 0.5, size: 0.8, spread: 1, gravity: 1.4, shape: SHAPE.dot },
  { count: 1, color: FROST_VAPOR, speed: 0.4, life: 0.8, size: 1.5, expansion: 1, spread: 0.6, gravity: -0.3, shape: SHAPE.puff },
];
/** Distância entre duas lufadas da bruma (m). */
export const ICE_MIST_EVERY = 1;
/** O floco pequeno que o tiro de gelo ainda deixa de vez em quando. */
export const ICE_TRAIL: BurstOptions = { count: 1, color: FROST_FLAKE, speed: 0.5, life: 0.7, size: 1.4, spread: 0.6, gravity: 2, spin: 4, shape: SHAPE.flake };
/** Distância entre dois flocos do rastro (m). */
export const ICE_TRAIL_EVERY = 3.5;

/** A fumaça que o obus do canhão pesado deixa no caminho: um fiapo cinza que cresce e sobe devagar. */
export const SHELL_TRAIL: BurstOptions = { count: 1, color: c(0.34, 0.34, 0.34), speed: 0.4, life: 1.2, size: 3.4, expansion: 2.2, spread: 0.5, gravity: -0.4, shape: SHAPE.puff };
/** Distância entre dois fiapos de fumaça (m). */
export const SHELL_TRAIL_EVERY = 3;

/** Uma camada do rastro: o que soltar e a cada quantos metros do caminho. */
export interface TrailStep {
  fx: readonly BurstOptions[];
  every: number;
}

/** O rastro de partículas que cada tipo de tiro deixa no caminho (os outros não deixam nenhum): o gelo, bruma e flocos; o obus, fumaça. */
export const TRAIL_FX: Readonly<Partial<Record<'ice' | 'shell', readonly TrailStep[]>>> = {
  ice: [
    { fx: ICE_MIST, every: ICE_MIST_EVERY },
    { fx: [ICE_TRAIL], every: ICE_TRAIL_EVERY },
  ],
  shell: [{ fx: [SHELL_TRAIL], every: SHELL_TRAIL_EVERY }],
};
