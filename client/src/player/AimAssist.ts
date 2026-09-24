import * as THREE from 'three';
import type { LookState } from '../camera/CameraMode';
import { PROJECTILE_SPEED } from '../combat/ProjectileSystem';
import type { MechBase } from '../entities/MechBase';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/** Até onde a mira assistida procura inimigos (m). */
const RANGE = 140;
/** Cone em volta da mira (rad) em que o dedo fica mais lento: ~6°. */
export const FRICTION_CONE = 0.105;
/** No centro do alvo o dedo anda a esta fração da velocidade normal. */
export const FRICTION_MIN = 0.45;
/** Cone em que a mira é puxada para o inimigo (rad): ~5°. Fora dele, nada muda. */
export const PULL_CONE = 0.087;
/** Rapidez do puxão (1/s) e teto (rad/s): corrige ~1/3 do erro por décimo de segundo, no máximo ~29°/s. */
const PULL_GAIN = 4;
const PULL_MAX = 0.5;
/**
 * Rastreio: fração do movimento angular do alvo que a mira acompanha sozinha (o inimigo anda de lado e
 * a mira vai junto). Sem isso, um bot andando de lado a 20 m escapa do puxão.
 */
export const TRACK = 0.75;
/** Tempo com o tiro "certo" antes do tiro automático (s): passar a mira de raspão não dispara. */
export const AUTO_FIRE_DELAY = 0.12;
/** Onde mirar no inimigo: fração da altura (meio do torso; a mesma dos bots). */
const AIM_HEIGHT = 0.62;
/** Fração do raio do Mech que conta como acerto certo para o tiro automático (folga para a borda). */
const HIT_RADIUS = 0.85;

export interface AimError {
  /** Quanto girar para a esquerda (+) ou direita (-), em rad, entre -π e π. */
  dYaw: number;
  /** Quanto subir (+) ou descer (-), em rad. */
  dPitch: number;
  /** Distância angular até o alvo, em rad (o erro de yaw encolhe perto dos polos). */
  angle: number;
  /** Distância em metros. */
  dist: number;
}

/**
 * Erro entre a mira (yaw/pitch da câmera) e um ponto. Mesma convenção do jogo: a frente é
 * (-sin yaw, 0, -cos yaw) e yaw positivo gira para a esquerda. Escreve em `out` (G4).
 */
export function aimErrorTo(
  cam: THREE.Vector3,
  yaw: number,
  pitch: number,
  tx: number,
  ty: number,
  tz: number,
  out: AimError,
): AimError {
  const dx = tx - cam.x;
  const dy = ty - cam.y;
  const dz = tz - cam.z;
  const flat = Math.hypot(dx, dz);
  let dYaw = Math.atan2(-dx, -dz) - yaw;
  dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw)); // -π..π
  out.dYaw = dYaw;
  out.dPitch = Math.atan2(dy, flat) - pitch;
  out.angle = Math.hypot(dYaw * Math.cos(pitch), out.dPitch);
  out.dist = Math.hypot(flat, dy);
  return out;
}

/**
 * Onde o alvo vai estar quando o plasma chegar: posição + velocidade horizontal × tempo de voo.
 * Uma iteração basta (o tempo de voo muda pouco com a correção). Escreve em `out`.
 */
export function leadPoint(cam: THREE.Vector3, target: THREE.Vector3, vx: number, vz: number, speed: number, out: THREE.Vector3): THREE.Vector3 {
  const t = cam.distanceTo(target) / speed;
  return out.set(target.x + vx * t, target.y, target.z + vz * t);
}

/** Fração da velocidade do dedo: 1 fora do cone, FRICTION_MIN no centro, linear entre os dois. */
export function frictionFor(angle: number): number {
  if (angle >= FRICTION_CONE) return 1;
  return FRICTION_MIN + (1 - FRICTION_MIN) * (angle / FRICTION_CONE);
}

/** Passo do puxão num eixo (rad): proporcional ao erro, com teto por segundo. */
export function pullStep(error: number, dt: number): number {
  const max = PULL_MAX * dt;
  return Math.max(-max, Math.min(max, error * PULL_GAIN * dt));
}

const _cam = new THREE.Vector3();
const _torso = new THREE.Vector3();
const _lead = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _err: AimError = { dYaw: 0, dPitch: 0, angle: 0, dist: 0 };
const _best: AimError = { dYaw: 0, dPitch: 0, angle: 0, dist: 0 };
const _pull = { yaw: 0, pitch: 0 };

/**
 * Mira do jogador: acende sobre um inimigo (toque e mouse) e, só no toque, ajuda a mirar e atira sozinha.
 * - Fricção: perto de um inimigo o dedo fica mais lento e é fácil parar em cima dele.
 * - Puxão e rastreio: enquanto o jogador age (anda, mira ou atira), a mira escorrega de leve para o
 *   inimigo e acompanha parte do movimento dele. Parado, nada acontece: a mira nunca joga sozinha.
 * - Antecipação: o ponto de mira é onde o inimigo vai estar quando o plasma chegar (140 m/s). Sem
 *   isso, um bot andando de lado a 40 m escapa de todo tiro, e no dedo não dá para antecipar.
 * - Tiro automático: a mira está no ponto antecipado (acerto provável) há AUTO_FIRE_DELAY.
 * Custo: por quadro, um laço pelos inimigos (3 bots hoje, 7 numa sala de 8) e no máximo um raio de
 * linha de visão, só no toque. Nada é alocado.
 */
export class AimAssist {
  /** Fração a aplicar ao movimento do dedo no próximo quadro. */
  friction = 1;
  /** Mira acesa: no mouse, um inimigo sob a mira; no toque, um tiro agora acertaria (com antecipação). */
  onTarget = false;
  /** Mira acesa há tempo suficiente para o tiro automático. */
  fireReady = false;
  /**
   * Distância (m) do ponto antecipado quando a mira assistida está nele; 0 fora disso. O Game põe o
   * ponto de mira nessa distância: sem isso o raio bate na parede lá atrás e o plasma, que sai do
   * canhão (não da câmera), cruza a linha de mira com erro de paralaxe.
   */
  aimDist = 0;
  private onTargetTime = 0;
  /** Alvo do quadro anterior e a direção absoluta dele (para o rastreio). */
  private lastTarget: MechBase | null = null;
  private lastYaw = 0;
  private lastPitch = 0;

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly player: MechBase,
    private readonly enemies: readonly MechBase[],
  ) {}

  /**
   * Depois do rig.update: `underCrosshair` é o Mech sob a mira neste quadro (ou undefined).
   * `assist` = modo toque com a mira assistida ligada; `engaged` = o jogador está agindo.
   * Devolve o ajuste do olhar para o próximo quadro (objeto reaproveitado).
   */
  update(dt: number, camera: THREE.Camera, look: LookState, underCrosshair: MechBase | undefined, assist: boolean, engaged: boolean): { yaw: number; pitch: number } {
    const pull = _pull;
    pull.yaw = 0;
    pull.pitch = 0;
    this.friction = 1;
    this.aimDist = 0;
    const alive = this.player.alive;
    let on = alive && !!underCrosshair && underCrosshair !== this.player && underCrosshair.alive;

    if (assist && alive) on = this.assistStep(dt, camera, look, engaged, pull) || on;
    else this.lastTarget = null;

    this.onTarget = on;
    this.onTargetTime = on ? this.onTargetTime + dt : 0;
    this.fireReady = this.onTargetTime >= AUTO_FIRE_DELAY;
    return pull;
  }

  reset(): void {
    this.lastTarget = null;
    this.friction = 1;
    this.aimDist = 0;
    this.onTarget = this.fireReady = false;
    this.onTargetTime = 0;
  }

  /** Fricção, puxão e rastreio no ponto antecipado; devolve se um tiro agora acertaria. */
  private assistStep(dt: number, camera: THREE.Camera, look: LookState, engaged: boolean, pull: { yaw: number; pitch: number }): boolean {
    camera.getWorldPosition(_cam);
    let best: MechBase | null = null;
    for (const m of this.enemies) {
      if (!m.alive || m === this.player) continue;
      _torso.copy(m.position).y += m.stats.height * AIM_HEIGHT;
      leadPoint(_cam, _torso, m.velocity.x, m.velocity.z, PROJECTILE_SPEED, _lead);
      aimErrorTo(_cam, look.yaw, look.pitch, _lead.x, _lead.y, _lead.z, _err);
      if (_err.dist > RANGE || _err.angle >= FRICTION_CONE) continue;
      if (!best || _err.angle < _best.angle) {
        best = m;
        Object.assign(_best, _err);
      }
    }
    // Só ajuda com linha de visão até o corpo: nada de grudar em inimigo atrás da parede.
    if (best) {
      _torso.copy(best.position).y += best.stats.height * AIM_HEIGHT;
      _dir.subVectors(_torso, _cam);
      const d = _dir.length();
      _dir.divideScalar(d);
      if (this.physics.firstColliderOnRay(_cam, _dir, d, this.player.collider) !== best.collider) best = null;
    }
    if (!best) {
      this.lastTarget = null;
      return false;
    }

    this.friction = frictionFor(_best.angle);
    // Direção absoluta do ponto antecipado; o quanto ela andou desde o quadro anterior é o rastreio.
    const yawNow = look.yaw + _best.dYaw;
    const pitchNow = look.pitch + _best.dPitch;
    if (engaged && _best.angle < PULL_CONE) {
      pull.yaw = pullStep(_best.dYaw, dt);
      pull.pitch = pullStep(_best.dPitch, dt);
      if (best === this.lastTarget) {
        pull.yaw += TRACK * Math.atan2(Math.sin(yawNow - this.lastYaw), Math.cos(yawNow - this.lastYaw));
        pull.pitch += TRACK * (pitchNow - this.lastPitch);
      }
    }
    this.lastTarget = best;
    this.lastYaw = yawNow;
    this.lastPitch = pitchNow;
    // Acerto provável: a mira está dentro do corpo do alvo, no ponto antecipado.
    const hit = _best.angle < Math.atan((best.stats.radius * HIT_RADIUS) / _best.dist);
    if (hit) this.aimDist = _best.dist;
    return hit;
  }
}
