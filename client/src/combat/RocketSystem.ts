import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { ShotFx } from '../fx/WeaponFx';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { weapon, type WeaponStats } from './weapons';

interface Rocket {
  /** O corpo desenhado. Nulo nos mísseis do lançador leve: eles são desenhados em lote (`microMesh`, uma instância cada). */
  mesh: THREE.Mesh | null;
  prev: THREE.Vector3;
  pos: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  /** O lançador de quem disparou (velocidade, alcance e a explosão). */
  weapon: WeaponStats;
  owner?: RAPIER.Collider;
  /** Quem o míssil teleguiado persegue (nulo: voa reto). */
  target: GuideTarget | null;
  /** Ticks de voo: o rastro dos mísseis leves sai de três em três (são muitos). */
  age: number;
  /** O rastro em fita deste míssil no `ShotFx` (-1 = sem rastro). */
  fxTrail: number;
}

/** O que o míssil teleguiado precisa saber de um alvo: se vive e onde está (posição de simulação e altura, sem rig nem 3D: roda igual no servidor). Um `MechBase` serve. */
export interface GuideTarget {
  readonly alive: boolean;
  readonly simPosition: THREE.Vector3;
  readonly stats: { readonly height: number };
}

/** Mísseis do lançador leve em voo ao mesmo tempo (o mais velho é reaproveitado): uma salva de 32 a cada 0,07 s tem ~24 no ar, e dois lançadores, ~48. */
const MICRO_SIZE = 128;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
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
 * Custo: por foguete em voo, um raycast por tick e 2 partículas de rastro. **Os mísseis do lançador leve** (`Salvo`) ficam num pool à parte,
 * de 128, desenhados num `InstancedMesh` só (uma chamada de desenho para todos, não uma por míssil) e com rastro de uma partícula a cada três
 * ticks: o custo de um deles é um raycast por tick.
 */
export class RocketSystem {
  /** Explosão no ponto `at` (cópia reaproveitada: use na hora). `dir` = direção do voo. */
  onExplode?: (at: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;
  /** Um foguete saiu (o servidor do multiplayer manda como evento). */
  onFired?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;

  /** Quem desenha o clarão, a fumaça e o fogo do motor em fita (P160; só o cliente liga). Com ele, o rastro de partículas sai. */
  fx?: ShotFx;

  /** Quem o míssil teleguiado trava na hora do disparo (a partida escolhe: inimigo mais centrado à frente, à vista). Sem isto, voa reto. */
  acquire?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => GuideTarget | null;

  private readonly pool: Rocket[] = [];
  /** Os mísseis do lançador leve (`Salvo`): pool à parte, desenhado em lote. */
  private readonly micro: Rocket[] = [];
  private readonly microMesh: THREE.InstancedMesh;
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
      this.pool.push({ mesh, prev: new THREE.Vector3(), pos: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, weapon: weapon('rockets'), target: null, age: 0, fxTrail: -1 });
    }
    for (let i = 0; i < MICRO_SIZE; i++) {
      this.micro.push({ mesh: null, prev: new THREE.Vector3(), pos: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, weapon: weapon('swarm'), target: null, age: 0, fxTrail: -1 });
    }
    // O míssil leve: um corpo fino e curto (o foguete é 0,26 x 0,9 m), o mesmo laranja quente, deitado ao longo de Z.
    this.microMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 5).rotateX(Math.PI / 2), mat, MICRO_SIZE);
    this.microMesh.count = 0;
    this.microMesh.frustumCulled = false; // as instâncias andam por fora da caixa original
    scene.add(this.microMesh);
  }

  /** `w`: o lançador de quem dispara (os foguetes são lentos: quem está longe tem tempo de desviar). */
  fire(origin: THREE.Vector3, dir: THREE.Vector3, owner?: RAPIER.Collider, w: WeaponStats = weapon('rockets')): void {
    this.onFired?.(origin, dir, owner, w);
    const list = w.salvo ? this.micro : this.pool;
    let r = list.find((q) => q.life <= 0);
    if (!r) {
      if (!w.salvo) return;
      r = list.reduce((a, q) => (q.life < a.life ? q : a)); // o pool do lançador leve cheio: o míssil mais velho cede o lugar (sumir o novo seria pior)
      this.fx?.landed(r.fxTrail, r.pos, r.pos, r.weapon, false);
    }
    r.pos.copy(origin);
    r.prev.copy(origin);
    r.velocity.copy(dir).multiplyScalar(w.speed);
    r.life = w.maxRange / w.speed;
    r.weapon = w;
    r.owner = owner;
    r.age = 0;
    r.target = w.guide ? (this.acquire?.(origin, dir, owner, w) ?? null) : null;
    if (r.mesh) {
      r.mesh.material = w.guide ? this.guidedMat : this.plainMat;
      r.mesh.position.copy(origin);
      r.mesh.lookAt(_look.copy(origin).add(dir));
      r.mesh.visible = true;
    }
    r.fxTrail = this.fx ? this.fx.fired(origin, dir, w, false) : -1;
  }

  fixedUpdate(dt: number): void {
    for (const r of this.pool) this.step(r, dt);
    for (const r of this.micro) this.step(r, dt);
  }

  /** Um tick de um míssil: curva (se guiado), raio do trecho, explosão no impacto ou no fim do alcance. */
  private step(r: Rocket, dt: number): void {
    if (r.life <= 0) return;
    const speed = r.weapon.speed;
    const step = speed * dt;
    _dir.copy(r.velocity).divideScalar(speed);
    if (r.target) this.steer(r, r.target, dt);
    const hit = this.physics.raycast(r.pos, _dir, step, r.owner, true); // `true`: o míssil também acerta as caixas-alvo (coqueiros, P138)
    if (hit) {
      // Um pouco antes da superfície: a explosão não nasce dentro da parede.
      _at.copy(hit.point).addScaledVector(_dir, -0.2);
      this.explode(r, _at);
      return;
    }
    r.prev.copy(r.pos);
    r.pos.addScaledVector(r.velocity, dt);
    r.life -= dt;
    // O míssil leve deixa uma partícula a cada três ticks (são dezenas no ar); o foguete e o teleguiado, duas por tick. Com o `fx` (o cliente), o
    // rastro é a fita de fumaça e fogo dele, e as partículas não saem.
    if (!this.fx && (!r.weapon.salvo || r.age++ % 3 === 0)) {
      this.particles.burst(_back.copy(r.pos).addScaledVector(_dir, -0.6), _dir.negate(), { count: r.weapon.salvo ? 1 : 2, color: r.weapon.guide ? TRAIL_GUIDED : TRAIL, speed: 3, life: r.weapon.salvo ? 0.3 : 0.35, spread: 0.4, gravity: -1 });
    }
    if (r.life <= 0) this.explode(r, _at.copy(r.pos));
  }

  render(alpha: number): void {
    for (const r of this.pool) {
      if (r.life <= 0 || !r.mesh) continue;
      r.mesh.position.lerpVectors(r.prev, r.pos, alpha);
      // O teleguiado curva: o corpo acompanha a direção em que ele anda.
      if (r.weapon.guide) r.mesh.lookAt(_look.copy(r.mesh.position).add(r.velocity));
      this.fx?.flying(r.fxTrail, r.mesh.position, r.weapon, false);
    }
    // Os mísseis leves: uma instância por míssil vivo, deitada na direção do voo.
    let n = 0;
    for (const r of this.micro) {
      if (r.life <= 0) continue;
      _p.lerpVectors(r.prev, r.pos, alpha);
      _q.setFromUnitVectors(Z_AXIS, _dir.copy(r.velocity).normalize());
      this.microMesh.setMatrixAt(n++, _m.compose(_p, _q, _s));
      this.fx?.flying(r.fxTrail, _p, r.weapon, false);
    }
    this.microMesh.count = n;
    this.microMesh.instanceMatrix.needsUpdate = true;
  }

  /** Quantos mísseis do lançador leve estão no ar (teste e diagnóstico). */
  get microActive(): number {
    let n = 0;
    for (const r of this.micro) if (r.life > 0) n++;
    return n;
  }

  /** Rodada nova: some com tudo o que está no ar, sem explodir. */
  clear(): void {
    for (const r of this.pool) {
      r.life = 0;
      r.target = null;
      r.fxTrail = -1;
      if (r.mesh) r.mesh.visible = false;
    }
    for (const r of this.micro) {
      r.life = 0;
      r.fxTrail = -1;
    }
    this.microMesh.count = 0;
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
    if (r.mesh) r.mesh.visible = false;
    _dir.copy(r.velocity).normalize();
    this.fx?.landed(r.fxTrail, at, at, r.weapon, false);
    r.fxTrail = -1;
    this.onExplode?.(at, _dir, r.owner, r.weapon);
  }
}
