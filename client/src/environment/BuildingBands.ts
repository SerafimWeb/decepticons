import * as THREE from 'three';

/** Faixas estáticas de um prédio em um desenho; matrizes só são montadas na criação. */
export function buildingBands(
  width: number,
  height: number,
  depth: number,
  floor: number,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.InstancedMesh | null {
  if (!(floor > 0) || !Number.isFinite(floor)) throw new RangeError('intervalo de andar inválido');
  let count = 0;
  for (let y = floor; y < height - 1; y += floor) count++;
  if (count === 0) return null;

  const bands = new THREE.InstancedMesh(geometry, material, count);
  bands.name = 'building-neon-bands';
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (let y = floor; y < height - 1; y += floor) {
    matrix.makeScale(width + 0.12, 0.18, depth + 0.12);
    matrix.setPosition(0, y - height / 2, 0);
    bands.setMatrixAt(index++, matrix);
  }
  bands.instanceMatrix.needsUpdate = true;
  bands.computeBoundingBox();
  bands.computeBoundingSphere();
  return bands;
}
