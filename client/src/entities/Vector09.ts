import * as THREE from 'three';
import { MechBase, type LegRig, type MechRig, type MechStats } from './MechBase';
import { box, cyl, group } from './meshKit';

/** Vector-09: assalto rápido, pulo duplo, dash curto; sem compartimento de sucata. */
export const VECTOR09_STATS: MechStats = {
  name: 'VECTOR-09',
  moveSpeed: 16,
  groundAccel: 95,
  airAccel: 28,
  jumpVelocity: 13,
  maxJumps: 2,
  dashSpeed: 50,
  dashDuration: 0.18,
  dashCooldown: 2.5,
  radius: 1.3,
  height: 5.3,
  stepHeight: 0.9,
  demolishOnDash: false,
  maxScrapSlots: 0,
  fireInterval: 0.14,
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

function buildRig(): MechRig {
  const M = {
    armor: new THREE.MeshStandardMaterial({ color: 0x5a606c, metalness: 0.6, roughness: 0.35 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1f222a, metalness: 0.7, roughness: 0.5 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xd94a1a, metalness: 0.35, roughness: 0.45 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00e5ff, emissiveIntensity: 4 }),
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

  // Braço esquerdo: lançador secundário (placeholder).
  const leftArm = group(torso, -1.35, 1.45, 0);
  box(leftArm, 0.7, 0.6, 0.9, M.paint, -0.1, 0.1, 0);
  box(leftArm, 0.4, 0.9, 0.45, M.frame, 0, -0.55, 0);
  box(leftArm, 0.5, 0.8, 0.55, M.armor, 0, -1.1, -0.2);
  box(leftArm, 0.45, 0.35, 0.7, M.frame, -0.1, -1.1, -0.6);
  box(leftArm, 0.3, 0.08, 0.05, M.visor, -0.1, -1.05, -0.96);

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
    thrusters,
    thrusterMaterial: M.thruster,
    hipHeight: HIP,
  };
}

export class Vector09 extends MechBase {
  constructor() {
    super(VECTOR09_STATS, buildRig());
  }
}
