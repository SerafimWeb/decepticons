import * as THREE from 'three';

/**
 * Paleta do jogo: neon estilo Tron, bem colorida. A cidade usa todas as cores neon (ciano, pink,
 * vermelho aceso, amarelo fluorescente, verde, laranja); o que é do jogador é verde neon e o que é das
 * IAs rebeldes é vermelho, para a leitura de combate não se perder no meio das cores.
 * Pedidos do dono: "verde neon, vermelho, diversas cores, só não fica apenas em azul e roxo" (25/09) e
 * "prédios coloridos: volte o ciano, o pink, vermelho aceso, amarelo fluorescente; estilo Tron, sci-fi
 * espacial" (25/09). Fonte única das cores do mundo 3D; a interface usa as mesmas no styles.css.
 */
export const PALETTE = {
  // Ambiente: espaço escuro, chão com grade ciano (Tron). O céu é um degradê (`environment/Atmosphere.ts`) do zênite
  // quase preto até um brilho de horizonte; a névoa é um tom acima do preto para as torres distantes se
  // destacarem do céu em vez de sumir nele.
  skyZenith: 0x03040a,
  skyUpper: 0x060a1a,
  skyMid: 0x0a1a30,
  skyGlow: 0x143448,
  skyHorizon: 0x1f4d60,
  fog: 0x0c2230,
  ground: 0x1c2832,
  gridMain: 0x00a8c0,
  gridSub: 0x0c2a36,
  steel: 0x262a2b,
  steelDark: 0x0e1112,
  // Neon da cidade
  cyan: 0x00e5ff,
  shieldBlue: 0x55bfff,
  bankBlue: 0x287bff, // Banco VORCARIS: azul luminoso pedido pelo dono.
  pink: 0xff2bd6,
  fluo: 0xe8ff1a,
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
  skyLight: 0xdff6ff,
  groundLight: 0x0a0a14,
  keyLight: 0xffd6ec,
  rimLight: 0x66f0ff,
} as const;

/** Cores neon da cidade (prédios, barricadas, horizonte), na ordem em que se alternam. */
export const CITY_NEON: readonly number[] = [PALETTE.cyan, PALETTE.pink, PALETTE.fluo, PALETTE.signal, PALETTE.green, PALETTE.sodium];

/**
 * Cores de efeito, acima de 1 para acender no bloom (RGB linear). Verde = do jogador; vermelho = do
 * inimigo, para o jogador distinguir de onde vem cada tiro.
 */
export const GLOW = {
  // Os tiros do jogador acendem menos que os do inimigo (que são o aviso): o dono achava que a luz do próprio tiro atrapalhava a visão (11/10).
  // P256 (24/10): o teto de todo efeito de tiro caiu de ~4,0 para ~2,6 de propósito — o Comandante voltou a dizer que os tiros geram muita luz.
  // O rastro continua mostrando para onde o tiro foi; o que saiu foi o halo branco que cobria o alvo.
  friendlyPlasma: new THREE.Color(0.5, 1.75, 0.75),
  hostilePlasma: new THREE.Color(2.6, 0.32, 0.3),
  friendlyArc: new THREE.Color(0.6, 1.5, 1.75),
  hostileArc: new THREE.Color(2.3, 0.6, 2.5),
  friendlyIce: new THREE.Color(1.15, 1.7, 1.85),
  hostileIce: new THREE.Color(2.2, 1.7, 2.7),
  // O raio laser (feixe, `fx/BeamVisuals.ts`): magenta do jogador (não se confunde com o plasma verde nem com a elétrica azul) e laranja-vermelho aceso do inimigo.
  friendlyLaser: new THREE.Color(1.75, 0.35, 1.6),
  hostileLaser: new THREE.Color(2.6, 0.75, 0.3),
  // O tiro de metal (canhão pesado e automático): o corpo é de aço (`fx/kineticShot.ts`), só a cauda quente acende.
  friendlySlug: new THREE.Color(1.7, 1.15, 0.4),
  hostileSlug: new THREE.Color(2.3, 0.5, 0.25),
  spark: new THREE.Color(0.9, 1.6, 0.95),
  core: new THREE.Color(1.5, 1.8, 1.5),
  playerMuzzle: new THREE.Color(0.7, 1.55, 0.85),
  enemyMuzzle: new THREE.Color(2.2, 0.35, 0.32),
  dust: new THREE.Color(0.42, 0.44, 0.43),
  smoke: new THREE.Color(0.32, 0.34, 0.34),
  metal: new THREE.Color(0.23, 0.25, 0.26),
} as const;
