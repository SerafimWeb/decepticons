import * as THREE from 'three';
import { GLOW } from '../core/palette';
import type { MechBase } from '../entities/MechBase';
import type { BurstOptions, ParticleSystem } from './ParticleSystem';
const UP = new THREE.Vector3(0, 1, 0);
const FRIENDLY: BurstOptions = { count: 6, color: GLOW.playerMuzzle, speed: 2, life: 0.18, size: 0.65, spread: 1.2, gravity: 0 };
const HOSTILE: BurstOptions = { ...FRIENDLY, color: GLOW.enemyMuzzle };
/** Aviso na boca durante a carga, 10 Hz / 8 unidades por pulso / até 480 partículas por segundo. */
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
    this.remaining--;
    mech.mountWorldPosition('rightHand', this.at);
    this.particles.burst(this.at, UP, hostile ? HOSTILE : FRIENDLY);
  }
}
