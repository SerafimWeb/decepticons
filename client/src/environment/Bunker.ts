import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

export type MapId = 'arena' | 'bunker';
/** Online e missões mantêm o mapa contratado com o servidor/objetivos. */
export function mapFromSearch(search: string, online: boolean, mode: string): MapId {
  return !online && mode === 'deathmatch' && new URLSearchParams(search).get('mapa') === 'bunker' ? 'bunker' : 'arena';
}

export const BUNKER_SPAWNS: readonly (readonly [number, number])[] = [
  [0, 48], [-60, 24], [60, -24], [60, 48], [-60, -48],
  [-60, 72], [60, 72], [0, -72], [-60, 0], [60, 0], [0, 72], [-60, -72],
];

interface Block { x: number; y: number; z: number; w: number; h: number; d: number; angle: number; }
/** Um dado cria a malha E o colisor. Nada muda por frame/tick. */
export function bunkerBlocks(): Block[] {
  const blocks: Block[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, angle = 0) => blocks.push({ x, y, z, w, h, d, angle });
  box(0, -0.5, 0, 180, 1, 180);
  for (const y of [10, 20]) {
    // Anéis laterais; o vão de 92 m permanece livre no centro.
    for (const x of [-68, 68]) box(x, y - 0.5, 0, 44, 1, 180);
    for (const z of [-77, 77]) box(0, y - 0.5, z, 92, 1, 26);
    // Patamares ligam ambas as rampas ao anel, sem teto sobre a subida.
    if (y === 10) for (const x of [-36, 36]) box(x, 9.5, -24, 20, 1, 8);
  }
  for (const x of [-36, 36]) {
    for (const [base, run, z] of [[0, 40, 0], [10, 44, -42]]) {
      const a = Math.atan2(10, run!);
      // Plano sobe para -Z; centro deslocado pela normal mantém os extremos exatos.
      box(x, base! + 5 - Math.cos(a) * 0.5, z! - Math.sin(a) * 0.5, 12, 1, run! / Math.cos(a), a);
    }
  }
  // Casca fechada; sem janela para a cidade original.
  for (const x of [-91, 91]) box(x, 16, 0, 2, 34, 184);
  for (const z of [-91, 91]) box(0, 16, z, 180, 34, 2);
  box(0, 33, 0, 184, 2, 184);
  // Coberturas no átrio: passagem central e laterais livres, sem ocultar os andares.
  for (const x of [-14, 14]) for (const z of [-34, 12]) box(x, 1.5, z, 8, 3, 6);
  // Túneis laterais: duas galerias paralelas com cruzamentos em -48, 0 e +48.
  // Interrupções de 16 m permitem contornar a cobertura e perder a linha de visão.
  for (const y of [0, 10, 20]) for (const x of [-68, 68]) {
    for (const z of [-72, -24, 24, 72]) box(x, y + 4.5, z, 2, 9, 32);
    // Pilares internos, fora das rotas principais e dos pontos de nascimento.
    for (const z of [-48, 48]) box(x > 0 ? 82 : -82, y + 4, z, 4, 8, 4);
  }
  return blocks;
}

/** Dungeon industrial: duas malhas instanciadas, sem luz dinâmica/textura externa. */
export class Bunker {
  readonly solids: THREE.InstancedMesh;
  readonly markings: THREE.InstancedMesh;
  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    scene.background = new THREE.Color(0x101923);
    scene.fog = new THREE.FogExp2(0x101923, 0.004);
    const blocks = bunkerBlocks();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    this.solids = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: 0x657582, roughness: 0.78, metalness: 0.25 }), blocks.length);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const axis = new THREE.Vector3(1, 0, 0);
    blocks.forEach((b, i) => {
      position.set(b.x, b.y, b.z); scale.set(b.w, b.h, b.d); rotation.setFromAxisAngle(axis, b.angle);
      this.solids.setMatrixAt(i, matrix.compose(position, rotation, scale));
      this.solids.setColorAt(i, new THREE.Color(b.h === 1 ? 0x758591 : b.h === 3 ? 0x526577 : 0x99adb9));
      physics.addStaticBox(position, scale, rotation);
    });
    this.solids.computeBoundingSphere(); scene.add(this.solids);
    const stripes: { x: number; y: number; z: number; w: number; d: number; color: number }[] = [];
    for (const [level, color] of [[0, 0x39d5e5], [10, 0xffb347], [20, 0xbca0ff]]) {
      for (const x of [-48, 48]) stripes.push({ x: x!, y: level! + 0.03, z: 0, w: 0.25, d: 180, color: color! });
      for (const z of [-65, 65]) stripes.push({ x: 0, y: level! + 0.03, z: z!, w: 92, d: 0.25, color: color! });
      for (const x of [-68, 68]) for (const z of [-48, 0, 48]) stripes.push({ x, y: level! + 0.04, z, w: 38, d: 0.5, color: color! });
      // Ombreiras luminosas dos cruzamentos: referências visíveis dentro dos túneis.
      for (const x of [-68, 68]) for (const z of [-56, -40, -8, 8, 40, 56]) {
        stripes.push({ x, y: level! + 4, z, w: 2.1, d: 0.18, color: color! });
      }
    }
    this.markings = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }), stripes.length);
    stripes.forEach((s, i) => {
      position.set(s.x, s.y, s.z); scale.set(s.w, s.d === 0.18 ? 7 : 0.04, s.d); rotation.identity();
      this.markings.setMatrixAt(i, matrix.compose(position, rotation, scale));
      this.markings.setColorAt(i, new THREE.Color(s.color).multiplyScalar(1.5));
    });
    this.markings.computeBoundingSphere(); scene.add(this.markings);
  }
}
