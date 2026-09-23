import * as THREE from 'three';
import type { AimState, CameraContext, CameraMode } from './CameraMode';
import { aimFromCamera } from './aim';

const _euler = new THREE.Euler();
const _fwd = new THREE.Vector3();

/** Cockpit: câmera na cabeça do Mech (cabeça oculta, braços/canhão visíveis). */
export class FirstPersonCamera implements CameraMode {
  readonly id = 'fps';
  readonly label = '1ª PESSOA';
  readonly pointerLock = true;
  readonly fov = 85;
  readonly dashFovKick = 15;
  readonly pitchLimits: [number, number] = [-1.35, 1.35];

  constructor(private readonly ctx: CameraContext) {}

  enter(): void {
    this.ctx.mech.setHeadVisible(false);
  }

  exit(): void {
    this.ctx.mech.setHeadVisible(true);
  }

  update(_dt: number, aim: AimState): void {
    const { camera, look, mech } = this.ctx;
    // A orientação do torso precisa estar aplicada antes de ler a posição da cabeça.
    mech.applyFacing(look.yaw, look.pitch);
    mech.root.updateMatrixWorld(true);

    camera.quaternion.setFromEuler(_euler.set(look.pitch, look.yaw, 0, 'YXZ'));
    _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    mech.headWorldPosition(camera.position);
    // À frente do casco: o torso não tapa a visão olhando reto, só ao olhar para baixo.
    camera.position.y += 0.3;
    camera.position.addScaledVector(_fwd, 1.1);

    aimFromCamera(this.ctx, aim);
  }
}
