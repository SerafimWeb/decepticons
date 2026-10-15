import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { GLOW } from '../core/palette';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

interface Piece {
  body: RAPIER.RigidBody;
  size: THREE.Vector3;
  dirty: boolean;
  born: number; // ordem de criação: no limite, a mais antiga sai primeiro
}

const MAX_PIECES = 240;
const MAX_PIECES_PER_BREAK = 24;
const HOT_COLOR = new THREE.Color(1.0, 0.35, 0.05);
const METAL_COLOR = GLOW.metal;

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _c = new THREE.Color();

/**
 * Destroços físicos (pre-fractured swapping): a peça intacta some e é trocada
 * por blocos dinâmicos. Custos controlados:
 * - 1 InstancedMesh para todos os destroços (1 draw call);
 * - só atualiza a matriz de corpos acordados;
 * - corpos dormem ao parar (Rapier não integra corpos dormindo);
 * - limite global de peças: as mais antigas somem primeiro.
 */
export class DebrisSystem {
  readonly mesh: THREE.InstancedMesh;
  private readonly pieces: Piece[] = [];
  private spawned = 0;

  constructor(
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
  ) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.7 }),
      MAX_PIECES,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Cria já o buffer de cor por instância: o three.js só o cria no primeiro `setColorAt`, e ter ou não `instanceColor` muda
    // a variante do shader (`USE_INSTANCING_COLOR`). Sem isto o primeiro destroço do jogo compilava um programa novo e
    // congelava a partida ~1,5 s na GPU integrada (a pré-compilação do carregamento só via a variante sem cor).
    this.mesh.setColorAt(0, METAL_COLOR);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  get count(): number {
    return this.pieces.length;
  }

  /**
   * Quebra um bloco (centro/tamanho) numa grade de pedaços empurrados em `dir`. `cores` (P138: madeira e folha de um coqueiro, a lona de um
   * guarda-sol) tinge cada pedaço com uma delas, em vez do metal quente de uma barricada.
   */
  shatter(center: THREE.Vector3, size: THREE.Vector3, dir: THREE.Vector3, force = 10, cores?: readonly THREE.Color[]): void {
    let nx = THREE.MathUtils.clamp(Math.round(size.x / 1.4), 1, 6);
    let ny = THREE.MathUtils.clamp(Math.round(size.y / 1.1), 1, 3);
    let nz = THREE.MathUtils.clamp(Math.round(size.z / 1.4), 1, 6);
    while (nx * ny * nz > MAX_PIECES_PER_BREAK) {
      if (nx >= nz && nx > 1) nx--;
      else if (nz > 1) nz--;
      else ny--;
    }

    const cell = new THREE.Vector3(size.x / nx, size.y / ny, size.z / nz);
    const pieceSize = cell.clone().multiplyScalar(0.94);

    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        for (let iz = 0; iz < nz; iz++) {
          const x = center.x - size.x / 2 + cell.x * (ix + 0.5);
          const y = center.y - size.y / 2 + cell.y * (iy + 0.5);
          const z = center.z - size.z / 2 + cell.z * (iz + 0.5);
          const out = _p.set(x - center.x, 0, z - center.z).normalize();
          const f = force * (0.5 + Math.random() * 0.7);
          this.spawn(
            new THREE.Vector3(x, y, z),
            pieceSize,
            new THREE.Vector3(
              dir.x * f + out.x * 3,
              2 + Math.random() * 5 + iy * 1.5,
              dir.z * f + out.z * 3,
            ),
            cores ? false : Math.random() < 0.2,
            cores ? cores[Math.floor(Math.random() * cores.length)] : undefined,
          );
        }
      }
    }
  }

  private spawn(pos: THREE.Vector3, size: THREE.Vector3, vel: THREE.Vector3, hot: boolean, cor?: THREE.Color): void {
    if (this.pieces.length >= MAX_PIECES) this.removeAt(this.oldestIndex());

    const world = this.physics.world;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinvel(vel.x, vel.y, vel.z)
        .setAngvel({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 })
        .setLinearDamping(0.15)
        .setAngularDamping(0.4),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setFriction(0.9).setDensity(1.5),
      body,
    );

    const index = this.pieces.length;
    this.pieces.push({ body, size: size.clone(), dirty: true, born: this.spawned++ });
    this.mesh.setColorAt(index, hot ? HOT_COLOR : _c.copy(cor ?? METAL_COLOR).multiplyScalar(0.7 + Math.random() * 0.6));
    this.mesh.count = this.pieces.length;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** O swap-remove embaralha a ordem do array; a mais antiga é achada pelo `born` (O(n), só no limite). */
  /** Remove todos os destroços (rodada nova). */
  clear(): void {
    while (this.pieces.length) this.removeAt(this.pieces.length - 1);
  }

  private oldestIndex(): number {
    let oldest = 0;
    for (let i = 1; i < this.pieces.length; i++) {
      if (this.pieces[i].born < this.pieces[oldest].born) oldest = i;
    }
    return oldest;
  }

  /** Remove trocando com o último (O(1)); o que foi movido é marcado para reescrever. */
  private removeAt(i: number): void {
    const last = this.pieces.length - 1;
    this.physics.world.removeRigidBody(this.pieces[i].body);
    if (i !== last) {
      this.pieces[i] = this.pieces[last];
      this.pieces[i].dirty = true;
      this.mesh.getColorAt(last, _c);
      this.mesh.setColorAt(i, _c);
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
    this.pieces.pop();
    this.mesh.count = this.pieces.length;
  }

  /** Copia transformações dos corpos acordados para o InstancedMesh. */
  sync(): void {
    let changed = false;
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      if (piece.body.isSleeping() && !piece.dirty) continue;
      const t = piece.body.translation();
      if (t.y < -30) {
        this.removeAt(i);
        changed = true;
        continue;
      }
      const r = piece.body.rotation();
      _m.compose(_p.set(t.x, t.y, t.z), _q.set(r.x, r.y, r.z, r.w), piece.size);
      this.mesh.setMatrixAt(i, _m);
      piece.dirty = false;
      changed = true;
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
