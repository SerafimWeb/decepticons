import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type Loadout, weapon } from '../combat/weapons';
import { buildMechBlueprintRig, COLOSSUS_01_BLUEPRINT, HEAVY_MECH_BLUEPRINT, LIGHT_MECH_BLUEPRINT, MEDIUM_MECH_BLUEPRINT } from './mechBlueprint';
import { Vector09 } from './Vector09';

describe('blueprints visuais dos Mechs', () => {
  it('diferencia as quatro silhuetas pela geometria sem exceder 10 draws articulados', () => {
    const rigs = [LIGHT_MECH_BLUEPRINT, MEDIUM_MECH_BLUEPRINT, HEAVY_MECH_BLUEPRINT, COLOSSUS_01_BLUEPRINT].map((blueprint) => {
      const rig = buildMechBlueprintRig(blueprint);
      const boxes = new THREE.Box3().setFromObject(rig.model);
      let draws = 0;
      rig.model.traverse((node) => { if ((node instanceof THREE.Mesh || node instanceof THREE.Points) && node.parent?.name !== 'morteiro-costas') draws++; });
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

describe('a chuva de mísseis tem um morteiro próprio nas costas, apontando para cima, e não é o casulo do braço', () => {
  const todos = [LIGHT_MECH_BLUEPRINT, MEDIUM_MECH_BLUEPRINT, HEAVY_MECH_BLUEPRINT, COLOSSUS_01_BLUEPRINT];
  const comCasulo: Loadout = { primary: weapon('plasma'), secondary: weapon('rockets') };
  const comChuva: Loadout = { primary: weapon('plasma'), secondary: weapon('barrage') };
  const malhaDoBraco = (rig: ReturnType<typeof buildMechBlueprintRig>) => (rig.leftArm as unknown as THREE.Object3D).children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh)!;
  /** Quantos desenhos o Mech faz de verdade: malhas e pontos visíveis (o que está oculto não é desenhado). */
  const desenhados = (root: THREE.Object3D) => {
    let n = 0;
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh || node instanceof THREE.Points)) return;
      for (let p: THREE.Object3D | null = node; p; p = p.parent) if (!p.visible) return;
      n++;
    });
    return n;
  };

  it.each(todos.map((b) => [b.id, b] as const))('%s: com a chuva, o morteiro das costas aparece, o antebraço fica liso, e com foguetes tudo volta', (_id, blueprint) => {
    const rig = buildMechBlueprintRig(blueprint);
    const rack = rig.model.getObjectByName('morteiro-costas')!;
    const braco = malhaDoBraco(rig);
    const casulo = braco.geometry;
    const boca0 = rig.leftMuzzle!.position.clone();
    expect(rack.visible).toBe(false); // de fábrica o Mech é o de sempre
    const antes = desenhados(rig.model);

    rig.mountWeapons!(comChuva);
    expect(rack.visible).toBe(true);
    expect(braco.geometry).not.toBe(casulo);
    expect(braco.geometry.getAttribute('position').count).toBeLessThan(casulo.getAttribute('position').count); // sem os tubos do casulo
    expect(desenhados(rig.model)).toBe(antes + 1); // paga um desenho só quando usa

    rig.mountWeapons!(comCasulo);
    expect(rack.visible).toBe(false);
    expect(braco.geometry).toBe(casulo);
    expect(desenhados(rig.model)).toBe(antes);
    // G14: a boca do tiro nunca se move com a arma (o cliente troca depois de medir; o servidor já nasce com ela).
    expect(rig.leftMuzzle!.position.toArray()).toEqual(boca0.toArray());
  });

  it.each(todos.map((b) => [b.id, b] as const))('%s: o morteiro fica nas costas, na altura da cabeça, e a boca dele aponta para cima', (_id, blueprint) => {
    const rig = buildMechBlueprintRig(blueprint);
    rig.mountWeapons!(comChuva);
    rig.model.updateMatrixWorld(true);
    const boca = rig.barrageMouth!.getWorldPosition(new THREE.Vector3());
    const cabeca = rig.head.getWorldPosition(new THREE.Vector3());
    const torso = rig.torso.getWorldPosition(new THREE.Vector3());
    expect(boca.z).toBeGreaterThan(torso.z); // +Z é a parte de trás do Mech
    expect(boca.y).toBeGreaterThan(torso.y + blueprint.torso.height); // sobe acima do tronco
    expect(boca.y).toBeLessThanOrEqual(cabeca.y + blueprint.head.height + blueprint.torso.height * 0.15); // até a altura da cabeça (não tapa a mira)
    expect(Math.abs(boca.x)).toBeLessThan(0.01); // no meio das costas
    // Os tubos são verticais: o morteiro todo cabe na largura da mochila (não abre para os lados nem para a frente).
    const caixa = new THREE.Box3().setFromObject(rig.model.getObjectByName('morteiro-costas')!);
    expect(caixa.max.x - caixa.min.x).toBeLessThan(blueprint.torso.width * 0.6);
  });

  it('o Mech nasce com a arma da montagem e troca ao vivo com equip (Hangar, respawn); a boca de simulação não muda', () => {
    const v = new THREE.Vector3();
    const ref = new THREE.Vector3();
    const chuva = new Vector09({ loadout: comChuva });
    const foguete = new Vector09({ loadout: comCasulo });
    expect(chuva.barrageMouth(v)).toBeDefined();
    expect(foguete.barrageMouth(v)).toBeUndefined();
    foguete.equip(comChuva);
    expect(foguete.barrageMouth(v)).toBeDefined();
    foguete.equip(comCasulo);
    expect(foguete.barrageMouth(v)).toBeUndefined();
    // G14: onde o tiro nasce na simulação é o mesmo com chuva ou com foguetes.
    expect(chuva.simMuzzle(v, 'leftHand').toArray()).toEqual(foguete.simMuzzle(ref, 'leftHand').toArray());
  });

  it('só o braço esquerdo troca de desenho; o direito segue igual', () => {
    const rig = buildMechBlueprintRig(MEDIUM_MECH_BLUEPRINT);
    const direito = (rig.rightArm as unknown as THREE.Object3D).children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh)!;
    const antes = direito.geometry;
    rig.mountWeapons!(comChuva);
    expect(direito.geometry).toBe(antes);
  });
});
