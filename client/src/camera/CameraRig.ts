import * as THREE from 'three';
import type { AimState, CameraContext, CameraMode, CameraModeId, LookState } from './CameraMode';
import { FirstPersonCamera } from './FirstPersonCamera';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { TacticalCamera } from './TacticalCamera';

const MODE_ORDER: CameraModeId[] = ['tps', 'fps', 'tactical'];

/**
 * Gerencia os modos de câmera, a sensibilidade do mouse, o camera shake e o FOV.
 * Cada modo é um módulo independente (implementa CameraMode).
 */
export class CameraRig {
  readonly look: LookState = { yaw: 0, pitch: -0.12 };
  readonly aim: AimState = { yaw: 0, pitch: 0, moveYaw: 0, point: new THREE.Vector3() };
  sensitivity = 0.0022;

  private readonly modes: Record<CameraModeId, CameraMode>;
  private current: CameraMode;
  private trauma = 0;
  private time = 0;

  constructor(private readonly ctx: Omit<CameraContext, 'look'>) {
    const full: CameraContext = { ...ctx, look: this.look };
    this.modes = {
      tps: new ThirdPersonCamera(full),
      fps: new FirstPersonCamera(full),
      tactical: new TacticalCamera(full),
    };
    this.current = this.modes.tps;
    this.current.enter?.();
  }

  get mode(): CameraMode {
    return this.current;
  }

  setMode(id: CameraModeId): void {
    if (id === this.current.id) return;
    this.current.exit?.();
    this.current = this.modes[id];
    this.current.enter?.();
    this.clampPitch();
  }

  cycle(): CameraMode {
    const i = MODE_ORDER.indexOf(this.current.id);
    this.setMode(MODE_ORDER[(i + 1) % MODE_ORDER.length]);
    return this.current;
  }

  applyMouse(dx: number, dy: number): void {
    if (!this.current.pointerLock) return;
    this.look.yaw -= dx * this.sensitivity;
    this.look.pitch -= dy * this.sensitivity;
    this.clampPitch();
  }

  onWheel(deltaY: number): void {
    this.current.onWheel?.(deltaY);
  }

  /** Trauma 0..1 (acumula). O tremor cresce com o quadrado do trauma. */
  addShake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    const { camera, mech } = this.ctx;
    this.current.update(dt, this.aim);
    mech.applyFacing(this.aim.yaw, this.aim.pitch);

    // Camera shake (barato: ruído senoidal, sem alocações).
    this.time += dt;
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma;
      const t = this.time * 40;
      camera.position.x += Math.sin(t * 1.1) * s * 0.5;
      camera.position.y += Math.sin(t * 1.7 + 1) * s * 0.4;
      camera.rotateZ(Math.sin(t * 1.3 + 2) * s * 0.03);
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
    }

    const targetFov = this.current.fov + (mech.isDashing ? this.current.dashFovKick : 0);
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
      camera.updateProjectionMatrix();
    }
  }

  private clampPitch(): void {
    const [min, max] = this.current.pitchLimits;
    this.look.pitch = THREE.MathUtils.clamp(this.look.pitch, min, max);
  }
}
