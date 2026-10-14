import * as THREE from 'three';
import type { AimState, CameraContext, CameraMode } from './CameraMode';
import { aimFromCamera } from './aim';

const _euler = new THREE.Euler();
const _pivot = new THREE.Vector3();
const _dir = new THREE.Vector3();
const RECOVERY_RATE = 12; // volta 90% da distância em ~0,19 s, independente do FPS

/** Over-the-shoulder. Puxa a câmera para perto se houver algo no caminho. */
export class ThirdPersonCamera implements CameraMode {
  readonly id = 'tps';
  readonly label = '3ª PESSOA';
  readonly pointerLock = true;
  readonly fov = 75;
  readonly dashFovKick = 12;
  readonly pitchLimits: [number, number] = [-1.2, 0.85];

  /** Ombro e distância para o Vector-09 (5,3 m); robôs menores usam a mesma câmera em escala. */
  private readonly offset = new THREE.Vector3(1.8, 0.6, 7.5);
  private readonly pivotHeight = 4.4;
  private zoom = 1;
  private distance = -1;

  constructor(private readonly ctx: CameraContext) {}

  enter(): void {
    this.distance = -1;
  }

  onWheel(deltaY: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom + Math.sign(deltaY) * 0.12, 0.6, 1.8);
  }

  update(dt: number, aim: AimState): void {
    const { camera, look, mech, physics } = this.ctx;
    const q = camera.quaternion.setFromEuler(_euler.set(look.pitch, look.yaw, 0, 'YXZ'));

    // Na escala do robô: num andróide de 1,6 m a câmera fica na altura de uma pessoa, e o Mech rebelde
    // aparece gigante (dono: "a impressão de que estou combatendo um Mech bem maior"). Mínimo de 45%
    // para o andróide não ficar colado na câmera.
    const scale = Math.max(0.45, mech.stats.height / 5.3);
    _pivot.copy(mech.position);
    _pivot.y += this.pivotHeight * (mech.stats.height / 5.3);
    _dir.copy(this.offset).multiplyScalar(this.zoom * scale).applyQuaternion(q);
    const len = _dir.length();
    _dir.divideScalar(len);

    const hit = physics.raycast(_pivot, _dir, len + 0.4, mech.collider);
    const limit = hit ? Math.max(0.5, hit.distance - 0.4) : len;
    // Obstáculo novo recolhe a câmera na hora; sair da cobertura recupera a distância aos poucos.
    // Só o braço da câmera é amortecido: posição do piloto e rotação do mouse continuam imediatas.
    if (this.distance < 0 || limit <= this.distance || limit - this.distance < 0.0001) this.distance = limit;
    else this.distance += (limit - this.distance) * (1 - Math.exp(-RECOVERY_RATE * Math.max(0, dt)));
    camera.position.copy(_pivot).addScaledVector(_dir, this.distance);

    aimFromCamera(this.ctx, aim);
  }
}
