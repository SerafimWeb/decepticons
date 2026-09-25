import * as THREE from 'three';
import { PALETTE } from '../core/palette';
import { MechBase, type LegRig, type MechRig, type MechStats } from './MechBase';
import { box, cyl, group } from './meshKit';

/**
 * Vector-09: assalto ágil, pulo duplo, dash curto; sem compartimento de sucata.
 * Calibrado em 24/09 (dono: "muito rápido; o tiro precisa de um respiro"): menos velocidade e calor na arma.
 */
export const VECTOR09_STATS: MechStats = {
  name: 'VECTOR-09',
  moveSpeed: 12,
  groundAccel: 70,
  airAccel: 22,
  jumpVelocity: 13,
  maxJumps: 2,
  dashSpeed: 42,
  dashDuration: 0.18,
  dashCooldown: 3,
  radius: 1.3,
  height: 5.3,
  stepHeight: 0.9,
  demolishOnDash: false,
  maxScrapSlots: 0,
  fireInterval: 0.18,
  heatPerShot: 0.085,
  heatCooling: 0.6,
  heatCoolDelay: 0.25,
  heatRecover: 0.35,
  maxModuleHealth: {
    torso: 300,
    head: 100,
    leftArm: 120,
    rightArm: 120,
    leftLeg: 150,
    rightLeg: 150,
  },
};

const HIP = 2.5;
const DEFAULT_PAINT = PALETTE.playerPaint;

function buildRig(paint: number, visor: number): MechRig {
  const M = {
    armor: new THREE.MeshStandardMaterial({ color: PALETTE.armor, metalness: 0.6, roughness: 0.35 }),
    frame: new THREE.MeshStandardMaterial({ color: PALETTE.frame, metalness: 0.7, roughness: 0.5 }),
    paint: new THREE.MeshStandardMaterial({ color: paint, metalness: 0.35, roughness: 0.45 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: visor, emissiveIntensity: 4 }),
    rocket: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff7a1a, emissiveIntensity: 3 }),
    thruster: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff6a00, emissiveIntensity: 2 }),
  };

  const model = new THREE.Group();
  const pelvis = group(model, 0, HIP, 0);
  box(pelvis, 1.3, 0.5, 0.9, M.frame);

  const leg = (side: number): LegRig => {
    const hip = group(pelvis, side * 0.6, -0.1, 0);
    box(hip, 0.5, 0.5, 0.6, M.armor);
    cyl(hip, 0.22, 1.15, M.frame, 0, -0.6, 0);
    box(hip, 0.55, 0.75, 0.6, M.armor, side * 0.05, -0.55, -0.05);
    const knee = group(hip, 0, -1.15, 0);
    box(knee, 0.45, 0.45, 0.5, M.frame);
    box(knee, 0.5, 1.0, 0.55, M.paint, 0, -0.55, 0);
    box(knee, 0.65, 0.2, 1.1, M.frame, 0, -1.15, -0.15);
    return { hip, knee };
  };
  const leftLeg = leg(-1);
  const rightLeg = leg(1);

  const torso = group(pelvis, 0, 0.3, 0);
  box(torso, 2.0, 1.4, 1.5, M.armor, 0, 0.95, 0);
  box(torso, 2.1, 0.25, 1.6, M.paint, 0, 1.7, 0);
  box(torso, 1.4, 0.12, 0.06, M.visor, 0, 1.1, -0.78);
  box(torso, 1.4, 1.0, 0.6, M.frame, 0, 1.0, 1.0);

  // Propulsores traseiros (brilham forte durante o dash).
  const thrusters: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    cyl(torso, 0.22, 0.8, M.frame, side * 0.45, 0.95, 1.4);
    cyl(torso, 0.18, 0.12, M.thruster, side * 0.45, 0.5, 1.4);
    thrusters.push(group(torso, side * 0.45, 0.4, 1.45));
  }

  const head = group(torso, 0, 1.95, -0.15);
  box(head, 0.75, 0.5, 0.85, M.armor, 0, 0.2, 0);
  box(head, 0.65, 0.12, 0.06, M.visor, 0, 0.22, -0.44);
  cyl(head, 0.03, 0.6, M.frame, 0.25, 0.6, 0.2);

  // Braço direito: canhão de plasma principal.
  const rightArm = group(torso, 1.35, 1.45, 0);
  box(rightArm, 0.7, 0.6, 0.9, M.paint, 0.1, 0.1, 0);
  box(rightArm, 0.4, 0.9, 0.45, M.frame, 0, -0.55, 0);
  box(rightArm, 0.55, 0.55, 1.2, M.armor, 0, -1.05, -0.35);
  cyl(rightArm, 0.14, 1.4, M.frame, 0, -1.05, -1.4, Math.PI / 2);
  cyl(rightArm, 0.2, 0.1, M.visor, 0, -1.05, -1.9, Math.PI / 2);
  const muzzle = group(rightArm, 0, -1.05, -2.2);

  // Braço esquerdo: lançador de foguetes (casulo com 4 tubos, bocas acesas em laranja).
  const leftArm = group(torso, -1.35, 1.45, 0);
  box(leftArm, 0.7, 0.6, 0.9, M.paint, -0.1, 0.1, 0);
  box(leftArm, 0.4, 0.9, 0.45, M.frame, 0, -0.55, 0);
  box(leftArm, 0.85, 0.85, 1.3, M.armor, -0.05, -1.12, -0.35);
  for (const [x, y] of [[-0.25, -0.93], [0.15, -0.93], [-0.25, -1.31], [0.15, -1.31]] as const) {
    cyl(leftArm, 0.13, 0.2, M.rocket, x, y, -1.02, Math.PI / 2);
  }
  const leftMuzzle = group(leftArm, -0.05, -1.12, -1.2);

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
    thrusters,
    thrusterMaterial: M.thruster,
    hullMaterials: [M.armor, M.paint],
    hipHeight: HIP,
  };
}

export interface Vector09Options {
  /** Cor da pintura (ex.: alvos e inimigos com cor diferente do jogador). */
  paint?: number;
  /** Cor do visor e das luzes da cabeça: âmbar no jogador, vermelho no inimigo. */
  visor?: number;
}

export class Vector09 extends MechBase {
  constructor(options: Vector09Options = {}) {
    super(VECTOR09_STATS, buildRig(options.paint ?? DEFAULT_PAINT, options.visor ?? PALETTE.green));
  }
}
