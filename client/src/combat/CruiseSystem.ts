import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { WeaponStats } from './weapons';

/** Mísseis cruzadores no ar ao mesmo tempo (teto: o mais velho é reaproveitado). Um por carga e 8 s de recarga: seis cobrem uma sala cheia. */
const MAX_MISSILES = 6;
/** De que altura acima do ponto de chegada o aviso procura o chão (m): cobre o alvo no telhado e o ponto na mira que está no ar. */
const GROUND_PROBE = 4;
const PROBE_DEPTH = 500;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const FIRE = new THREE.Color(3.0, 1.3, 0.35);
const SMOKE = new THREE.Color(0.42, 0.42, 0.42);

const _dir = new THREE.Vector3();
const _at = new THREE.Vector3();
const _step = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();

/**
 * O ponto do caminho em `u` (0 = o lançamento, 1 = a chegada): a **parábola** que sai de `from`, passa por cima do cenário e mergulha em `to`, com o ápice a `apex` metros acima
 * da reta entre os dois. Função pura e contínua dos dois pontos e de `u`: o servidor e o cliente, com a mira quase igual, chegam a caminhos quase iguais (G1/G2).
 */
export function cruisePoint(from: THREE.Vector3, to: THREE.Vector3, apex: number, u: number, out: THREE.Vector3): THREE.Vector3 {
  out.lerpVectors(from, to, u);
  out.y += 4 * apex * u * (1 - u);
  return out;
}

/** O quanto o ponto do caminho anda (m) por unidade de `u` em `u`: o tamanho da tangente. Andar `v·dt` metros pede `du = v·dt / cruiseRate`. */
export function cruiseRate(from: THREE.Vector3, to: THREE.Vector3, apex: number, u: number): number {
  return Math.hypot(to.x - from.x, to.y - from.y + 4 * apex * (1 - 2 * u), to.z - from.z);
}

/** A altura do ápice para um tiro de `dist` metros no plano do chão: `apex` × a distância, entre o piso e o teto da arma. */
export function cruiseApex(dist: number, apex: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, apex * dist));
}

interface Missile {
  live: boolean;
  weapon: WeaponStats;
  owner?: RAPIER.Collider;
  /** O lançamento e o ponto de chegada (o chão sob o ponto da mira). */
  from: THREE.Vector3;
  to: THREE.Vector3;
  apex: number;
  /** Onde está no caminho (0 a 1). */
  u: number;
  prev: THREE.Vector3;
  pos: THREE.Vector3;
  /** Para onde aponta (a tangente do caminho): só desenho e o raio do trecho. */
  dir: THREE.Vector3;
}

/**
 * O míssil cruzador em voo (G3: módulo independente, ligado ao `Match` por callbacks; G4/G5: pool fixo e nada alocado por tick). Sobe, cruza e mergulha no ponto que a mira
 * apontava no disparo (`Cruise` da arma): o caminho é uma função só dos dois pontos (`cruisePoint`), percorrida a velocidade constante. **Explode no primeiro que encontrar** (o
 * chão, uma parede, um prédio mais alto que o arco, um Mech), exceto o próprio dono, ou no ponto de chegada; quem aplica o dano em área é o `CombatSystem` (`onExplode`), como nos
 * foguetes. **O aviso no chão** (um anel do tamanho da explosão, que se fecha com a chegada) aparece no lançamento: quem está embaixo tem tempo de sair, e quem atirou vê onde cai.
 *
 * Custo: por míssil em voo, um raio curto por tick e 2 partículas de rastro; no pior caso (6 no ar) são 6 raios por tick.
 */
export class CruiseSystem {
  /** O míssil explodiu em `at` (cópia reaproveitada: use na hora). `dir` é a direção do voo. */
  onExplode?: (at: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;
  /** Um míssil saiu (o servidor manda como evento de tiro). */
  onFired?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;

  private readonly pool: Missile[] = [];
  private readonly bodyMesh: THREE.InstancedMesh;
  private readonly markMesh: THREE.InstancedMesh;

  constructor(
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly particles: ParticleSystem,
  ) {
    for (let i = 0; i < MAX_MISSILES; i++) {
      this.pool.push({
        live: false,
        weapon: null as unknown as WeaponStats,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        apex: 0,
        u: 0,
        prev: new THREE.Vector3(),
        pos: new THREE.Vector3(),
        dir: new THREE.Vector3(0, 0, 1),
      });
    }
    // A silhueta de um míssil (perfil girado em volta do eixo): ponta, corpo e o afunilado da cauda, com a ponta para +Z.
    const profile = [
      new THREE.Vector2(0, 1.5),
      new THREE.Vector2(0.1, 1.2),
      new THREE.Vector2(0.2, 0.75),
      new THREE.Vector2(0.2, -0.9),
      new THREE.Vector2(0.28, -1.15),
      new THREE.Vector2(0.12, -1.2),
      new THREE.Vector2(0, -1.2),
    ];
    const body = new THREE.LatheGeometry(profile, 10).rotateX(Math.PI / 2);
    this.bodyMesh = new THREE.InstancedMesh(body, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.7) }), MAX_MISSILES);
    this.markMesh = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.88, 1, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.7, 0.25), transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
      MAX_MISSILES,
    );
    for (const mesh of [this.bodyMesh, this.markMesh]) {
      mesh.count = 0;
      mesh.frustumCulled = false; // as instâncias andam por fora da caixa original
      scene.add(mesh);
    }
  }

  /**
   * Lança um míssil de `origin` para `target` (o ponto da mira). `dir` é a direção do tiro (o evento de rede). Mira além do alcance: o míssil cai no limite do alcance, na mesma
   * direção (só no plano do chão). O ponto de chegada é o chão sob a mira (ou o telhado, se a mira estava num): uma mira no céu cai no chão lá embaixo, não no ar.
   */
  fire(origin: THREE.Vector3, dir: THREE.Vector3, target: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats): void {
    const c = w.cruise;
    if (!c) return;
    this.onFired?.(origin, dir, owner, w);
    const m = this.pool.find((q) => !q.live) ?? this.pool.reduce((a, q) => (q.u > a.u ? q : a));
    m.live = true;
    m.weapon = w;
    m.owner = owner;
    m.from.copy(origin);
    let tx = target.x;
    let tz = target.z;
    const dx = tx - origin.x;
    const dz = tz - origin.z;
    const flat = Math.hypot(dx, dz);
    if (flat > w.maxRange) {
      tx = origin.x + (dx / flat) * w.maxRange;
      tz = origin.z + (dz / flat) * w.maxRange;
    }
    const ground = this.physics.terrainY(tx, tz, target.y + GROUND_PROBE, PROBE_DEPTH);
    m.to.set(tx, ground ?? target.y, tz);
    m.apex = cruiseApex(Math.min(flat, w.maxRange), c.apex, c.minApex, c.maxApex);
    m.u = 0;
    m.prev.copy(origin);
    m.pos.copy(origin);
    this.tangent(m);
  }

  fixedUpdate(dt: number): void {
    for (const m of this.pool) {
      if (!m.live) continue;
      const step = m.weapon.speed * dt;
      const rate = cruiseRate(m.from, m.to, m.apex, m.u);
      m.u = Math.min(1, m.u + (rate > 1e-6 ? step / rate : 1));
      m.prev.copy(m.pos);
      cruisePoint(m.from, m.to, m.apex, m.u, _p);
      _step.subVectors(_p, m.prev);
      const len = _step.length();
      if (len > 1e-6) {
        _dir.copy(_step).multiplyScalar(1 / len);
        // Um raio curto do trecho andado neste tick: bate no que estiver no caminho (parede, telhado, Mech), menos o dono.
        const hit = this.physics.raycast(m.prev, _dir, len, m.owner, true);
        if (hit) {
          this.land(m, _at.copy(hit.point).addScaledVector(_dir, -0.2));
          continue;
        }
      }
      m.pos.copy(_p);
      this.tangent(m);
      // O rastro: fogo atrás e uma fumaça mais grossa e lenta, em dois pontos do trecho andado (a 120 m/s o míssil anda 2 m por tick: um ponto só deixaria um tracejado, não uma linha).
      _dir.copy(m.dir).negate();
      for (let k = 0; k < 2; k++) {
        _at.copy(m.pos).addScaledVector(m.dir, -1.4 - k * (len > 0 ? len * 0.5 : 0));
        this.particles.burst(_at, _dir, { count: 1, color: FIRE, speed: 4, life: 0.3, size: 2.4, spread: 0.35, gravity: 0 });
        this.particles.burst(_at, _dir, { count: 1, color: SMOKE, speed: 1.5, life: 1.1, size: 3.4, expansion: 2, spread: 0.5, gravity: -0.6 });
      }
      if (m.u >= 1) this.land(m, _at.copy(m.to).setY(m.to.y + 0.3));
    }
  }

  /** Desenho do quadro: os mísseis no caminho e o aviso no chão (um anel que se fecha). `alpha` = quanto do próximo tick já passou. */
  render(alpha: number): void {
    let bodies = 0;
    for (const m of this.pool) {
      if (!m.live) continue;
      _p.lerpVectors(m.prev, m.pos, alpha);
      _q.setFromUnitVectors(Z_AXIS, m.dir);
      this.bodyMesh.setMatrixAt(bodies, _m.compose(_p, _q, _s.set(1, 1, 1)));
      const pulse = 1 + 0.07 * Math.sin(m.u * 90);
      const close = 0.5 + 0.5 * (1 - m.u);
      const radius = m.weapon.blastRadius * pulse * close;
      this.markMesh.setMatrixAt(bodies, _m.compose(_p.set(m.to.x, m.to.y + 0.15, m.to.z), FLAT, _s.set(radius, radius, 1)));
      bodies++;
    }
    this.bodyMesh.count = bodies;
    this.markMesh.count = bodies;
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.markMesh.instanceMatrix.needsUpdate = true;
  }

  /** Rodada nova: some com tudo o que está no ar, sem explodir. */
  clear(): void {
    for (const m of this.pool) m.live = false;
    this.bodyMesh.count = 0;
    this.markMesh.count = 0;
  }

  /** Quantos mísseis estão no ar (teste e diagnóstico). */
  get active(): number {
    let n = 0;
    for (const m of this.pool) if (m.live) n++;
    return n;
  }

  /** Para onde o míssil aponta agora: a tangente do caminho, na posição dele. */
  private tangent(m: Missile): void {
    _step.set(m.to.x - m.from.x, m.to.y - m.from.y + 4 * m.apex * (1 - 2 * m.u), m.to.z - m.from.z);
    if (_step.lengthSq() > 1e-12) m.dir.copy(_step).normalize();
  }

  private land(m: Missile, at: THREE.Vector3): void {
    m.live = false;
    _dir.copy(m.dir);
    this.onExplode?.(at, _dir, m.owner, m.weapon); // cópia: quem ouve pode mexer na direção
  }
}
