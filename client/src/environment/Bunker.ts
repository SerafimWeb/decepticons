import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { bunkerBlocks } from './BunkerLayout';

export { bunkerBlocks, BUNKER_LEVELS, BUNKER_LIFTS, BUNKER_SPAWNS } from './BunkerLayout';

export type MapId = 'arena' | 'bunker' | 'praia' | 'amazonia';
/** Online e missões mantêm o mapa contratado com o servidor/objetivos. O Bunker é só do Deathmatch; a praia abre o Deathmatch e as ondas; a Amazônia (P180) abre o Deathmatch e a missão do rio (a Sobrevivência: o Draga-01 marcha rumo à aldeia). */
export function mapFromSearch(search: string, online: boolean, mode: string): MapId {
  if (online) return 'arena';
  const mapa = new URLSearchParams(search).get('mapa');
  if (mapa === 'praia') return mode === 'deathmatch' || mode === 'survival' ? 'praia' : 'arena';
  if (mapa === 'bunker') return mode === 'deathmatch' ? 'bunker' : 'arena';
  if (mapa === 'amazonia') return mode === 'deathmatch' || mode === 'survival' ? 'amazonia' : 'arena';
  return 'arena';
}

/** Bunker escavado: duas submissões instanciadas; geometria e colisão estáticas. */
export class Bunker {
  readonly solids: THREE.InstancedMesh;
  readonly markings: THREE.InstancedMesh;
  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    scene.background = new THREE.Color(0x080b10);
    scene.fog = new THREE.FogExp2(0x101116, 0.0028);
    const blocks = bunkerBlocks();
    const solidBlocks = blocks.filter((b) => b.solid);
    const detailBlocks = blocks.filter((b) => !b.solid);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    this.solids = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: 0x79838b, roughness: 0.84, metalness: 0.22 }), solidBlocks.length);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const rx = new THREE.Quaternion();
    const rz = new THREE.Quaternion();
    const xAxis = new THREE.Vector3(1, 0, 0);
    const zAxis = new THREE.Vector3(0, 0, 1);
    const colors: Record<string, number> = {
      concrete: 0x89949a, steel: 0x45525c, tunnel: 0x15191d,
      light: 0x39ffb4, amber: 0xffa51f, red: 0xff303d, sniper: 0x253847,
    };
    solidBlocks.forEach((b, i) => {
      position.set(b.x, b.y, b.z); scale.set(b.w, b.h, b.d);
      rx.setFromAxisAngle(xAxis, b.rx); rz.setFromAxisAngle(zAxis, b.rz); rotation.copy(rz).multiply(rx);
      this.solids.setMatrixAt(i, matrix.compose(position, rotation, scale));
      this.solids.setColorAt(i, new THREE.Color(colors[b.kind] ?? colors.concrete));
      physics.addStaticBox(position, scale, rotation);
    });
    this.solids.computeBoundingSphere(); scene.add(this.solids);
    this.markings = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }), detailBlocks.length);
    detailBlocks.forEach((b, i) => {
      position.set(b.x, b.y, b.z); scale.set(b.w, b.h, b.d);
      rx.setFromAxisAngle(xAxis, b.rx); rz.setFromAxisAngle(zAxis, b.rz); rotation.copy(rz).multiply(rx);
      this.markings.setMatrixAt(i, matrix.compose(position, rotation, scale));
      this.markings.setColorAt(i, new THREE.Color(colors[b.kind] ?? colors.amber).multiplyScalar(b.kind === 'light' || b.kind === 'red' ? 1.8 : 1));
    });
    this.markings.computeBoundingSphere(); scene.add(this.markings);
  }
}
