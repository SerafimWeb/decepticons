import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildMechBlueprintRig, HEAVY_MECH_BLUEPRINT, LIGHT_MECH_BLUEPRINT, MEDIUM_MECH_BLUEPRINT } from './mechBlueprint';
import { Vector09 } from './Vector09';

describe('blueprints visuais dos Mechs', () => {
  it('diferencia as três silhuetas pela geometria sem exceder 9 malhas articuladas', () => {
    const rigs = [LIGHT_MECH_BLUEPRINT, MEDIUM_MECH_BLUEPRINT, HEAVY_MECH_BLUEPRINT].map((blueprint) => {
      const rig = buildMechBlueprintRig(blueprint);
      const boxes = new THREE.Box3().setFromObject(rig.model);
      let draws = 0;
      rig.model.traverse((node) => { if (node instanceof THREE.Mesh) draws++; });
      return { rig, boxes, draws };
    });

    expect(rigs.map(({ draws }) => draws)).toEqual([9, 9, 9]);
    expect(rigs[0]!.boxes.getSize(new THREE.Vector3()).x).toBeLessThan(rigs[1]!.boxes.getSize(new THREE.Vector3()).x);
    expect(rigs[1]!.boxes.getSize(new THREE.Vector3()).x).toBeLessThan(rigs[2]!.boxes.getSize(new THREE.Vector3()).x);
    expect(rigs.map(({ rig }) => [rig.head.name, rig.torso.name, rig.leftArm.name, rig.rightArm.name, rig.leftLeg.hip.name, rig.rightLeg.hip.name]))
      .toEqual(Array(3).fill(['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']));
    for (const { boxes } of rigs) expect(boxes.min.y).toBeCloseTo(0, 1);

    for (const { rig } of rigs) rig.model.traverse((node) => {
      if (node instanceof THREE.Mesh) node.geometry.dispose();
    });
    for (const { rig } of rigs) rig.thrusterMaterial.dispose();
  });

  it('usa a silhueta escolhida sem alterar a saúde nem impedir que partes destruídas sumam', () => {
    const mech = new Vector09({ blueprint: LIGHT_MECH_BLUEPRINT });
    expect(mech.stats.height).toBe(5.3);
    expect(mech.modules.leftArm).toBe(mech.stats.maxModuleHealth.leftArm);
    const arm = mech.root.getObjectByName('leftArm');
    expect(arm?.visible).toBe(true);
    mech.damagePart('leftArm', mech.stats.maxModuleHealth.leftArm);
    expect(arm?.visible).toBe(false);
    mech.root.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
        else node.material.dispose();
      }
    });
  });
});
