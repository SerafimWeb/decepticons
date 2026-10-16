import * as THREE from 'three';
import type { WeaponStats } from '../combat/weapons';
import { PALETTE } from '../core/palette';
import { batchRigMeshes, box, cyl } from './meshKit';

/**
 * As armas como módulos desenhados, para o encaixe do pulso (`weaponMount.ts`). Um módulo é um objeto 3D à parte:
 * trocar de arma é trocar o módulo, sem tocar no Mech.
 *
 * O padrão do módulo (vale para toda arma nova):
 * - **Unidade:** 1 = o comprimento do antebraço do Mech que a leva (o encaixe escala sozinho).
 * - **Origem:** o centro da placa de engate, no pulso. **Frente = -Z**, cima = +Y.
 * - **Engate:** todo módulo começa com o mesmo colar e flange (`coupling`), que é o "punho" do Mech: nenhum robô
 *   tem dedos, a mão é o engate.
 * - **Boca:** `muzzle` é onde o tiro nasce, no mesmo referencial.
 * - **Custo:** o módulo inteiro vira UMA malha (`batchRigMeshes`), montado uma vez por arma e nível e clonado
 *   (geometria e material compartilhados). Nada é criado por quadro (G4/G5).
 */
export interface WeaponModel {
  readonly object: THREE.Object3D;
  readonly muzzle: THREE.Vector3;
}

interface Mats {
  armor: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
}

/**
 * O desenho das armas é feito em unidades de projeto; estas duas escalas o engrossam (seção) e o alongam (frente)
 * para a proporção de um Mech de 5 m, cujo antebraço é grosso. Só o engate (`coupling`) fica fora delas.
 */
const THICK = 1.5;
const LONG = 1.15;

/** Desenha no módulo já com as escalas de espessura e comprimento. Todo cilindro aqui é deitado ao longo de Z. */
function pen(root: THREE.Object3D) {
  return {
    box: (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) =>
      box(root, w * THICK, h * THICK, d * LONG, mat, x * THICK, y * THICK, z * LONG),
    cylZ: (radius: number, length: number, mat: THREE.Material, x = 0, y = 0, z = 0) =>
      cyl(root, radius * THICK, length * LONG, mat, x * THICK, y * THICK, z * LONG, Math.PI / 2),
  };
}

/** Placa de engate no pulso: colar, flange que cobre a emenda com o antebraço e duas travas luminosas. */
function coupling(root: THREE.Object3D, M: Mats): void {
  cyl(root, 0.24, 0.22, M.frame, 0, 0, -0.04, Math.PI / 2);
  cyl(root, 0.3, 0.07, M.armor, 0, 0, 0.08, Math.PI / 2);
  box(root, 0.08, 0.1, 0.12, M.glow, 0, 0.27, -0.04);
  box(root, 0.08, 0.1, 0.12, M.glow, 0, -0.27, -0.04);
}

/** Canhão de plasma (energia, braço direito). O nível alonga o cano e soma aletas de calor e capacitores. */
function plasma(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const barrel = [1.0, 1.15, 1.3][tier]!;
  const rings = [2, 4, 6][tier]!;
  d.box(0.38, 0.36, 0.66, M.armor, 0, 0, -0.38);
  d.cylZ(0.1, barrel, M.frame, 0, 0, -0.68 - barrel / 2);
  for (let i = 0; i < rings; i++) d.cylZ(0.155, 0.05, M.armor, 0, 0, -0.82 - i * ((barrel - 0.3) / rings));
  const end = 0.68 + barrel;
  d.cylZ(0.15, 0.14, M.frame, 0, 0, -end - 0.04);
  d.cylZ(0.09, 0.04, M.glow, 0, 0, -end - 0.13);
  if (tier >= 1) for (const side of [-1, 1]) d.cylZ(0.065, 0.55, M.armor, side * 0.25, 0.1, -0.52);
  if (tier >= 2) d.box(0.06, 0.13, 0.75, M.frame, 0, 0.25, -0.56);
  return (end + 0.16) * LONG;
}

/** Casulo de foguetes (munição, braço esquerdo). O nível aumenta a grade de tubos: 2×2, 2×3, 3×3. */
function rockets(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const cols = [2, 2, 3][tier]!;
  const rows = [2, 3, 3][tier]!;
  const pitch = 0.22;
  const w = cols * pitch + 0.12;
  const h = rows * pitch + 0.12;
  d.box(w, h, 0.7, M.armor, 0, 0, -0.42);
  d.box(w * 1.06, h * 1.06, 0.08, M.frame, 0, 0, -0.78);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      d.cylZ(0.085, 0.06, M.glow, (c - (cols - 1) / 2) * pitch, (r - (rows - 1) / 2) * pitch, -0.83);
    }
  }
  return 0.92 * LONG;
}

/**
 * Lançador de ombro: o mesmo casulo de tubos do braço, sem o engate do pulso, com a traseira fechada e um suporte
 * embaixo para assentar na ombreira. Origem = o centro da traseira; frente = -Z.
 */
function pod(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const cols = [2, 2, 3][tier]!;
  const rows = [2, 3, 3][tier]!;
  const muzzleZ = rockets(root, tier, M);
  const w = cols * 0.22 + 0.12;
  const h = rows * 0.22 + 0.12;
  d.box(w, h, 0.08, M.frame, 0, 0, -0.04);
  d.box(w * 0.7, 0.14, 0.5, M.frame, 0, -(h / 2 + 0.07), -0.4);
  return muzzleZ;
}

/** Morteiro de ombro (chuva de mísseis): a mesma grade de tubos inclinados do braço, com um suporte embaixo para assentar na ombreira. */
function mortarPod(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const muzzleZ = barrage(root, tier, M);
  d.box(0.34, 0.16, 0.5, M.frame, 0, -0.2, -0.4);
  return muzzleZ;
}

/**
 * Lançador de mísseis leve (P152): uma grade densa de tubos finos, **um tubo por míssil**: 8 no MK I (4×2), 16 no MK II (4×4) e 32 no MK III (8×4). O desenho conta os mísseis
 * que a arma leva (o nível é o tamanho do lançador).
 */
function swarm(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const cols = [4, 4, 8][tier]!;
  const rows = [2, 4, 4][tier]!;
  const pitch = 0.1;
  const w = cols * pitch + 0.1;
  const h = rows * pitch + 0.1;
  d.box(w, h, 0.55, M.armor, 0, 0, -0.35);
  d.box(w * 1.05, h * 1.05, 0.06, M.frame, 0, 0, -0.66);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      d.cylZ(0.036, 0.04, M.glow, (c - (cols - 1) / 2) * pitch, (r - (rows - 1) / 2) * pitch, -0.69);
    }
  }
  return 0.78 * LONG;
}

/** Lançador leve de ombro: a mesma grade de tubos, com a traseira fechada e o suporte embaixo para assentar na ombreira. */
function swarmPod(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const muzzleZ = swarm(root, tier, M);
  d.box(0.34, 0.14, 0.45, M.frame, 0, -([2, 4, 4][tier]! * 0.05 + 0.12), -0.36);
  return muzzleZ;
}

/** Míssil cruzador (P152): um tubo único, comprido e grosso; o nível o alonga e põe anéis de reforço. */
function cruise(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [0.95, 1.1, 1.25][tier]!;
  d.box(0.38, 0.36, 0.5, M.armor, 0, 0, -0.3);
  d.cylZ(0.17, len, M.frame, 0, 0, -0.55 - len / 2);
  for (let i = 0; i < 2 + tier; i++) d.cylZ(0.21, 0.05, M.armor, 0, 0, -0.7 - i * 0.28);
  d.cylZ(0.2, 0.07, M.armor, 0, 0, -0.56 - len);
  d.cylZ(0.13, 0.04, M.glow, 0, 0, -0.6 - len);
  return (0.65 + len) * LONG;
}

/** Cruzador de ombro: o mesmo tubo, com o suporte embaixo. */
function cruisePod(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const muzzleZ = cruise(root, tier, M);
  d.box(0.34, 0.16, 0.6, M.frame, 0, -0.26, -0.5);
  return muzzleZ;
}

/** Raio laser (P152): cano fino e longo com a lente na ponta e anéis de foco; o nível alonga o cano e soma anéis. */
function laser(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [0.95, 1.05, 1.15][tier]!;
  d.box(0.3, 0.3, 0.5, M.armor, 0, 0, -0.3);
  d.cylZ(0.05, len, M.frame, 0, 0, -0.55 - len / 2);
  for (let i = 0; i < 2 + tier; i++) d.cylZ(0.12, 0.035, M.armor, 0, 0, -0.72 - i * 0.22);
  d.cylZ(0.085, 0.05, M.glow, 0, 0, -0.56 - len);
  d.box(0.05, 0.08, 0.3, M.frame, 0, 0.2, -0.4);
  return (0.62 + len) * LONG;
}

/** Blaster leve (energia): corpo curto e dois canos paralelos. O nível alonga os canos e põe a mira. */
function blaster(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [0.7, 0.8, 0.9][tier]!;
  d.box(0.32, 0.3, 0.46, M.armor, 0, 0, -0.3);
  for (const side of [-1, 1]) {
    d.cylZ(0.058, len, M.frame, side * 0.1, 0.02, -0.52 - len / 2);
    d.cylZ(0.04, 0.04, M.glow, side * 0.1, 0.02, -0.54 - len);
  }
  if (tier >= 1) d.box(0.05, 0.08, 0.3, M.frame, 0, 0.2, -0.4);
  return (0.6 + len) * LONG;
}

/** Escopeta (energia, dano de perto): corpo grosso e dois canos curtos lado a lado. O nível põe mira, depois um protetor de calor. */
function shotgun(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  d.box(0.42, 0.4, 0.5, M.armor, 0, 0, -0.3);
  for (const side of [-1, 1]) {
    d.cylZ(0.095, 0.75, M.frame, side * 0.115, 0.02, -0.55 - 0.375);
    d.cylZ(0.12, 0.06, M.armor, side * 0.115, 0.02, -1.22);
    d.cylZ(0.07, 0.04, M.glow, side * 0.115, 0.02, -1.3);
  }
  d.box(0.3, 0.12, 0.4, M.frame, 0, -0.22, -0.7);
  if (tier >= 1) d.box(0.05, 0.1, 0.3, M.frame, 0, 0.24, -0.45);
  if (tier >= 2) d.box(0.46, 0.08, 0.55, M.armor, 0, 0.17, -0.85);
  return 1.36 * LONG;
}

/**
 * Chuva de mísseis (munição, área): uma base com tubos de morteiro inclinados para cima e para a frente, em duas colunas.
 * O nível soma fileiras de tubos (2, 3, 4). A boca do módulo é a da frente da base: o lançamento sobe dali.
 */
function barrage(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const rows = [2, 3, 4][tier]!;
  d.box(0.5, 0.26, 0.5 + rows * 0.2, M.armor, 0, -0.02, -0.3 - rows * 0.1);
  d.box(0.56, 0.06, 0.12, M.frame, 0, 0.14, -0.2);
  for (let r = 0; r < rows; r++) {
    const z = -0.42 - r * 0.2;
    for (const side of [-1, 1]) {
      cyl(root, 0.085 * THICK, 0.6, M.frame, side * 0.14 * THICK, 0.3, z * LONG, -Math.PI / 6);
      cyl(root, 0.06 * THICK, 0.05, M.glow, side * 0.14 * THICK, 0.3 + 0.26, (z - 0.15) * LONG, -Math.PI / 6);
    }
  }
  return (0.42 + rows * 0.2 + 0.3) * LONG;
}

/** Metralhadora rotatória (energia, braço direito): corpo, um feixe de seis canos em círculo e o alimentador embaixo. O nível alonga os canos e soma anéis. */
function rotary(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [0.9, 1.05, 1.2][tier]!;
  d.box(0.42, 0.4, 0.5, M.armor, 0, 0, -0.3);
  d.cylZ(0.2, 0.18, M.frame, 0, 0, -0.62);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    d.cylZ(0.04, len, M.frame, Math.cos(a) * 0.11, Math.sin(a) * 0.11, -0.7 - len / 2);
  }
  d.cylZ(0.17, 0.05, M.armor, 0, 0, -0.7 - len * 0.5);
  if (tier >= 1) d.cylZ(0.17, 0.05, M.armor, 0, 0, -0.7 - len * 0.25);
  d.cylZ(0.17, 0.06, M.frame, 0, 0, -0.7 - len);
  d.cylZ(0.05, 0.04, M.glow, 0, 0, -0.74 - len);
  d.box(0.2, 0.28, 0.3, M.frame, 0, -0.3, -0.25);
  return (0.74 + len) * LONG;
}

/** Arma elétrica (energia): corpo, três anéis de bobina que crescem com o nível e dois eletrodos abertos na boca, com a faísca entre eles. */
function arc(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [0.8, 0.92, 1.04][tier]!;
  d.box(0.4, 0.38, 0.5, M.armor, 0, 0, -0.3);
  d.cylZ(0.1, len, M.frame, 0, 0, -0.5 - len / 2);
  for (let i = 0; i < 2 + tier; i++) {
    d.cylZ(0.2, 0.05, M.armor, 0, 0, -0.62 - i * 0.2);
    d.cylZ(0.17, 0.035, M.glow, 0, 0, -0.65 - i * 0.2);
  }
  for (const side of [-1, 1]) d.box(0.045, 0.2, 0.3, M.frame, side * 0.1, 0, -0.5 - len - 0.1);
  d.box(0.1, 0.03, 0.2, M.glow, 0, 0, -0.5 - len - 0.1);
  return (0.5 + len + 0.25) * LONG;
}

/** Arma de gelo (energia): corpo, dois cilindros de refrigerante nas laterais, aletas de resfriamento e uma boca em cristal (três prismas) que cresce com o nível. */
function cryo(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [0.7, 0.82, 0.94][tier]!;
  d.box(0.42, 0.4, 0.52, M.armor, 0, 0, -0.3);
  d.cylZ(0.11, len, M.frame, 0, 0, -0.5 - len / 2);
  for (const side of [-1, 1]) {
    d.cylZ(0.085, 0.5 + tier * 0.08, M.armor, side * 0.19, 0.02, -0.33);
    d.cylZ(0.05, 0.42 + tier * 0.08, M.glow, side * 0.19, 0.02, -0.33);
  }
  for (let i = 0; i < 3 + tier; i++) d.box(0.3, 0.035, 0.05, M.frame, 0, 0.19, -0.18 - i * 0.12);
  const tip = 0.5 + len;
  d.box(0.07, 0.24, 0.24 + tier * 0.04, M.glow, 0, 0, -tip - 0.12);
  d.box(0.07, 0.24, 0.24 + tier * 0.04, M.glow, 0, 0, -tip - 0.12).rotation.z = Math.PI / 3;
  d.box(0.07, 0.24, 0.24 + tier * 0.04, M.glow, 0, 0, -tip - 0.12).rotation.z = -Math.PI / 3;
  return (tip + 0.3) * LONG;
}

/** Lança-chamas (combustível): corpo, dois tanques cilíndricos de combustível por cima, um bico longo com a chama-piloto acesa na ponta. O nível alonga o bico e soma um tanque. */
function flamer(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [0.8, 0.95, 1.1][tier]!;
  d.box(0.44, 0.38, 0.56, M.armor, 0, 0, -0.3);
  d.cylZ(0.13, len, M.frame, 0, 0, -0.52 - len / 2);
  d.cylZ(0.17, 0.12, M.armor, 0, 0, -0.62 - len * 0.55); // o anel do bico
  for (let i = 0; i <= tier; i++) {
    d.cylZ(0.11, 0.62, M.armor, (i - tier / 2) * 0.26, 0.28, -0.3);
    d.cylZ(0.07, 0.5, M.glow, (i - tier / 2) * 0.26, 0.28, -0.3);
  }
  const tip = 0.52 + len;
  d.box(0.07, 0.07, 0.12, M.glow, 0, 0, -tip - 0.05); // a chama-piloto
  return (tip + 0.14) * LONG;
}

/**
 * Canhão pesado (aço, um tiro só): culatra grossa, cano curto e largo com freio de boca de duas fendas e dois amortecedores de recuo nas laterais.
 * Nada de brilho além da brasa do cano. O nível alonga o cano e soma anéis de reforço.
 */
function cannon(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [1.25, 1.4, 1.55][tier]!;
  d.box(0.56, 0.5, 0.78, M.armor, 0, 0, -0.4); // a culatra
  d.cylZ(0.17, len, M.frame, 0, 0, -0.78 - len / 2); // o cano
  for (let i = 0; i <= tier; i++) d.cylZ(0.22, 0.09, M.armor, 0, 0, -0.95 - i * 0.34); // anéis de reforço
  const end = 0.78 + len;
  d.cylZ(0.25, 0.3, M.armor, 0, 0, -end - 0.08); // o freio de boca
  for (const side of [-1, 1]) d.box(0.05, 0.36, 0.08, M.frame, side * 0.2, 0, -end - 0.1); // as fendas
  d.cylZ(0.12, 0.04, M.glow, 0, 0, -end - 0.24); // a brasa na boca
  for (const side of [-1, 1]) d.cylZ(0.075, 0.9, M.frame, side * 0.33, 0, -0.62); // amortecedores de recuo
  return (end + 0.28) * LONG;
}

/**
 * Canhão de cerco (o canhão pesado feito para um gigante): o mesmo desenho de aço, mais comprido e mais grosso, com um
 * segundo bloco de culatra e mais anéis. A unidade do módulo é o antebraço do Mech, então num titã ele já nasce maior que
 * o canhão de um Mech comum; aqui ele ganha o que o olho lê como "arma de tamanho 3". O nível alonga o cano e soma um anel.
 */
function siege(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [1.9, 2.15, 2.4][tier]!;
  d.box(0.78, 0.7, 1.0, M.armor, 0, 0, -0.5); // a culatra
  d.box(0.6, 0.5, 0.5, M.frame, 0, 0.42, -0.42); // o segundo bloco da culatra
  d.cylZ(0.24, len, M.frame, 0, 0, -1.0 - len / 2); // o cano
  for (let i = 0; i <= tier + 1; i++) d.cylZ(0.3, 0.11, M.armor, 0, 0, -1.2 - i * 0.42); // os anéis de reforço
  const end = 1.0 + len;
  d.cylZ(0.34, 0.38, M.armor, 0, 0, -end - 0.1); // o freio de boca
  for (const side of [-1, 1]) d.box(0.06, 0.46, 0.1, M.frame, side * 0.27, 0, -end - 0.12); // as fendas
  d.cylZ(0.16, 0.05, M.glow, 0, 0, -end - 0.3); // a brasa na boca
  for (const side of [-1, 1]) d.cylZ(0.1, 1.3, M.frame, side * 0.45, 0, -0.8); // amortecedores de recuo
  return (end + 0.36) * LONG;
}

/**
 * Canhão automático (aço, tiros em sequência): receptor, caixa de munição em cima com a fita, cano curto com a camisa perfurada e freio de boca.
 * O nível alonga o cano, soma uma segunda caixa e aletas.
 */
function autocannon(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [0.95, 1.1, 1.25][tier]!;
  d.box(0.42, 0.4, 0.62, M.armor, 0, 0, -0.34);
  d.box(0.3, 0.26, 0.4, M.frame, 0, 0.3, -0.3); // a caixa de munição
  d.box(0.1, 0.14, 0.22, M.armor, 0, 0.14, -0.55); // a fita descendo para a câmara
  if (tier >= 1) d.box(0.3, 0.26, 0.4, M.frame, 0, -0.3, -0.3);
  d.cylZ(0.09, len, M.frame, 0, 0, -0.65 - len / 2);
  d.cylZ(0.15, len * 0.6, M.armor, 0, 0, -0.75 - len * 0.3); // a camisa
  for (let i = 0; i < 3 + tier; i++) d.cylZ(0.165, 0.035, M.frame, 0, 0, -0.78 - i * 0.14);
  d.cylZ(0.13, 0.12, M.armor, 0, 0, -0.68 - len);
  d.box(0.07, 0.07, 0.1, M.glow, 0.2, 0.06, -0.42); // a janela de ejeção
  return (0.74 + len) * LONG;
}

/**
 * Canhão sônico (ombro): um corpo curto e um **funil de anéis de ressonância** que abre para a frente (cada anel, uma lâmina de metal e um aro luminoso lilás), com uma haste no
 * eixo. O nível soma um anel. No ombro leva uma braçadeira embaixo (como os lançadores); na mão (não é onde ele vai, mas o `switch` é completo) leva o engate.
 */
function sonic(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const rings = 3 + tier;
  d.box(0.36, 0.34, 0.5, M.armor, 0, 0, -0.3);
  d.box(0.26, 0.12, 0.42, M.frame, 0, -0.23, -0.3);
  const end = 0.58 + rings * 0.17;
  d.cylZ(0.07, end - 0.4, M.frame, 0, 0, -0.4 - (end - 0.4) / 2);
  for (let i = 0; i < rings; i++) {
    const rad = 0.1 + i * 0.055;
    const z = -0.58 - i * 0.17;
    d.cylZ(rad + 0.04, 0.05, M.armor, 0, 0, z);
    d.cylZ(rad, 0.035, M.glow, 0, 0, z - 0.03);
  }
  return (end + 0.1) * LONG;
}

/** Motosserra (corpo a corpo): motor e uma barra alta com dentes luminosos. O nível alonga a barra. */
function chainsaw(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [1.3, 1.5, 1.7][tier]!;
  d.box(0.38, 0.38, 0.52, M.armor, 0, 0, -0.3);
  d.box(0.09, 0.52, len, M.frame, 0, 0, -0.56 - len / 2);
  for (const side of [-1, 1]) d.box(0.115, 0.05, len, M.glow, 0, side * 0.285, -0.56 - len / 2);
  return (0.56 + len) * LONG;
}

/** Dois trilhos expostos, capacitores e aletas: silhueta longa de precisão. */
function railgun(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = 1.4 + tier * 0.15;
  d.box(0.4, 0.32, 0.55, M.armor, 0, 0, -0.32);
  for (const side of [-1, 1]) {
    d.box(0.08, 0.15, len, M.frame, side * 0.16, 0, -0.58 - len / 2);
    d.box(0.035, 0.055, len, M.glow, side * 0.105, 0, -0.58 - len / 2);
    for (let i = 0; i < 2 + tier; i++) d.cylZ(0.07, 0.22, M.armor, side * 0.25, 0.08, -0.3 - i * 0.22);
  }
  return (0.6 + len) * LONG;
}

/** Bobina curta: anéis emissivos, sem parecer outro canhão de plasma. */
function emp(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  d.box(0.4, 0.4, 0.48, M.armor, 0, 0, -0.3);
  const len = 0.7 + tier * 0.1;
  d.cylZ(0.11, len, M.frame, 0, 0, -0.5 - len / 2);
  for (let i = 0; i < 3 + tier; i++) {
    d.cylZ(0.22, 0.045, M.armor, 0, 0, -0.6 - i * 0.14);
    d.cylZ(0.19, 0.03, M.glow, 0, 0, -0.63 - i * 0.14);
  }
  d.cylZ(0.2, 0.04, M.glow, 0, 0, -0.54 - len);
  return (0.6 + len) * LONG;
}

/** Sem arma: o engate fechado com uma tampa, para o braço não terminar num buraco. */
function cap(root: THREE.Object3D, M: Mats): number {
  cyl(root, 0.21, 0.06, M.frame, 0, 0, -0.17, Math.PI / 2);
  cyl(root, 0.07, 0.03, M.glow, 0, 0, -0.21, Math.PI / 2);
  return 0.24;
}

function mats(accent: number): Mats {
  return {
    armor: new THREE.MeshStandardMaterial({ color: PALETTE.armor, metalness: 0.6, roughness: 0.36 }),
    frame: new THREE.MeshStandardMaterial({ color: PALETTE.frame, metalness: 0.72, roughness: 0.48 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: accent, emissiveIntensity: 3.5 }),
  };
}

function build(weapon: Pick<WeaponStats, 'id' | 'tier'> | null, shoulder = false): WeaponModel {
  const root = new THREE.Group();
  const accent = weapon?.id === 'sonic' || weapon?.id === 'laser' ? PALETTE.pink : weapon?.id === 'seeker' ? PALETTE.cyan : weapon?.id === 'arc' || weapon?.id === 'cryo' ? PALETTE.cyan : weapon?.id === 'flamer' ? PALETTE.sodium : weapon?.id === 'railgun' || weapon?.id === 'emp' || weapon?.id === 'plasma' || weapon?.id === 'blaster' || weapon?.id === 'shotgun' ? PALETTE.green : PALETTE.sodium;
  const M = mats(accent);
  if (shoulder) {
    // Lançador de ombro: o casulo de foguetes, o morteiro da chuva e os lançadores leve e cruzador têm esse desenho. Sem arma (ou outra), o ombro fica limpo.
    if (weapon?.id !== 'rockets' && weapon?.id !== 'barrage' && weapon?.id !== 'sonic' && weapon?.id !== 'seeker' && weapon?.id !== 'swarm' && weapon?.id !== 'cruise') return { object: new THREE.Group(), muzzle: new THREE.Vector3() };
    const muzzleZ =
      weapon.id === 'sonic' ? sonic(root, weapon.tier, M)
      : weapon.id === 'barrage' ? mortarPod(root, weapon.tier, M)
      : weapon.id === 'swarm' ? swarmPod(root, weapon.tier, M)
      : weapon.id === 'cruise' ? cruisePod(root, weapon.tier, M)
      : pod(root, weapon.tier, M);
    batchRigMeshes(root, []);
    return { object: root, muzzle: new THREE.Vector3(0, 0, -muzzleZ) };
  }
  coupling(root, M);
  let muzzleZ: number;
  if (!weapon) muzzleZ = cap(root, M);
  else {
    switch (weapon.id) {
      case 'railgun': muzzleZ = railgun(root, weapon.tier, M); break;
      case 'emp': muzzleZ = emp(root, weapon.tier, M); break;
      case 'plasma':
        muzzleZ = plasma(root, weapon.tier, M);
        break;
      case 'rockets':
      case 'seeker':
        muzzleZ = rockets(root, weapon.tier, M);
        break;
      case 'blaster':
        muzzleZ = blaster(root, weapon.tier, M);
        break;
      case 'shotgun':
        muzzleZ = shotgun(root, weapon.tier, M);
        break;
      case 'barrage':
        muzzleZ = barrage(root, weapon.tier, M);
        break;
      case 'swarm':
        muzzleZ = swarm(root, weapon.tier, M);
        break;
      case 'cruise':
        muzzleZ = cruise(root, weapon.tier, M);
        break;
      case 'laser':
        muzzleZ = laser(root, weapon.tier, M);
        break;
      case 'rotary':
        muzzleZ = rotary(root, weapon.tier, M);
        break;
      case 'arc':
        muzzleZ = arc(root, weapon.tier, M);
        break;
      case 'cryo':
        muzzleZ = cryo(root, weapon.tier, M);
        break;
      case 'flamer':
        muzzleZ = flamer(root, weapon.tier, M);
        break;
      case 'cannon':
        muzzleZ = cannon(root, weapon.tier, M);
        break;
      case 'siege':
        muzzleZ = siege(root, weapon.tier, M);
        break;
      case 'autocannon':
        muzzleZ = autocannon(root, weapon.tier, M);
        break;
      case 'sonic':
        muzzleZ = sonic(root, weapon.tier, M);
        break;
      case 'chainsaw':
        muzzleZ = chainsaw(root, weapon.tier, M);
        break;
    }
  }
  batchRigMeshes(root, []);
  return { object: root, muzzle: new THREE.Vector3(0, 0, -muzzleZ) };
}

const prototypes = new Map<string, WeaponModel>();
const podPrototypes = new Map<string, WeaponModel>();

/**
 * O módulo desta arma (ou o engate fechado, se `null`). Cada chamada devolve uma instância nova que compartilha
 * geometria e material com as outras: pode ser pendurada em qualquer Mech e descartada sem liberar nada.
 */
export function weaponModel(weapon: Pick<WeaponStats, 'id' | 'tier'> | null): WeaponModel {
  const key = weapon ? `${weapon.id}:${weapon.tier}` : 'vazio';
  let proto = prototypes.get(key);
  if (!proto) {
    proto = build(weapon);
    prototypes.set(key, proto);
  }
  return { object: proto.object.clone(), muzzle: proto.muzzle };
}

/**
 * O lançador de ombro desta arma. Mesmo padrão do módulo do pulso (unidade = o tamanho que o encaixe der, origem na
 * traseira, frente = -Z, uma malha só, instâncias que compartilham geometria e material), mas sem o engate. Só os
 * foguetes e a chuva de mísseis têm desenho de ombro; sem arma (ou outra), devolve um grupo vazio e a boca na origem.
 */
export function podModel(weapon: Pick<WeaponStats, 'id' | 'tier'> | null): WeaponModel {
  const key = weapon ? `${weapon.id}:${weapon.tier}` : 'vazio';
  let proto = podPrototypes.get(key);
  if (!proto) {
    proto = build(weapon, true);
    podPrototypes.set(key, proto);
  }
  return { object: proto.object.clone(), muzzle: proto.muzzle };
}
