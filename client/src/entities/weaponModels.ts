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

/** Motosserra (corpo a corpo): motor e uma barra alta com dentes luminosos. O nível alonga a barra. */
function chainsaw(root: THREE.Object3D, tier: number, M: Mats): number {
  const d = pen(root);
  const len = [1.3, 1.5, 1.7][tier]!;
  d.box(0.38, 0.38, 0.52, M.armor, 0, 0, -0.3);
  d.box(0.09, 0.52, len, M.frame, 0, 0, -0.56 - len / 2);
  for (const side of [-1, 1]) d.box(0.115, 0.05, len, M.glow, 0, side * 0.285, -0.56 - len / 2);
  return (0.56 + len) * LONG;
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

function build(weapon: Pick<WeaponStats, 'id' | 'tier'> | null): WeaponModel {
  const root = new THREE.Group();
  const accent = weapon?.id === 'plasma' || weapon?.id === 'blaster' || weapon?.id === 'shotgun' ? PALETTE.green : PALETTE.sodium;
  const M = mats(accent);
  coupling(root, M);
  let muzzleZ: number;
  if (!weapon) muzzleZ = cap(root, M);
  else {
    switch (weapon.id) {
      case 'plasma':
        muzzleZ = plasma(root, weapon.tier, M);
        break;
      case 'rockets':
        muzzleZ = rockets(root, weapon.tier, M);
        break;
      case 'blaster':
        muzzleZ = blaster(root, weapon.tier, M);
        break;
      case 'shotgun':
        muzzleZ = shotgun(root, weapon.tier, M);
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
