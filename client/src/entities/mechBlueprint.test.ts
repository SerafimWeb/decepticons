import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildMechBlueprintRig, COLOSSUS_01_BLUEPRINT, HEAVY_MECH_BLUEPRINT, LIGHT_MECH_BLUEPRINT, MEDIUM_MECH_BLUEPRINT } from './mechBlueprint';
import { Vector09 } from './Vector09';

describe('blueprints visuais dos Mechs', () => {
  it('diferencia as quatro silhuetas pela geometria sem exceder 10 draws articulados', () => {
    const rigs = [LIGHT_MECH_BLUEPRINT, MEDIUM_MECH_BLUEPRINT, HEAVY_MECH_BLUEPRINT, COLOSSUS_01_BLUEPRINT].map((blueprint) => {
      const rig = buildMechBlueprintRig(blueprint);
      const boxes = new THREE.Box3().setFromObject(rig.model);
      let draws = 0;
      rig.model.traverse((node) => { if (node instanceof THREE.Mesh || node instanceof THREE.Points) draws++; });
      return { rig, boxes, draws };
    });

    expect(rigs.map(({ draws }) => draws)).toEqual([10, 10, 10, 10]);
    expect(rigs[0]!.boxes.getSize(new THREE.Vector3()).x).toBeLessThan(rigs[1]!.boxes.getSize(new THREE.Vector3()).x);
    expect(rigs[1]!.boxes.getSize(new THREE.Vector3()).x).toBeLessThan(rigs[2]!.boxes.getSize(new THREE.Vector3()).x);
    expect(rigs.map(({ rig }) => [rig.head.name, rig.torso.name, rig.leftArm.name, rig.rightArm.name, rig.leftLeg.hip.name, rig.rightLeg.hip.name]))
      .toEqual(Array(4).fill(['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']));
    for (const { boxes } of rigs) expect(boxes.min.y).toBeCloseTo(0, 1);

    const vapor: THREE.Points[] = [];
    rigs[1]!.rig.model.traverse((node) => { if (node instanceof THREE.Points) vapor.push(node); });
    expect(vapor).toHaveLength(1);
    expect(vapor[0]!.visible).toBe(false);
    rigs[1]!.rig.setHeatVisual?.(1 / 60, 1, true, false);
    expect(vapor[0]!.visible).toBe(true);
    expect((vapor[0]!.material as THREE.PointsMaterial).opacity).toBeGreaterThan(0);

    for (const { rig } of rigs) rig.model.traverse((node) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.Points) node.geometry.dispose();
    });
    for (const { rig } of rigs) {
      rig.model.traverse((node) => { if (node instanceof THREE.Points) node.material.dispose(); });
      rig.thrusterMaterial.dispose();
    }
  });

  it('mantém o Colossus-01 como escala 3 real, maior que o pesado de escala 2', () => {
    expect(COLOSSUS_01_BLUEPRINT.referenceHeight).toBe(14);
    expect(COLOSSUS_01_BLUEPRINT.referenceHeight).toBeGreaterThan(HEAVY_MECH_BLUEPRINT.referenceHeight * 2);
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
