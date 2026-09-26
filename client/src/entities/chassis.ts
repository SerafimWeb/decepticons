import { weapon, type WeaponId } from '../combat/weapons';
import type { MechStats } from './MechBase';

/**
 * Chassis: os números de cada robô, sem modelo 3D nem física (só dados). É o que a simulação, o Hangar,
 * o site e, no multiplayer, o servidor leem; o visual de cada um fica no arquivo do modelo
 * (`Vector09.ts`, `Android.ts`). Sem Three.js aqui: o servidor vai importar este arquivo.
 */

/**
 * Vector-09: assalto ágil, pulo duplo, dash curto; sem compartimento de sucata.
 * Calibrado em 24/09 (dono: "muito rápido; o tiro precisa de um respiro"): menos velocidade e calor na arma.
 * Armas em 25/09 (arsenal em `combat/weapons.ts`): plasma MK I no braço direito, foguetes MK I no esquerdo.
 * Carga de armas de 11 t (Hangar, 25/09): cabe MK III num braço e MK I no outro, nunca os dois no máximo.
 */
export const VECTOR09_STATS: MechStats = {
  name: 'VECTOR-09',
  moveSpeed: 12,
  groundAccel: 70,
  airAccel: 22,
  jumpVelocity: 13,
  maxJumps: 2,
  dashSpeed: 42,
  dashDuration: 0.18,
  dashCooldown: 3,
  radius: 1.3,
  height: 5.3,
  stepHeight: 0.9,
  demolishOnDash: false,
  maxScrapSlots: 0,
  loadout: { primary: weapon('plasma'), secondary: weapon('rockets') },
  weaponCapacity: 11,
  heatCooling: 0.6,
  heatCoolDelay: 0.25,
  heatRecover: 0.35,
  heatIdleCooling: 2,
  heatRun: 0.15,
  heatJump: 0.05,
  heatDash: 0.12,
  heatPerDamage: 0.002,
  maxModuleHealth: {
    torso: 300,
    head: 100,
    leftArm: 120,
    rightArm: 120,
    leftLeg: 150,
    rightLeg: 150,
  },
};

/**
 * Andróide rebelde, escala 1: um robô autônomo do tamanho dos humanoides de hoje (~2 m), uma IA
 * rebelde a pé. Mais chato do que perigoso (dono, 25/09: "rápido, mas fraco"): cai com 2 tiros de
 * plasma ou com 2 pisões de Mech; a arma dele é uma motosserra que só corta encostado (as pernas do Mech), mas arranca na hora, pula duas vezes e desvia com dash
 * a cada 1,4 s. Alvo pequeno: acertar exige mira de verdade (no toque, a mira assistida ajuda).
 * O mesmo corpo serve ao técnico (visor amarelo), que conserta os Mechs em vez de atirar.
 */
export const ANDROID_STATS: MechStats = {
  name: 'ANDRÓIDE A-1',
  moveSpeed: 10.5,
  groundAccel: 120,
  airAccel: 40,
  jumpVelocity: 10,
  maxJumps: 2,
  dashSpeed: 30,
  dashDuration: 0.14,
  dashCooldown: 1.4,
  radius: 0.45,
  height: 2,
  stepHeight: 0.45,
  demolishOnDash: false,
  maxScrapSlots: 0,
  loadout: { primary: weapon('chainsaw'), secondary: null },
  weaponCapacity: 1.5,
  heatCooling: 0.7,
  heatCoolDelay: 0.2,
  heatRecover: 0.3,
  heatIdleCooling: 2,
  heatRun: 0.08,
  heatJump: 0.02,
  heatDash: 0.05,
  heatPerDamage: 0.002,
  maxModuleHealth: {
    torso: 32,
    head: 13,
    leftArm: 16,
    rightArm: 16,
    leftLeg: 19,
    rightLeg: 19,
  },
};

/**
 * Andróide pilotado pelo jogador (dono, 25/09: "também quero poder jogar com andróides menores e ter a
 * impressão de que estou combatendo um Mech bem maior"). O mesmo corpo de 2 m e a mesma agilidade do
 * rebelde, mas 3× a vida (o jogador não pode cair com 2 tiros de plasma). Blaster no braço direito e
 * motosserra no esquerdo: de longe incomoda; colado, serra as pernas do Mech. Continua pequeno: um Mech
 * rebelde que anda para cima dele encostado esmaga em 2 passos, como qualquer pequeno.
 */
export const PILOT_ANDROID_STATS: MechStats = {
  ...ANDROID_STATS,
  name: 'ANDRÓIDE',
  loadout: { primary: weapon('blaster'), secondary: weapon('chainsaw') },
  weaponCapacity: 3,
  maxModuleHealth: {
    torso: 96,
    head: 40,
    leftArm: 48,
    rightArm: 48,
    leftLeg: 57,
    rightLeg: 57,
  },
};

/** Chassis que o jogador pode pilotar (o andróide rebelde e o técnico são só das IAs). */
export const CHASSIS = { vector09: VECTOR09_STATS, android: PILOT_ANDROID_STATS } as const satisfies Record<string, MechStats>;
export type ChassisId = keyof typeof CHASSIS;

/** O que cada braço aceita em cada chassi: o Hangar só oferece e só valida estas armas. */
export const ARM_SLOTS: Record<ChassisId, { right: readonly WeaponId[]; left: readonly WeaponId[] }> = {
  vector09: { right: ['plasma'], left: ['rockets'] },
  android: { right: ['blaster'], left: ['chainsaw'] },
};
