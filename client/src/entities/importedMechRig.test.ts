import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AxisCorrectedJoint } from './importedMechRig';

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
    const joint = new AxisCorrectedJoint(bone);

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
    const joint = new AxisCorrectedJoint(bone);
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
    const joint = new AxisCorrectedJoint(bone);
    joint.rotation.x = 0.9;
    joint.rotation.y = -0.4;
    joint.rotation.x = 0;
    joint.rotation.y = 0;
    expect(bone.quaternion.angleTo(restQuat)).toBeCloseTo(0, 5);
  });

  it('não mexe na posição do osso, só na rotação (position.z de recuo continua funcionando)', () => {
    const bone = boneWithWeirdRest();
    bone.position.set(0.1, 0.2, 0.3);
    const joint = new AxisCorrectedJoint(bone);
    joint.position.z = 0.5;
    expect(bone.position.z).toBeCloseTo(0.5, 6);
  });
});
