import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildMechBlueprintRig, MEDIUM_MECH_BLUEPRINT } from './mechBlueprint';

/** Os vértices marcados como pé (`mechFoot`) de um pivô: quantos são -1 (o pé esquerdo), +1 (o direito) e 0 (o resto). */
function marcas(no: unknown): { esquerdo: number; direito: number; resto: number } {
  const contagem = { esquerdo: 0, direito: 0, resto: 0 };
  for (const filho of (no as THREE.Object3D).children) {
    // Só as malhas do lote (as que levam `mechHull`): a capa de gelo, por exemplo, é uma malha à parte.
    if (!(filho instanceof THREE.Mesh) || !(filho.geometry as THREE.BufferGeometry).getAttribute('mechHull')) continue;
    const atributo = (filho.geometry as THREE.BufferGeometry).getAttribute('mechFoot');
    expect(atributo).toBeDefined();
    for (let i = 0; i < atributo.count; i++) {
      const v = atributo.getX(i);
      if (v < 0) contagem.esquerdo++;
      else if (v > 0) contagem.direito++;
      else contagem.resto++;
    }
  }
  return contagem;
}

// O tornozelo (P322): o pé gira no vertex shader do lote, sem pivô com malha nem draw call a mais.
describe('o tornozelo do rig procedural (meshKit.batchRigMeshes)', () => {
  it('só o pé de cada perna é marcado para girar: -1 no esquerdo e +1 no direito, no pivô do joelho; o resto do corpo fica em zero', () => {
    const rig = buildMechBlueprintRig(MEDIUM_MECH_BLUEPRINT);
    const esquerdo = marcas(rig.leftLeg.knee);
    const direito = marcas(rig.rightLeg.knee);
    expect(esquerdo.esquerdo).toBeGreaterThan(0);
    expect(esquerdo.direito).toBe(0);
    expect(direito.direito).toBeGreaterThan(0);
    expect(direito.esquerdo).toBe(0);
    // a canela ao lado do pé não gira (o pé é uma parte pequena da malha do joelho)
    expect(esquerdo.resto).toBeGreaterThan(esquerdo.esquerdo);
    for (const no of [rig.pelvis, rig.torso, rig.head, rig.leftArm, rig.rightArm, rig.leftLeg.hip, rig.rightLeg.hip]) {
      const m = marcas(no);
      expect(m.esquerdo + m.direito).toBe(0);
    }
  });

  it('não acrescenta pivô com malha nem draw call: o nó do tornozelo está vazio e o lote continua em dez malhas, no máximo', () => {
    const rig = buildMechBlueprintRig(MEDIUM_MECH_BLUEPRINT);
    expect(rig.leftLeg.ankle).toBeDefined();
    expect(rig.rightLeg.ankle).toBeDefined();
    expect((rig.leftLeg.ankle as unknown as THREE.Object3D).children.length).toBe(0);
    let malhas = 0;
    rig.model.traverse((o) => {
      if (o instanceof THREE.Mesh && (o.geometry as THREE.BufferGeometry).getAttribute('mechHull')) malhas++;
    });
    // pelve, tronco, cabeça, dois braços, dois quadris, dois joelhos e o morteiro das costas (escondido até a chuva de mísseis)
    expect(malhas).toBeLessThanOrEqual(10);
  });

  it('setFootPitch gira o nó do tornozelo e entrega os dois ângulos ao shader do lote', () => {
    const rig = buildMechBlueprintRig(MEDIUM_MECH_BLUEPRINT);
    rig.setFootPitch?.(0.3, -0.2);
    expect(rig.leftLeg.ankle?.rotation.x).toBeCloseTo(0.3, 9);
    expect(rig.rightLeg.ankle?.rotation.x).toBeCloseTo(-0.2, 9);
    const par = rig.hullMaterials[0]?.userData.footPitch as THREE.Vector2;
    expect(par.x).toBeCloseTo(0.3, 9);
    expect(par.y).toBeCloseTo(-0.2, 9);
  });

  it('o shader do lote gira só os vértices marcados, em torno do tornozelo, e a normal junto', () => {
    const rig = buildMechBlueprintRig(MEDIUM_MECH_BLUEPRINT);
    const material = rig.hullMaterials[0];
    expect(material).toBeDefined();
    const falso = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <emissivemap_fragment>',
    };
    material?.onBeforeCompile(falso as never, undefined as never);
    expect(falso.uniforms.mechFootPitch).toBeDefined();
    expect(falso.uniforms.mechAnkle).toBeDefined();
    expect(falso.vertexShader).toContain('attribute float mechFoot;');
    expect(falso.vertexShader).toContain('if (mechFoot != 0.0) objectNormal = mechFootRot(objectNormal);');
    expect(falso.vertexShader).toContain('if (mechFoot != 0.0) transformed = mechAnkle + mechFootRot(transformed - mechAnkle);');
  });
});
