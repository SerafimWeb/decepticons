import * as THREE from "three";
import type { MechBase } from "../entities/MechBase";
import { PALETTE } from "../core/palette";
import { FIRE_RING } from "../combat/EnergyShield";
/** Pools de 32 por tipo; até quatro desenhos no total, sem objetos novos por frame. */
export class ShieldVisuals {
  private readonly fill: THREE.InstancedMesh;
  private readonly edge: THREE.InstancedMesh;
  private count = 0;
  private sphereCount = 0;
  private readonly sphere: THREE.InstancedMesh;
  /** O anel de fogo: um aro e um disco de brasa deitados no chão, do raio do dano (`FIRE_RING.radius`). */
  private readonly fireRim: THREE.InstancedMesh;
  private readonly fireDisc: THREE.InstancedMesh;
  private fireCount = 0;
  private readonly grid: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly euler = new THREE.Euler(0, 0, 0, "YXZ");
  constructor(scene: THREE.Scene) {
    const material = new THREE.MeshBasicMaterial({
      color: PALETTE.shieldBlue,
      transparent: true,
      opacity: 0.055,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.fill = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 6),
      material,
      32,
    );
    this.edge = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.97, 1, 6),
      new THREE.MeshBasicMaterial({
        color: PALETTE.shieldBlue,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      32,
    );
    this.fill.frustumCulled = this.edge.frustumCulled = false;
    this.fill.count = this.edge.count = 0;
    const shell = new THREE.SphereGeometry(1, 24, 12);
    this.sphere = new THREE.InstancedMesh(shell, new THREE.MeshBasicMaterial({
      color: PALETTE.shieldBlue, transparent: true, opacity: 0.045, depthWrite: false,
    }), 32);
    this.grid = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({
      color: PALETTE.shieldBlue, transparent: true, opacity: 0.22, wireframe: true, depthWrite: false,
    }), 32);
    this.sphere.frustumCulled = this.grid.frustumCulled = false;
    this.sphere.count = this.grid.count = 0;
    const ember = (opacity: number) => new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.6, 0.55, 0.12), transparent: true, opacity, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    });
    this.fireRim = new THREE.InstancedMesh(new THREE.RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2), ember(0.7), 16);
    this.fireDisc = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), ember(0.07), 16);
    this.fireRim.frustumCulled = this.fireDisc.frustumCulled = false;
    this.fireRim.count = this.fireDisc.count = 0;
    scene.add(this.fill, this.edge, this.sphere, this.grid, this.fireRim, this.fireDisc);
  }
  begin(): void {
    this.count = this.sphereCount = this.fireCount = 0;
  }
  update(m: MechBase): void {
    if (!m.alive || !m.energyShield.active) return;
    if (m.energyShield.kind === 'fire') {
      // O anel de fogo não é uma barreira: é um aro de brasa no chão, do tamanho do alcance do dano.
      if (this.fireCount >= 16) return;
      this.position.copy(m.position);
      this.position.y += 0.1;
      this.rotation.identity();
      this.scale.setScalar(FIRE_RING.radius);
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.fireRim.setMatrixAt(this.fireCount, this.matrix);
      this.fireDisc.setMatrixAt(this.fireCount++, this.matrix);
      return;
    }
    if (m.energyShield.kind === 'sphere') {
      if (this.sphereCount >= 32) return;
      this.position.copy(m.position);
      this.position.y += m.stats.height * 0.48;
      this.rotation.identity();
      this.scale.setScalar(Math.max(m.stats.height * 0.62, m.stats.radius * 1.65));
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.sphere.setMatrixAt(this.sphereCount, this.matrix);
      this.grid.setMatrixAt(this.sphereCount++, this.matrix);
      return;
    }
    if (this.count >= 32) return;
    const cp = Math.cos(m.pitch),
      distance = m.stats.radius + 0.45;
    this.position.copy(m.position);
    this.position.x -= Math.sin(m.yaw) * cp * distance;
    this.position.y += m.stats.height * 0.52 + Math.sin(m.pitch) * distance;
    this.position.z -= Math.cos(m.yaw) * cp * distance;
    this.rotation.setFromEuler(this.euler.set(m.pitch, m.yaw, 0));
    this.scale.set(m.stats.radius * 1.8, m.stats.height * 0.57, 1);
    this.matrix.compose(this.position, this.rotation, this.scale);
    this.fill.setMatrixAt(this.count, this.matrix);
    this.edge.setMatrixAt(this.count++, this.matrix);
  }
  end(): void {
    this.sphere.count = this.grid.count = this.sphereCount;
    this.sphere.instanceMatrix.needsUpdate = this.grid.instanceMatrix.needsUpdate = true;
    this.fireRim.count = this.fireDisc.count = this.fireCount;
    this.fireRim.instanceMatrix.needsUpdate = this.fireDisc.instanceMatrix.needsUpdate = true;
    this.fill.count = this.edge.count = this.count;
    this.fill.instanceMatrix.needsUpdate =
      this.edge.instanceMatrix.needsUpdate = true;
  }
}
