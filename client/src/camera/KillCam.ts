import * as THREE from 'three';
import type { MechBase } from '../entities/MechBase';
import type { Occluder } from '../environment/Arena';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

const WRECK_FOCUS_S = 0.55;
const KILLER_FOCUS_S = 1.35;
const RELEASE_S = 0.38;
const FOLLOW_SMOOTHING = 7;
const WALL_MARGIN = 0.35;
const OCCLUDED_OPACITY = 0.16;
const ORBIT_OFFSETS = [0, Math.PI / 2, -Math.PI / 2, Math.PI] as const;

type State = 'idle' | 'following' | 'releasing';

/**
 * Câmera de abate somente visual. Guarda uma referência ao matador e trabalha com vetores próprios:
 * não toca a simulação, o input ou o renascimento e não aloca durante `update()` (G1/G4).
 */
export class KillCam {
  private state: State = 'idle';
  private killer: MechBase | null = null;
  private elapsed = 0;
  private releaseElapsed = 0;
  private orbitOffset = 0;

  private readonly wreckFocus = new THREE.Vector3();
  private readonly killerFocus = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private readonly desiredPosition = new THREE.Vector3();
  private readonly probePosition = new THREE.Vector3();
  private readonly ray = new THREE.Vector3();
  private readonly viewPosition = new THREE.Vector3();
  private readonly releasePosition = new THREE.Vector3();
  private readonly normalPosition = new THREE.Vector3();
  private readonly viewQuaternion = new THREE.Quaternion();
  private readonly desiredQuaternion = new THREE.Quaternion();
  private readonly releaseQuaternion = new THREE.Quaternion();
  private readonly normalQuaternion = new THREE.Quaternion();
  /** Camera auxiliar pré-alocada: Camera olha pelo eixo -Z; Object3D comum apontaria ao contrário. */
  private readonly aim = new THREE.PerspectiveCamera();
  private readonly occlusionRay = new THREE.Ray();
  private readonly occlusionHit = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly physics: PhysicsWorld,
    private readonly occluders: readonly Occluder[] = [],
  ) {}

  /** Enquanto true, o Game pula o CameraRig: há apenas um raycast de câmera por quadro. */
  get overridesRig(): boolean {
    return this.state === 'following';
  }

  /** Visível para o HUD e para o atalho V, inclusive durante a transição de saída. */
  get active(): boolean {
    return this.state !== 'idle';
  }

  /** Troca a referência uma vez no abate e copia o ponto do destroço para não reter scratch externo. */
  start(killer: MechBase, wreckAt: THREE.Vector3): void {
    this.killer = killer;
    this.wreckFocus.copy(wreckAt);
    this.viewPosition.copy(this.camera.position);
    this.viewQuaternion.copy(this.camera.quaternion);
    this.orbitOffset = this.chooseOrbit(killer);
    this.elapsed = 0;
    this.releaseElapsed = 0;
    this.state = 'following';
  }

  /** Renascimento: mistura da última imagem de abate para a câmera normal já calculada pelo rig. */
  release(): void {
    if (this.state !== 'following') return;
    this.killer = null;
    this.releasePosition.copy(this.viewPosition);
    this.releaseQuaternion.copy(this.viewQuaternion);
    this.releaseElapsed = 0;
    this.state = 'releasing';
  }

  /** Pedido do jogador (V/CAM): devolve o controle da câmera no mesmo quadro de render seguinte. */
  cancel(): void {
    this.killer = null;
    this.state = 'idle';
    this.restoreOccluders();
  }

  /**
   * Em `following`, substitui o CameraRig. Em `releasing`, deve rodar depois do rig para misturar até
   * a pose normal. O estado idle retorna antes de qualquer trabalho.
   */
  update(dt: number): void {
    if (this.state === 'idle') return;
    if (this.state === 'releasing') {
      this.updateRelease(dt);
      return;
    }

    const killer = this.killer;
    if (!killer) {
      this.cancel();
      return;
    }

    this.elapsed += dt;
    const height = killer.stats.height;
    const distance = THREE.MathUtils.clamp(height * 2, 4.5, 12);
    const lift = THREE.MathUtils.clamp(height * 1.2, 2.6, 8);
    const shoulder = THREE.MathUtils.clamp(height * 0.2, 0.45, 1.6);
    const orbitYaw = killer.yaw + this.orbitOffset;
    const sin = Math.sin(orbitYaw);
    const cos = Math.cos(orbitYaw);

    // Atrás, acima e levemente sobre o ombro direito do matador.
    this.desiredPosition.set(
      killer.position.x + sin * distance + cos * shoulder,
      killer.position.y + lift,
      killer.position.z + cos * distance - sin * shoulder,
    );

    this.killerFocus.copy(killer.position);
    this.killerFocus.y += height * 0.55;
    const focus = THREE.MathUtils.smoothstep(this.elapsed, WRECK_FOCUS_S, KILLER_FOCUS_S);
    this.lookAt.lerpVectors(this.wreckFocus, this.killerFocus, focus);

    // A proteção parte do matador, não do destroço: o primeiro foco pode estar do outro lado de uma
    // parede. Assim a câmera fica sempre no mesmo espaço navegável do alvo que ela acompanha.
    this.ray.subVectors(this.desiredPosition, this.killerFocus);
    const rayLength = this.ray.length();
    if (rayLength > 1e-4) {
      this.ray.multiplyScalar(1 / rayLength);
      const hit = this.physics.raycast(this.killerFocus, this.ray, rayLength, killer.collider);
      if (hit) {
        const distanceToWall = Math.max(0.8, hit.distance - WALL_MARGIN);
        this.desiredPosition.copy(this.killerFocus).addScaledVector(this.ray, distanceToWall);
      }
    }

    this.aim.position.copy(this.desiredPosition);
    this.aim.lookAt(this.lookAt);
    this.desiredQuaternion.copy(this.aim.quaternion);

    const smoothing = 1 - Math.exp(-dt * FOLLOW_SMOOTHING);
    this.viewPosition.lerp(this.desiredPosition, smoothing);
    this.viewQuaternion.slerp(this.desiredQuaternion, smoothing);
    this.applyView();
    this.updateOcclusion();
  }

  private updateRelease(dt: number): void {
    // O CameraRig acabou de escrever a pose normal; copie antes de sobrescrevê-la pela mistura.
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

  /**
   * Escolhe uma vez por morte o primeiro ombro livre: costas, laterais e frente. Na arena aberta
   * mantém o enquadramento atrás; junto de parede evita encostar a câmera dentro da geometria.
   */
  private chooseOrbit(killer: MechBase): number {
    const height = killer.stats.height;
    const distance = THREE.MathUtils.clamp(height * 2, 4.5, 12);
    const lift = THREE.MathUtils.clamp(height * 1.2, 2.6, 8);
    const shoulder = THREE.MathUtils.clamp(height * 0.2, 0.45, 1.6);
    this.killerFocus.copy(killer.position);
    this.killerFocus.y += height * 0.55;
    let bestOffset = 0;
    let bestClearance = -1;
    for (const offset of ORBIT_OFFSETS) {
      const yaw = killer.yaw + offset;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      this.probePosition.set(
        killer.position.x + sin * distance + cos * shoulder,
        killer.position.y + lift,
        killer.position.z + cos * distance - sin * shoulder,
      );
      this.ray.subVectors(this.probePosition, this.killerFocus);
      const length = this.ray.length();
      if (length <= 1e-4) continue;
      this.ray.multiplyScalar(1 / length);
      const hit = this.physics.raycast(this.killerFocus, this.ray, length, killer.collider);
      const clearance = hit ? hit.distance : length + 100;
      if (clearance > bestClearance) {
        bestClearance = clearance;
        bestOffset = offset;
      }
    }
    return bestOffset;
  }

  /** Mesmo recurso barato da câmera tática: o prédio entre a câmera e o matador fica translúcido. */
  private updateOcclusion(): void {
    const origin = this.camera.position;
    const distance = origin.distanceTo(this.killerFocus);
    this.occlusionRay.origin.copy(origin);
    this.occlusionRay.direction.subVectors(this.killerFocus, origin).normalize();
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
