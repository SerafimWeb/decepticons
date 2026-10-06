import * as THREE from "three";
import type { MechBase } from "../entities/MechBase";
import { PALETTE } from "../core/palette";
/** Até 32 barreiras, dois desenhos no total. Sem objetos novos por frame. */
export class ShieldVisuals {
  private readonly fill: THREE.InstancedMesh;
  private readonly edge: THREE.InstancedMesh;
  private count = 0;
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
    scene.add(this.fill, this.edge);
  }
  begin(): void {
    this.count = 0;
  }
  update(m: MechBase): void {
    if (!m.alive || !m.energyShield.active || this.count >= 32) return;
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
    this.fill.count = this.edge.count = this.count;
    this.fill.instanceMatrix.needsUpdate =
      this.edge.instanceMatrix.needsUpdate = true;
  }
}
