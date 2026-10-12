import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-simd-compat';
import type { MechBase } from '../entities/MechBase';
import type { PhysicsHit } from '../physics/PhysicsWorld';
import type { CombatSystem } from './CombatSystem';
import { FIRE_RING } from './EnergyShield';
import { weapon, type WeaponStats } from './weapons';

/**
 * O anel de fogo (dono, 11/10: *"um círculo de fogo ao redor do Mech, queimando tudo ao redor durante alguns segundos, e aumentando o calor geral de tudo,
 * inclusive do próprio robô"*). O módulo e os números moram em `EnergyShield.ts` (`FIRE_RING`); aqui mora o que um pulso faz em volta do dono.
 *
 * **Um pulso (a cada 0,25 s com o anel ligado):**
 * - todo Mech dentro do raio (medido até a superfície do corpo, e a até `reach` m de altura) **esquenta** `FIRE_RING.heat` e **não resfria nesse tick**
 *   (`absorbBurn`), **inclusive o dono e os aliados**;
 * - todo **inimigo** dentro do raio leva o dano do pulso pelo mesmo caminho do lança-chamas (escudos de chapa e de energia, abate com crédito, `inflicts: 'burn'`
 *   só se o dano passou), e fica **queimando**;
 * - o inimigo que estava **congelado** leva `FIRE_RING.melt` a mais, de uma vez: o fogo derrete o gelo (o combo gelo + fogo).
 * Sem linha de visão (é um círculo em volta do Mech, não um feixe) e sem sorteio (G1/G2). Quem chama é a partida (`Match.step`); o cliente online não aplica nada
 * (`damageEnabled` desligado: o servidor decide e o cliente só desenha, `fx/FireRingVisuals.ts`).
 *
 * Custo: um pulso é um laço pelos Mechs da partida (a 4 Hz por anel ligado), sem alocação (G4).
 */
const RING_WEAPON: WeaponStats = Object.freeze({ ...weapon('flamer'), damage: FIRE_RING.damage });

/** Quem o anel de um dono queima (`foes`) e quem só esquenta (`friends`): listas que a partida monta uma vez. */
export interface RingSides {
  foes: readonly (readonly MechBase[])[];
  friends: readonly (readonly MechBase[])[];
}

export class FireRing {
  private readonly hit: PhysicsHit = { point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), distance: 0, collider: undefined as unknown as RAPIER.Collider };
  private readonly dir = new THREE.Vector3();

  constructor(private readonly combat: CombatSystem) {}

  /** Um pulso do anel de `caster`. Devolve quantos inimigos o fogo pegou (o teste e o orçamento leem). */
  pulse(caster: MechBase, sides: RingSides): number {
    if (!this.combat.damageEnabled || !caster.alive) return 0;
    this.warm(caster, caster);
    let burned = 0;
    for (const group of sides.friends) for (const m of group) if (m !== caster) this.warm(caster, m);
    for (const group of sides.foes) {
      for (const m of group) {
        if (m === caster || !this.warm(caster, m)) continue;
        this.burn(caster, m);
        burned++;
      }
    }
    return burned;
  }

  /** Esquenta `target` se ele está dentro do anel de `caster`. Devolve se está. */
  private warm(caster: MechBase, target: MechBase): boolean {
    if (!target.alive) return false;
    const a = caster.simPosition;
    const b = target.simPosition;
    if (Math.abs(b.y - a.y) > FIRE_RING.reach) return false;
    if (Math.hypot(b.x - a.x, b.z - a.z) - target.stats.radius > FIRE_RING.radius) return false;
    target.absorbBurn(FIRE_RING.heat);
    return true;
  }

  private burn(caster: MechBase, target: MechBase): void {
    const a = caster.simPosition;
    const b = target.simPosition;
    this.dir.set(b.x - a.x, 0, b.z - a.z);
    if (this.dir.lengthSq() < 1e-6) this.dir.set(0, 0, -1);
    this.dir.normalize();
    target.partWorldPosition('torso', this.hit.point, true);
    this.hit.collider = target.collider;
    const gap = Math.max(0, Math.hypot(b.x - a.x, b.z - a.z) - target.stats.radius);
    this.hit.distance = gap;
    // O congelado derrete: o dano extra entra no mesmo golpe (ainda congelado, ele leva também o +20% de dano do gelo) e o fogo desfaz o gelo.
    const melt = target.status.isFrozen ? FIRE_RING.melt : 0;
    this.combat.onProjectileHit(this.hit, this.dir, FIRE_RING.damage + melt, caster.collider, RING_WEAPON, gap);
  }
}
