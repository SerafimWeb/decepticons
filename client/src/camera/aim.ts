import * as THREE from 'three';
import type { AimState, CameraContext } from './CameraMode';

const _fwd = new THREE.Vector3();
const AIM_RANGE = 400;

/** Mira pelo centro da tela (1ª e 3ª pessoa): raycast a partir da câmera. */
export function aimFromCamera(ctx: CameraContext, aim: AimState): void {
  const { camera, look, physics, mech } = ctx;
  aim.yaw = look.yaw;
  aim.pitch = look.pitch;
  aim.moveYaw = look.yaw;

  _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const hit = physics.raycast(camera.position, _fwd, AIM_RANGE, mech.collider);
  if (hit) aim.point.copy(hit.point);
  else aim.point.copy(camera.position).addScaledVector(_fwd, AIM_RANGE);
  aim.target = hit?.collider ?? null;
}
