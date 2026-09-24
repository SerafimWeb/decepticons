import * as THREE from 'three';
import type { MechBase } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { BOT_SKILL_NORMAL, BotController, type BotSkill } from './BotController';
import type { CombatSystem } from './CombatSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import type { Respawner } from './Respawner';

export const BOT_RESPAWN_S = 4;
/** Violeta: lê como "não sou eu" contra o laranja do jogador. */
const BOT_PAINT = 0x7b2cff;
const MUZZLE_COLOR = new THREE.Color(3.0, 0.6, 2.0);

const _muzzle = new THREE.Vector3();

export interface BotSystemOptions {
  scene: THREE.Scene;
  physics: PhysicsWorld;
  combat: CombatSystem;
  projectiles: ProjectileSystem;
  particles: ParticleSystem;
  respawner: Respawner;
  /** Onde cada bot nasce (x, z): um bot por ponto. */
  spawns: readonly (readonly [number, number])[];
  /** Rota de patrulha (x, z). */
  waypoints: readonly (readonly [number, number])[];
  seed?: number;
  skill?: BotSkill;
}

interface Bot {
  mech: MechBase;
  brain: BotController;
}

/**
 * Mechs inimigos: um Vector-09 violeta por ponto de nascimento, cada um com o seu
 * `BotController`. No tick: o cérebro decide, o Mech simula, e o tiro sai da boca do canhão
 * calculada da simulação. Custo por bot: 1 character controller por tick + a IA (ver BotController).
 */
export class BotSystem {
  /** Quem os bots caçam (hoje: só o jogador). */
  targets: readonly MechBase[] = [];
  readonly mechs: readonly MechBase[];
  private readonly bots: Bot[] = [];
  private readonly projectiles: ProjectileSystem;
  private readonly particles: ParticleSystem;

  constructor(o: BotSystemOptions) {
    this.projectiles = o.projectiles;
    this.particles = o.particles;
    const waypoints = o.waypoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const seed = o.seed ?? 1;
    o.spawns.forEach(([x, z], i) => {
      const mech = new Vector09({ paint: BOT_PAINT });
      mech.spawn(o.physics, new THREE.Vector3(x, 0, z));
      mech.applyFacing(Math.atan2(x, z), 0); // nasce olhando para o centro da arena
      o.scene.add(mech.root);
      o.combat.register(mech);
      const brain = new BotController(mech, o.physics, waypoints, seed * 1000 + i, o.skill ?? BOT_SKILL_NORMAL);
      o.respawner.track(mech, BOT_RESPAWN_S, () => brain.reset());
      this.bots.push({ mech, brain });
    });
    this.mechs = this.bots.map((b) => b.mech);
  }

  /** Estado do cérebro de um bot (HUD de debug e testes). */
  brainOf(mech: MechBase): BotController | undefined {
    return this.bots.find((b) => b.mech === mech)?.brain;
  }

  /** Um bot levou tiro de um alvo que ele caça: se estava só patrulhando, vira e vai atrás. */
  onDamaged(mech: MechBase, shooter: MechBase | undefined): void {
    if (!shooter || !this.targets.includes(shooter)) return;
    this.brainOf(mech)?.alert(shooter);
  }

  fixedUpdate(dt: number): void {
    for (const { mech, brain } of this.bots) {
      mech.fixedUpdate(brain.think(dt, this.targets), dt);
      if (!brain.wantsToFire) continue;
      mech.simMuzzle(_muzzle);
      this.projectiles.fire(_muzzle, brain.shotDir, mech.collider, true);
      this.particles.burst(_muzzle, brain.shotDir, { count: 8, color: MUZZLE_COLOR, speed: 10, life: 0.15, spread: 0.5, gravity: 0 });
      mech.onFire();
    }
  }

  render(dt: number, alpha: number): void {
    for (const { mech } of this.bots) mech.render(dt, alpha);
  }
}
