import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { weapon } from '../combat/weapons';
import { CHASSIS } from './chassis';
import { ImportedMech } from './ImportedMech';
import type { MechRig } from './MechBase';
import { weaponModel } from './weaponModels';
import { AxisCorrectedJoint, instantiateImportedMechRig, type ImportedMechAsset } from './importedMechRig';

/**
 * `GLTFLoader` precisa de `self` (só existe em navegador/worker) e decodifica textura via `Image`,
 * então carregar um `.glb` de verdade não roda no Vitest (`environment: 'node'`, sem DOM) — só num
 * navegador real (coberto pelo smoke/site em Playwright). O que dá pra testar aqui, e é o achado real
 * desta sessão: a correção de eixo funciona pra QUALQUER orientação de repouso do osso, não só a deste
 * arquivo específico — por isso o teste usa uma orientação de bind deliberadamente torta.
 */
function boneWithWeirdRest(): THREE.Bone {
  const parent = new THREE.Bone();
  parent.quaternion.setFromEuler(new THREE.Euler(0.4, 1.1, -0.7)); // pai também girado, de propósito
  const bone = new THREE.Bone();
  bone.quaternion.setFromEuler(new THREE.Euler(1.3, -0.6, 2.1)); // orientação de bind "torta"
  parent.add(bone);
  parent.updateMatrixWorld(true);
  return bone;
}

describe('importedMechRig: correção de eixo num osso importado', () => {
  it('rotation.x gira no eixo X do MUNDO, não no eixo local torto do bind pose', () => {
    const bone = boneWithWeirdRest();
    const model = new THREE.Object3D();
    const joint = new AxisCorrectedJoint(bone, model);

    const beforeWorld = bone.getWorldQuaternion(new THREE.Quaternion());
    joint.rotation.x = 0.6;
    bone.parent!.updateMatrixWorld(true);
    const afterWorld = bone.getWorldQuaternion(new THREE.Quaternion());

    // Delta = afterWorld * beforeWorld⁻¹ (rotação aplicada, medida no mundo).
    const delta = afterWorld.clone().multiply(beforeWorld.clone().invert());
    const axis = new THREE.Vector3();
    const angle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)));
    if (Math.sin(angle / 2) > 1e-6) axis.set(delta.x, delta.y, delta.z).divideScalar(Math.sin(angle / 2));
    if (delta.w < 0) axis.negate(); // quatérnio antípoda representa o mesmo giro

    expect(Math.abs(axis.dot(new THREE.Vector3(1, 0, 0)))).toBeGreaterThan(0.999);
    expect(angle).toBeCloseTo(0.6, 2);
  });

  it('rotation.y gira no eixo Y do MUNDO, independente do rotation.x já aplicado', () => {
    const bone = boneWithWeirdRest();
    const model = new THREE.Object3D();
    const joint = new AxisCorrectedJoint(bone, model);
    joint.rotation.x = 0.3;
    bone.parent!.updateMatrixWorld(true);
    const beforeWorld = bone.getWorldQuaternion(new THREE.Quaternion());

    joint.rotation.y = 0.5;
    bone.parent!.updateMatrixWorld(true);
    const afterWorld = bone.getWorldQuaternion(new THREE.Quaternion());

    const delta = afterWorld.clone().multiply(beforeWorld.clone().invert());
    const axis = new THREE.Vector3();
    const angle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)));
    if (Math.sin(angle / 2) > 1e-6) axis.set(delta.x, delta.y, delta.z).divideScalar(Math.sin(angle / 2));
    if (delta.w < 0) axis.negate();

    expect(Math.abs(axis.dot(new THREE.Vector3(0, 1, 0)))).toBeGreaterThan(0.999);
    expect(angle).toBeCloseTo(0.5, 2);
  });

  it('volta pro bind pose exato quando os dois ângulos voltam a zero', () => {
    const bone = boneWithWeirdRest();
    const restQuat = bone.quaternion.clone();
    const model = new THREE.Object3D();
    const joint = new AxisCorrectedJoint(bone, model);
    joint.rotation.x = 0.9;
    joint.rotation.y = -0.4;
    joint.rotation.x = 0;
    joint.rotation.y = 0;
    expect(bone.quaternion.angleTo(restQuat)).toBeCloseTo(0, 5);
  });

  it('não mexe na posição do osso, só na rotação (position.z de recuo continua funcionando)', () => {
    const bone = boneWithWeirdRest();
    bone.position.set(0.1, 0.2, 0.3);
    const model = new THREE.Object3D();
    const joint = new AxisCorrectedJoint(bone, model);
    joint.position.z = 0.5;
    expect(bone.position.z).toBeCloseTo(0.5, 6);
  });
});

function boneAt(name: string, x: number, y: number, z: number): THREE.Bone {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.set(x, y, z);
  return bone;
}

/**
 * Esqueleto mínimo no referencial do ARQUIVO (personagem olhando para +Z, então a esquerda dele é +X), girado 180°
 * exatamente como `preloadImportedMechAsset` faz com `rotationY: Math.PI`. É o caso dos quatro chassis importados.
 * `tpose`: braços abertos para os lados (como o Marauder); senão, pendurados.
 */
function syntheticAsset(o: { tpose: boolean; armRest?: ImportedMechAsset['armRest']; weaponMounts?: boolean }): ImportedMechAsset {
  const scene = new THREE.Group();
  const hips = boneAt('Hips', 0, 1, 0);
  const spine = boneAt('Spine', 0, 0.3, 0);
  const head = boneAt('Head', 0, 0.5, 0);
  const lArm = boneAt('LArm', 0.3, 0.3, 0);
  const rArm = boneAt('RArm', -0.3, 0.3, 0);
  // Braço em duas partes, como um esqueleto de verdade: ombro, antebraço (0,4) e mão (mais 0,4).
  const lFore = o.tpose ? boneAt('LForeArm', 0.4, 0, 0) : boneAt('LForeArm', 0, -0.4, 0);
  const rFore = o.tpose ? boneAt('RForeArm', -0.4, 0, 0) : boneAt('RForeArm', 0, -0.4, 0);
  const lHand = o.tpose ? boneAt('LHand', 0.4, 0, 0) : boneAt('LHand', 0, -0.4, 0);
  const rHand = o.tpose ? boneAt('RHand', -0.4, 0, 0) : boneAt('RHand', 0, -0.4, 0);
  const lUp = boneAt('LUpLeg', 0.2, 0, 0);
  const lLow = boneAt('LLeg', 0, -0.5, 0);
  const lFoot = boneAt('LFoot', 0, -0.5, 0);
  const rUp = boneAt('RUpLeg', -0.2, 0, 0);
  const rLow = boneAt('RLeg', 0, -0.5, 0);
  const rFoot = boneAt('RFoot', 0, -0.5, 0);
  hips.add(spine, lUp, rUp);
  spine.add(head, lArm, rArm);
  lArm.add(lFore);
  lFore.add(lHand);
  rArm.add(rFore);
  rFore.add(rHand);
  lUp.add(lLow);
  lLow.add(lFoot);
  rUp.add(rLow);
  rLow.add(rFoot);
  scene.add(hips);
  scene.rotation.y = Math.PI;
  scene.updateMatrixWorld(true);
  return {
    scene,
    boneNames: {
      hips: 'Hips',
      head: 'Head',
      torso: 'Spine',
      leftArm: 'LArm',
      rightArm: 'RArm',
      leftUpLeg: 'LUpLeg',
      leftLowerLeg: 'LLeg',
      rightUpLeg: 'RUpLeg',
      rightLowerLeg: 'RLeg',
      leftHand: 'LHand',
      rightHand: 'RHand',
    },
    hipHeight: 1,
    naturalHeight: 2,
    naturalMinY: 0,
    armRest: o.armRest,
    weaponMounts: o.weaponMounts,
  };
}

const at = (rig: MechRig, name: string): THREE.Vector3 => {
  let found: THREE.Object3D | undefined;
  rig.model.traverse((n) => {
    if (n.name === name) found = n;
  });
  return found!.getWorldPosition(new THREE.Vector3());
};

/** Do ombro à mão, no referencial do Mech (frente em -Z), normalizado. */
const armDir = (rig: MechRig, arm: string, hand: string): THREE.Vector3 => at(rig, hand).sub(at(rig, arm)).normalize();

describe('importedMechRig: a animação do jogo vale para malha importada virada 180° (a mesma convenção do rig procedural)', () => {
  it('hip positivo leva o joelho para a FRENTE (-Z); o balanço não pode sair invertido', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: false }), 2);
    const before = at(rig, 'LLeg');
    rig.leftLeg.hip.rotation.x = 0.5;
    const after = at(rig, 'LLeg');
    expect(after.z - before.z).toBeLessThan(-0.1);
    expect(Math.abs(after.x - before.x)).toBeLessThan(1e-6);
  });

  it('joelho negativo dobra o pé para TRÁS (+Z), como um joelho de verdade', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: false }), 2);
    const before = at(rig, 'LFoot');
    rig.leftLeg.knee.rotation.x = -0.8;
    expect(at(rig, 'LFoot').z - before.z).toBeGreaterThan(0.1);
  });

  it('pitch positivo (olhar para cima) leva a mão do braço pendurado para a frente e para cima', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: false }), 2);
    const before = at(rig, 'LHand');
    rig.leftArm.rotation.x = 0.5;
    const after = at(rig, 'LHand');
    expect(after.z - before.z).toBeLessThan(-0.1);
    expect(after.y - before.y).toBeGreaterThan(0.05);
  });

  it('o sentido também vale depois de o Mech girar o yaw (os eixos são do Mech, não do mundo)', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: false }), 2);
    const root = new THREE.Group();
    root.add(rig.model);
    root.rotation.y = Math.PI / 2; // frente do Mech passa a ser -X
    root.updateMatrixWorld(true);
    const before = at(rig, 'LLeg');
    rig.leftLeg.hip.rotation.x = 0.5;
    root.updateMatrixWorld(true);
    const after = at(rig, 'LLeg');
    expect(after.x - before.x).toBeLessThan(-0.1);
    expect(Math.abs(after.z - before.z)).toBeLessThan(1e-6);
  });
});

describe('importedMechRig: malha em T-pose (Marauder) com armRest', () => {
  it('sem armRest o braço fica aberto e a mira não o move: é o defeito que o armRest resolve', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: true }), 2);
    expect(Math.abs(armDir(rig, 'LArm', 'LHand').x)).toBeGreaterThan(0.99);
    const before = at(rig, 'LHand');
    rig.leftArm.rotation.x = 0.5;
    expect(at(rig, 'LHand').distanceTo(before)).toBeLessThan(1e-6);
  });

  it('com armRest os dois braços ficam pendurados e adiantados, simétricos, e a mira volta a mexê-los', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: true, armRest: { lower: 1.3, forward: 0.5 } }), 2);
    const left = armDir(rig, 'LArm', 'LHand');
    const right = armDir(rig, 'RArm', 'RHand');
    for (const d of [left, right]) {
      expect(d.y).toBeLessThan(-0.7); // para baixo
      expect(d.z).toBeLessThan(-0.2); // e para a frente (-Z)
    }
    expect(left.x).toBeLessThan(0); // o braço esquerdo do personagem fica do lado -X depois da rotação de 180°
    expect(right.x).toBeGreaterThan(0);
    expect(left.x).toBeCloseTo(-right.x, 6);

    const before = at(rig, 'LHand');
    rig.leftArm.rotation.x = 0.5;
    const after = at(rig, 'LHand');
    expect(after.y - before.y).toBeGreaterThan(0.05);
    expect(after.z - before.z).toBeLessThan(-0.05);
  });

  it('armRest não mexe em braço que já vem pendurado', () => {
    const plain = instantiateImportedMechRig(syntheticAsset({ tpose: false }), 2);
    const rest = instantiateImportedMechRig(syntheticAsset({ tpose: false, armRest: { lower: 1.3, forward: 0.5 } }), 2);
    expect(at(rest, 'LHand').distanceTo(at(plain, 'LHand'))).toBeLessThan(1e-6);
  });

  it('as pernas seguem a mesma convenção com armRest ligado', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: true, armRest: { lower: 1.3, forward: 0.5 } }), 2);
    const before = at(rig, 'RLeg');
    rig.rightLeg.hip.rotation.x = 0.5;
    expect(at(rig, 'RLeg').z - before.z).toBeLessThan(-0.1);
  });
});

const ARM = { lower: 1.42, forward: 0.4, elbow: 1.17 };
const READY = { primary: weapon('plasma'), secondary: weapon('rockets') };

const bone = (rig: MechRig, name: string): THREE.Object3D => {
  let found: THREE.Object3D | undefined;
  rig.model.traverse((n) => {
    if (n.name === name) found = n;
  });
  return found!;
};

/** O módulo da arma pendurado no encaixe de um antebraço (o nó "hardpoint" também guarda o nó de boca). */
const mounted = (rig: MechRig, forearm: string): THREE.Object3D | undefined => {
  const point = bone(rig, forearm).children.find((c) => c.name === 'hardpoint');
  return point?.children.find((c) => c !== rig.muzzle && c !== rig.leftMuzzle);
};

describe('importedMechRig: encaixes de arma nos pulsos (o robô não tem mão nem dedos)', () => {
  it('sem weaponMounts não há encaixe e a mão fica como veio', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: false }), 2);
    expect(rig.mountWeapons).toBeUndefined();
    expect(bone(rig, 'LHand').scale.x).toBe(1);
  });

  it('com weaponMounts as mãos somem (osso encolhido) e cada antebraço leva a arma da montagem', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: true, armRest: ARM, weaponMounts: true }), 2);
    rig.mountWeapons!(READY);
    for (const hand of ['LHand', 'RHand']) expect(bone(rig, hand).scale.x).toBeLessThan(0.01);
    expect(mounted(rig, 'LForeArm')).toBeDefined();
    expect(mounted(rig, 'RForeArm')).toBeDefined();
  });

  it('a pose de arma em punho põe o antebraço na horizontal, para a frente, e a arma aponta ao longo dele', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: true, armRest: ARM, weaponMounts: true }), 2);
    rig.mountWeapons!(READY);
    for (const [fore, hand, muzzle, w] of [
      ['LForeArm', 'LHand', rig.leftMuzzle!, READY.secondary],
      ['RForeArm', 'RHand', rig.muzzle, READY.primary],
    ] as const) {
      const forearm = at(rig, hand).sub(at(rig, fore));
      const length = forearm.length();
      const dir = forearm.clone().normalize();
      expect(dir.z).toBeLessThan(-0.9); // quase na horizontal, para a frente (-Z)
      expect(Math.abs(dir.y)).toBeLessThan(0.15);
      const toMuzzle = muzzle.getWorldPosition(new THREE.Vector3()).sub(at(rig, hand));
      expect(toMuzzle.clone().normalize().dot(dir)).toBeGreaterThan(0.99); // a arma segue o antebraço
      expect(toMuzzle.length()).toBeCloseTo(Math.abs(weaponModel(w).muzzle.z) * length, 3); // em unidades de antebraço
    }
  });

  it('trocar de arma troca só o módulo; remontar a mesma não faz nada; sem arma fica o engate fechado', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: true, armRest: ARM, weaponMounts: true }), 2);
    rig.mountWeapons!(READY);
    const right = mounted(rig, 'RForeArm')!;
    const left = mounted(rig, 'LForeArm')!;
    rig.mountWeapons!(READY);
    expect(mounted(rig, 'RForeArm')).toBe(right);
    expect(mounted(rig, 'LForeArm')).toBe(left);

    rig.mountWeapons!({ primary: weapon('blaster', 2), secondary: null });
    expect(mounted(rig, 'RForeArm')).not.toBe(right);
    expect(right.parent).toBeNull(); // o módulo antigo saiu do encaixe
    expect(rig.muzzle.position.z).toBeCloseTo(weaponModel(weapon('blaster', 2)).muzzle.z, 6); // a boca acompanha a arma
    expect(mounted(rig, 'LForeArm')).toBeDefined(); // o braço sem arma não termina num buraco
    expect(mounted(rig, 'LForeArm')).not.toBe(left);
  });

  it('os dois lados são espelhados: a mesma arma sai à mesma altura e distância, em x oposto', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: true, armRest: ARM, weaponMounts: true }), 2);
    rig.mountWeapons!({ primary: weapon('blaster'), secondary: weapon('blaster') });
    const r = rig.muzzle.getWorldPosition(new THREE.Vector3());
    const l = rig.leftMuzzle!.getWorldPosition(new THREE.Vector3());
    expect(r.x).toBeGreaterThan(0);
    expect(l.x).toBeCloseTo(-r.x, 6);
    expect(l.y).toBeCloseTo(r.y, 6);
    expect(l.z).toBeCloseTo(r.z, 6);
  });

  it('o MechBase monta as armas ao nascer e remonta no equip (é o que o Hangar chama)', () => {
    const rig = instantiateImportedMechRig(syntheticAsset({ tpose: true, armRest: ARM, weaponMounts: true }), 2);
    const mech = new ImportedMech(CHASSIS.marauder, rig, READY);
    const before = mounted(rig, 'RForeArm');
    expect(before).toBeDefined();
    mech.equip({ primary: weapon('plasma', 2), secondary: weapon('rockets', 2) });
    expect(mounted(rig, 'RForeArm')).not.toBe(before);
  });
});
