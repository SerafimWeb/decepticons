import * as THREE from 'three';
import { PALETTE } from '../core/palette';
import type { LegRig, MechRig } from './MechBase';
import { batchRigMeshes, beveledBox, box, cyl, group, heatVapor } from './meshKit';

/** Parâmetros visuais apenas; não altera colisão, massa, vida, calor ou armas da simulação. */
export interface MechBlueprint {
  readonly id: 'ferret' | 'vector09' | 'heavy' | 'colossus01';
  readonly label: string;
  readonly referenceHeight: number;
  readonly torso: { readonly width: number; readonly height: number; readonly depth: number };
  readonly head: { readonly width: number; readonly height: number; readonly depth: number; readonly antenna: number };
  readonly shoulders: { readonly width: number; readonly height: number; readonly depth: number };
  readonly hips: { readonly width: number; readonly depth: number };
  readonly legs: { readonly hipWidth: number; readonly thighWidth: number; readonly shinWidth: number; readonly upperLength: number; readonly lowerLength: number; readonly footLength: number; readonly digitigrade: number };
  readonly arms: { readonly mountX: number; readonly upperWidth: number; readonly upperLength: number; readonly forearmWidth: number; readonly forearmDepth: number };
  readonly vents: { readonly count: number; readonly width: number; readonly height: number };
  readonly backPack: { readonly width: number; readonly height: number; readonly depth: number };
}

/** Ferret-X: leve e esguio, com pernas longas e sensores altos. Blueprint visual, sem stats de gameplay. */
export const LIGHT_MECH_BLUEPRINT: MechBlueprint = {
  id: 'ferret', label: 'LEVE', referenceHeight: 4.5,
  torso: { width: 1.28, height: 1.03, depth: 0.94 },
  head: { width: 0.56, height: 0.43, depth: 0.56, antenna: 0.24 },
  shoulders: { width: 0.56, height: 0.55, depth: 0.62 }, hips: { width: 0.84, depth: 0.58 },
  legs: { hipWidth: 0.39, thighWidth: 0.39, shinWidth: 0.28, upperLength: 0.92, lowerLength: 1.08, footLength: 0.83, digitigrade: 0.32 },
  arms: { mountX: 0.96, upperWidth: 0.34, upperLength: 0.72, forearmWidth: 0.42, forearmDepth: 0.82 },
  vents: { count: 3, width: 0.12, height: 0.34 }, backPack: { width: 0.68, height: 0.82, depth: 0.48 },
};

/** Vector-09: assalto médio, mantendo a proporção visual aprovada do modelo atual. */
export const MEDIUM_MECH_BLUEPRINT: MechBlueprint = {
  id: 'vector09', label: 'MÉDIO', referenceHeight: 5.3,
  torso: { width: 2.0, height: 1.4, depth: 1.5 },
  head: { width: 0.75, height: 0.5, depth: 0.85, antenna: 0.3 },
  shoulders: { width: 0.7, height: 0.6, depth: 0.9 }, hips: { width: 1.3, depth: 0.9 },
  legs: { hipWidth: 0.5, thighWidth: 0.55, shinWidth: 0.5, upperLength: 1.15, lowerLength: 1.15, footLength: 1.1, digitigrade: 0 },
  arms: { mountX: 1.5, upperWidth: 0.4, upperLength: 0.9, forearmWidth: 0.55, forearmDepth: 1.2 },
  vents: { count: 2, width: 0.16, height: 0.42 }, backPack: { width: 1.02, height: 0.86, depth: 0.62 },
};

/** Pesado padrão: largo e blindado, ainda uma classe de escala 2. Blueprint visual, sem stats. */
export const HEAVY_MECH_BLUEPRINT: MechBlueprint = {
  id: 'heavy', label: 'PESADO', referenceHeight: 6.5,
  torso: { width: 2.62, height: 1.72, depth: 1.88 },
  head: { width: 0.86, height: 0.58, depth: 0.88, antenna: 0.08 },
  shoulders: { width: 1.04, height: 0.88, depth: 1.08 }, hips: { width: 1.7, depth: 1.18 },
  legs: { hipWidth: 0.72, thighWidth: 0.76, shinWidth: 0.7, upperLength: 1.34, lowerLength: 1.28, footLength: 1.42, digitigrade: 0 },
  arms: { mountX: 1.96, upperWidth: 0.58, upperLength: 1.02, forearmWidth: 0.78, forearmDepth: 1.42 },
  vents: { count: 4, width: 0.18, height: 0.5 }, backPack: { width: 1.42, height: 1.04, depth: 0.78 },
};

/**
 * Colossus-01: máquina de cerco da escala 3. Não é o pesado de escala 2 aumentado:
 * recebe uma base larga, tronco alto e pernas que criam espaço para o jogador circular.
 * São parâmetros estritamente visuais; IA, vida e armas entram no encontro em outro módulo.
 */
export const COLOSSUS_01_BLUEPRINT: MechBlueprint = {
  id: 'colossus01', label: 'COLOSSUS-01', referenceHeight: 14,
  torso: { width: 5.8, height: 3.8, depth: 4.2 },
  head: { width: 1.65, height: 1.05, depth: 1.5, antenna: 0 },
  shoulders: { width: 2.25, height: 1.75, depth: 2.15 }, hips: { width: 3.95, depth: 2.5 },
  legs: { hipWidth: 2.2, thighWidth: 1.65, shinWidth: 1.45, upperLength: 3.05, lowerLength: 2.85, footLength: 3.25, digitigrade: 0 },
  arms: { mountX: 4.45, upperWidth: 1.2, upperLength: 2.15, forearmWidth: 1.62, forearmDepth: 3.1 },
  vents: { count: 5, width: 0.42, height: 1.15 }, backPack: { width: 3.2, height: 2.55, depth: 1.85 },
};

export const MECH_BLUEPRINTS: readonly MechBlueprint[] = [
  LIGHT_MECH_BLUEPRINT,
  MEDIUM_MECH_BLUEPRINT,
  HEAVY_MECH_BLUEPRINT,
  COLOSSUS_01_BLUEPRINT,
];

export interface BlueprintRigOptions {
  readonly paint?: number;
  readonly visor?: number;
  readonly scaleToHeight?: number;
}

/** Constrói o mesmo rig articulado de seis partes a partir de proporções; toda fusão ocorre na criação. */
export function buildMechBlueprintRig(blueprint: MechBlueprint, options: BlueprintRigOptions = {}): MechRig {
  const scale = options.scaleToHeight ?? 1;
  const torsoW = blueprint.torso.width;
  const torsoH = blueprint.torso.height;
  const torsoD = blueprint.torso.depth;
  // Mantém a sola no chão: offset do quadril + segmentos da perna + meio do pé.
  const hipHeight = (blueprint.legs.upperLength + blueprint.legs.lowerLength + 0.3) * scale;
  const M = {
    armor: new THREE.MeshStandardMaterial({ color: PALETTE.armor, metalness: 0.6, roughness: 0.36 }),
    frame: new THREE.MeshStandardMaterial({ color: PALETTE.frame, metalness: 0.72, roughness: 0.48 }),
    paint: new THREE.MeshStandardMaterial({ color: options.paint ?? PALETTE.playerPaint, metalness: 0.36, roughness: 0.44 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: options.visor ?? PALETTE.green, emissiveIntensity: 4 }),
    rocket: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: PALETTE.sodium, emissiveIntensity: 3 }),
    thruster: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: PALETTE.sodium, emissiveIntensity: 2 }),
  };
  M.thruster.userData.mechDynamicEmission = true;

  const model = new THREE.Group();
  model.name = `mech-${blueprint.id}`;
  const pelvis = group(model, 0, hipHeight, 0);
  pelvis.name = 'pelvis';
  box(pelvis, blueprint.hips.width, 0.5 * scale, blueprint.hips.depth, M.frame);

  const leg = (side: number): LegRig => {
    const hip = group(pelvis, side * blueprint.legs.hipWidth * 0.5, -0.1 * scale, 0);
    hip.name = side < 0 ? 'leftLeg' : 'rightLeg';
    beveledBox(hip, blueprint.legs.thighWidth, blueprint.legs.upperLength * 0.76, blueprint.legs.thighWidth * 1.08, 0.08 * scale, M.armor, 0, -blueprint.legs.upperLength * 0.35, 0);
    cyl(hip, blueprint.legs.thighWidth * 0.38, blueprint.legs.upperLength * 0.9, M.frame, 0, -blueprint.legs.upperLength * 0.48, 0);
    const knee = group(hip, 0, -blueprint.legs.upperLength, 0);
    knee.name = side < 0 ? 'leftLegLower' : 'rightLegLower';
    beveledBox(knee, blueprint.legs.shinWidth * 0.92, blueprint.legs.lowerLength * 0.94, blueprint.legs.shinWidth, 0.06 * scale, M.paint, 0, -blueprint.legs.lowerLength * 0.42, 0);
    box(knee, blueprint.legs.shinWidth * 1.2, 0.2 * scale, blueprint.legs.footLength, M.frame, 0, -blueprint.legs.lowerLength - 0.1 * scale, -blueprint.legs.footLength * 0.12);
    // Tornozelo avançado cria a perna digitígrada sem adicionar junta nem draw call.
    if (blueprint.legs.digitigrade > 0) knee.position.z = -blueprint.legs.digitigrade * scale;
    return { hip, knee };
  };
  const leftLeg = leg(-1);
  const rightLeg = leg(1);

  const torso = group(pelvis, 0, 0.3 * scale, 0);
  torso.name = 'torso';
  const updateVapor = heatVapor(torso, blueprint.backPack.width * 0.32, torsoD * 0.78 + blueprint.backPack.depth * 0.5 + 0.08 * scale);
  beveledBox(torso, torsoW, torsoH, torsoD, Math.min(torsoW, torsoH, torsoD) * 0.055, M.armor, 0, torsoH * 0.68, 0);
  beveledBox(torso, torsoW * 1.04, 0.2 * scale, torsoD * 1.04, 0.07 * scale, M.paint, 0, torsoH * 1.18, 0);
  box(torso, torsoW * 0.62, 0.12 * scale, 0.06 * scale, M.visor, 0, torsoH * 0.78, -torsoD * 0.53);
  box(torso, torsoW * 0.56, torsoH * 0.62, blueprint.backPack.depth, M.frame, 0, torsoH * 0.66, torsoD * 0.78);
  // Respiros nas laterais: formas simples e espaçadas continuam legíveis à distância.
  for (const side of [-1, 1]) {
    for (let i = 0; i < blueprint.vents.count; i++) {
      const y = torsoH * (0.42 + (i / Math.max(1, blueprint.vents.count - 1)) * 0.48);
      box(torso, blueprint.vents.width, blueprint.vents.height / blueprint.vents.count, 0.055 * scale, M.rocket,
        side * (torsoW * 0.43), y, -torsoD * 0.52);
    }
  }
  const thrusters: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const x = side * blueprint.backPack.width * 0.32;
    cyl(torso, blueprint.backPack.width * 0.19, blueprint.backPack.depth * 0.9, M.frame, x, torsoH * 0.48, torsoD * 0.74);
    cyl(torso, blueprint.backPack.width * 0.15, 0.12 * scale, M.thruster, x, torsoH * 0.48, torsoD * 1.12);
    thrusters.push(group(torso, x, torsoH * 0.48, torsoD * 1.15));
  }

  const head = group(torso, 0, torsoH * 1.25, -torsoD * 0.08);
  head.name = 'head';
  beveledBox(head, blueprint.head.width, blueprint.head.height, blueprint.head.depth, Math.min(blueprint.head.width, blueprint.head.height, blueprint.head.depth) * 0.11, M.armor, 0, blueprint.head.height * 0.5, 0);
  box(head, blueprint.head.width * 0.78, 0.11 * scale, 0.06 * scale, M.visor, 0, blueprint.head.height * 0.56, -blueprint.head.depth * 0.52);
  if (blueprint.head.antenna > 0) cyl(head, 0.035 * scale, blueprint.head.antenna, M.frame, blueprint.head.width * 0.28, blueprint.head.height + blueprint.head.antenna * 0.45, 0.08 * scale);

  const arm = (side: number, isLeft: boolean): THREE.Group => {
    const g = group(torso, side * blueprint.arms.mountX, torsoH * 0.84, 0);
    g.name = isLeft ? 'leftArm' : 'rightArm';
    beveledBox(g, blueprint.shoulders.width, blueprint.shoulders.height, blueprint.shoulders.depth, Math.min(blueprint.shoulders.width, blueprint.shoulders.height) * 0.1, M.paint, 0, 0, 0);
    box(g, blueprint.arms.upperWidth, blueprint.arms.upperLength, blueprint.arms.upperWidth, M.frame, 0, -blueprint.arms.upperLength * 0.72, 0);
    box(g, blueprint.arms.forearmWidth, blueprint.arms.forearmWidth, blueprint.arms.forearmDepth, M.armor, 0, -blueprint.arms.upperLength * 1.5, -blueprint.arms.forearmDepth * 0.2);
    if (isLeft) {
      const rows = blueprint.id === 'heavy' || blueprint.id === 'colossus01' ? 3 : 2;
      const cols = 2;
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const cx = (col - (cols - 1) / 2) * blueprint.arms.forearmWidth * 0.42;
        const cy = -blueprint.arms.upperLength * 1.5 + (row - (rows - 1) / 2) * blueprint.arms.forearmWidth * 0.38;
        cyl(g, blueprint.arms.forearmWidth * 0.11, 0.18 * scale, M.rocket, cx, cy, -blueprint.arms.forearmDepth * 0.62, Math.PI / 2);
      }
    } else {
      cyl(g, blueprint.arms.forearmWidth * 0.2, blueprint.arms.forearmDepth * 1.1, M.frame, 0, -blueprint.arms.upperLength * 1.5, -blueprint.arms.forearmDepth * 0.64, Math.PI / 2);
      cyl(g, blueprint.arms.forearmWidth * 0.24, 0.12 * scale, M.visor, 0, -blueprint.arms.upperLength * 1.5, -blueprint.arms.forearmDepth * 1.16, Math.PI / 2);
    }
    return g;
  };
  const rightArm = arm(1, false);
  const leftArm = arm(-1, true);
  const muzzle = group(rightArm, 0, -blueprint.arms.upperLength * 1.5, -blueprint.arms.forearmDepth * 1.35);
  const leftMuzzle = group(leftArm, 0, -blueprint.arms.upperLength * 1.5, -blueprint.arms.forearmDepth * 0.8);

  const batchedMaterial = batchRigMeshes(model, [M.armor, M.paint]);
  const setHeatVisual = (dt: number, heat: number, overheated: boolean, coolingBoost: boolean): void => {
    const setHeat = batchedMaterial.userData.setHeat;
    if (typeof setHeat === 'function') setHeat(Math.max(0, (heat - 0.65) / 0.35) * (overheated ? 0.62 : 0.52));
    updateVapor(dt, heat, overheated, coolingBoost);
  };
  model.userData.blueprint = blueprint.id;
  model.scale.setScalar(scale);
  return {
    model, pelvis, torso, head, leftArm, rightArm, leftLeg, rightLeg, muzzle, leftMuzzle,
    thrusters, thrusterMaterial: batchedMaterial, setDashVisual: batchedMaterial.userData.setDash,
    hullMaterials: [batchedMaterial], hipHeight, setHeatVisual,
  };
}
