import { DAMAGE_TYPE, type DamageType, type WeaponStats } from './weapons';

/**
 * A reação do robô ao tiro (dono, 11/10, P69: "melhorar impactos, local onde eles batem, **reação nos inimigos**"). Todo tiro que passa pela defesa e arranca
 * vida agora **empurra** o alvo e **dá um tranco no torso** dele, na medida do que bateu. Duas partes, só dado e uma conta:
 *
 * - **O empurrão** (`MechBase.push`, regra de simulação: o servidor e o jogo offline aplicam igual): `PUSH_PER_DAMAGE` m/s por ponto de dano que **passou** (o escudo que
 *   absorveu tudo não empurra), por natureza do dano, até `HIT_PUSH_MAX`. O robô grande resiste mais (`push` divide pela resistência dele: o Colossus quase não sai do lugar).
 *   Pulso, som, corte e choque não empurram (o som já tem o empurrão dele; o resto não é um golpe de massa) e **o lança-chamas, a onda sônica e o arpão ficam de fora** (fluxo e cone
 *   têm a regra própria).
 * - **O tranco** (`MechBase.flinch`, só desenho): o torso se joga para onde o tiro andava, até `FLINCH_MAX`, e volta sozinho em ~0,3 s.
 *
 * Os números são pequenos de propósito: um canhão pesado (90) empurra 4,5 m/s (o teto), o plasma ~0,5, uma rajada de rotatória soma um empurrão de ~1,5 m/s em regime. Dado puro:
 * o servidor e o site leem o mesmo arquivo.
 */
export const PUSH_PER_DAMAGE: Readonly<Record<DamageType, number>> = {
  balistico: 0.05,
  explosivo: 0.04,
  laser: 0.02,
  termico: 0.015,
  criogenico: 0.01,
  pulso: 0,
  sonico: 0,
  corte: 0,
  eletrico: 0,
};

/** O teto do empurrão de um acerto (m/s), antes da resistência do alvo. */
export const HIT_PUSH_MAX = 4.5;

/** Radianos de tranco por ponto de dano, o teto, e quão rápido o torso volta (1/s). */
export const FLINCH_PER_DAMAGE = 0.0025;
export const FLINCH_MAX = 0.14;
export const FLINCH_DECAY = 9;

/** Quanto este acerto empurra o alvo (m/s a queima-roupa, antes da resistência dele). `applied` = o dano que passou. */
export function hitPush(w: Pick<WeaponStats, 'id' | 'flame' | 'wave' | 'hook'>, applied: number): number {
  if (w.flame || w.wave || w.hook || applied <= 0) return 0;
  return Math.min(HIT_PUSH_MAX, applied * PUSH_PER_DAMAGE[DAMAGE_TYPE[w.id]]);
}

/** O tranco do torso por este acerto (rad), qualquer arma: até um tiro fraco mexe um pouco. */
export function hitFlinch(applied: number): number {
  return Math.min(FLINCH_MAX, Math.max(0, applied) * FLINCH_PER_DAMAGE);
}
