import * as THREE from 'three';
import { GLOW } from '../core/palette';
import type { MechBase } from '../entities/MechBase';
import { weaponAt, type MountId } from '../combat/mounts';
import type { BurstOptions, ParticleSystem } from './ParticleSystem';
const UP = new THREE.Vector3(0, 1, 0);
const FRIENDLY: BurstOptions = { count: 6, color: GLOW.playerMuzzle, speed: 2, life: 0.18, size: 0.65, spread: 1.2, gravity: 0 };
const HOSTILE: BurstOptions = { ...FRIENDLY, color: GLOW.enemyMuzzle };
/**
 * Aviso na boca durante a carga, 10 Hz / 8 unidades por pulso / até 480 partículas por segundo. **Em cada boca que está carregando** (dono, 11/10: no Marauder
 * "os tiros saíam só pela mão direita": o aviso da carga também era desenhado sempre da direita): a mão que leva arma de carga (trilho) acende; as outras, não.
 */
export class ChargeVisuals {
  private readonly at = new THREE.Vector3();
  private elapsed = 0;
  private remaining = 0;
  constructor(private readonly particles: Pick<ParticleSystem, 'burst'>) {}
  beginFrame(dt: number, active: boolean): void {
    this.remaining = 0;
    if (!active) { this.elapsed = 0; return; }
    this.elapsed += dt;
    if (this.elapsed < 0.1) return;
    this.elapsed %= 0.1;
    this.remaining = 8;
  }
  update(mech: MechBase, hostile = true): void {
    if (!mech.alive || !mech.root.visible || !mech.weaponCharging || this.remaining <= 0) return;
    const l = mech.loadout;
    const t = mech.triggers;
    // Cada encaixe carrega a arma que a montagem põe nele (a mão esquerda do Marauder pode estar em qualquer um dos dois ataques).
    for (const m of t.primary) if (weaponAt(l, m)?.chargeTime) this.emit(mech, m, hostile);
    for (const m of t.secondary) if (weaponAt(l, m)?.chargeTime) this.emit(mech, m, hostile);
  }
  private emit(mech: MechBase, mount: MountId, hostile: boolean): void {
    if (this.remaining <= 0) return;
    this.remaining--;
    mech.mountWorldPosition(mount, this.at);
    this.particles.burst(this.at, UP, hostile ? HOSTILE : FRIENDLY);
  }
}
