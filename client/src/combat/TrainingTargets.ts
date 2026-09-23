import * as THREE from 'three';
import type { MechBase, MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { CombatSystem } from './CombatSystem';

export const TARGET_RESPAWN_S = 4;
/** Violeta: lê como "não sou eu" contra o laranja do jogador. */
const TARGET_PAINT = 0x7b2cff;
/** Pontos livres da arena (longe de prédios e barricadas), à vista do spawn do jogador. */
const HOMES: readonly [number, number][] = [
  [-18, -8],
  [6, -18],
  [24, 12],
];

interface Target {
  mech: MechBase;
  home: THREE.Vector3;
  input: MechInput;
  respawnIn: number | null;
}

/**
 * Alvos de treino: Vector-09 parados que tomam dano por parte, morrem e voltam depois de
 * alguns segundos. Servem para testar o combate antes dos bots, que vão reusar o mesmo Mech
 * trocando o input parado por uma IA. Custo: 1 character controller por alvo por tick.
 */
export class TrainingTargets {
  private readonly targets: Target[] = [];

  constructor(scene: THREE.Scene, physics: PhysicsWorld, combat: CombatSystem, faceToward: THREE.Vector3) {
    for (const [x, z] of HOMES) {
      const mech = new Vector09({ paint: TARGET_PAINT });
      const home = new THREE.Vector3(x, 0, z);
      const yaw = Math.atan2(-(faceToward.x - x), -(faceToward.z - z));
      mech.spawn(physics, home);
      mech.applyFacing(yaw, 0);
      scene.add(mech.root);
      combat.register(mech);
      this.targets.push({
        mech,
        home,
        input: { moveX: 0, moveZ: 0, moveYaw: yaw, yaw, jump: false, dash: false },
        respawnIn: null,
      });
    }
  }

  get mechs(): readonly MechBase[] {
    return this.targets.map((t) => t.mech);
  }

  /** Tick fixo: alvo vivo fica parado (gravidade/chão); alvo abatido conta até voltar. */
  fixedUpdate(dt: number): void {
    for (const t of this.targets) {
      if (t.mech.alive) {
        t.mech.fixedUpdate(t.input, dt);
        continue;
      }
      t.respawnIn ??= TARGET_RESPAWN_S;
      t.respawnIn -= dt;
      if (t.respawnIn <= 0) {
        t.respawnIn = null;
        t.mech.respawn(t.home);
        t.mech.applyFacing(t.input.yaw, 0);
      }
    }
  }

  render(dt: number, alpha: number): void {
    for (const t of this.targets) t.mech.render(dt, alpha);
  }
}
