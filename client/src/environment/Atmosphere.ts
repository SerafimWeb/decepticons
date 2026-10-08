import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { PALETTE } from '../core/palette';

/**
 * Atmosfera da Arena sem custo por quadro: o céu é uma imagem equirretangular de 1 coluna de degradê (o three a
 * desenha como fundo, 1 draw call) e o chão ganha uma textura de placas. As duas são geradas em memória, sem
 * arquivo e sem DOM (roda no Node, onde a partida sem tela monta a Arena).
 * Referência de qualidade: `.decepticons/REFERENCIA_VISUAL.md` (o céu e o chão pretos faziam o mundo sumir no escuro).
 */

type Rgb = readonly [number, number, number];

const hexToRgb = (hex: number): Rgb => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * Paradas do degradê, da altura do horizonte para cima (graus acima do horizonte; negativo = abaixo dele).
 * Abaixo do horizonte o chão já esconde o céu, então a cor é a da névoa: o fim do chão se funde com o horizonte.
 */
const SKY_STOPS: readonly (readonly [number, number])[] = [
  [-90, PALETTE.fog],
  [-4, PALETTE.fog],
  [0, PALETTE.skyHorizon],
  [7, PALETTE.skyGlow],
  [28, PALETTE.skyMid],
  [60, PALETTE.skyUpper],
  [90, PALETTE.skyZenith],
];

/** Cor do céu a `deg` graus do horizonte (sRGB 0–255). */
export function skyColorAt(deg: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  let i = 1;
  while (i < SKY_STOPS.length - 1 && deg > SKY_STOPS[i]![0]) i++;
  const [d0, c0] = SKY_STOPS[i - 1]!;
  const [d1, c1] = SKY_STOPS[i]!;
  const t = smooth(Math.min(1, Math.max(0, (deg - d0) / (d1 - d0))));
  const a = hexToRgb(c0);
  const b = hexToRgb(c1);
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

const SKY_ROWS = 128;

/**
 * Degradê do céu como fundo da cena. A linha 0 da imagem é o nadir e a última é o zênite (o v do mapeamento
 * equirretangular cresce para cima). Uma coluna basta: a cor só depende da altura; 4 colunas evitam textura degenerada.
 */
export function buildSkyTexture(): THREE.DataTexture {
  const cols = 4;
  const data = new Uint8Array(cols * SKY_ROWS * 4);
  const c: [number, number, number] = [0, 0, 0];
  for (let row = 0; row < SKY_ROWS; row++) {
    const deg = ((row + 0.5) / SKY_ROWS - 0.5) * 180;
    skyColorAt(deg, c);
    for (let x = 0; x < cols; x++) data.set([c[0], c[1], c[2], 255], (row * cols + x) * 4);
  }
  const tex = new THREE.DataTexture(data, cols, SKY_ROWS, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Lado da textura do chão em pixels e quantas placas cabem por lado. */
export const FLOOR_TEX_SIZE = 128;
export const FLOOR_PLATES = 2;
/** Metros que a textura cobre uma vez: 2×2 placas de 4 m, casando com as células da grade ciano. */
export const FLOOR_TILE_METERS = 8;

/**
 * Placas de piso de metal: brilho um pouco diferente por placa, junta escura, parafusos nos cantos e riscos de uso.
 * Cinza neutro (a cor entra pelo material). Determinística: a mesma semente dá sempre a mesma imagem.
 */
export function buildFloorTexture(seed = 4242): THREE.DataTexture {
  const size = FLOOR_TEX_SIZE;
  const plate = size / FLOOR_PLATES;
  const rand = mulberry32(seed);
  const data = new Uint8Array(size * size * 4);
  const base: number[] = [];
  for (let p = 0; p < FLOOR_PLATES * FLOOR_PLATES; p++) base.push(0.5 + rand() * 0.45);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x % plate;
      const py = y % plate;
      let v = base[Math.floor(y / plate) * FLOOR_PLATES + Math.floor(x / plate)]!;
      // Grão fino.
      v += (rand() - 0.5) * 0.07;
      // Junta: 2 px escuros no encontro das placas (a textura é ladrilhada, então a borda da imagem também é junta).
      const edge = Math.min(px, py, plate - 1 - px, plate - 1 - py);
      if (edge < 2) v *= 0.22;
      else if (edge < 4) v *= 0.72;
      // Parafuso: 3×3 mais claro a 7 px de cada canto da placa.
      const bx = Math.min(px, plate - 1 - px);
      const by = Math.min(py, plate - 1 - py);
      if (Math.abs(bx - 7) <= 1 && Math.abs(by - 7) <= 1) v *= 1.3;
      const g = Math.round(Math.min(1, Math.max(0, v)) * 255);
      data.set([g, g, g, 255], (y * size + x) * 4);
    }
  }
  // Riscos de uso: poucos traços curtos mais claros ou escuros.
  for (let s = 0; s < 14; s++) {
    const x0 = Math.floor(rand() * size);
    const y0 = Math.floor(rand() * size);
    const len = 4 + Math.floor(rand() * 10);
    const horizontal = rand() < 0.5;
    const k = rand() < 0.5 ? 0.78 : 1.18;
    for (let i = 0; i < len; i++) {
      const x = (horizontal ? x0 + i : x0) % size;
      const y = (horizontal ? y0 : y0 + i) % size;
      const o = (y * size + x) * 4;
      const g = Math.min(255, Math.round(data[o]! * k));
      data[o] = data[o + 1] = data[o + 2] = g;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  // O chão é visto de lado quase o tempo todo: sem anisotropia a textura vira papa a poucos metros. 4× é o
  // meio-termo até alguém medir numa GPU integrada (o custo é preenchimento de tela, não CPU).
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
