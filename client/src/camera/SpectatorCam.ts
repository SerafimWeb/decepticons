import * as THREE from 'three';
import type { Drone } from '../combat/DroneSystem';
import type { MechBase } from '../entities/MechBase';
import type { Occluder } from '../environment/Arena';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

export interface FixedCameraPoint {
  readonly id: string;
  readonly label: string;
  readonly position: THREE.Vector3;
  readonly lookAt: THREE.Vector3;
}

export const DEFAULT_FIXED_CAMERAS: readonly FixedCameraPoint[] = Object.freeze([
  {
    id: 'serafim_topo',
    label: 'TOPO DO PRÉDIO SERAFIM',
    position: new THREE.Vector3(76, 58.5, 38),
    lookAt: new THREE.Vector3(0, 4, 0),
  },
  {
    id: 'banco_porta',
    label: 'PORTA DO BANCO VORCARIS',
    position: new THREE.Vector3(-28, 4.5, -23),
    lookAt: new THREE.Vector3(-10, 3, -15),
  },
  {
    id: 'predio_rosa',
    label: 'ESQUINA PRÉDIO ROSA',
    position: new THREE.Vector3(24, 6, -2),
    lookAt: new THREE.Vector3(0, 3, 0),
  },
  {
    id: 'predio_fluo',
    label: 'MIRANTE NORTE (PRÉDIO FLUO)',
    position: new THREE.Vector3(4, 25, -60),
    lookAt: new THREE.Vector3(0, 4, 0),
  },
  {
    id: 'plataforma',
    label: 'PLATAFORMA ELEVADA',
    position: new THREE.Vector3(-46, 8.5, 32),
    lookAt: new THREE.Vector3(0, 3, 0),
  },
]);

export type SpectatorTargetKind = 'fixed' | 'drone' | 'mech';

export interface SpectatorTargetView {
  readonly kind: SpectatorTargetKind;
  readonly id: string;
  readonly label: string;
  readonly mech?: MechBase;
  readonly fixed?: FixedCameraPoint;
  readonly drone?: Drone;
}

const FOLLOW_SMOOTHING = 8;
const RELEASE_S = 0.35;
const WALL_MARGIN = 0.35;
const OCCLUDED_OPACITY = 0.16;

type SpectatorState = 'idle' | 'spectating' | 'releasing';

/**
 * Câmera de espectador independente: alterna entre visão de câmeras de vigilância fixas,
 * drones de apoio da base Serafim e Mechs de combate na Arena.
 * Zero alocações por quadro (G1/G4). Suporta proteção contra paredes e prédios oclusores.
 */
export class SpectatorCam {
  private state: SpectatorState = 'idle';
  private targetIndex = 0;
  private releaseElapsed = 0;

  private readonly fixedCameras: readonly FixedCameraPoint[];
  private readonly getDrones: () => readonly Drone[];
  private readonly getDynamicMechs: () => readonly MechBase[];
  private readonly getMechName?: (mech: MechBase) => string;

  // Buffers matemáticos pré-alocados para cálculo de frame (zero 'new' por tick/frame)
  private readonly viewPosition = new THREE.Vector3();
  private readonly viewQuaternion = new THREE.Quaternion();
  private readonly desiredPosition = new THREE.Vector3();
  private readonly desiredQuaternion = new THREE.Quaternion();
  private readonly lookAt = new THREE.Vector3();
  private readonly targetFocus = new THREE.Vector3();
  private readonly ray = new THREE.Vector3();
  private readonly releasePosition = new THREE.Vector3();
  private readonly releaseQuaternion = new THREE.Quaternion();
  private readonly normalPosition = new THREE.Vector3();
  private readonly normalQuaternion = new THREE.Quaternion();
  private readonly aimCamera = new THREE.PerspectiveCamera();
  private readonly occlusionRay = new THREE.Ray();
  private readonly occlusionHit = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly physics: PhysicsWorld,
    private readonly occluders: readonly Occluder[] = [],
    options?: {
      fixedCameras?: readonly FixedCameraPoint[];
      getDrones?: () => readonly Drone[];
      getDynamicMechs?: () => readonly MechBase[];
      getMechName?: (mech: MechBase) => string;
    },
  ) {
    this.fixedCameras = options?.fixedCameras ?? DEFAULT_FIXED_CAMERAS;
    this.getDrones = options?.getDrones ?? (() => []);
    this.getDynamicMechs = options?.getDynamicMechs ?? (() => []);
    this.getMechName = options?.getMechName;
  }

  get active(): boolean {
    return this.state !== 'idle';
  }

  get overridesRig(): boolean {
    return this.state === 'spectating';
  }

  get isSpectating(): boolean {
    return this.state === 'spectating';
  }

  get currentIndex(): number {
    return this.targetIndex;
  }

  /** Lista todos os alvos disponíveis atualmente (câmeras fixas + drones + mechs vivos). */
  getTargets(): SpectatorTargetView[] {
    const list: SpectatorTargetView[] = [];
    for (const fix of this.fixedCameras) {
      list.push({ kind: 'fixed', id: fix.id, label: fix.label, fixed: fix });
    }
    const drones = this.getDrones();
    for (let i = 0; i < drones.length; i++) {
      const d = drones[i]!;
      if (d.state === 'abatido') continue;
      const roleName = d.role.toUpperCase();
      const stateName = d.state === 'pouso' ? 'POUSADO' : 'EM VOO';
      list.push({
        kind: 'drone',
        id: `drone_${d.index}`,
        label: `DRONE SERAFIM (${roleName}) [${stateName}]`,
        drone: d,
      });
    }
    const mechs = this.getDynamicMechs();
    for (let i = 0; i < mechs.length; i++) {
      const m = mechs[i]!;
      if (!m.alive) continue;
      const name = this.getMechName ? this.getMechName(m) : `PILOTO #${i + 1}`;
      list.push({ kind: 'mech', id: `mech_${i}`, label: name, mech: m });
    }
    return list;
  }

  /** Rótulo do alvo atual para exibição na UI / HUD. */
  get currentTargetLabel(): string {
    if (this.state === 'idle') return '';
    const targets = this.getTargets();
    if (targets.length === 0) return 'SEM ALVOS DISPONÍVEIS';
    const clamped = Math.max(0, Math.min(this.targetIndex, targets.length - 1));
    return targets[clamped]?.label ?? 'CÂMERA DE ESPECTADOR';
  }

  /** Inicia o modo de espectador. */
  start(initialIndex = 0): void {
    const targets = this.getTargets();
    if (targets.length === 0) return;
    this.targetIndex = THREE.MathUtils.clamp(initialIndex, 0, targets.length - 1);
    this.viewPosition.copy(this.camera.position);
    this.viewQuaternion.copy(this.camera.quaternion);
    this.releaseElapsed = 0;
    this.state = 'spectating';
  }

  /** Alterna para o próximo alvo. */
  nextTarget(): void {
    const targets = this.getTargets();
    if (targets.length <= 1) return;
    this.targetIndex = (this.targetIndex + 1) % targets.length;
  }

  /** Alterna para o alvo anterior. */
  prevTarget(): void {
    const targets = this.getTargets();
    if (targets.length <= 1) return;
    this.targetIndex = (this.targetIndex - 1 + targets.length) % targets.length;
  }

  /** Seleciona um alvo específico por índice. */
  setTarget(index: number): void {
    const targets = this.getTargets();
    if (targets.length === 0) return;
    this.targetIndex = THREE.MathUtils.clamp(index, 0, targets.length - 1);
  }

  /** Cancela imediatamente o modo espectador e restaura opacidade dos prédios. */
  cancel(): void {
    this.state = 'idle';
    this.restoreOccluders();
  }

  /** Libera o modo espectador com interpolação suave até a câmera normal do CameraRig. */
  release(): void {
    if (this.state !== 'spectating') return;
    this.releasePosition.copy(this.viewPosition);
    this.releaseQuaternion.copy(this.viewQuaternion);
    this.releaseElapsed = 0;
    this.state = 'releasing';
  }

  /** Atualização chamada na taxa de render. */
  update(dt: number): void {
    if (this.state === 'idle') return;

    if (this.state === 'releasing') {
      this.updateRelease(dt);
      return;
    }

    const targets = this.getTargets();
    if (targets.length === 0) {
      this.cancel();
      return;
    }

    // Ajusta o índice caso algum alvo tenha desaparecido (ex.: mech ou drone abatido)
    if (this.targetIndex >= targets.length) {
      this.targetIndex = 0;
    }

    const current = targets[this.targetIndex]!;
    if (current.kind === 'fixed' && current.fixed) {
      this.updateFixed(current.fixed, dt);
    } else if (current.kind === 'drone' && current.drone) {
      this.updateDrone(current.drone, dt);
    } else if (current.kind === 'mech' && current.mech) {
      this.updateMech(current.mech, dt);
    } else {
      this.nextTarget();
    }
  }

  private updateFixed(fixed: FixedCameraPoint, dt: number): void {
    this.desiredPosition.copy(fixed.position);
    this.lookAt.copy(fixed.lookAt);

    this.aimCamera.position.copy(this.desiredPosition);
    this.aimCamera.lookAt(this.lookAt);
    this.desiredQuaternion.copy(this.aimCamera.quaternion);

    const smoothing = 1 - Math.exp(-dt * FOLLOW_SMOOTHING);
    this.viewPosition.lerp(this.desiredPosition, smoothing);
    this.viewQuaternion.slerp(this.desiredQuaternion, smoothing);

    this.applyView();
    this.updateOcclusion(this.lookAt);
  }

  private updateDrone(drone: Drone, dt: number): void {
    if (drone.state === 'abatido') {
      this.nextTarget();
      return;
    }

    const distance = 3.8;
    const lift = 1.3;
    const sin = Math.sin(drone.yaw);
    const cos = Math.cos(drone.yaw);

    this.targetFocus.copy(drone.pos);
    this.targetFocus.y += 0.2;

    // Câmera posicionada atrás do drone, olhando à frente
    this.desiredPosition.set(
      drone.pos.x + sin * distance,
      drone.pos.y + lift,
      drone.pos.z + cos * distance,
    );

    // Proteção contra colisão com prédios/paredes
    this.ray.subVectors(this.desiredPosition, this.targetFocus);
    const rayLength = this.ray.length();
    if (rayLength > 1e-4) {
      this.ray.multiplyScalar(1 / rayLength);
      const hit = this.physics.raycast(this.targetFocus, this.ray, rayLength, drone.collider ?? undefined);
      if (hit) {
        const dist = Math.max(0.6, hit.distance - WALL_MARGIN);
        this.desiredPosition.copy(this.targetFocus).addScaledVector(this.ray, dist);
      }
    }

    // Ponto de foco: ligeiramente à frente do drone
    this.lookAt.set(
      drone.pos.x - sin * 6,
      drone.pos.y + 0.3,
      drone.pos.z - cos * 6,
    );

    this.aimCamera.position.copy(this.desiredPosition);
    this.aimCamera.lookAt(this.lookAt);
    this.desiredQuaternion.copy(this.aimCamera.quaternion);

    const smoothing = 1 - Math.exp(-dt * FOLLOW_SMOOTHING);
    this.viewPosition.lerp(this.desiredPosition, smoothing);
    this.viewQuaternion.slerp(this.desiredQuaternion, smoothing);

    this.applyView();
    this.updateOcclusion(this.targetFocus);
  }

  private updateMech(mech: MechBase, dt: number): void {
    if (!mech.alive) {
      this.nextTarget();
      return;
    }

    const height = mech.stats.height;
    const distance = THREE.MathUtils.clamp(height * 2.2, 5, 14);
    const lift = THREE.MathUtils.clamp(height * 1.3, 2.8, 9);
    const shoulder = THREE.MathUtils.clamp(height * 0.22, 0.5, 1.8);

    const yaw = mech.yaw;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);

    this.targetFocus.copy(mech.position);
    this.targetFocus.y += height * 0.55;

    // Posição atrás e acima do robô observado
    this.desiredPosition.set(
      mech.position.x + sin * distance + cos * shoulder,
      mech.position.y + lift,
      mech.position.z + cos * distance - sin * shoulder,
    );

    // Proteção contra colisão com paredes usando raycast do ponto do Mech até a câmera
    this.ray.subVectors(this.desiredPosition, this.targetFocus);
    const rayLength = this.ray.length();
    if (rayLength > 1e-4) {
      this.ray.multiplyScalar(1 / rayLength);
      const hit = this.physics.raycast(this.targetFocus, this.ray, rayLength, mech.collider);
      if (hit) {
        const dist = Math.max(0.8, hit.distance - WALL_MARGIN);
        this.desiredPosition.copy(this.targetFocus).addScaledVector(this.ray, dist);
      }
    }

    this.lookAt.copy(this.targetFocus);
    this.aimCamera.position.copy(this.desiredPosition);
    this.aimCamera.lookAt(this.lookAt);
    this.desiredQuaternion.copy(this.aimCamera.quaternion);

    const smoothing = 1 - Math.exp(-dt * FOLLOW_SMOOTHING);
    this.viewPosition.lerp(this.desiredPosition, smoothing);
    this.viewQuaternion.slerp(this.desiredQuaternion, smoothing);

    this.applyView();
    this.updateOcclusion(this.targetFocus);
  }

  private updateRelease(dt: number): void {
    this.normalPosition.copy(this.camera.position);
    this.normalQuaternion.copy(this.camera.quaternion);
    this.releaseElapsed = Math.min(RELEASE_S, this.releaseElapsed + dt);
    const t = THREE.MathUtils.smoothstep(this.releaseElapsed, 0, RELEASE_S);
    this.viewPosition.lerpVectors(this.releasePosition, this.normalPosition, t);
    this.viewQuaternion.slerpQuaternions(this.releaseQuaternion, this.normalQuaternion, t);
    this.applyView();
    if (this.releaseElapsed >= RELEASE_S) {
      this.state = 'idle';
      this.restoreOccluders();
    }
  }

  private applyView(): void {
    this.camera.position.copy(this.viewPosition);
    this.camera.quaternion.copy(this.viewQuaternion);
    this.camera.updateMatrixWorld();
  }

  private updateOcclusion(focus: THREE.Vector3): void {
    const origin = this.camera.position;
    const distance = origin.distanceTo(focus);
    this.occlusionRay.origin.copy(origin);
    this.occlusionRay.direction.subVectors(focus, origin).normalize();
    for (const occluder of this.occluders) {
      const hit = this.occlusionRay.intersectBox(occluder.box, this.occlusionHit);
      this.setOccluded(occluder, !!hit && origin.distanceTo(this.occlusionHit) < distance);
    }
  }

  private restoreOccluders(): void {
    for (const occluder of this.occluders) this.setOccluded(occluder, false);
  }

  private setOccluded(occluder: Occluder, faded: boolean): void {
    const material = occluder.material;
    if (!material) return; // só entra na planta (o mobiliário da praça urbana): não some quando tapa a câmera
    const opacity = faded ? OCCLUDED_OPACITY : 1;
    if (material.opacity === opacity) return;
    material.opacity = opacity;
    material.depthWrite = !faded;
  }
}
