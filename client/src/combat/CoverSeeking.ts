import * as THREE from 'three';
import type { MechBase } from '../entities/MechBase';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
/** Busca local de cobertura ao recuar/esfriar: oito posições, no máximo 16 raios por segundo. */
export class CoverSeeking {
  readonly goal = new THREE.Vector3();
  private wait = 0;
  private found = false;
  private readonly origin = new THREE.Vector3();
  private readonly ray = new THREE.Vector3();
  private readonly candidate = new THREE.Vector3();
  constructor(private readonly physics: PhysicsWorld, private readonly mech: MechBase) {}
  reset(): void { this.wait = 0; this.found = false; }
  find(dt: number, threat: MechBase, knownPosition: Readonly<THREE.Vector3> = threat.simPosition): boolean {
    this.wait -= dt;
    if (this.wait > 0) return this.found;
    this.wait = 1;
    this.found = false;
    const me = this.mech.simPosition, enemy = knownPosition;
    this.origin.set(enemy.x, enemy.y + threat.stats.height * 0.7, enemy.z);
    let best = Infinity;
    for (let i=0;i<8;i++) {
      const a = i * Math.PI / 4;
      this.candidate.set(me.x + Math.sin(a)*12, me.y + this.mech.stats.height*0.55, me.z + Math.cos(a)*12);
      this.ray.subVectors(this.candidate,this.origin);
      const distance = this.ray.length(); this.ray.divideScalar(distance);
      const hit = this.physics.firstColliderOnRay(this.origin,this.ray,distance,threat.collider);
      if (!hit || hit === this.mech.collider || hit.parent()?.isKinematic()) continue;
      // Não escolhe dentro de paredes: a sonda vertical precisa alcançar o chão do nível atual.
      const ground = this.physics.terrainY(this.candidate.x,this.candidate.z,me.y+this.mech.stats.height+2,this.mech.stats.height+4);
      if (ground === null || Math.abs(ground-me.y)>this.mech.stats.stepHeight) continue;
      const score = -distance;
      if (score < best) { best=score; this.goal.set(this.candidate.x,me.y,this.candidate.z); this.found=true; }
    }
    return this.found;
  }
}
