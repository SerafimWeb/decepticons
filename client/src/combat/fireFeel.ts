import type { WeaponId, WeaponStats } from './weapons';

/**
 * Peso do tiro na câmera do jogador: quanto de tremor (trauma de `CameraRig.addShake`, 0..1) cada disparo dá. Só render,
 * nunca regra de jogo: não mexe na mira, na simulação nem na rede. A VISÃO promete "sensação de peso e massa", e até aqui
 * atirar não fazia a câmera sentir nada (só pouso, dano, explosão e abate tremiam).
 *
 * É uma tabela por arma, e `Record<WeaponId, …>` obriga uma arma nova a declarar o dela (o compilador reclama). O tremor
 * cresce com o quadrado do trauma, que acumula por tiro e decai 1,6 por segundo, então a cadência pesa junto: o plasma,
 * a 4,5 tiros/s, dá um zumbido leve; o trilho, um tiro a cada 1,4 s, dá um solavanco.
 */
export const FIRE_KICK: Readonly<Record<WeaponId, number>> = {
  blaster: 0.015,
  plasma: 0.05,
  emp: 0.09,
  arc: 0.06, // um estalo por tiro, a cada 0,45 s: pesa como o plasma, um pouco mais
  flamer: 0.015, // um pulso a cada 0,2 s: um tremor leve e constante, nada de coice
  cryo: 0.04, // um estalo seco a cada 0,6 s: o mais leve das armas de energia de apoio
  shotgun: 0.24,
  rockets: 0.2,
  seeker: 0.2,
  swarm: 0.015, // um míssil a cada 0,07 s: o tremor soma numa trepidação leve durante a salva, sem coice por míssil
  cruise: 0.42, // um só a cada 8 s: o solavanco de um lançamento grande, perto do canhão pesado
  laser: 0.012, // ~8 pulsos por segundo: um zumbido fino e constante
  barrage: 0.28,
  railgun: 0.4,
  cannon: 0.46, // um tiro a cada 2,6 s: o maior solavanco do arsenal (o MK III chega a 0,6, o teto da câmera)
  siege: 0.45, // o canhão do titã: 150 de dano, um tiro a cada 3,2 s — o maior obus depois do canhão dos Mechs
  sonic: 0.22, // um baque por aperto, a cada 1,2 s: pesa como a escopeta; as duas bocas dos ombros somam
  autocannon: 0.035, // 5 tiros/s: uma pancada curta por tiro, que soma numa trepidação firme
  rotary: 0.014, // 20 tiros/s somam: o zumbido da rajada, sem solavanco por bala
  chainsaw: 0, // corpo a corpo: a serra tem som e fagulha, e tremer a câmera o tempo todo cansaria
};

/** Cada nível (MK II, MK III) pesa um pouco mais, como o dano (+20%) e a carga (+50%) em `weapons.ts`. */
const TIER_STEP = 0.15;

/** Tremor de um tiro de `w`, no nível dela. Nunca passa do pouso mais forte (0,6). */
export function fireKick(w: WeaponStats): number {
  return Math.min(0.6, FIRE_KICK[w.id] * (1 + TIER_STEP * w.tier));
}
