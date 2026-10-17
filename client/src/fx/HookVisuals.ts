import * as THREE from 'three';
import { HOOK_POOL, type HookSystem } from '../combat/HookSystem';
import type { MechBase } from '../entities/MechBase';
import type { BeamVisuals } from './BeamVisuals';

/**
 * O desenho do arpão magnético (P77): o **cabo preso** entre cada ombro do atirador e o peito do alvo, e o **raio** do disparo. Só desenho: quem prende, puxa e solta é `combat/HookSystem.ts`
 * (a regra, a mesma offline e no servidor). O cabo é um cilindro fino por ombro num único `InstancedMesh` (uma chamada de desenho para todos os cabos da cena), que pulsa enquanto
 * segura; o raio do disparo reaproveita o `BeamVisuals` (cor ciano do arpão, o inimigo em vermelho). Custo de CPU: dois `setMatrixAt` por cabo preso a cada quadro (no máximo {@link MAX_CABLES});
 * nada é alocado (G4/G5).
 */
export const MAX_CABLES = HOOK_POOL * 2;

/** O cabo é ciano-magnético (o do inimigo, vermelho): acima de 1 para o bloom acender só o miolo. */
const FRIENDLY = new THREE.Color(0.5, 2.2, 3.0);
const HOSTILE = new THREE.Color(3.2, 0.6, 0.5);
/** Quanto o raio do disparo fica aceso (s): o cabo, se prender, assume. */
const RAY_GLOW = 0.22;
const RAY_WIDTH = 0.75;
/** A espessura do cabo (raio, m) e quanto ela pulsa. */
const THICKNESS = 0.045;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Acende o raio de um arpão disparado de `from` até `to` (onde ele terminou). */
export function hookRay(beams: BeamVisuals, from: THREE.Vector3, to: THREE.Vector3, hostile: boolean): void {
  beams.spawn(from, to, hostile, RAY_GLOW, hostile ? HOSTILE : FRIENDLY, RAY_WIDTH);
}

export class HookVisuals {
  private readonly mesh: THREE.InstancedMesh;
  private time = 0;

  constructor(scene: THREE.Scene) {
    // Um cilindro de raio 1 e comprimento 1 deitado ao longo de Z: a escala dá a espessura e o comprimento de cada cabo.
    const geo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true).rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_CABLES);
    for (let i = 0; i < MAX_CABLES; i++) this.mesh.setColorAt(i, FRIENDLY);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false; // o cabo cruza a cena: a caixa original não vale
    scene.add(this.mesh);
  }

  /**
   * Um quadro: refaz as instâncias dos cabos presos agora. `mine` é o Mech do jogador (o cabo dele é ciano; o dos outros, vermelho). O alvo é puxado pelo peito.
   * Os dois ombros que prendem o mesmo alvo mostram os dois cabos.
   */
  update(hooks: HookSystem, mine: MechBase | null, dt: number): void {
    this.time = (this.time + dt) % 1000;
    const pulse = 1 + 0.35 * Math.sin(this.time * 34);
    let n = 0;
    for (const h of hooks.pool) {
      if (!h.active || !h.owner || !h.target) continue;
      const t = h.target.simPosition;
      _b.set(t.x, t.y + h.target.stats.height * 0.5, t.z);
      for (const mount of [h.mountA, h.mountB]) {
        if (!mount || n >= MAX_CABLES) continue;
        h.owner.mountWorldPosition(mount, _a);
        const len = _a.distanceTo(_b);
        if (len < 1e-3) continue;
        _mid.addVectors(_a, _b).multiplyScalar(0.5);
        _q.setFromUnitVectors(Z_AXIS, _s.subVectors(_b, _a).multiplyScalar(1 / len));
        this.mesh.setMatrixAt(n, _m.compose(_mid, _q, _s.set(THICKNESS * pulse, THICKNESS * pulse, len)));
        this.mesh.setColorAt(n, h.owner === mine ? FRIENDLY : HOSTILE);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Rodada nova ou troca de partida: apaga todos os cabos. */
  clear(): void {
    this.mesh.count = 0;
  }

  /** Quantos cabos estão desenhados agora (teste e diagnóstico). */
  get active(): number {
    return this.mesh.count;
  }
}
