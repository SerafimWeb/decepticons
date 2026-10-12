import * as THREE from 'three';
import type { WeaponId } from '../combat/weapons';
import type { BurstOptions } from './ParticleSystem';
import { SHAPE } from './particleShapes';

/**
 * O que acontece na boca do cano quando a arma atira (dono, 11/10: *"melhorar os tiros: centelhas, rastros, caudas, tudo"*). Antes toda arma
 * soltava o mesmo punhado de pontos verdes na boca. O tiro de metal ganha o seu: a **língua de fogo da pólvora**, o clarão, a fumaça do cano e,
 * no automático, o **estojo** que salta de lado e cai.
 *
 * `null` = a arma segue com o clarão genérico do jogador (`PlayerController`); o `Record` obriga uma decisão por arma nova.
 * Quem solta é o `ProjectileSystem.fire`, então vale para o jogador, os bots e os outros jogadores do online (no servidor as partículas são vazias).
 * Custo: 6 partículas por tiro do automático (a 5 tiros/s = 30/s) e 16 por tiro do canhão pesado (um a cada 2,6 s).
 */
export interface MuzzleFx {
  /** O clarão e a fumaça, na direção do tiro. */
  flash: readonly BurstOptions[];
  /** O estojo vazio, que salta para o lado e para cima e cai com giro. */
  casing?: BurstOptions;
}

const c = (r: number, g: number, b: number): THREE.Color => new THREE.Color(r, g, b);
const POWDER = c(2.2, 1.35, 0.45);
const GAS = c(0.34, 0.33, 0.32);
const BRASS = c(1.2, 0.85, 0.3);
const SHOCK = c(0.8, 0.75, 0.7);

export const MUZZLE_FX: Readonly<Record<WeaponId, MuzzleFx | null>> = {
  cannon: {
    flash: [
      { count: 9, color: POWDER, speed: 24, life: 0.16, size: 3.6, spread: 0.4, gravity: 0, shape: SHAPE.streak },
      { count: 1, color: POWDER, speed: 0, life: 0.1, size: 5.5, expansion: 3, gravity: 0 },
      { count: 5, color: GAS, speed: 9, life: 0.9, size: 4.5, expansion: 3, spread: 1, gravity: -0.5, shape: SHAPE.puff },
      { count: 1, color: SHOCK, speed: 0, life: 0.24, size: 2, expansion: 4, gravity: 0, shape: SHAPE.ring },
    ],
  },
  autocannon: {
    flash: [
      { count: 4, color: POWDER, speed: 16, life: 0.07, size: 2, spread: 0.3, gravity: 0, shape: SHAPE.streak },
      { count: 1, color: POWDER, speed: 0, life: 0.06, size: 2.4, expansion: 1, gravity: 0 },
    ],
    casing: { count: 1, color: BRASS, speed: 4.5, life: 0.8, size: 1.5, spread: 0.4, gravity: 16, spin: 18, shape: SHAPE.casing },
  },
  siege: {
    flash: [
      { count: 14, color: POWDER, speed: 30, life: 0.18, size: 4.6, spread: 0.45, gravity: 0, shape: SHAPE.streak },
      { count: 1, color: POWDER, speed: 0, life: 0.12, size: 7.5, expansion: 4, gravity: 0 },
      { count: 7, color: GAS, speed: 10, life: 1.1, size: 6, expansion: 3.5, spread: 1, gravity: -0.5, shape: SHAPE.puff },
      { count: 1, color: SHOCK, speed: 0, life: 0.3, size: 2.6, expansion: 5, gravity: 0, shape: SHAPE.ring },
    ],
  },
  sonic: null, // a onda se desenha sozinha (`fx/WaveVisuals.ts`)
  plasma: null,
  blaster: null,
  shotgun: null,
  railgun: null,
  rotary: null,
  arc: null,
  cryo: null,
  emp: null,
  rockets: null,
  seeker: null,
  barrage: null,
  flamer: null,
  chainsaw: null,
};
