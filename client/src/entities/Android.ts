import * as THREE from 'three';
import { PALETTE } from '../core/palette';
import { MechBase, type LegRig, type MechRig, type MechStats } from './MechBase';
import { box, cyl, group } from './meshKit';

/**
 * Andróide rebelde, escala 1: um robô autônomo do tamanho dos humanoides de hoje (~2 m), uma IA
 * rebelde a pé. Pequeno, frágil e com tiro fraco, mas muito mais ágil que um Mech: arranca quase
 * na hora, pula duas vezes e desvia com dash a cada 1,4 s. Alvo pequeno: acertar exige mira de
 * verdade (no toque, a mira assistida ajuda).
 */
export const ANDROID_STATS: MechStats = {
  name: 'ANDRÓIDE A-1',
  moveSpeed: 10.5,
  groundAccel: 120,
  airAccel: 40,
  jumpVelocity: 10,
  maxJumps: 2,
  dashSpeed: 30,
  dashDuration: 0.14,
  dashCooldown: 1.4,
  radius: 0.45,
  height: 2,
  stepHeight: 0.45,
  demolishOnDash: false,
  maxScrapSlots: 0,
  fireInterval: 0.3,
  weaponDamage: 9,
  heatPerShot: 0.12,
  heatCooling: 0.7,
  heatCoolDelay: 0.2,
  heatRecover: 0.3,
  maxModuleHealth: {
    torso: 70,
    head: 30,
    leftArm: 35,
    rightArm: 35,
    leftLeg: 40,
    rightLeg: 40,
  },
};

const HIP = 1.0;

function buildRig(paint: number, visor: number): MechRig {
  const M = {
    shell: new THREE.MeshStandardMaterial({ color: paint, metalness: 0.25, roughness: 0.4 }),
    frame: new THREE.MeshStandardMaterial({ color: PALETTE.frame, metalness: 0.7, roughness: 0.5 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: visor, emissiveIntensity: 4 }),
    thruster: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: visor, emissiveIntensity: 1 }),
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
  box(torso, 0.46, 0.55, 0.28, M.shell, 0, 0.32, 0);
  box(torso, 0.3, 0.05, 0.02, M.visor, 0, 0.44, -0.15);
  box(torso, 0.32, 0.32, 0.14, M.frame, 0, 0.32, 0.2);

  // Cabeça: casco liso com a faixa do visor, como os humanoides de hoje.
  const head = group(torso, 0, 0.62, 0);
  box(head, 0.2, 0.24, 0.22, M.shell, 0, 0.12, 0);
  box(head, 0.18, 0.05, 0.02, M.visor, 0, 0.14, -0.115);

  // Braço direito: antebraço vira um blaster apontado para a frente.
  const rightArm = group(torso, 0.3, 0.52, 0);
  box(rightArm, 0.11, 0.3, 0.12, M.frame, 0, -0.15, 0);
  box(rightArm, 0.13, 0.13, 0.42, M.shell, 0, -0.32, -0.15);
  cyl(rightArm, 0.035, 0.12, M.visor, 0, -0.32, -0.38, Math.PI / 2);
  const muzzle = group(rightArm, 0, -0.32, -0.45);

  // Braço esquerdo: mão livre (sem arma secundária).
  const leftArm = group(torso, -0.3, 0.52, 0);
  box(leftArm, 0.11, 0.3, 0.12, M.frame, 0, -0.15, 0);
  box(leftArm, 0.12, 0.3, 0.13, M.shell, 0, -0.45, 0);

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
    thrusters: [],
    thrusterMaterial: M.thruster,
    hullMaterials: [M.shell],
    hipHeight: HIP,
  };
}

export interface AndroidOptions {
  /** Cor do casco (padrão: branco, como os humanoides de hoje). */
  paint?: number;
  /** Cor do visor e das luzes (padrão: vermelho de IA rebelde). */
  visor?: number;
}

export class Android extends MechBase {
  constructor(options: AndroidOptions = {}) {
    super(ANDROID_STATS, buildRig(options.paint ?? PALETTE.bone, options.visor ?? PALETTE.signal));
  }
}
