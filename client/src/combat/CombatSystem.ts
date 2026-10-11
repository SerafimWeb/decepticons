import { applyEmp } from './EmpEffect';
import { inflictOnHit, STATUS } from './StatusEffects';
import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { GLOW } from '../core/palette';
import { SHAPE } from '../fx/particleShapes';
import { MechBase, type MechPart } from '../entities/MechBase';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { BurstOptions, ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsHit } from '../physics/PhysicsWorld';
import type { DamageResult } from './damage';
import { DAMAGE_TYPE, splashDamage, weapon, type WeaponStats } from './weapons';

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
const SMOKE = GLOW.smoke;

/** O sopro de frio no aliado que o gelo amigo esfria: vapor azulado que sobe devagar (sem flocos: ele não congela). */
const COOLED: BurstOptions = { count: 5, color: new THREE.Color(0.5, 0.85, 1.1), speed: 2.4, life: 0.8, size: 1.7, expansion: 1.2, spread: 1.1, gravity: -0.8, shape: SHAPE.puff };

const _at = new THREE.Vector3();
const _near = new THREE.Vector3();
const _dir = new THREE.Vector3();

export interface MechHitEvent {
  mech: MechBase;
  result: DamageResult;
  /** Quem atirou, se foi um Mech registrado. */
  shooter?: MechBase;
  /** Como: tiro ou explosão (padrão), corte de motosserra ou pisão. */
  kind?: 'melee' | 'crush';
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

  /**
   * Dano ligado. No multiplayer o cliente desliga: só o servidor tira vida (e quebra barricada); aqui os tiros
   * continuam parando nos robôs e soltando faísca.
   */
  damageEnabled = true;

  /**
   * Os dois estão do mesmo lado? (`Match.sameSide`: aliados da Arena offline e times). Sem esta regra (o servidor de hoje, todos contra todos) ninguém é aliado
   * de ninguém e o gelo congela quem for. Só o gelo a lê (`friendlyChill`); o resto do dano ainda não distingue o lado (fogo amigo continua como era).
   */
  sameSide?: (a: MechBase, b: MechBase) => boolean;

  register(mech: MechBase): void {
    this.byCollider.set(mech.collider.handle, mech);
  }

  /** Tira o Mech das regras (jogador que saiu da sala). */
  unregister(mech: MechBase): void {
    if (this.byCollider.get(mech.collider.handle) === mech) this.byCollider.delete(mech.collider.handle);
  }

  /**
   * Explosão da arma `w` em `at`: cada Mech a menos do raio da explosão da superfície da cápsula leva
   * dano que cai com a distância, na parte mais perto da explosão (no pé acerta a perna, no peito o
   * torso: a mesma regra de zonas do plasma). Quem disparou não se fere. Barricadas no raio também.
   * Regra de simulação: usa a posição do tick (simPosition), nunca a de render.
   */
  explode(at: THREE.Vector3, dir: THREE.Vector3, owner?: RAPIER.Collider, w: WeaponStats = weapon('rockets')): void {
    if (!this.damageEnabled) return;
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
      const damage = splashDamage(w, Math.hypot(Math.max(0, flat - radius), at.y - y)) * (shooter?.combatBoost.damageMultiplier ?? 1);
      if (damage <= 0) continue;
      const remaining = mech.defend(damage, DAMAGE_TYPE[w.id], at.x - p.x, at.y - p.y - height * 0.5, at.z - p.z);
      const result = mech.takeHit(_near, remaining);
      if (result.applied <= 0) continue;
      if (result.killed) this.wreck(mech, dir, shooter);
      else if (result.partDestroyed) this.tearOff(mech, result.part, dir);
      else if (w.inflicts && remaining >= damage * STATUS.shieldPass) inflictOnHit(mech.status, w.inflicts, result.part, shooter);
      this.onMechHit?.({ mech, result, shooter });
    }
    this.destructibles.damageInRadius(at, w.blastRadius, w.damage * (shooter?.combatBoost.damageMultiplier ?? 1), dir);
  }

  /**
   * Corte corpo a corpo (motosserra): só acerta encostado (distância entre as cápsulas ≤ alcance da arma),
   * na altura do meio do atacante presa ao corpo do alvo; num Mech, a lâmina de um andróide pega a perna.
   * Regra de simulação (posições do tick). Faíscas no ponto do corte.
   */
  melee(attacker: MechBase, target: MechBase, w: WeaponStats): void {
    if (!this.damageEnabled) return;
    if (!attacker.alive || !target.alive) return;
    const a = attacker.simPosition;
    const t = target.simPosition;
    const dx = a.x - t.x;
    const dz = a.z - t.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d - attacker.stats.radius - target.stats.radius > w.maxRange) return;
    const y = Math.min(t.y + target.stats.height, Math.max(t.y, a.y + attacker.stats.height * 0.5));
    _near.set(t.x + (dx / d) * target.stats.radius, y, t.z + (dz / d) * target.stats.radius);
    // Só a chapa do escudo físico segura a lâmina; o campo de energia não (barreira e esfera deixam a serra passar).
    const blade = w.damage * attacker.combatBoost.damageMultiplier;
    const cut = target.modules.leftArm > 0 ? target.metalShield.absorb(blade, DAMAGE_TYPE[w.id], dx, dz, target.yaw) : blade;
    const result = target.takeHit(_near, cut);
    if (result.applied <= 0) return;
    // Faíscas saem para cima; destroço e carcaça são empurrados para longe de quem cortou.
    this.particles.burst(_near, UP, { count: 10, color: SPARK, speed: 12, life: 0.3, size: 0.8, spread: 0.9 });
    _dir.set(-dx / d, 0, -dz / d);
    if (result.killed) this.wreck(target, _dir, attacker);
    else if (result.partDestroyed) this.tearOff(target, result.part, _dir);
    this.onMechHit?.({ mech: target, result, shooter: attacker, kind: 'melee' });
  }

  /** Pisão (`crush.ts`): o grande tira `amount` do torso do pequeno. Conta o abate para quem pisou. */
  crush(big: MechBase, small: MechBase, amount: number): void {
    if (!this.damageEnabled) return;
    const result = small.damagePart('torso', amount);
    if (result.applied <= 0) return;
    const s = small.simPosition;
    _dir.set(s.x - big.simPosition.x, 0, s.z - big.simPosition.z).normalize();
    _near.set(s.x, s.y + small.stats.height * 0.5, s.z);
    this.particles.burst(_near, UP, { count: 24, color: SPARK, speed: 14, life: 0.45, size: 1, spread: 1.6 });
    if (result.killed) this.wreck(small, _dir, big);
    else if (result.partDestroyed) this.tearOff(small, result.part, _dir);
    this.onMechHit?.({ mech: small, result, shooter: big, kind: 'crush' });
  }

  /** O Mech dono deste colisor (mira, tiro automático), ou undefined para cenário. */
  mechOf(collider: RAPIER.Collider | null): MechBase | undefined {
    return collider ? this.byCollider.get(collider.handle) : undefined;
  }

  onProjectileHit(hit: PhysicsHit, dir: THREE.Vector3, damage: number, owner?: RAPIER.Collider, w?: WeaponStats, distance = 0): void {
    if (!this.damageEnabled) return;
    damage *= owner ? (this.byCollider.get(owner.handle)?.combatBoost.damageMultiplier ?? 1) : 1;
    const mech = this.byCollider.get(hit.collider.handle);
    if (!mech) {
      this.destructibles.damage(hit.collider, damage, dir);
      return;
    }
    const shooter = owner ? this.byCollider.get(owner.handle) : undefined;
    if (shooter && shooter !== mech && w?.inflicts === 'chill' && this.sameSide?.(shooter, mech)) {
      this.friendlyChill(mech, hit.point, w);
      return;
    }
    if (w) applyEmp(mech, w, distance);
    const remaining = mech.defend(damage, w ? DAMAGE_TYPE[w.id] : 'termico', -dir.x, -dir.y, -dir.z);
    const result = mech.takeHit(hit.point, remaining);
    if (result.applied <= 0) return;
    if (result.killed) this.wreck(mech, dir, shooter);
    else {
      if (result.partDestroyed) this.tearOff(mech, result.part, dir);
      // Fogo, choque ou gelo: só se o tiro chegou ao corpo (o escudo que absorveu tudo não deixa estado). A cabeça vale o atordoamento do choque.
      if (w?.inflicts && remaining >= damage * STATUS.shieldPass) inflictOnHit(mech.status, w.inflicts, result.part, shooter);
    }
    this.onMechHit?.({ mech, result, shooter });
  }

  /**
   * O gelo de um aliado esfria em vez de congelar: tira calor (`STATUS.friendlyVentPerDamage` por ponto de dano da arma, no nível dela) e apaga o fogo, sem dano e sem
   * estado de gelo. O escudo e a chapa não entram (é ajuda, não ataque). Sem `onMechHit`: o marcador de acerto do HUD é de dano.
   */
  private friendlyChill(mech: MechBase, at: THREE.Vector3, w: WeaponStats): void {
    if (!mech.alive) return;
    mech.vent(w.damage * STATUS.friendlyVentPerDamage);
    mech.status.douse();
    this.particles.burst(at, UP, COOLED);
  }

  /**
   * Um tick dos estados de um Mech (`combat/StatusEffects.ts`): o tempo corre e o dano por segundo (queimadura, choque) sai do torso;
   * se mata, o abate é de quem aplicou por último. O tempo corre mesmo com o dano desligado (o cliente online): só o servidor tira vida.
   * Sem `onMechHit` a cada tick: o marcador de acerto do HUD seria um chiado.
   */
  tickStatus(mech: MechBase, dt: number): void {
    const s = mech.status;
    const killer = s.source instanceof MechBase ? s.source : undefined;
    const heat = s.heatPerSecond * dt;
    const damage = s.step(dt);
    if (!this.damageEnabled || !mech.alive) return;
    if (heat > 0) mech.absorbBurn(heat);
    if (damage <= 0) return;
    const result = mech.statusDamage(damage);
    if (result.killed) this.wreck(mech, UP, killer);
    else if (result.partDestroyed) this.tearOff(mech, result.part, UP);
  }

  /** A parte some do modelo (MechBase) e o pedaço cai no chão como destroço. */
  private tearOff(mech: MechBase, part: MechPart, dir: THREE.Vector3): void {
    const at = mech.partWorldPosition(part, _at);
    this.debris.shatter(at, PART_CHUNK[part], dir, 8);
    this.particles.burst(at, UP, { count: 40, color: SPARK, speed: 18, life: 0.6, size: 1.5, expansion: -0.3, spread: 1.4 });
  }

  private wreck(mech: MechBase, dir: THREE.Vector3, killer?: MechBase): void {
    const at = _at.copy(mech.position);
    at.y += WRECK_CENTER_Y;
    this.debris.shatter(at, WRECK_SIZE, dir, 14);
    this.particles.burst(at, UP, { count: 120, color: FIRE, speed: 22, life: 0.9, size: 2.1, expansion: 0.8, spread: 2.2 });
    this.particles.burst(at, UP, { count: 60, color: SPARK, speed: 32, life: 0.65, size: 1.25, expansion: -0.45, spread: 1.6 });
    this.particles.burst(at, UP, { count: 70, color: SMOKE, speed: 8, life: 1.8, size: 2.6, expansion: 1.25, spread: 2.5, gravity: -1 });
    this.onMechKilled?.(mech, at, killer);
  }
}
