import * as THREE from 'three';

/**
 * Paleta do jogo: âmbar industrial, a mesma identidade do site (terminal de fósforo, aço, luz de
 * sódio). Sem o azul e o roxo do neon genérico, que o dono vê como "cara de feito com IA" (24/09).
 * Fonte única das cores do mundo 3D; a interface usa as mesmas cores nas variáveis do styles.css.
 */
export const PALETTE = {
  // Ambiente
  sky: 0x0a0906,
  fog: 0x15110b,
  ground: 0x0b0a08,
  gridMain: 0x8f6a28,
  gridSub: 0x3e3018,
  steel: 0x2d2b27,
  steelDark: 0x11100d,
  // Destaques
  amber: 0xffb000,
  sodium: 0xff8a1f,
  bone: 0xe8dcc4,
  signal: 0xff3b1f,
  // Mechs
  playerPaint: 0xd94a1a,
  enemyPaint: 0x6f7a3a,
  armor: 0x5f5c55,
  frame: 0x22211e,
  // Luzes
  skyLight: 0xffd9a0,
  groundLight: 0x16110a,
  keyLight: 0xff9a3c,
  rimLight: 0xfff1d6,
} as const;

/**
 * Cores de efeito, acima de 1 para acender no bloom (RGB linear). Âmbar = do jogador; vermelho =
 * do inimigo, para o jogador distinguir de onde vem cada tiro.
 */
export const GLOW = {
  friendlyPlasma: new THREE.Color(4.0, 2.6, 0.8),
  hostilePlasma: new THREE.Color(4.0, 0.45, 0.2),
  spark: new THREE.Color(3.0, 1.8, 0.5),
  core: new THREE.Color(3.0, 2.8, 2.2),
  playerMuzzle: new THREE.Color(3.2, 2.0, 0.6),
  enemyMuzzle: new THREE.Color(3.2, 0.5, 0.25),
  dust: new THREE.Color(0.45, 0.42, 0.38),
  smoke: new THREE.Color(0.34, 0.32, 0.3),
  metal: new THREE.Color(0.24, 0.23, 0.21),
} as const;
