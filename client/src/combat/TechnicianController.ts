import * as THREE from 'three';
import type { MechBase, MechInput } from '../entities/MechBase';
import { damageFraction, REPAIR_RANGE } from './repair';
import { setLocalMove, turnToward, yawOf } from './steer';

/** Um alvo (o jogador) a menos disto faz o técnico fugir. Não precisa ver: ele "ouve" o combate. */
const FLEE_RADIUS = 16;
/** Fugindo, só volta a trabalhar quando o alvo estiver a esta distância (histerese). */
const SAFE_RADIUS = 24;
/** Mech com menos de 3% de avaria não chama o técnico. */
const DAMAGE_THRESHOLD = 0.03;
/** Escoltando, fica a esta distância do Mech. */
const ESCORT_RANGE = 9;
/** Reavalia qual Mech consertar a cada 0,5 s, não a cada tick. */
const PICK_INTERVAL_S = 0.5;
const TURN_RATE = 6;
/** Andando e quase parado por este tempo = encalhou: pula. */
const STUCK_S = 1;

export type TechnicianState = 'escort' | 'repair' | 'flee';

const _move = new THREE.Vector3();
const _from = new THREE.Vector3();

/**
 * Cérebro do andróide técnico (escala 1, apoio): conserta os Mechs rebeldes. Vai até o mais avariado,
 * fica perto e mantém o feixe nele (o BotSystem aplica o conserto); se um alvo chega perto, foge com
 * dash; sem nada a consertar, escolta o Mech mais próximo. Não atira: é o alvo prioritário do jogador.
 * Mesma interface do BotController (o BotSystem trata os dois igual). Determinístico e sem alocar:
 * lê posições do tick; por tick, um laço pelos aliados (3 hoje) e pelos alvos.
 */
export class TechnicianController {
  readonly input: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
  /** Técnico não atira (interface comum com o BotController). */
  readonly wantsToFire = false;
  readonly shotDir = new THREE.Vector3();
  state: TechnicianState = 'escort';
  /** Mech sendo consertado agora (dentro do alcance), ou null. O BotSystem aplica o conserto. */
  repairTarget: MechBase | null = null;
  private patient: MechBase | null = null;
  private pickTimer = 0;
  private yaw: number;
  private stuckTimer = 0;
  private readonly stuckFrom = new THREE.Vector3();

  constructor(
    readonly mech: MechBase,
    /** Mechs que ele conserta (os rebeldes de escala 2). */
    private readonly allies: readonly MechBase[],
  ) {
    this.yaw = mech.yaw;
    this.stuckFrom.copy(mech.simPosition);
  }

  /** Levou tiro: foge na hora. */
  alert(_from: MechBase): void {
    this.state = 'flee';
    this.input.dash = true;
  }

  reset(): void {
    this.state = 'escort';
    this.repairTarget = this.patient = null;
    this.pickTimer = 0;
    this.yaw = this.mech.yaw;
    this.stuckFrom.copy(this.mech.simPosition);
    this.stuckTimer = 0;
  }

  think(dt: number, targets: readonly MechBase[]): MechInput {
    const cmd = this.input;
    const dashAsked = cmd.dash;
    cmd.jump = false;
    cmd.dash = false;
    this.repairTarget = null;
    const me = this.mech.simPosition;
    if (!this.mech.alive) {
      cmd.moveX = cmd.moveZ = 0;
      return cmd;
    }

    // Ameaça: o alvo vivo mais perto.
    let threat: MechBase | null = null;
    let threatDist = Infinity;
    for (const t of targets) {
      if (!t.alive) continue;
      const d = Math.hypot(t.simPosition.x - me.x, t.simPosition.z - me.z);
      if (d < threatDist) {
        threatDist = d;
        threat = t;
      }
    }
    if (threat && threatDist < FLEE_RADIUS) {
      if (this.state !== 'flee') cmd.dash = true; // primeiro susto: dash para longe
      this.state = 'flee';
    } else if (this.state === 'flee' && threatDist > SAFE_RADIUS) {
      this.state = 'escort';
    }
    if (dashAsked) cmd.dash = true;

    // Paciente: o Mech aliado mais avariado (reavaliado a cada 0,5 s).
    this.pickTimer -= dt;
    if (this.pickTimer <= 0) {
      this.pickTimer = PICK_INTERVAL_S;
      this.patient = null;
      let worst = DAMAGE_THRESHOLD;
      for (const a of this.allies) {
        if (!a.alive) continue;
        const f = damageFraction(a.modules, a.stats.maxModuleHealth);
        if (f > worst) {
          worst = f;
          this.patient = a;
        }
      }
    }

    let faceYaw = this.yaw;
    _move.set(0, 0, 0);
    if (this.state === 'flee' && threat) {
      _move.set(me.x - threat.simPosition.x, 0, me.z - threat.simPosition.z).normalize();
      faceYaw = yawOf(_move.x, _move.z);
    } else {
      const goal = this.patient ?? this.nearestAlly();
      if (goal) {
        const gp = goal.simPosition;
        _from.set(gp.x - me.x, 0, gp.z - me.z);
        const dist = _from.length();
        const keep = this.patient ? REPAIR_RANGE * 0.6 : ESCORT_RANGE;
        if (dist > keep) _move.copy(_from).divideScalar(dist);
        faceYaw = yawOf(_from.x, _from.z);
        this.state = this.patient ? 'repair' : 'escort';
        if (this.patient && dist <= REPAIR_RANGE && goal.alive) this.repairTarget = goal;
      }
    }

    this.unstick(dt, cmd);
    this.yaw = turnToward(this.yaw, faceYaw, TURN_RATE * dt);
    this.mech.applyFacing(this.yaw, 0);
    setLocalMove(cmd, _move.x, _move.z, this.yaw);
    return cmd;
  }

  private nearestAlly(): MechBase | null {
    const me = this.mech.simPosition;
    let best: MechBase | null = null;
    let bestDist = Infinity;
    for (const a of this.allies) {
      if (!a.alive) continue;
      const d = Math.hypot(a.simPosition.x - me.x, a.simPosition.z - me.z);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return best;
  }

  /** Querendo andar e quase parado por STUCK_S: pula o obstáculo. */
  private unstick(dt: number, cmd: MechInput): void {
    const me = this.mech.simPosition;
    const moving = _move.lengthSq() > 0.01;
    this.stuckTimer += dt;
    if (this.stuckTimer < STUCK_S) return;
    if (moving && Math.hypot(me.x - this.stuckFrom.x, me.z - this.stuckFrom.z) < 1) cmd.jump = true;
    this.stuckTimer = 0;
    this.stuckFrom.copy(me);
  }
}
