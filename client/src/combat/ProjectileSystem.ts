import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { GLOW } from '../core/palette';
import type { PhysicsHit, PhysicsWorld } from '../physics/PhysicsWorld';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { hitDamage, weapon, type WeaponStats } from './weapons';

interface Projectile {
  mesh: THREE.Mesh;
  prev: THREE.Vector3;
  pos: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  trailLife: number;
  trail: THREE.Line;
  /** A arma de quem atirou (velocidade, alcance, dano e queda com a distância). */
  weapon: WeaponStats;
  /** Metros já percorridos: o plasma perde força com a distância. */
  traveled: number;
  owner?: RAPIER.Collider;
}

const SPARK_COLOR = GLOW.spark;
const CORE_COLOR = GLOW.core;

const _dir = new THREE.Vector3();
const _hitAt = new THREE.Vector3();
const _hitNormal = new THREE.Vector3();
const _look = new THREE.Vector3();

/**
 * Projéteis de plasma com pool fixo. Simulados no tick fixo com raycast do
 * segmento percorrido (não atravessa nada em alta velocidade); o render interpola.
 */
export class ProjectileSystem {
  /** Chamado a cada impacto (Mech ou destrutível; quem decide é o CombatSystem). `damage` já vem com a queda por distância; `owner` = quem atirou. */
  onHit?: (hit: PhysicsHit, dir: THREE.Vector3, damage: number, owner?: RAPIER.Collider, w?: WeaponStats, distance?: number) => void;
  /** Um tiro saiu (o servidor do multiplayer manda como evento). */
  onFired?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;

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
    const mat = new THREE.MeshBasicMaterial({ color: GLOW.friendlyPlasma });
    this.hostileMat = new THREE.MeshBasicMaterial({ color: GLOW.hostilePlasma });
    this.friendlyMat = mat;
    for (let i = 0; i < size; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(1, 1, 6);
      mesh.visible = false;
      scene.add(mesh);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const trail = new THREE.Line(trailGeo, mat);
      trail.visible = false;
      trail.frustumCulled = false;
      scene.add(trail);
      this.pool.push({
        mesh, trail, trailLife: 0,
        prev: new THREE.Vector3(),
        pos: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
        weapon: weapon('plasma'),
        traveled: 0,
      });
    }
  }

  /**
   * `hostile`: plasma inimigo, em vermelho, para o jogador distinguir os tiros que vêm contra ele.
   * `w`: a arma de quem atira (velocidade, alcance e dano; o dano cai com a distância percorrida).
   */
  fire(origin: THREE.Vector3, dir: THREE.Vector3, owner?: RAPIER.Collider, hostile = false, w: WeaponStats = weapon('plasma')): void {
    this.onFired?.(origin, dir, owner, w);
    let p: Projectile | undefined;
    for (const q of this.pool) if (q.life <= 0 && q.trailLife <= 0) { p = q; break; }
    if (!p) return;
    p.pos.copy(origin);
    p.prev.copy(origin);
    p.velocity.copy(dir).multiplyScalar(w.speed);
    p.life = w.maxRange / w.speed;
    p.owner = owner;
    p.weapon = w;
    p.traveled = 0;
    p.mesh.position.copy(origin);
    p.mesh.lookAt(_look.copy(origin).add(dir));
    p.mesh.material = hostile ? this.hostileMat : this.friendlyMat;
    p.trail.material = p.mesh.material;
    p.trail.visible = w.tracer === 'rail';
    p.trailLife = 0;
    const positions = p.trail.geometry.getAttribute('position');
    positions.setXYZ(0, origin.x, origin.y, origin.z);
    positions.setXYZ(1, origin.x, origin.y, origin.z);
    positions.needsUpdate = true;
    if (w.tracer === 'rail') p.mesh.scale.set(0.45, 0.45, 18);
    else if (w.tracer === 'pulse') p.mesh.scale.set(2.5, 2.5, 2.5);
    else p.mesh.scale.set(1, 1, 6);
    p.mesh.visible = true;
  }

  fixedUpdate(dt: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) {
        p.trailLife = Math.max(0, p.trailLife - dt);
        if (p.trailLife === 0) p.trail.visible = false;
        continue;
      }

      const speed = p.velocity.length();
      const step = Math.min(speed * dt, p.weapon.maxRange - p.traveled);
      if (step <= 0) { this.kill(p); continue; }
      _dir.copy(p.velocity).divideScalar(speed);
      const hit = this.physics.raycast(p.pos, _dir, step, p.owner);

      if (hit) {
        // O resultado do raycast é reaproveitado: copia antes que o onHit dispare outro.
        _hitNormal.copy(hit.normal);
        _hitAt.copy(hit.point).addScaledVector(_hitNormal, 0.05);
        this.onHit?.(hit, _dir, hitDamage(p.weapon, p.traveled + hit.distance), p.owner, p.weapon, p.traveled + hit.distance);

        this.particles.burst(_hitAt, _hitNormal, { count: 36, color: SPARK_COLOR, speed: 27, life: 0.55, size: 1.4, expansion: -0.35, spread: 0.9 });
        this.particles.burst(_hitAt, _hitNormal, { count: 10, color: CORE_COLOR, speed: 6, life: 0.25, size: 2.2, expansion: 0.6, gravity: 0 });
        this.trailEnd(p, _hitAt);
        this.kill(p);
        continue;
      }

      p.prev.copy(p.pos);
      p.pos.addScaledVector(_dir, step);
      this.trailEnd(p, p.pos);
      p.traveled += step;
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
    for (const p of this.pool) {
      p.life = p.trailLife = 0;
      p.mesh.visible = p.trail.visible = false;
    }
  }

  private trailEnd(p: Projectile, end: THREE.Vector3): void {
    if (p.weapon.tracer !== 'rail') return;
    const positions = p.trail.geometry.getAttribute('position');
    positions.setXYZ(1, end.x, end.y, end.z);
    positions.needsUpdate = true;
  }

  private kill(p: Projectile): void {
    p.trailLife = p.weapon.tracer === 'rail' ? 0.12 : 0;
    p.life = 0;
    p.mesh.visible = false;
  }
}
