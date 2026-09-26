import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Helpers de geometria procedural para montar Mechs com primitivas. */

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);

export function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Caixa chanfrada procedural para as grandes placas do casco; costuma ser fundida no pivô logo após criar. */
export function beveledBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  bevel: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const edge = Math.max(0.001, Math.min(bevel, w * 0.2, h * 0.2, d * 0.2));
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  shape.lineTo(w / 2, h / 2);
  shape.lineTo(-w / 2, h / 2);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: d - edge * 2,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: edge,
    bevelThickness: edge,
    curveSegments: 1,
  });
  geometry.center();
  geometry.computeVertexNormals();
  geometry.userData.mechOwnedGeometry = true;
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Cilindro ao longo de Y; `rotX = Math.PI / 2` deita no eixo Z. */
export function cyl(
  parent: THREE.Object3D,
  radius: number,
  length: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rotX = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(cylGeo, mat);
  m.scale.set(radius, length, radius);
  m.position.set(x, y, z);
  m.rotation.x = rotX;
  parent.add(m);
  return m;
}

export function group(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/**
 * Combina as malhas estáticas filhas de cada pivô articulado. Cada pivô vira um draw call,
 * mantendo materiais por vértice (cor, metal, rugosidade e emissão) e a visibilidade da peça.
 * Chamado só ao construir o rig; o custo não entra no frame nem no tick.
 */
export function batchRigMeshes(root: THREE.Object3D, hullMaterials: readonly THREE.Material[]): THREE.MeshStandardMaterial {
  const hull = new Set(hullMaterials);
  const replacedMaterials = new Set<THREE.Material>();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0, roughness: 1 });
  // Preto de saída: `new THREE.Color()` nasce branco, e o casco brilhava branco até o primeiro dano.
  const flash = { value: new THREE.Color(0, 0, 0) };
  const dash = { value: 1 };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.mechHitFlashColor = flash;
    shader.uniforms.mechDashScale = dash;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float mechHull;\nattribute float mechDash;\nattribute float mechRoughness;\nattribute float mechMetalness;\nattribute vec3 mechEmission;\nvarying float vMechHull;\nvarying float vMechDash;\nvarying float vMechRoughness;\nvarying float vMechMetalness;\nvarying vec3 vMechEmission;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMechHull = mechHull;\nvMechDash = mechDash;\nvMechRoughness = mechRoughness;\nvMechMetalness = mechMetalness;\nvMechEmission = mechEmission;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 mechHitFlashColor;\nuniform float mechDashScale;\nvarying float vMechHull;\nvarying float vMechDash;\nvarying float vMechRoughness;\nvarying float vMechMetalness;\nvarying vec3 vMechEmission;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vMechRoughness;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vMechMetalness;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vMechEmission * mix(1.0, mechDashScale, vMechDash) + mechHitFlashColor * vMechHull;');
  };
  material.customProgramCacheKey = () => 'cybermech-articulated-batch-v1';
  material.userData.setHitFlash = (value: number) => flash.value.setRGB(value * 1.4, value * 0.35, value * 0.2);
  material.userData.setDash = (active: boolean) => { dash.value = active ? 7 : 1; };

  const mergePart = (parent: THREE.Object3D): void => {
    for (const child of [...parent.children]) mergePart(child);
    const meshes = parent.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    if (!meshes.length) return;

    const pieces: THREE.BufferGeometry[] = [];
    for (const mesh of meshes) {
      const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (!(sourceMaterial instanceof THREE.MeshStandardMaterial)) continue;
      replacedMaterials.add(sourceMaterial);
      let geometry = mesh.geometry.clone();
      if (!geometry.index) {
        const indexed = mergeVertices(geometry, 1e-4);
        geometry.dispose();
        geometry = indexed;
      }
      mesh.updateMatrix();
      geometry.applyMatrix4(mesh.matrix);
      const count = geometry.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      const emissions = new Float32Array(count * 3);
      const roughness = new Float32Array(count);
      const metalness = new Float32Array(count);
      const hullMask = new Float32Array(count);
      const dashMask = new Float32Array(count);
      const color = sourceMaterial.color;
      const emission = sourceMaterial.emissive.clone().multiplyScalar(sourceMaterial.emissiveIntensity);
      for (let i = 0; i < count; i++) {
        colors.set([color.r, color.g, color.b], i * 3);
        emissions.set([emission.r, emission.g, emission.b], i * 3);
        roughness[i] = sourceMaterial.roughness;
        metalness[i] = sourceMaterial.metalness;
        hullMask[i] = hull.has(sourceMaterial) ? 1 : 0;
        dashMask[i] = sourceMaterial.userData.mechDynamicEmission === true ? 1 : 0;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('mechEmission', new THREE.BufferAttribute(emissions, 3));
      geometry.setAttribute('mechRoughness', new THREE.BufferAttribute(roughness, 1));
      geometry.setAttribute('mechMetalness', new THREE.BufferAttribute(metalness, 1));
      geometry.setAttribute('mechHull', new THREE.BufferAttribute(hullMask, 1));
      geometry.setAttribute('mechDash', new THREE.BufferAttribute(dashMask, 1));
      pieces.push(geometry);
    }
    if (!pieces.length) return;

    const merged = mergeGeometries(pieces, false);
    for (const piece of pieces) piece.dispose();
    if (!merged) throw new Error('Não foi possível combinar a geometria do rig');
    for (const mesh of meshes) {
      parent.remove(mesh);
      if (mesh.geometry.userData.mechOwnedGeometry === true) mesh.geometry.dispose();
    }
    parent.add(new THREE.Mesh(merged, material));
  };
  mergePart(root);
  for (const source of replacedMaterials) source.dispose();
  return material;
}
