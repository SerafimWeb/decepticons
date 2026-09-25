import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/** Foguete: mais lento que o plasma (140 m/s) e visível no ar; quem está longe tem tempo de desviar. */
export const ROCKET_SPEED = 75;
/** Dano no centro da explosão; cai em linha reta até zero na borda do raio. */
export const ROCKET_DAMAGE = 75;
/** Raio da explosão (m), medido até a superfície da cápsula do Mech. */
export const BLAST_RADIUS = 6;
/** Carregador do lançador: foguetes prontos, intervalo entre disparos e tempo para recarregar um. */
export const ROCKET_AMMO = 4;
export const ROCKET_INTERVAL = 0.3;
export const ROCKET_RELOAD = 2.2;
const LIFETIME = 3;

/**
 * Dano da explosão a `dist` metros da superfície do alvo: máximo no centro, zero na borda do raio.
 * Inteiro, como o dano do plasma (os módulos mostram números redondos).
 */
export function splashDamage(dist: number, radius = BLAST_RADIUS, max = ROCKET_DAMAGE): number {
  if (dist >= radius) return 0;
  return Math.round(max * (1 - Math.max(0, dist) / radius));
}

/**
 * Carregador do braço esquerdo. Regra de jogo pura (G14): roda no tick fixo, sem física nem render.
 * Recarrega um foguete por vez, continuamente, enquanto não estiver cheio.
 */
export class RocketLauncher {
  ammo = ROCKET_AMMO;
  private cooldown = 0;
  private reload = 0;

  fixedUpdate(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.ammo >= ROCKET_AMMO) {
      this.reload = 0;
      return;
    }
    this.reload += dt;
    if (this.reload >= ROCKET_RELOAD) {
      this.reload -= ROCKET_RELOAD;
      this.ammo++;
    }
  }

  /** Gasta um foguete se houver e o intervalo tiver passado. */
  tryFire(): boolean {
    if (this.ammo <= 0 || this.cooldown > 0) return false;
    this.ammo--;
    this.cooldown = ROCKET_INTERVAL;
    return true;
  }

  /** 0..1 do próximo foguete (para o HUD); 1 com o carregador cheio. */
  get reloadProgress(): number {
    return this.ammo >= ROCKET_AMMO ? 1 : this.reload / ROCKET_RELOAD;
  }

  /** Rodada nova ou renascimento: carregador cheio. */
  refill(): void {
    this.ammo = ROCKET_AMMO;
    this.cooldown = this.reload = 0;
  }
}

interface Rocket {
  mesh: THREE.Mesh;
  prev: THREE.Vector3;
  pos: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  owner?: RAPIER.Collider;
}

const TRAIL = new THREE.Color(2.2, 0.9, 0.25);
const _dir = new THREE.Vector3();
const _back = new THREE.Vector3();
const _at = new THREE.Vector3();
const _look = new THREE.Vector3();

/**
 * Foguetes em voo, com pool fixo (G4/G5). Simulados no tick fixo com raycast do trecho percorrido,
 * como o plasma; explodem no impacto ou no fim do alcance. Quem aplica o dano em área é o
 * CombatSystem (onExplode), para a regra ficar num lugar só.
 * Custo: por foguete em voo, um raycast por tick e 2 partículas de rastro.
 */
export class RocketSystem {
  /** Explosão no ponto `at` (cópia reaproveitada: use na hora). `dir` = direção do voo. */
  onExplode?: (at: THREE.Vector3, dir: THREE.Vector3, owner?: RAPIER.Collider) => void;

  private readonly pool: Rocket[] = [];

  constructor(
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly particles: ParticleSystem,
    size = 24,
  ) {
    const geo = new THREE.CylinderGeometry(0.13, 0.13, 0.9, 6).rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.4, 0.4) });
    for (let i = 0; i < size; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, prev: new THREE.Vector3(), pos: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0 });
    }
  }

  fire(origin: THREE.Vector3, dir: THREE.Vector3, owner?: RAPIER.Collider): void {
    const r = this.pool.find((q) => q.life <= 0);
    if (!r) return;
    r.pos.copy(origin);
    r.prev.copy(origin);
    r.velocity.copy(dir).multiplyScalar(ROCKET_SPEED);
    r.life = LIFETIME;
    r.owner = owner;
    r.mesh.position.copy(origin);
    r.mesh.lookAt(_look.copy(origin).add(dir));
    r.mesh.visible = true;
  }

  fixedUpdate(dt: number): void {
    for (const r of this.pool) {
      if (r.life <= 0) continue;
      const step = ROCKET_SPEED * dt;
      _dir.copy(r.velocity).divideScalar(ROCKET_SPEED);
      const hit = this.physics.raycast(r.pos, _dir, step, r.owner);
      if (hit) {
        // Um pouco antes da superfície: a explosão não nasce dentro da parede.
        _at.copy(hit.point).addScaledVector(_dir, -0.2);
        this.explode(r, _at);
        continue;
      }
      r.prev.copy(r.pos);
      r.pos.addScaledVector(r.velocity, dt);
      r.life -= dt;
      this.particles.burst(_back.copy(r.pos).addScaledVector(_dir, -0.6), _dir.negate(), { count: 2, color: TRAIL, speed: 3, life: 0.35, spread: 0.4, gravity: -1 });
      if (r.life <= 0) this.explode(r, _at.copy(r.pos));
    }
  }

  render(alpha: number): void {
    for (const r of this.pool) {
      if (r.life > 0) r.mesh.position.lerpVectors(r.prev, r.pos, alpha);
    }
  }

  /** Rodada nova: some com tudo o que está no ar, sem explodir. */
  clear(): void {
    for (const r of this.pool) {
      r.life = 0;
      r.mesh.visible = false;
    }
  }

  private explode(r: Rocket, at: THREE.Vector3): void {
    r.life = 0;
    r.mesh.visible = false;
    _dir.copy(r.velocity).normalize();
    this.onExplode?.(at, _dir, r.owner);
  }
}
