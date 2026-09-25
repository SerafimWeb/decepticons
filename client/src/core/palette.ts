import * as THREE from 'three';

/**
 * Paleta do jogo: neon tático, multicolorida. Verde neon (HUD, o jogador, o tiro amigo), vermelho
 * (IAs rebeldes, alerta, o tiro inimigo), laranja e amarelo (perigo, fogo, foguetes), branco quente.
 * Pedido do dono (25/09): "verde neon, vermelho, pode usar diversas cores, só não fica apenas em
 * azul e roxo". Fonte única das cores do mundo 3D; a interface usa as mesmas nas variáveis do styles.css.
 */
export const PALETTE = {
  // Ambiente
  sky: 0x06080a,
  fog: 0x0a0e0f,
  ground: 0x080a0a,
  gridMain: 0x1f8a45,
  gridSub: 0x0f2d1a,
  steel: 0x262a2b,
  steelDark: 0x0e1112,
  // Destaques
  green: 0x39ff6a,
  amber: 0xffb000,
  sodium: 0xff8a1f,
  yellow: 0xffe14d,
  bone: 0xf0f2e8,
  signal: 0xff2d3d,
  // Mechs: o jogador em amarelo de perigo com visor verde; as IAs rebeldes em vermelho.
  playerPaint: 0xe0a21a,
  enemyPaint: 0x8c1f22,
  armor: 0x5d6163,
  frame: 0x1e2224,
  // Luzes
  skyLight: 0xe0ffe8,
  groundLight: 0x0a0f0c,
  keyLight: 0xffc070,
  rimLight: 0x7dffa0,
} as const;

/**
 * Cores de efeito, acima de 1 para acender no bloom (RGB linear). Verde = do jogador; vermelho = do
 * inimigo, para o jogador distinguir de onde vem cada tiro.
 */
export const GLOW = {
  friendlyPlasma: new THREE.Color(0.9, 4.0, 1.5),
  hostilePlasma: new THREE.Color(4.0, 0.4, 0.4),
  spark: new THREE.Color(1.4, 3.2, 1.6),
  core: new THREE.Color(2.8, 3.2, 2.8),
  playerMuzzle: new THREE.Color(1.2, 3.4, 1.6),
  enemyMuzzle: new THREE.Color(3.4, 0.5, 0.45),
  dust: new THREE.Color(0.42, 0.44, 0.43),
  smoke: new THREE.Color(0.32, 0.34, 0.34),
  metal: new THREE.Color(0.23, 0.25, 0.26),
} as const;
