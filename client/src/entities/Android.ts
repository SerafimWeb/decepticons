import * as THREE from 'three';
import type { Loadout } from '../combat/weapons';
import { PALETTE } from '../core/palette';
import { ANDROID_STATS } from './chassis';
import { MechBase, type LegRig, type MechRig, type MechStats } from './MechBase';
import { batchRigMeshes, box, cyl, group, heatVapor } from './meshKit';

/** Os números do andróide ficam em `chassis.ts` (sem 3D: o servidor e o site leem de lá). */
export { ANDROID_STATS };

const HIP = 1.0;
/** Altura em que as peças abaixo foram desenhadas; o modelo é escalado para a altura do chassi. */
const MODEL_HEIGHT = 2;

function buildRig(paint: number, visor: number, tool: AndroidTool, height: number): MechRig {
  const M = {
    shell: new THREE.MeshStandardMaterial({ color: paint, metalness: 0.25, roughness: 0.4 }),
    frame: new THREE.MeshStandardMaterial({ color: PALETTE.frame, metalness: 0.7, roughness: 0.5 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: visor, emissiveIntensity: 4 }),
    thruster: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: visor, emissiveIntensity: 1 }),
    saw: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: PALETTE.sodium, emissiveIntensity: 2.2 }),
  };

  const model = new THREE.Group();
  const pelvis = group(model, 0, HIP, 0);
  box(pelvis, 0.42, 0.18, 0.26, M.frame);

  // Pernas finas: coxa em casco claro, canela em estrutura escura, pé achatado.
  const leg = (side: number): LegRig => {
    const hip = group(pelvis, side * 0.13, -0.05, 0);
    box(hip, 0.17, 0.48, 0.19, M.shell, 0, -0.24, 0);
    const knee = group(hip, 0, -0.48, 0);
    box(knee, 0.14, 0.44, 0.16, M.frame, 0, -0.22, 0);
    box(knee, 0.16, 0.06, 0.28, M.frame, 0, -0.45, -0.05);
    return { hip, knee };
  };
  const leftLeg = leg(-1);
  const rightLeg = leg(1);

  // Tronco em casco claro, faixa acesa no peito e mochila de baterias.
  const torso = group(pelvis, 0, 0.1, 0);
  const updateVapor = heatVapor(torso, 0.18, 0.31);
  box(torso, 0.46, 0.55, 0.28, M.shell, 0, 0.32, 0);
  box(torso, 0.3, 0.05, 0.02, M.visor, 0, 0.44, -0.15);
  box(torso, 0.32, 0.32, 0.14, M.frame, 0, 0.32, 0.2);

  // Cabeça: casco liso com a faixa do visor, como os humanoides de hoje.
  const head = group(torso, 0, 0.62, 0);
  box(head, 0.2, 0.24, 0.22, M.shell, 0, 0.12, 0);
  box(head, 0.18, 0.05, 0.02, M.visor, 0, 0.14, -0.115);

  // Braço direito: o antebraço é a ferramenta. Motosserra (combate): motor no punho e a lâmina para a
  // frente, com as bordas dos dentes acesas em laranja. Ferramenta de conserto (técnico): o antebraço antigo.
  const rightArm = group(torso, 0.3, 0.52, 0);
  box(rightArm, 0.11, 0.3, 0.12, M.frame, 0, -0.15, 0);
  let muzzle: THREE.Object3D;
  if (tool === 'chainsaw') {
    box(rightArm, 0.15, 0.15, 0.28, M.shell, 0, -0.32, -0.08);
    box(rightArm, 0.045, 0.13, 0.62, M.frame, 0, -0.32, -0.52);
    box(rightArm, 0.05, 0.025, 0.62, M.saw, 0, -0.395, -0.52);
    box(rightArm, 0.05, 0.025, 0.62, M.saw, 0, -0.245, -0.52);
    muzzle = group(rightArm, 0, -0.32, -0.83);
  } else {
    box(rightArm, 0.13, 0.13, 0.42, M.shell, 0, -0.32, -0.15);
    cyl(rightArm, 0.035, 0.12, M.visor, 0, -0.32, -0.38, Math.PI / 2);
    muzzle = group(rightArm, 0, -0.32, -0.45);
  }

  // Braço esquerdo: mão livre; no andróide pilotado, a motosserra (o direito fica com o blaster).
  const leftArm = group(torso, -0.3, 0.52, 0);
  box(leftArm, 0.11, 0.3, 0.12, M.frame, 0, -0.15, 0);
  let leftMuzzle: THREE.Object3D | undefined;
  if (tool === 'pilot') {
    box(leftArm, 0.15, 0.15, 0.28, M.shell, 0, -0.32, -0.08);
    box(leftArm, 0.045, 0.13, 0.62, M.frame, 0, -0.32, -0.52);
    box(leftArm, 0.05, 0.025, 0.62, M.saw, 0, -0.395, -0.52);
    box(leftArm, 0.05, 0.025, 0.62, M.saw, 0, -0.245, -0.52);
    leftMuzzle = group(leftArm, 0, -0.32, -0.83);
  } else {
    box(leftArm, 0.12, 0.3, 0.13, M.shell, 0, -0.45, 0);
  }

  const batchedMaterial = batchRigMeshes(model, [M.shell]);
  const setHeatVisual = (dt: number, heat: number, overheated: boolean, coolingBoost: boolean): void => {
    const setHeat = batchedMaterial.userData.setHeat;
    if (typeof setHeat === 'function') setHeat(Math.max(0, (heat - 0.65) / 0.35) * (overheated ? 0.62 : 0.52));
    updateVapor(dt, heat, overheated, coolingBoost);
  };
  // As juntas animam em coordenadas do modelo (quadril em HIP); a escala vale para tudo abaixo dele.
  model.scale.setScalar(height / MODEL_HEIGHT);
  return {
    model,
    pelvis,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    muzzle,
    leftMuzzle,
    thrusters: [],
    thrusterMaterial: batchedMaterial,
    hullMaterials: [batchedMaterial],
    hipHeight: HIP,
    setHeatVisual,
  };
}

/**
 * O que vai nos antebraços: motosserra no direito (rebelde de combate), ferramenta de conserto (técnico) ou,
 * no andróide pilotado pelo jogador, blaster no direito e motosserra no esquerdo.
 */
export type AndroidTool = 'chainsaw' | 'repair' | 'pilot';

export interface AndroidOptions {
  /** Cor do casco (padrão: branco, como os humanoides de hoje). */
  paint?: number;
  /** Cor do visor e das luzes (padrão: vermelho de IA rebelde). */
  visor?: number;
  /** Ferramenta do antebraço (padrão: motosserra). */
  tool?: AndroidTool;
  /** Números do chassi (padrão: o rebelde; o jogador usa `PILOT_ANDROID_STATS`). */
  stats?: MechStats;
  /** Armas nos braços (Hangar); sem isso, as de fábrica do chassi. */
  loadout?: Loadout;
}

export class Android extends MechBase {
  constructor(options: AndroidOptions = {}) {
    const stats = options.stats ?? ANDROID_STATS;
    super(stats, buildRig(options.paint ?? PALETTE.bone, options.visor ?? PALETTE.signal, options.tool ?? 'chainsaw', stats.height), options.loadout);
  }
}
