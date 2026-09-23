import * as THREE from 'three';

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
