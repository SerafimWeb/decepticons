import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import type { MechBase, MechPart } from '../entities/MechBase';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsHit } from '../physics/PhysicsWorld';
import type { DamageResult } from './damage';
import { BLAST_RADIUS, ROCKET_DAMAGE, splashDamage } from './RocketSystem';

/** Tamanho do pedaço que vira destroço quando a parte é arrancada. */
const PART_CHUNK: Record<MechPart, THREE.Vector3> = {
  torso: new THREE.Vector3(2.0, 1.4, 1.5),
  head: new THREE.Vector3(0.8, 0.6, 0.9),
  leftArm: new THREE.Vector3(0.7, 1.7, 1.1),
  rightArm: new THREE.Vector3(0.7, 1.7, 1.1),
  leftLeg: new THREE.Vector3(0.6, 1.2, 0.8),
  rightLeg: new THREE.Vector3(0.6, 1.2, 0.8),
};
/** Carcaça inteira na morte (vira até 6 destroços). */
const WRECK_SIZE = new THREE.Vector3(2.4, 4.4, 1.9);
const WRECK_CENTER_Y = 2.4;

const UP = new THREE.Vector3(0, 1, 0);
const SPARK = new THREE.Color(3.0, 1.3, 0.3);
const FIRE = new THREE.Color(3.5, 1.1, 0.15);
const SMOKE = new THREE.Color(0.32, 0.3, 0.36);

const _at = new THREE.Vector3();
const _near = new THREE.Vector3();

export interface MechHitEvent {
  mech: MechBase;
  result: DamageResult;
  /** Quem atirou, se foi um Mech registrado. */
  shooter?: MechBase;
}

/**
 * Roteia cada impacto: Mech (dano por parte) ou destrutível. A regra de dano mora em
 * `damage.ts` e no `MechBase` (simulação); aqui ficam só os efeitos de mundo
 * (peça arrancada vira destroço, carcaça explode). Custo: um lookup por impacto.
 */
export class CombatSystem {
  /** Qualquer acerto que tirou vida (HUD: marcador de acerto). */
  onMechHit?: (e: MechHitEvent) => void;
  /** Mech abatido (tremor de câmera, placar). `killer` = quem deu o tiro final. */
  onMechKilled?: (mech: MechBase, at: THREE.Vector3, killer?: MechBase) => void;

  private readonly byCollider = new Map<number, MechBase>();

  constructor(
    private readonly destructibles: Destructibles,
    private readonly debris: DebrisSystem,
    private readonly particles: ParticleSystem,
  ) {}

  register(mech: MechBase): void {
    this.byCollider.set(mech.collider.handle, mech);
  }

  /**
   * Explosão de foguete em `at`: cada Mech a menos de BLAST_RADIUS da superfície da cápsula leva
   * dano que cai com a distância, na parte mais perto da explosão (no pé acerta a perna, no peito o
   * torso: a mesma regra de zonas do plasma). Quem disparou não se fere. Barricadas no raio também.
   * Regra de simulação: usa a posição do tick (simPosition), nunca a de render.
   */
  explode(at: THREE.Vector3, dir: THREE.Vector3, owner?: RAPIER.Collider): void {
    const shooter = owner ? this.byCollider.get(owner.handle) : undefined;
    for (const mech of this.byCollider.values()) {
      if (!mech.alive || mech === shooter) continue;
      const p = mech.simPosition;
      const { radius, height } = mech.stats;
      // Ponto da cápsula mais perto da explosão: altura presa ao corpo, lado preso ao raio.
      const y = Math.min(p.y + height, Math.max(p.y, at.y));
      const dx = at.x - p.x;
      const dz = at.z - p.z;
      const flat = Math.hypot(dx, dz);
      const k = flat > radius ? radius / flat : 1;
      _near.set(p.x + dx * k, y, p.z + dz * k);
      const damage = splashDamage(Math.hypot(Math.max(0, flat - radius), at.y - y));
      if (damage <= 0) continue;
      const result = mech.takeHit(_near, damage);
      if (result.applied <= 0) continue;
      if (result.killed) this.wreck(mech, dir, shooter);
      else if (result.partDestroyed) this.tearOff(mech, result.part, dir);
      this.onMechHit?.({ mech, result, shooter });
    }
    this.destructibles.damageInRadius(at, BLAST_RADIUS, ROCKET_DAMAGE, dir);
  }

  /** O Mech dono deste colisor (mira, tiro automático), ou undefined para cenário. */
  mechOf(collider: RAPIER.Collider | null): MechBase | undefined {
    return collider ? this.byCollider.get(collider.handle) : undefined;
  }

  onProjectileHit(hit: PhysicsHit, dir: THREE.Vector3, damage: number, owner?: RAPIER.Collider): void {
    const mech = this.byCollider.get(hit.collider.handle);
    if (!mech) {
      this.destructibles.damage(hit.collider, damage, dir);
      return;
    }
    const shooter = owner ? this.byCollider.get(owner.handle) : undefined;
    const result = mech.takeHit(hit.point, damage);
    if (result.applied <= 0) return;
    if (result.killed) this.wreck(mech, dir, shooter);
    else if (result.partDestroyed) this.tearOff(mech, result.part, dir);
    this.onMechHit?.({ mech, result, shooter });
  }

  /** A parte some do modelo (MechBase) e o pedaço cai no chão como destroço. */
  private tearOff(mech: MechBase, part: MechPart, dir: THREE.Vector3): void {
    const at = mech.partWorldPosition(part, _at);
    this.debris.shatter(at, PART_CHUNK[part], dir, 8);
    this.particles.burst(at, UP, { count: 40, color: SPARK, speed: 16, life: 0.6, spread: 1.4 });
  }

  private wreck(mech: MechBase, dir: THREE.Vector3, killer?: MechBase): void {
    const at = _at.copy(mech.position);
    at.y += WRECK_CENTER_Y;
    this.debris.shatter(at, WRECK_SIZE, dir, 14);
    this.particles.burst(at, UP, { count: 120, color: FIRE, speed: 22, life: 0.8, spread: 2.2 });
    this.particles.burst(at, UP, { count: 60, color: SPARK, speed: 30, life: 0.6, spread: 1.6 });
    this.particles.burst(at, UP, { count: 70, color: SMOKE, speed: 8, life: 1.8, spread: 2.5, gravity: -1 });
    this.onMechKilled?.(mech, at, killer);
  }
}
