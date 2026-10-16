/**
 * O tamanho do estouro desenhado de cada arma explosiva (só desenho e som, nunca regra): o estouro do jogo (`Game.ts`, `Match.onExplosion`) era um só, o do foguete; com os
 * mísseis leves (2,2 m de explosão, dezenas por salva) e o cruzador (9 m) ele passa a escalar com o raio da explosão da arma. Uma salva de 32 mísseis com o estouro do foguete
 * soltaria ~3.000 partículas em dois segundos (o teto do `ParticleSystem`) e 32 baques de câmera e de som.
 */

/** O raio de explosão (m) que o estouro desenhado toma como tamanho normal: o do foguete. */
export const EXPLOSION_REFERENCE_M = 6;

/** Fração (0,25 a 1,8) do estouro normal para uma explosão de `blastRadius` metros: o piso mantém o míssil leve visível, o teto não deixa o cruzador encher a tela. */
export function explosionScale(blastRadius: number): number {
  return Math.min(1.8, Math.max(0.25, blastRadius / EXPLOSION_REFERENCE_M));
}

/** Até onde (m) o estouro de uma arma se ouve: além disto o som fica no piso do `AudioSystem.playExplosion`. */
export const EXPLOSION_HEARING_M = 60;

/**
 * A distância **normalizada (0 a 1)** que o `AudioSystem.playExplosion` espera (0 = colado, volume cheio; 1 = longe, no piso): a distância real até `EXPLOSION_HEARING_M`, mais um
 * abafamento para a explosão pequena (o míssil leve, escala 0,37, começa em 0,25 em vez de 0). Antes o jogo passava a distância em **metros** (qualquer coisa a mais de 1 m caía
 * no piso de 5% do volume): o estouro de foguete era quase mudo (R17, P152).
 */
export function explosionSoundDistance(dist: number, scale: number): number {
  return Math.min(1, Math.max(0, dist / EXPLOSION_HEARING_M) + (1 - Math.min(1, scale)) * 0.4);
}

/**
 * O tranco de câmera (trauma do `CameraRig.addShake`, 0 a 1) de uma explosão de escala `scale` (`explosionScale`) a `dist` metros (P160): alcança mais longe quanto maior a
 * explosão (30 m + 30 m por escala: o foguete, 60 m; o cruzador, 84 m) e cai com o quadrado da distância, então de perto o golpe é forte e de longe só um estremecer. Antes era
 * linear e parava aos 40 m para qualquer explosão: o cruzador a 50 m não sacudia nada.
 */
export function explosionShake(dist: number, scale: number): number {
  const reach = 30 + 30 * scale;
  const t = Math.max(0, 1 - dist / reach);
  return Math.min(0.9, 0.6 * scale * t * t);
}
