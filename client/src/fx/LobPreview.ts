import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import type { GrenadeSystem } from '../combat/GrenadeSystem';
import { lobPoint } from '../combat/lob';
import type { WeaponStats } from '../combat/weapons';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { BILL, type Billboards } from './Billboards';

/**
 * A mira do lança-granadas (P160 parte 2b): **o arco que a granada vai fazer**, em pontinhos, e **o anel do tamanho da explosão** onde ela vai cair,
 * para o jogador ver se o arco passa por cima da cobertura antes de atirar. Usa a mesma conta do tiro (`GrenadeSystem.aimArc`: o arco baixo, ou o alto
 * quando o baixo bate no cenário), então o que aparece é o que sai. Só o cliente desenha, e só com a arma equipada.
 *
 * Custo: até ~60 raios curtos por quadro (o arco conferido e o desenhado), ~0,1 ms; os pontinhos são cartazes do lote que já existe (`Billboards`)
 * e o anel, uma malha só. Nada alocado por quadro.
 */

/** Passo do desenho do arco (s de voo) e o máximo de voo desenhado. */
const STEP_S = 0.07;
const MAX_S = 3.2;

const _dir = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _seg = new THREE.Vector3();
const _n = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);
const DOT = new THREE.Color(1.4, 2.3, 0.5);
const RING = new THREE.Color(1.1, 1.8, 0.4);

export class LobPreview {
  readonly ring: THREE.Mesh;
  private readonly ringMat: THREE.MeshBasicMaterial;

  constructor() {
    this.ringMat = new THREE.MeshBasicMaterial({ color: RING, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), this.ringMat);
    this.ring.visible = false;
    this.ring.frustumCulled = false;
  }

  /** Esconde a mira (sem a arma, morto, no Hangar). */
  hide(): void {
    this.ring.visible = false;
  }

  /**
   * Desenha o arco de `origin` (a boca) até onde a mira aponta (`target`). `held` acende mais (o gatilho apertado). Devolve se achou onde cai.
   */
  draw(bill: Billboards, physics: PhysicsWorld, grenades: GrenadeSystem, origin: THREE.Vector3, target: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats, held: boolean, time: number): boolean {
    const lob = w.lob;
    if (!lob) {
      this.hide();
      return false;
    }
    const speed = grenades.aimArc(origin, target, owner, w, _dir);
    const glow = held ? 1 : 0.55;
    _a.copy(origin);
    // Os pontinhos andam ao longo do arco (a fase corre com o tempo): dá a direção do voo sem precisar de seta.
    const phase = (time * 1.6) % 1;
    for (let k = 1; k * STEP_S <= MAX_S; k++) {
      lobPoint(origin, _dir, speed, lob.gravity, k * STEP_S, _b);
      _seg.subVectors(_b, _a);
      const len = _seg.length();
      if (len > 1e-6) {
        const hit = physics.raycast(_a, _seg.multiplyScalar(1 / len), len, owner, true);
        if (hit) {
          _n.copy(hit.normal);
          this.ring.position.copy(hit.point).addScaledVector(_n, 0.06);
          this.ring.quaternion.setFromUnitVectors(Z, _n);
          const r = w.blastRadius * (0.96 + 0.04 * Math.sin(time * 9));
          this.ring.scale.set(r, r, 1);
          this.ringMat.opacity = 0.35 + 0.35 * glow;
          this.ring.visible = true;
          return true;
        }
      }
      if (k % 2 === 0) {
        const fade = 1 - (k * STEP_S) / MAX_S;
        const pulse = 0.6 + 0.4 * Math.max(0, Math.cos(((k * STEP_S) / MAX_S - phase) * 6.283 * 3));
        bill.put(_b, DOT, BILL.glow, 0.5, glow * (0.35 + 0.65 * fade) * pulse);
      }
      _a.copy(_b);
    }
    this.ring.visible = false;
    return false;
  }
}
