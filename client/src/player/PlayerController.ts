import * as THREE from 'three';
import type { CameraRig } from '../camera/CameraRig';
import type { ProjectileSystem } from '../combat/ProjectileSystem';
import type { InputManager } from '../core/InputManager';
import type { MechBase, MechInput } from '../entities/MechBase';
import type { ParticleSystem } from '../fx/ParticleSystem';

const MUZZLE_COLOR = new THREE.Color(0.6, 2.5, 3.5);
const AIM_RANGE = 400;

const _muzzle = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();

/**
 * Liga teclado/câmera ao Mech local. Eventos de borda (pulo, dash) ficam
 * "travados" até o próximo tick fixo, para não se perderem em monitores >60 Hz.
 */
export class PlayerController {
  active = false;

  private jumpQueued = false;
  private dashQueued = false;
  private fireCooldown = 0;
  private readonly cmd: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };

  constructor(
    private readonly mech: MechBase,
    private readonly input: InputManager,
    private readonly rig: CameraRig,
    private readonly projectiles: ProjectileSystem,
    private readonly particles: ParticleSystem,
  ) {}

  /** Taxa do render: captura eventos de borda. */
  collect(): void {
    if (!this.active) return;
    if (this.input.wasPressed('Space')) this.jumpQueued = true;
    if (this.input.wasPressed('ShiftLeft') || this.input.wasPressed('ShiftRight')) this.dashQueued = true;
  }

  /** Taxa fixa (60 Hz): monta o comando e simula. */
  fixedUpdate(dt: number): void {
    const a = this.active;
    const aim = this.rig.aim;
    const cmd = this.cmd;
    cmd.moveX = a ? this.input.axis('KeyD', 'KeyA') : 0;
    cmd.moveZ = a ? this.input.axis('KeyW', 'KeyS') : 0;
    cmd.moveYaw = aim.moveYaw;
    cmd.yaw = aim.yaw;
    cmd.jump = this.jumpQueued;
    cmd.dash = this.dashQueued;
    this.jumpQueued = this.dashQueued = false;

    this.mech.fixedUpdate(cmd, dt);

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (a && this.input.mouseDown && this.fireCooldown <= 0 && this.mech.canFirePrimary) {
      this.fire();
      this.fireCooldown = this.mech.stats.fireInterval;
    }
  }

  private fire(): void {
    const { mech, rig } = this;
    const { yaw, pitch, point } = rig.aim;
    mech.muzzleWorldPosition(_muzzle);
    _fwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

    // Se o alvo estiver "atrás" do canhão (ex.: mirando o chão perto do pé), atira reto.
    _to.copy(point);
    if (_dir.subVectors(_to, _muzzle).dot(_fwd) < 3) _to.copy(_muzzle).addScaledVector(_fwd, AIM_RANGE);
    _dir.subVectors(_to, _muzzle).normalize();

    this.projectiles.fire(_muzzle, _dir, mech.collider);
    this.particles.burst(_muzzle, _dir, { count: 10, color: MUZZLE_COLOR, speed: 10, life: 0.15, spread: 0.5, gravity: 0 });
    mech.onFire();
  }
}
