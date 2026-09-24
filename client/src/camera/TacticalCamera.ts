import * as THREE from 'three';
import type { AimState, CameraContext, CameraMode } from './CameraMode';

const OCCLUDED_OPACITY = 0.18;

const _euler = new THREE.Euler();
const _q = new THREE.Quaternion();
const _back = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _ray = new THREE.Ray();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _muzzle = new THREE.Vector3();
const _lead = new THREE.Vector3();
const _mechCenter = new THREE.Vector3();
const _hitTmp = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

/**
 * Visão tática estilo LoL/Diablo: câmera alta em ângulo fixo, cursor livre.
 * WASD move relativo à tela, o torso gira para o cursor, clique atira no cursor.
 * Prédios entre a câmera e o Mech ficam translúcidos.
 */
export class TacticalCamera implements CameraMode {
  readonly id = 'tactical';
  readonly label = 'TÁTICA';
  readonly pointerLock = false;
  readonly fov = 45;
  readonly dashFovKick = 0;
  readonly pitchLimits: [number, number] = [-1.2, 0.85];

  /** Yaw fixo da câmera (0 = norte para cima, como no LoL). */
  private readonly camYaw = 0;
  private readonly camPitch = -0.95; // ~55° para baixo
  private distance = 42;
  private readonly focus = new THREE.Vector3();
  private initialized = false;

  constructor(private readonly ctx: CameraContext) {}

  enter(): void {
    this.initialized = false;
  }

  exit(): void {
    for (const o of this.ctx.occluders) this.setFaded(o.material, false);
    // Ao voltar para 1ª/3ª pessoa, continua olhando para onde o Mech estava virado.
    this.ctx.look.yaw = this.ctx.mech.yaw;
    this.ctx.look.pitch = -0.12;
  }

  onWheel(deltaY: number): void {
    this.distance = THREE.MathUtils.clamp(this.distance + Math.sign(deltaY) * 5, 25, 90);
  }

  update(dt: number, aim: AimState): void {
    const { camera, mech, input, physics } = this.ctx;

    // Foco segue o Mech com leve antecipação em direção ao cursor.
    _lead.subVectors(aim.point, mech.position).setY(0);
    if (_lead.lengthSq() > 64) _lead.setLength(8);
    _lead.multiplyScalar(0.25).add(mech.position);
    if (!this.initialized) {
      this.focus.copy(_lead);
      this.initialized = true;
    }
    this.focus.lerp(_lead, 1 - Math.exp(-dt * 8));

    _q.setFromEuler(_euler.set(this.camPitch, this.camYaw, 0, 'YXZ'));
    _back.set(0, 0, 1).applyQuaternion(_q);
    camera.quaternion.copy(_q);
    camera.position.copy(this.focus).addScaledVector(_back, this.distance);
    camera.updateMatrixWorld();

    // Cursor -> mundo.
    _ndc.set((input.mouseX / window.innerWidth) * 2 - 1, -(input.mouseY / window.innerHeight) * 2 + 1);
    _raycaster.setFromCamera(_ndc, camera);
    const dir = _raycaster.ray.direction;
    // Altura do canhão acima dos pés: mirando no chão, o tiro sai na horizontal.
    const muzzleHeight = mech.muzzleWorldPosition(_muzzle).y - mech.position.y;
    const hit = physics.raycast(camera.position, dir, 500, mech.collider);
    aim.target = hit?.collider ?? null;
    if (hit && hit.normal.y < 0.7) {
      aim.point.copy(hit.point); // parede/lateral: mira direto nela
    } else if (hit) {
      aim.point.copy(hit.point).setY(hit.point.y + muzzleHeight); // chão/topo
    } else {
      _plane.constant = -(mech.position.y + muzzleHeight);
      if (!_raycaster.ray.intersectPlane(_plane, aim.point)) aim.point.copy(mech.position);
    }

    const dx = aim.point.x - mech.position.x;
    const dz = aim.point.z - mech.position.z;
    if (dx * dx + dz * dz > 0.25) aim.yaw = Math.atan2(-dx, -dz);
    aim.pitch = 0;
    aim.moveYaw = this.camYaw;

    this.updateOcclusion();
  }

  /** Prédios que cortam o segmento câmera -> Mech ficam translúcidos. */
  private updateOcclusion(): void {
    const { camera, mech, occluders } = this.ctx;
    _mechCenter.copy(mech.position).setY(mech.position.y + 3);
    const dist = camera.position.distanceTo(_mechCenter);
    _ray.origin.copy(camera.position);
    _ray.direction.subVectors(_mechCenter, camera.position).normalize();
    for (const o of occluders) {
      const hit = _ray.intersectBox(o.box, _hitTmp);
      this.setFaded(o.material, !!hit && camera.position.distanceTo(hit) < dist);
    }
  }

  private setFaded(mat: THREE.MeshStandardMaterial, faded: boolean): void {
    mat.opacity = faded ? OCCLUDED_OPACITY : 1;
    mat.depthWrite = !faded;
  }
}
