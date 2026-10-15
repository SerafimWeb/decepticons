/**
 * O CHÃO DA PRAIA DOS CABOS (ordem P127, o Comandante, 14/10: "a praia ao longo do cenário, não num só lado"): o terreno em
 * **função pura**. A praia corre ao longo do **eixo X** (640 m) com o **mar de um lado** (z negativo) e a **cidade do outro**;
 * a linha d'água ondula (`costaEm`), o fundo do mar **desce em rampa suave** (o Mech entra andando e vai afundando, sem
 * degrau) e a areia tem **dunas** baixas. O desenho (a malha) e a física (o colisor de altura) leem a MESMA função, então o
 * que se vê é o que se pisa — e os testes conferem tudo sem montar 3D (G14).
 *
 * **Convenção:** o chão firme está em `y = 0` (é onde todo nascimento põe os pés); a superfície do mar fica um pouco abaixo
 * (`NIVEL_DO_MAR`), e a rampa da praia desce da areia até ela.
 */

/** A extensão do mapa (m): 640 de ponta a ponta, três vezes e meia a área da Arena (200 × 200). */
export const PRAIA_EXTENSAO = { comprimento: 640, largura: 240 } as const;

/** Os limites do mundo jogável (as paredes invisíveis ficam aqui). */
export const PRAIA_LIMITES = {
  minX: -PRAIA_EXTENSAO.comprimento / 2,
  maxX: PRAIA_EXTENSAO.comprimento / 2,
  minZ: -PRAIA_EXTENSAO.largura / 2,
  maxZ: PRAIA_EXTENSAO.largura / 2,
} as const;

/** A altura da superfície do mar (m): abaixo do chão firme, para a areia "subir" da água. */
export const NIVEL_DO_MAR = -0.35;
/** A fundura máxima do mar (m) lá no fundo (a meta da ficha `cenario-cabos.md`: 14 m). */
export const PRAIA_FUNDURA_MAXIMA = 14;
/** O lado das células da grade do terreno (m): a mesma para a malha e para o colisor. */
export const PRAIA_CELULA = 4;
/** A faixa da praia onde a areia desce até a linha d'água (m): a "face" molhada da praia. */
const FACE_DA_PRAIA_M = 4;
/** Escala da curva do mar (m): quão rápido o fundo desce (a metade da fundura sai por volta de 25 m da costa). */
const ESCALA_DO_FUNDO_M = 44;

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const suave = (t: number): number => t * t * (3 - 2 * t);

/** As faixas de cima para baixo da orla, em z (a faixa da praia vai da costa até `calcada.minZ`). */
export const PRAIA_FAIXAS = {
  calcada: { minZ: 4, maxZ: 17 },
  avenida: { minZ: 17, maxZ: 37 },
  cidade: { minZ: 37, maxZ: PRAIA_LIMITES.maxZ },
} as const;

/** O z da linha d'água em `x`: ondula devagar (baías e pontas), sempre dentro da faixa [-50, -22]. */
export function costaEm(x: number): number {
  return -36 + 6.5 * Math.sin(x / 61 + 0.8) + 3.2 * Math.sin(x / 23 + 2.1);
}

/** Uma duna: um monte suave de areia (gaussiana) — baixo e largo, para o Mech subir e descer sem pular. */
export interface Duna {
  x: number;
  z: number;
  /** Raios em X e Z (m). */
  rx: number;
  rz: number;
  /** Altura do topo (m). */
  h: number;
}

/**
 * As dunas da praia, no fundo da areia (junto do calçadão). Posições à mão: nenhuma cobre ponto de nascimento, zona ou
 * trajeto dos cabos (o `PraiaLayout.test.ts` confere o chão plano nesses pontos).
 */
export const PRAIA_DUNAS: readonly Duna[] = [
  { x: -219, z: -12, rx: 18, rz: 7, h: 1.1 },
  { x: -178, z: -11, rx: 14, rz: 6, h: 0.9 },
  { x: -138, z: -12, rx: 16, rz: 7, h: 1.3 },
  { x: -98, z: -10, rx: 14, rz: 6, h: 0.9 },
  { x: -60, z: -12, rx: 15, rz: 7, h: 1.2 },
  { x: -20, z: -11, rx: 14, rz: 6, h: 0.8 },
  { x: 23, z: -11, rx: 14, rz: 6, h: 1 },
  { x: 67, z: -12, rx: 16, rz: 7, h: 1.4 },
  { x: 108, z: -11, rx: 14, rz: 6, h: 0.9 },
  { x: 148, z: -11, rx: 14, rz: 6, h: 1.2 },
  { x: 187, z: -12, rx: 14, rz: 6, h: 0.8 },
  { x: 296, z: -22, rx: 18, rz: 12, h: 1.6 },
];

/** A altura que as dunas somam em (x, z): zero perto da água (a duna some antes da face da praia). */
export function alturaDasDunas(x: number, z: number): number {
  const s = costaEm(x) - z; // < 0: terra
  if (s > -7 || z >= PRAIA_FAIXAS.calcada.minZ) return 0; // sem duna na beira d'água nem no calçadão (a pista é plana)
  // A duna some na água (8 m depois da face da praia) e morre antes do calçadão (nos últimos 10 m da areia, em rampa mansa).
  const some = suave(clamp01((-s - 7) / 8)) * suave(clamp01((PRAIA_FAIXAS.calcada.minZ - z) / 10));
  let h = 0;
  for (const d of PRAIA_DUNAS) {
    const dx = (x - d.x) / d.rx;
    const dz = (z - d.z) / d.rz;
    const q = dx * dx + dz * dz;
    if (q < 9) h += d.h * Math.exp(-q);
  }
  return h * some;
}

/**
 * A altura do chão em (x, z), em metros. **Terra firme: 0** (mais as dunas); da areia até a linha d'água, a face da praia desce
 * 35 cm; dali o fundo do mar desce em curva suave até ~14 m (nunca mais íngreme que ~17°, o que o Mech sobe).
 */
export function alturaDoChao(x: number, z: number): number {
  const s = costaEm(x) - z; // s > 0: dentro do mar; s < 0: em terra
  if (s <= -FACE_DA_PRAIA_M) return alturaDasDunas(x, z);
  if (s <= 0) return NIVEL_DO_MAR * suave((s + FACE_DA_PRAIA_M) / FACE_DA_PRAIA_M);
  const fundo = (PRAIA_FUNDURA_MAXIMA + NIVEL_DO_MAR) * Math.tanh(Math.pow(s / ESCALA_DO_FUNDO_M, 1.2));
  return NIVEL_DO_MAR - fundo;
}

/** A fundura da água (m) sobre o chão em (x, z): 0 em terra. */
export function funduraDoMarEm(x: number, z: number): number {
  return Math.max(0, NIVEL_DO_MAR - alturaDoChao(x, z));
}

/** A grade de alturas de uma região (a mesma para a malha e para o colisor): `alturas[ix * (celulasZ + 1) + iz]`. */
export interface GradeDeAlturas {
  celulasX: number;
  celulasZ: number;
  minX: number;
  minZ: number;
  celula: number;
  alturas: Float32Array;
}

export function gradeDoTerreno(minX: number, maxX: number, minZ: number, maxZ: number, celula: number = PRAIA_CELULA): GradeDeAlturas {
  const celulasX = Math.round((maxX - minX) / celula);
  const celulasZ = Math.round((maxZ - minZ) / celula);
  const alturas = new Float32Array((celulasX + 1) * (celulasZ + 1));
  for (let ix = 0; ix <= celulasX; ix++) {
    for (let iz = 0; iz <= celulasZ; iz++) alturas[ix * (celulasZ + 1) + iz] = alturaDoChao(minX + ix * celula, minZ + iz * celula);
  }
  return { celulasX, celulasZ, minX, minZ, celula, alturas };
}

type Rgb = readonly [number, number, number];
const mistura = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const AREIA_SECA: Rgb = [0.97, 0.93, 0.8];
const AREIA_MOLHADA: Rgb = [0.74, 0.65, 0.5];
const AREIA_RASA: Rgb = [0.86, 0.9, 0.78];
const FUNDO_MEDIO: Rgb = [0.38, 0.62, 0.68];
const FUNDO_ESCURO: Rgb = [0.13, 0.3, 0.45];
const CHAO_DA_CIDADE: Rgb = [0.66, 0.63, 0.57];

/**
 * A cor do chão em (x, z) (sRGB 0–1, para a cor de vértice): areia branca com pintas largas de tom, a faixa molhada junto da
 * água, o fundo do mar clareando perto da costa e escurecendo no fundo, e o chão neutro da cidade. Pura.
 */
export function corDoChao(x: number, z: number): [number, number, number] {
  const s = costaEm(x) - z;
  const pinta = 0.5 + 0.25 * Math.sin(x * 0.043 + z * 0.071) + 0.25 * Math.sin(x * 0.11 - z * 0.05 + 1.7); // 0..1, em manchas largas
  let c: Rgb;
  if (z >= PRAIA_FAIXAS.calcada.minZ) {
    c = mistura(CHAO_DA_CIDADE, [0.72, 0.69, 0.62], pinta);
  } else if (s <= 0) {
    // Areia: seca no fundo, molhada junto da água (a faixa escura que a onda molha).
    const molhada = suave(clamp01(1 - (-s) / (FACE_DA_PRAIA_M + 4)));
    c = mistura(mistura(AREIA_SECA, [0.93, 0.86, 0.7], pinta * 0.6), AREIA_MOLHADA, molhada);
    // O topo das dunas fica um pouco mais claro (sol batendo).
    c = mistura(c, [1, 0.97, 0.88], clamp01(alturaDasDunas(x, z) / 3));
  } else {
    // Dentro do mar: areia rasa clara, passando ao fundo azulado.
    c = mistura(AREIA_RASA, FUNDO_MEDIO, suave(clamp01(s / 18)));
    c = mistura(c, FUNDO_ESCURO, suave(clamp01((s - 18) / 60)));
  }
  return [c[0], c[1], c[2]];
}

/** Os grandes trechos da orla, de dentro do mar para a cidade. */
export type FaixaDaOrla = 'mar' | 'praia' | 'calcada' | 'avenida' | 'cidade';

/** Em que faixa da orla (x, z) cai: o mar fica antes da linha d'água, a praia vai até o calçadão, e daí a cidade. */
export function faixaEm(x: number, z: number): FaixaDaOrla {
  if (z < costaEm(x)) return 'mar';
  if (z < PRAIA_FAIXAS.calcada.minZ) return 'praia';
  if (z < PRAIA_FAIXAS.avenida.minZ) return 'calcada';
  if (z < PRAIA_FAIXAS.cidade.minZ) return 'avenida';
  return 'cidade';
}

/**
 * A linha d'água do mapa, amostrada de `passo` em `passo` metros de oeste a leste (x, z): o minimapa e o radar do console desenham o mar
 * a partir dela (sem custo no jogo: sai uma vez, na montagem).
 */
export function pontosDaCosta(passo = 16): (readonly [number, number])[] {
  const pontos: (readonly [number, number])[] = [];
  for (let x = PRAIA_LIMITES.minX; x <= PRAIA_LIMITES.maxX + 1e-6; x += passo) pontos.push([x, costaEm(x)]);
  const ultimo = pontos[pontos.length - 1]!;
  if (ultimo[0] < PRAIA_LIMITES.maxX) pontos.push([PRAIA_LIMITES.maxX, costaEm(PRAIA_LIMITES.maxX)]);
  return pontos;
}
