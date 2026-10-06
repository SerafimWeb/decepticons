import * as THREE from 'three';
import type { MechBase } from '../entities/MechBase';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/** Desvio local com três sondas da largura do casco; no máximo 21 raios a 5 Hz por robô.
 * Guarda o lado do contorno para não oscilar entre esquerda e direita junto de uma parede.
 * Não é um planejador global: becos e rotas com vários prédios continuam exigindo navegação futura.
 */
export class ObstacleSteering {
  private wait = 0;
  private side = 1;
  private turning = false;
  private readonly origin = new THREE.Vector3();
  private readonly ray = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  constructor(private readonly physics: PhysicsWorld, private readonly mech: MechBase, side = 1) { this.side = side; }
  reset(): void { this.wait = 0; this.turning = false; this.direction.set(0, 0, 0); }
  steer(move: THREE.Vector3, dt: number): void {
    if (move.lengthSq() < 0.01) { this.wait = 0; return; }
    this.wait -= dt;
    if (this.wait <= 0) {
      this.wait = 0.2;
      move.normalize();
      const x = move.x, z = move.z;
      if (this.clear(x, z)) {
        this.direction.set(x, 0, z);
        this.turning = false;
      } else {
        let found = false;
        // Primeiro tenta contornar pelo mesmo lado; só inverte se não houver saída nele.
        for (let pass = 0; pass < 2 && !found; pass++) {
          const side = pass === 0 ? this.side : -this.side;
          for (let step = 1; step <= 3; step++) {
            const angle = side * step * Math.PI / 4;
            const dx = x * Math.cos(angle) - z * Math.sin(angle);
            const dz = x * Math.sin(angle) + z * Math.cos(angle);
            if (this.clear(dx, dz)) {
              this.direction.set(dx, 0, dz);
              this.side = side;
              found = true;
              break;
            }
          }
        }
        if (!found) this.direction.set(-x, 0, -z);
        this.turning = true;
      }
    }
    if (this.turning) move.copy(this.direction);
  }
  private clear(x: number, z: number): boolean {
    const p = this.mech.simPosition;
    const width = this.mech.stats.radius * 0.95;
    const reach = this.mech.stats.radius + 3;
    this.ray.set(x, 0, z);
    for (let i = -1; i <= 1; i++) {
      this.origin.set(p.x - z * width * i, p.y + this.mech.stats.height * 0.35, p.z + x * width * i);
      if (this.physics.firstColliderOnRay(this.origin, this.ray, reach, this.mech.collider)) return false;
    }
    return true;
  }
}
