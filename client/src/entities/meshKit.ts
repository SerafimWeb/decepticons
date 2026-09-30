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

/**
 * Caixa que afunila ao longo de Y: base (y = -h/2) sempre em w×d; topo (y = +h/2) escalado por `topScale`.
 * `topScale > 1` alarga o topo (ombro, quadril); `< 1` estreita (cotovelo, joelho, tornozelo). Sem bisel —
 * é o formato que muda, não o canto. Sempre geometria própria (não dá pra afunilar com escala uniforme).
 */
export function taperedBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  topScale: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const hw0 = w / 2, hd0 = d / 2;
  const hw1 = (w * topScale) / 2, hd1 = (d * topScale) / 2;
  const y0 = -h / 2, y1 = h / 2;
  const corners: readonly (readonly [number, number, number])[] = [
    [-hw0, y0, -hd0], [hw0, y0, -hd0], [hw0, y0, hd0], [-hw0, y0, hd0],
    [-hw1, y1, -hd1], [hw1, y1, -hd1], [hw1, y1, hd1], [-hw1, y1, hd1],
  ];
  // Cada face lista seus 4 cantos em ordem que dá normal pra fora (checado por produto vetorial):
  // base, topo, trás, direita, frente, esquerda.
  const faces: readonly (readonly [number, number, number, number])[] = [
    [0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0],
  ];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const faceUv: readonly (readonly [number, number])[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const quad of faces) {
    const base = positions.length / 3;
    for (let i = 0; i < quad.length; i++) {
      positions.push(...corners[quad[i]!]!);
      uvs.push(...faceUv[i]!);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  // batchRigMeshes funde geometrias de todas as peças articuladas num draw call só; o merge exige que
  // todas tenham os mesmos atributos (achado real, 29/09: box/cyl/beveledBox já vêm com uv do Three.js,
  // e sem essa linha aqui o merge falhava com "All geometries must have compatible attributes").
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
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

/** Pequena nuvem de vapor fixa no rig; geometria/material são criados uma vez e só alternam opacity. */
export function heatVapor(parent: THREE.Object3D, width: number, rearZ: number): (dt: number, heat: number, overheated: boolean, coolingBoost: boolean) => void {
  const positions = new Float32Array([
    -width, 0.65, rearZ, -width * 0.33, 0.85, rearZ, width * 0.33, 0.72, rearZ, width, 0.92, rearZ,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffdfbd, size: 0.36, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\nfloat vaporEdge = distance(gl_PointCoord, vec2(0.5));\ndiffuseColor.a *= 1.0 - smoothstep(0.12, 0.5, vaporEdge);',
    );
  };
  material.customProgramCacheKey = () => 'cybermech-heat-vapor-v1';
  const vapor = new THREE.Points(geometry, material);
  vapor.frustumCulled = false;
  vapor.visible = false;
  parent.add(vapor);
  let shown = -1;
  let phase = 0;
  return (dt, heat, overheated, coolingBoost) => {
    const intensity = overheated ? (coolingBoost ? 0.58 : 0.32) : 0;
    const next = intensity === 0 ? 0 : intensity * Math.min(1, Math.max(0, (heat - 0.8) * 3));
    if (Math.abs(next - shown) >= 0.025) {
      shown = next;
      material.opacity = next;
      vapor.visible = next > 0.02;
    }
    if (next > 0.02) {
      phase = (phase + dt * 0.45) % 1;
      for (let i = 0; i < 4; i++) positions[i * 3 + 1] = 0.65 + ((phase + i * 0.25) % 1) * 0.5;
      geometry.attributes.position.needsUpdate = true;
    }
  };
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
  const heat = { value: 0 };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.mechHitFlashColor = flash;
    shader.uniforms.mechDashScale = dash;
    shader.uniforms.mechHeatGlow = heat;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float mechHull;\nattribute float mechDash;\nattribute float mechRoughness;\nattribute float mechMetalness;\nattribute vec3 mechEmission;\nvarying float vMechHull;\nvarying float vMechDash;\nvarying float vMechRoughness;\nvarying float vMechMetalness;\nvarying vec3 vMechEmission;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMechHull = mechHull;\nvMechDash = mechDash;\nvMechRoughness = mechRoughness;\nvMechMetalness = mechMetalness;\nvMechEmission = mechEmission;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 mechHitFlashColor;\nuniform float mechDashScale;\nuniform float mechHeatGlow;\nvarying float vMechHull;\nvarying float vMechDash;\nvarying float vMechRoughness;\nvarying float vMechMetalness;\nvarying vec3 vMechEmission;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vMechRoughness;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vMechMetalness;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vMechEmission * mix(1.0, mechDashScale, vMechDash) + mechHitFlashColor * vMechHull + vec3(1.0, 0.18, 0.015) * mechHeatGlow * vMechHull;');
  };
  material.customProgramCacheKey = () => 'cybermech-articulated-batch-v2';
  material.userData.setHitFlash = (value: number) => flash.value.setRGB(value * 1.4, value * 0.35, value * 0.2);
  material.userData.setDash = (active: boolean) => { dash.value = active ? 7 : 1; };
  material.userData.setHeat = (value: number) => { heat.value = value; };

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
