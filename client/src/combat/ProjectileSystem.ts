import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import type { PhysicsHit, PhysicsWorld } from '../physics/PhysicsWorld';
import type { ParticleSystem } from '../fx/ParticleSystem';

interface Projectile {
  mesh: THREE.Mesh;
  prev: THREE.Vector3;
  pos: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  damage: number;
  owner?: RAPIER.Collider;
}

export const PROJECTILE_SPEED = 140;
const LIFETIME = 2;
const DAMAGE = 25;
const SPARK_COLOR = new THREE.Color(0.4, 2.2, 3.0);
const CORE_COLOR = new THREE.Color(2.5, 2.5, 3.0);

const _dir = new THREE.Vector3();
const _hitAt = new THREE.Vector3();
const _hitNormal = new THREE.Vector3();
const _look = new THREE.Vector3();

/**
 * Projéteis de plasma com pool fixo. Simulados no tick fixo com raycast do
 * segmento percorrido (não atravessa nada em alta velocidade); o render interpola.
 */
export class ProjectileSystem {
  /** Chamado a cada impacto (Mech ou destrutível; quem decide é o CombatSystem). `owner` = quem atirou. */
  onHit?: (hit: PhysicsHit, dir: THREE.Vector3, damage: number, owner?: RAPIER.Collider) => void;

  private readonly pool: Projectile[] = [];
  private readonly friendlyMat: THREE.MeshBasicMaterial;
  private readonly hostileMat: THREE.MeshBasicMaterial;

  constructor(
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly particles: ParticleSystem,
    size = 64,
  ) {
    const geo = new THREE.SphereGeometry(0.2, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3.0, 4.0) });
    this.hostileMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 0.6, 2.2) });
    this.friendlyMat = mat;
    for (let i = 0; i < size; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(1, 1, 6);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        mesh,
        prev: new THREE.Vector3(),
        pos: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
        damage: DAMAGE,
      });
    }
  }

  /** `hostile`: plasma inimigo, em magenta, para o jogador distinguir os tiros que vêm contra ele. */
  fire(origin: THREE.Vector3, dir: THREE.Vector3, owner?: RAPIER.Collider, hostile = false): void {
    const p = this.pool.find((q) => q.life <= 0);
    if (!p) return;
    p.pos.copy(origin);
    p.prev.copy(origin);
    p.velocity.copy(dir).multiplyScalar(PROJECTILE_SPEED);
    p.life = LIFETIME;
    p.owner = owner;
    p.mesh.position.copy(origin);
    p.mesh.lookAt(_look.copy(origin).add(dir));
    p.mesh.material = hostile ? this.hostileMat : this.friendlyMat;
    p.mesh.visible = true;
  }

  fixedUpdate(dt: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;

      const step = p.velocity.length() * dt;
      _dir.copy(p.velocity).divideScalar(step / dt);
      const hit = this.physics.raycast(p.pos, _dir, step, p.owner);

      if (hit) {
        // O resultado do raycast é reaproveitado: copia antes que o onHit dispare outro.
        _hitNormal.copy(hit.normal);
        _hitAt.copy(hit.point).addScaledVector(_hitNormal, 0.05);
        this.onHit?.(hit, _dir, p.damage, p.owner);

        this.particles.burst(_hitAt, _hitNormal, { count: 36, color: SPARK_COLOR, speed: 24, life: 0.6, spread: 0.9 });
        this.particles.burst(_hitAt, _hitNormal, { count: 10, color: CORE_COLOR, speed: 6, life: 0.25, gravity: 0 });
        this.kill(p);
        continue;
      }

      p.prev.copy(p.pos);
      p.pos.addScaledVector(p.velocity, dt);
      p.life -= dt;
      if (p.life <= 0) this.kill(p);
    }
  }

  render(alpha: number): void {
    for (const p of this.pool) {
      if (p.life > 0) p.mesh.position.lerpVectors(p.prev, p.pos, alpha);
    }
  }

  /** Some com todos os projéteis em voo (rodada nova). */
  clear(): void {
    for (const p of this.pool) if (p.life > 0) this.kill(p);
  }

  private kill(p: Projectile): void {
    p.life = 0;
    p.mesh.visible = false;
  }
}
