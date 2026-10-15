import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { weapon, type WeaponStats } from './weapons';

interface Rocket {
  mesh: THREE.Mesh;
  prev: THREE.Vector3;
  pos: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  /** O lançador de quem disparou (velocidade, alcance e a explosão). */
  weapon: WeaponStats;
  owner?: RAPIER.Collider;
  /** Quem o míssil teleguiado persegue (nulo: voa reto). */
  target: GuideTarget | null;
}

/** O que o míssil teleguiado precisa saber de um alvo: se vive e onde está (posição de simulação e altura, sem rig nem 3D: roda igual no servidor). Um `MechBase` serve. */
export interface GuideTarget {
  readonly alive: boolean;
  readonly simPosition: THREE.Vector3;
  readonly stats: { readonly height: number };
}

const TRAIL = new THREE.Color(2.2, 0.9, 0.25);
/** O míssil teleguiado é frio (branco-azulado), para quem olha saber que aquele curva. */
const TRAIL_GUIDED = new THREE.Color(0.9, 1.6, 2.4);
const _dir = new THREE.Vector3();
const _back = new THREE.Vector3();
const _at = new THREE.Vector3();
const _look = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _axis = new THREE.Vector3();

/**
 * Foguetes em voo, com pool fixo (G4/G5). Simulados no tick fixo com raycast do trecho percorrido,
 * como o plasma; explodem no impacto ou no fim do alcance. Quem aplica o dano em área é o
 * CombatSystem (onExplode), para a regra ficar num lugar só.
 * Custo: por foguete em voo, um raycast por tick e 2 partículas de rastro.
 */
export class RocketSystem {
  /** Explosão no ponto `at` (cópia reaproveitada: use na hora). `dir` = direção do voo. */
  onExplode?: (at: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;
  /** Um foguete saiu (o servidor do multiplayer manda como evento). */
  onFired?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;

  /** Quem o míssil teleguiado trava na hora do disparo (a partida escolhe: inimigo mais centrado à frente, à vista). Sem isto, voa reto. */
  acquire?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => GuideTarget | null;

  private readonly pool: Rocket[] = [];
  private readonly guidedMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.4, 3.0) });
  private readonly plainMat: THREE.Material;
  constructor(
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly particles: ParticleSystem,
    size = 24,
  ) {
    const geo = new THREE.CylinderGeometry(0.13, 0.13, 0.9, 6).rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.4, 0.4) });
    this.plainMat = mat;
    for (let i = 0; i < size; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, prev: new THREE.Vector3(), pos: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, weapon: weapon('rockets'), target: null });
    }
  }

  /** `w`: o lançador de quem dispara (os foguetes são lentos: quem está longe tem tempo de desviar). */
  fire(origin: THREE.Vector3, dir: THREE.Vector3, owner?: RAPIER.Collider, w: WeaponStats = weapon('rockets')): void {
    this.onFired?.(origin, dir, owner, w);
    const r = this.pool.find((q) => q.life <= 0);
    if (!r) return;
    r.pos.copy(origin);
    r.prev.copy(origin);
    r.velocity.copy(dir).multiplyScalar(w.speed);
    r.life = w.maxRange / w.speed;
    r.weapon = w;
    r.owner = owner;
    r.target = w.guide ? (this.acquire?.(origin, dir, owner, w) ?? null) : null;
    r.mesh.material = w.guide ? this.guidedMat : this.plainMat;
    r.mesh.position.copy(origin);
    r.mesh.lookAt(_look.copy(origin).add(dir));
    r.mesh.visible = true;
  }

  fixedUpdate(dt: number): void {
    for (const r of this.pool) {
      if (r.life <= 0) continue;
      const speed = r.weapon.speed;
      const step = speed * dt;
      _dir.copy(r.velocity).divideScalar(speed);
      if (r.target) this.steer(r, r.target, dt);
      const hit = this.physics.raycast(r.pos, _dir, step, r.owner, true); // `true`: o míssil também acerta as caixas-alvo (coqueiros, P138)
      if (hit) {
        // Um pouco antes da superfície: a explosão não nasce dentro da parede.
        _at.copy(hit.point).addScaledVector(_dir, -0.2);
        this.explode(r, _at);
        continue;
      }
      r.prev.copy(r.pos);
      r.pos.addScaledVector(r.velocity, dt);
      r.life -= dt;
      this.particles.burst(_back.copy(r.pos).addScaledVector(_dir, -0.6), _dir.negate(), { count: 2, color: r.weapon.guide ? TRAIL_GUIDED : TRAIL, speed: 3, life: 0.35, spread: 0.4, gravity: -1 });
      if (r.life <= 0) this.explode(r, _at.copy(r.pos));
    }
  }

  render(alpha: number): void {
    for (const r of this.pool) {
      if (r.life <= 0) continue;
      r.mesh.position.lerpVectors(r.prev, r.pos, alpha);
      // O teleguiado curva: o corpo acompanha a direção em que ele anda.
      if (r.weapon.guide) r.mesh.lookAt(_look.copy(r.mesh.position).add(r.velocity));
    }
  }

  /** Rodada nova: some com tudo o que está no ar, sem explodir. */
  clear(): void {
    for (const r of this.pool) {
      r.life = 0;
      r.target = null;
      r.mesh.visible = false;
    }
  }

  /**
   * Vira a direção do míssil (`_dir`, unitária, e a velocidade dele) para o centro do corpo do alvo, no máximo `turnRate * dt` radianos por tick. Alvo que morreu: o míssil solta e voa reto.
   * Sem alocação (G4) e sem sorteio (G1/G2): é só geometria da simulação.
   */
  private steer(r: Rocket, t: GuideTarget, dt: number): void {
    if (!t.alive) {
      r.target = null;
      return;
    }
    const p = t.simPosition;
    _aim.set(p.x, p.y + t.stats.height * 0.5, p.z).sub(r.pos);
    const d = _aim.length();
    if (d < 1e-3) return;
    _aim.multiplyScalar(1 / d);
    const maxTurn = r.weapon.guide!.turnRate * dt;
    const angle = Math.acos(Math.min(1, Math.max(-1, _dir.dot(_aim))));
    if (angle <= maxTurn) _dir.copy(_aim);
    else {
      _axis.crossVectors(_dir, _aim);
      // De frente para trás (180°): o eixo some; vira por cima.
      if (_axis.lengthSq() < 1e-10) _axis.set(0, 1, 0);
      else _axis.normalize();
      _dir.applyAxisAngle(_axis, maxTurn);
    }
    r.velocity.copy(_dir).multiplyScalar(r.weapon.speed);
  }

  private explode(r: Rocket, at: THREE.Vector3): void {
    r.life = 0;
    r.mesh.visible = false;
    _dir.copy(r.velocity).normalize();
    this.onExplode?.(at, _dir, r.owner, r.weapon);
  }
}
