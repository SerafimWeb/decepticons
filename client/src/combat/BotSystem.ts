import * as THREE from 'three';
import { GLOW, PALETTE } from '../core/palette';
import type { MechBase } from '../entities/MechBase';
import { Android } from '../entities/Android';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { ANDROID_PROFILE, BOT_SKILL_NORMAL, BotController, type BotSkill, MECH_PROFILE } from './BotController';
import type { CombatSystem } from './CombatSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import { REPAIR_RATE } from './repair';
import { TechnicianController } from './TechnicianController';
import type { Respawner } from './Respawner';

export const BOT_RESPAWN_S = 4;
/** IA rebelde: vermelho, com visor e tiros vermelhos (o jogador é amarelo com verde neon). */
const BOT_PAINT = PALETTE.enemyPaint;
const MUZZLE_COLOR = GLOW.enemyMuzzle;
/** Indicativos de chamada dos pilotos (placar). */
const CALLSIGNS = ['KESTREL', 'MAKO', 'VIPER', 'RAVEN', 'ORCA', 'JACKAL', 'WRAITH', 'COBALT'];

const _muzzle = new THREE.Vector3();

export interface BotSystemOptions {
  scene: THREE.Scene;
  physics: PhysicsWorld;
  combat: CombatSystem;
  projectiles: ProjectileSystem;
  particles: ParticleSystem;
  respawner: Respawner;
  /** Onde cada Mech rebelde (escala 2) nasce (x, z): um por ponto. */
  spawns: readonly (readonly [number, number])[];
  /** Onde cada andróide rebelde (escala 1) nasce (x, z): um por ponto. */
  androidSpawns?: readonly (readonly [number, number])[];
  /** Onde cada andróide técnico nasce (x, z): conserta os Mechs rebeldes, não atira. */
  technicianSpawns?: readonly (readonly [number, number])[];
  /** Rota de patrulha (x, z). */
  waypoints: readonly (readonly [number, number])[];
  seed?: number;
  skill?: BotSkill;
}

interface Bot {
  mech: MechBase;
  brain: BotController | TechnicianController;
  name: string;
  home: THREE.Vector3;
  /** Feixe de conserto (só técnicos): 2 pontos atualizados no render, sem alocar. */
  beam?: THREE.Line;
}

const BEAM_COLOR = new THREE.Color(PALETTE.fluo).multiplyScalar(3);
const _beamTo = new THREE.Vector3();

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
    const place = (mech: MechBase, [x, z]: readonly [number, number]) => {
      mech.spawn(o.physics, new THREE.Vector3(x, 0, z));
      mech.applyFacing(Math.atan2(x, z), 0); // nasce olhando para o centro da arena
      o.scene.add(mech.root);
      o.combat.register(mech);
      return new THREE.Vector3(x, 0, z);
    };
    const fighter = (mech: MechBase, p: readonly [number, number], name: string, i: number, android: boolean) => {
      const home = place(mech, p);
      const brain = new BotController(mech, o.physics, waypoints, seed * 1000 + i, o.skill ?? BOT_SKILL_NORMAL, android ? ANDROID_PROFILE : MECH_PROFILE);
      o.respawner.track(mech, BOT_RESPAWN_S, () => brain.reset());
      this.bots.push({ mech, brain, name, home });
    };
    o.spawns.forEach((p, i) => fighter(new Vector09({ paint: BOT_PAINT, visor: PALETTE.signal }), p, CALLSIGNS[i % CALLSIGNS.length]!, i, false));
    // Andróides: numerados como unidades de uma frota (A-01, A-02…); sementes depois das dos Mechs.
    (o.androidSpawns ?? []).forEach((p, i) => fighter(new Android(), p, `A-${String(i + 1).padStart(2, '0')}`, o.spawns.length + i, true));
    // Técnicos (T-01…): consertam os Mechs rebeldes; visor amarelo para o jogador achar e caçar primeiro.
    const allies = this.bots.filter((b) => b.mech instanceof Vector09).map((b) => b.mech);
    (o.technicianSpawns ?? []).forEach((p, i) => {
      const mech = new Android({ visor: PALETTE.fluo });
      const home = place(mech, p);
      const brain = new TechnicianController(mech, allies);
      o.respawner.track(mech, BOT_RESPAWN_S, () => brain.reset());
      const beam = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: BEAM_COLOR }));
      beam.visible = false;
      beam.frustumCulled = false;
      o.scene.add(beam);
      this.bots.push({ mech, brain, name: `T-${String(i + 1).padStart(2, '0')}`, home, beam });
    });
    this.mechs = this.bots.map((b) => b.mech);
  }

  nameOf(mech: MechBase): string {
    return this.bots.find((b) => b.mech === mech)?.name ?? 'BOT';
  }

  /** Rodada nova: todos inteiros de volta ao ponto de nascimento, olhando o centro, cérebro zerado. */
  respawnAll(): void {
    for (const { mech, brain, home } of this.bots) {
      mech.respawn(home);
      mech.applyFacing(Math.atan2(home.x, home.z), 0);
      brain.reset();
    }
  }

  /** Troca a dificuldade de todos os bots (vale a partir do próximo tick). */
  setSkill(skill: BotSkill): void {
    for (const b of this.bots) if (b.brain instanceof BotController) b.brain.skill = skill;
  }

  /** Cérebro de combate de um bot (HUD de debug e testes); undefined para técnicos. */
  brainOf(mech: MechBase): BotController | undefined {
    const brain = this.bots.find((b) => b.mech === mech)?.brain;
    return brain instanceof BotController ? brain : undefined;
  }

  /** Cérebro de um técnico (testes); undefined para os de combate. */
  technicianOf(mech: MechBase): TechnicianController | undefined {
    const brain = this.bots.find((b) => b.mech === mech)?.brain;
    return brain instanceof TechnicianController ? brain : undefined;
  }

  /** Um bot levou tiro de um alvo que ele caça: se estava só patrulhando, vira e vai atrás. */
  onDamaged(mech: MechBase, shooter: MechBase | undefined): void {
    if (!shooter || !this.targets.includes(shooter)) return;
    this.brainOf(mech)?.alert(shooter);
  }

  fixedUpdate(dt: number): void {
    for (const { mech, brain } of this.bots) {
      mech.fixedUpdate(brain.think(dt, this.targets), dt);
      // Técnico no alcance: o conserto é regra do tick (quem escolhe o Mech é o cérebro).
      if (brain instanceof TechnicianController && brain.repairTarget) brain.repairTarget.repair(REPAIR_RATE * dt);
      if (!brain.wantsToFire) continue;
      mech.simMuzzle(_muzzle);
      this.projectiles.fire(_muzzle, brain.shotDir, mech.collider, true, mech.stats.weaponDamage);
      this.particles.burst(_muzzle, brain.shotDir, { count: 8, color: MUZZLE_COLOR, speed: 10, life: 0.15, spread: 0.5, gravity: 0 });
      mech.onFire();
    }
  }

  render(dt: number, alpha: number): void {
    for (const { mech, brain, beam } of this.bots) {
      mech.render(dt, alpha);
      if (!beam) continue;
      const target = brain instanceof TechnicianController ? brain.repairTarget : null;
      beam.visible = !!target && mech.alive;
      if (!beam.visible || !target) continue;
      // Da ferramenta do técnico ao peito do Mech (posições de render; 6 números, sem alocar).
      const attr = beam.geometry.getAttribute('position') as THREE.BufferAttribute;
      mech.muzzleWorldPosition(_beamTo);
      attr.setXYZ(0, _beamTo.x, _beamTo.y, _beamTo.z);
      _beamTo.copy(target.position).y += target.stats.height * 0.55;
      attr.setXYZ(1, _beamTo.x, _beamTo.y, _beamTo.z);
      attr.needsUpdate = true;
    }
  }
}
