import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import type { Difficulty } from '../core/Settings';
import type { MechBase, MechInput } from '../entities/MechBase';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { PROJECTILE_SPEED } from './ProjectileSystem';
import { setLocalMove, turnToward, wrapAngle, yawOf } from './steer';

export type BotState = 'patrol' | 'chase' | 'attack' | 'retreat';

/** Como o bot pilota: tempo de reação, mira e ritmo de tiro. Um conjunto por nível de dificuldade. */
export interface BotSkill {
  /** Segundos entre ver o alvo e reagir (começar a caçar e atirar). */
  reactionS: number;
  /** Erro máximo da mira em radianos, sorteado a cada tiro em yaw e em pitch. */
  aimErrorRad: number;
  /** 0 = mira onde o alvo está; 1 = antecipa todo o movimento dele. */
  leadFactor: number;
  /** Velocidade de giro do torso (rad/s): o bot não vira instantaneamente. */
  turnRate: number;
  burstShots: number;
  burstPauseS: number;
}

/** Aprovado pelo dono jogando ("grau de dificuldade considerável, está bom assim", 2026-09-24). */
export const BOT_SKILL_NORMAL: BotSkill = {
  reactionS: 0.5,
  aimErrorRad: 0.045,
  leadFactor: 0.5,
  turnRate: 3.0,
  burstShots: 4,
  burstPauseS: 0.9,
};

export const BOT_SKILLS: Record<Difficulty, BotSkill> = {
  facil: { reactionS: 0.9, aimErrorRad: 0.085, leadFactor: 0.15, turnRate: 2.2, burstShots: 3, burstPauseS: 1.4 },
  normal: BOT_SKILL_NORMAL,
  dificil: { reactionS: 0.3, aimErrorRad: 0.028, leadFactor: 0.85, turnRate: 4.0, burstShots: 5, burstPauseS: 0.7 },
};

const VISION_RANGE = 90;
/** Em patrulha só vê à frente (±110°); mais perto que isto, "ouve" em qualquer direção. */
const VISION_HALF_ANGLE = 1.9;
const HEARING_RADIUS = 14;
/** Linha de visão a 10 Hz, não a cada tick: 1 raio por alvo a cada 0,1 s. */
const LOS_INTERVAL_S = 0.1;
/**
 * Jeito de lutar de cada tipo de robô (além da dificuldade): a que distância ataca, quão perto aceita
 * ficar, de quanto em quanto tempo muda o lado do zigue-zague e a chance de desviar com dash ao mudar.
 */
export interface BotProfile {
  attackRange: number;
  keepMinRange: number;
  strafeMinS: number;
  strafeMaxS: number;
  dodgeChance: number;
  /** Multiplica o erro de mira da dificuldade (1 = como está; maior = mira mais solta). */
  aimErrorScale: number;
}

/** Mech (escala 2): ataca de longe, anda de lado devagar, não desvia com dash. */
export const MECH_PROFILE: BotProfile = { attackRange: 38, keepMinRange: 14, strafeMinS: 1, strafeMaxS: 2.2, dodgeChance: 0, aimErrorScale: 1 };
/** Andróide (escala 1): chega perto, muda de lado a toda hora e desvia com dash; difícil de acertar, mas mira mal (chato, não perigoso). */
export const ANDROID_PROFILE: BotProfile = { attackRange: 22, keepMinRange: 7, strafeMinS: 0.35, strafeMaxS: 0.9, dodgeChance: 0.35, aimErrorScale: 2.2 };
const FIRE_RANGE = 75;
/** Só atira com o torso apontado para o alvo dentro deste ângulo. */
const FIRE_CONE_RAD = 0.12;
const LOSE_TARGET_S = 2.5;
const WAYPOINT_REACHED = 4;
const RETREAT_TORSO_FRACTION = 0.35;
const RETREAT_S = 3;
const RETREAT_COOLDOWN_S = 8;
const STUCK_CHECK_S = 0.5;
const STUCK_DIST = 0.8;
const SIDESTEP_S = 0.8;
/** Olhos na cabeça; mira no meio do torso (zonas de dano em combat/damage.ts). */
const EYE_HEIGHT = 0.85;
const AIM_HEIGHT = 0.62;

const _eye = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _move = new THREE.Vector3();
const _muzzle = new THREE.Vector3();


/**
 * IA de um Mech inimigo. Produz o mesmo `MechInput` que o teclado do jogador, e um pedido de
 * tiro; quem executa é o `BotSystem`. Tudo sai da simulação (posições do tick, RNG com semente),
 * nunca do render, então o mesmo cenário dá sempre o mesmo resultado (G2) e o servidor poderá
 * rodar os mesmos bots.
 * Custo por bot por tick: algumas contas de vetor; 1 raycast por alvo a 10 Hz.
 */
export class BotController {
  readonly input: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
  /** Direção do tiro deste tick, válida quando `wantsToFire`. */
  readonly shotDir = new THREE.Vector3();
  wantsToFire = false;
  state: BotState = 'patrol';

  private readonly rand: () => number;
  private target: MechBase | null = null;
  private targetVisible = false;
  /** Amostras de linha de visão perdidas em seguida. */
  private losMisses = 0;
  private visibleFor = 0;
  private sinceSeen = Infinity;
  private readonly lastSeen = new THREE.Vector3();
  private losTimer = 0;
  private waypoint = 0;
  private yaw: number;
  private pitch = 0;
  private strafeSign = 1;
  private strafeTimer = 0;
  private retreatTimer = 0;
  private retreatCooldown = 0;
  private fireCooldown = 0;
  private burstLeft: number;
  private stuckTimer = STUCK_CHECK_S;
  private readonly stuckFrom = new THREE.Vector3();
  private sidestepTimer = 0;
  private sidestepSign = 1;

  constructor(
    readonly mech: MechBase,
    private readonly physics: PhysicsWorld,
    private readonly waypoints: readonly THREE.Vector3[],
    seed: number,
    /** Pode mudar no meio da partida (tela de configurações): vale a partir do próximo tick. */
    public skill: BotSkill = BOT_SKILL_NORMAL,
    readonly profile: BotProfile = MECH_PROFILE,
  ) {
    this.rand = mulberry32(seed);
    this.yaw = mech.yaw;
    this.burstLeft = skill.burstShots;
    this.waypoint = Math.floor(this.rand() * waypoints.length);
    this.stuckFrom.copy(mech.simPosition);
  }

  /** Levou tiro de alguém que não estava vendo: vira e vai atrás. */
  alert(from: MechBase): void {
    if (this.state !== 'patrol') return;
    this.target = from;
    this.lastSeen.copy(from.simPosition);
    this.sinceSeen = 0;
    this.state = 'chase';
  }

  /** Volta ao estado inicial (ex.: depois de renascer). */
  reset(): void {
    this.state = 'patrol';
    this.target = null;
    this.targetVisible = false;
    this.visibleFor = 0;
    this.sinceSeen = Infinity;
    this.burstLeft = this.skill.burstShots;
    this.fireCooldown = 0;
    this.retreatTimer = 0;
    this.sidestepTimer = 0;
    this.yaw = this.mech.yaw;
    this.stuckFrom.copy(this.mech.simPosition);
    this.stuckTimer = STUCK_CHECK_S;
  }

  /** Um tick fixo: percebe, decide, monta o input e (talvez) um tiro. */
  think(dt: number, targets: readonly MechBase[]): MechInput {
    const cmd = this.input;
    this.wantsToFire = false;
    cmd.jump = false;
    cmd.dash = false;
    if (!this.mech.alive) {
      cmd.moveX = cmd.moveZ = 0;
      return cmd;
    }

    this.perceive(dt, targets);
    this.decide(dt);
    this.steer(dt);
    this.aimAndFire(dt);
    return cmd;
  }

  private perceive(dt: number, targets: readonly MechBase[]): void {
    if (this.target && !this.target.alive) {
      this.target = null;
      this.targetVisible = false;
    }
    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.losTimer = LOS_INTERVAL_S;
      let best: MechBase | null = null;
      let bestDist = Infinity;
      for (const t of targets) {
        if (t === this.mech || !t.alive) continue;
        const d = this.visibleDistance(t);
        if (d === null) continue;
        // Mantém o alvo atual enquanto ele estiver visível, senão pega o mais perto.
        if (t === this.target) {
          best = t;
          break;
        }
        if (d < bestDist) {
          bestDist = d;
          best = t;
        }
      }
      if (best) this.target = best;
      // Um raio perdido só não basta para esquecer o alvo: o Rapier às vezes deixa um raio passar
      // direto por uma cápsula (erro numérico, 1 amostra). Esquece depois de 2 falhas seguidas (0,2 s).
      this.losMisses = best ? 0 : this.losMisses + 1;
      this.targetVisible = best !== null || (this.targetVisible && this.losMisses < 2 && !!this.target?.alive);
    }
    if (this.targetVisible && this.target) {
      this.visibleFor += dt;
      this.sinceSeen = 0;
      this.lastSeen.copy(this.target.simPosition);
    } else {
      this.visibleFor = 0;
      this.sinceSeen += dt;
    }
  }

  /** Distância até `t` se houver linha de visão (e ele estiver no campo de visão), senão null. */
  private visibleDistance(t: MechBase): number | null {
    const me = this.mech.simPosition;
    const h = this.mech.stats.height;
    _eye.set(me.x, me.y + h * EYE_HEIGHT, me.z);
    const tp = t.simPosition;
    _aim.set(tp.x, tp.y + t.stats.height * AIM_HEIGHT, tp.z);
    _dir.subVectors(_aim, _eye);
    const dist = _dir.length();
    if (dist > VISION_RANGE) return null;
    if (this.state === 'patrol' && dist > HEARING_RADIUS) {
      const off = Math.abs(wrapAngle(yawOf(_dir.x, _dir.z) - this.yaw));
      if (off > VISION_HALF_ANGLE) return null;
    }
    _dir.divideScalar(dist);
    const first = this.physics.firstColliderOnRay(_eye, _dir, dist + 1, this.mech.collider);
    return first?.handle === t.collider.handle ? dist : null;
  }

  private decide(dt: number): void {
    const m = this.mech;
    this.retreatCooldown = Math.max(0, this.retreatCooldown - dt);
    const reacted = this.targetVisible && this.visibleFor >= this.skill.reactionS;
    const dist = this.target ? this.flatDistance(this.target.simPosition) : Infinity;
    const torso = m.modules.torso / m.stats.maxModuleHealth.torso;

    if (
      this.state !== 'retreat' &&
      reacted &&
      torso < RETREAT_TORSO_FRACTION &&
      this.retreatCooldown <= 0 &&
      m.mobility > 0
    ) {
      this.state = 'retreat';
      this.retreatTimer = RETREAT_S;
      this.retreatCooldown = RETREAT_COOLDOWN_S;
      this.input.dash = true;
      return;
    }

    switch (this.state) {
      case 'patrol':
        if (reacted) this.state = 'chase';
        break;
      case 'chase':
        if (!this.target) this.state = 'patrol';
        else if (reacted && dist <= this.profile.attackRange) this.state = 'attack';
        else if (this.sinceSeen > LOSE_TARGET_S && this.flatDistance(this.lastSeen) < WAYPOINT_REACHED) {
          // Chegou onde viu o alvo pela última vez e ele não está lá: desiste.
          this.target = null;
          this.state = 'patrol';
        }
        break;
      case 'attack':
        if (!this.targetVisible || dist > this.profile.attackRange + 8) this.state = 'chase';
        break;
      case 'retreat':
        this.retreatTimer -= dt;
        if (this.retreatTimer <= 0) this.state = this.target ? 'chase' : 'patrol';
        break;
    }
  }

  /** Para onde andar (direção no mundo) e para onde olhar; depois converte em `MechInput`. */
  private steer(dt: number): void {
    const me = this.mech.simPosition;
    let faceYaw = this.yaw;
    _move.set(0, 0, 0);

    const towards = (p: Readonly<THREE.Vector3>, sign = 1): void => {
      _move.set(p.x - me.x, 0, p.z - me.z);
      if (_move.lengthSq() > 1e-6) _move.normalize().multiplyScalar(sign);
    };

    switch (this.state) {
      case 'patrol': {
        const wp = this.waypoints[this.waypoint]!;
        if (this.flatDistance(wp) < WAYPOINT_REACHED) this.nextWaypoint();
        towards(this.waypoints[this.waypoint]!);
        if (_move.lengthSq() > 1e-6) faceYaw = yawOf(_move.x, _move.z);
        break;
      }
      case 'chase': {
        const goal = this.targetVisible && this.target ? this.target.simPosition : this.lastSeen;
        towards(goal);
        faceYaw = this.targetVisible && this.target ? this.yawTo(this.target.simPosition) : yawOf(_move.x, _move.z);
        break;
      }
      case 'attack': {
        if (!this.target) break;
        const t = this.target.simPosition;
        faceYaw = this.yawTo(t);
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          const p = this.profile;
          this.strafeSign = this.rand() < 0.5 ? -1 : 1;
          this.strafeTimer = p.strafeMinS + this.rand() * (p.strafeMaxS - p.strafeMinS);
          // Desvio com dash para o lado novo. Só quem tem a chance sorteia (o RNG dos Mechs não muda).
          if (p.dodgeChance > 0 && this.rand() < p.dodgeChance && this.mech.mobility > 0) this.input.dash = true;
        }
        // Anda de lado (direita do torso = (cos, -sin)) e recua (trás = (sin, cos)) se estiver perto demais.
        _move.set(Math.cos(faceYaw) * this.strafeSign, 0, -Math.sin(faceYaw) * this.strafeSign);
        if (this.flatDistance(t) < this.profile.keepMinRange) {
          _move.x += Math.sin(faceYaw);
          _move.z += Math.cos(faceYaw);
        }
        break;
      }
      case 'retreat': {
        const from = this.target ? this.target.simPosition : this.lastSeen;
        towards(from, -1);
        faceYaw = this.targetVisible && this.target ? this.yawTo(from) : yawOf(_move.x, _move.z);
        break;
      }
    }

    this.unstick(dt, faceYaw);

    this.yaw = turnToward(this.yaw, faceYaw, this.skill.turnRate * dt);

    setLocalMove(this.input, _move.x, _move.z, this.yaw);
  }

  /** Encalhou (andando e quase parado)? Na patrulha troca de destino; em combate dá um passo de lado e pula. */
  private unstick(dt: number, faceYaw: number): void {
    const me = this.mech.simPosition;
    if (this.sidestepTimer > 0) {
      this.sidestepTimer -= dt;
      _move.x += Math.cos(faceYaw) * this.sidestepSign;
      _move.z -= Math.sin(faceYaw) * this.sidestepSign;
    }
    this.stuckTimer -= dt;
    if (this.stuckTimer > 0) return;
    this.stuckTimer = STUCK_CHECK_S;
    const wantsToMove = _move.lengthSq() > 0.09 && this.mech.mobility > 0;
    const moved = Math.hypot(me.x - this.stuckFrom.x, me.z - this.stuckFrom.z);
    this.stuckFrom.copy(me);
    if (!wantsToMove || moved >= STUCK_DIST) return;
    if (this.state === 'patrol') {
      this.nextWaypoint();
    } else {
      this.sidestepTimer = SIDESTEP_S;
      this.sidestepSign = this.rand() < 0.5 ? -1 : 1;
      this.input.jump = true;
    }
  }

  private aimAndFire(dt: number): void {
    const m = this.mech;
    this.fireCooldown -= dt;
    const t = this.target;
    const engaged = this.state === 'chase' || this.state === 'attack' || this.state === 'retreat';
    if (!t || !engaged || !this.targetVisible || this.visibleFor < this.skill.reactionS) {
      m.applyFacing(this.yaw, 0);
      return;
    }

    // Mira no torso, antecipando parte do movimento do alvo (tempo de voo do plasma).
    const tp = t.simPosition;
    const dist = this.flatDistance(tp);
    const flight = dist / PROJECTILE_SPEED;
    _aim
      .set(tp.x, tp.y + t.stats.height * AIM_HEIGHT, tp.z)
      .addScaledVector(t.velocity, flight * this.skill.leadFactor);
    m.applyFacing(this.yaw, this.pitch);
    m.simMuzzle(_muzzle);
    _dir.subVectors(_aim, _muzzle);
    this.pitch = Math.atan2(_dir.y, Math.hypot(_dir.x, _dir.z));

    const facingOff = Math.abs(wrapAngle(this.yawTo(tp) - this.yaw));
    if (dist > FIRE_RANGE || facingOff > FIRE_CONE_RAD || this.fireCooldown > 0 || !m.canFirePrimary) return;

    // Erro de mira: gira a direção um pouco em yaw e em pitch.
    _dir.normalize();
    const err = this.skill.aimErrorRad * this.profile.aimErrorScale;
    const e = (this.rand() * 2 - 1) * err;
    const ce = Math.cos(e);
    const se = Math.sin(e);
    const x = _dir.x * ce + _dir.z * se;
    _dir.z = -_dir.x * se + _dir.z * ce;
    _dir.x = x;
    _dir.y += (this.rand() * 2 - 1) * err;
    this.shotDir.copy(_dir.normalize());
    this.wantsToFire = true;

    this.burstLeft--;
    if (this.burstLeft > 0) {
      this.fireCooldown = m.stats.fireInterval;
    } else {
      this.burstLeft = this.skill.burstShots;
      this.fireCooldown = this.skill.burstPauseS * (0.8 + this.rand() * 0.4);
    }
  }

  private nextWaypoint(): void {
    if (this.waypoints.length < 2) return;
    const step = 1 + Math.floor(this.rand() * (this.waypoints.length - 1));
    this.waypoint = (this.waypoint + step) % this.waypoints.length;
  }

  private yawTo(p: Readonly<THREE.Vector3>): number {
    const me = this.mech.simPosition;
    return yawOf(p.x - me.x, p.z - me.z);
  }

  private flatDistance(p: Readonly<THREE.Vector3>): number {
    const me = this.mech.simPosition;
    return Math.hypot(p.x - me.x, p.z - me.z);
  }
}
