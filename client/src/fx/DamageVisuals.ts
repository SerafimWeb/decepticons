import * as THREE from 'three';
import { GLOW, PALETTE } from '../core/palette';
import type { MechBase, MechModules, MechPart } from '../entities/MechBase';
import type { BurstOptions, ParticleSystem } from './ParticleSystem';

const PARTS: readonly MechPart[] = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const UP = new THREE.Vector3(0, 1, 0);
const SMOKE: BurstOptions = { count: 2, color: GLOW.smoke, speed: 1.5, life: 1.2, size: 1.8, expansion: 1.4, spread: 0.5, gravity: -1 };
const SPARK: BurstOptions = { count: 2, color: new THREE.Color(PALETTE.sodium).multiplyScalar(2), speed: 3, life: 0.3, size: 0.5, spread: 1.5, gravity: 6 };
const STEAM: BurstOptions = { count: 2, color: new THREE.Color(PALETTE.bone).multiplyScalar(0.3), speed: 2, life: 0.8, size: 2, expansion: 1.6, spread: 0.4, gravity: -2 };

/** Sinal de avaria, sem confundir arranhão com parte arrancada. Reparar apaga o sinal. */
export function damagedPart(health: number, max: number): boolean {
  return max > 0 && health > 0 && health / max <= 0.5;
}

/** Assimetria da passada; só lê a vida, nunca altera mobilidade nem colisão. */
export function legDamageLean(modules: MechModules, max: MechModules): number {
  const left = max.leftLeg > 0 ? 1 - modules.leftLeg / max.leftLeg : 0;
  const right = max.rightLeg > 0 ? 1 - modules.rightLeg / max.rightLeg : 0;
  return THREE.MathUtils.clamp(left - right, -1, 1);
}

/** Render puro: 10 Hz, até 12 unidades por pulso, usando o pool existente (zero draw calls novas).
 * Uma parte por unidade/pulso, alternada: no máximo 720 partículas/s, sem recuperar pulsos atrasados.
 */
export class DamageVisuals {
  private readonly origin = new THREE.Vector3();
  private timer = 0;
  private cursor = 0;
  private remaining = 0;

  constructor(private readonly particles: Pick<ParticleSystem, 'burst'>) {}

  beginFrame(dt: number, active: boolean): void {
    this.remaining = 0;
    if (!active) { this.timer = 0; return; }
    this.timer += dt;
    if (this.timer < 0.1) return;
    this.timer %= 0.1;
    this.cursor = (this.cursor + 1) % PARTS.length;
    this.remaining = 12;
  }

  /** O orçamento do pulso (12 robôs) só gasta com quem emite: num esquadrão grande, os saudáveis não podem esgotá-lo antes dos avariados. */
  update(mech: MechBase): void {
    if (!mech.alive || !mech.root.visible || this.remaining === 0) return;
    let emitted = false;
    for (let i = 0; i < PARTS.length; i++) {
      const part = PARTS[(this.cursor + i) % PARTS.length]!;
      if (!damagedPart(mech.modules[part], mech.stats.maxModuleHealth[part])) continue;
      mech.partWorldPosition(part, this.origin, false);
      this.particles.burst(this.origin, UP, SMOKE);
      this.particles.burst(this.origin, UP, SPARK);
      emitted = true;
      break;
    }
    // Os blueprints já ventilam; nos importados o sinal faltava por completo.
    if (!mech.hasHeatVisual && (mech.heat >= 0.7 || mech.overheated)) {
      mech.partWorldPosition('torso', this.origin, false);
      this.particles.burst(this.origin, UP, STEAM);
      emitted = true;
    }
    if (emitted) this.remaining--;
  }
}
