import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { GLOW } from '../core/palette';
import type { PhysicsHit, PhysicsWorld } from '../physics/PhysicsWorld';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { IMPACT_FX, TRAIL_FX } from '../fx/impactFx';
import { buildSlugGeometry, buildSteelMaterial, KINETIC, SLUG_TAIL, STEEL } from '../fx/kineticShot';
import { MUZZLE_FX } from '../fx/muzzleFx';
import { buildStreakGeometry, buildStreakMaterial, growingLength, STREAK_HEAD_WIDTH, streakLength } from '../fx/ShotStreak';
import type { ShotFx } from '../fx/WeaponFx';
import { applySpread, spreadAt, type Spread } from './spread';
import { hitDamage, weapon, type WeaponStats } from './weapons';

interface Projectile {
  mesh: THREE.Mesh;
  /** O corpo de aço do tiro de metal (canhão pesado e automático); escondido nos tiros de luz. */
  body: THREE.Mesh;
  /** Comprimento cheio da cauda (m), só no tiro de energia comum; 0 = o desenho próprio do trilho e do EMP. */
  tail: number;
  prev: THREE.Vector3;
  pos: THREE.Vector3;
  /** De onde saiu (o raio iônico do trilho vai daqui ao ponto do acerto). */
  origin: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  /** Tiro de inimigo (cor de aviso). */
  hostile: boolean;
  /** O rastro em fita deste projétil no `ShotFx` (-1 = sem rastro). */
  fxTrail: number;
  /** A arma de quem atirou (velocidade, alcance, dano e queda com a distância). */
  weapon: WeaponStats;
  /** Metros já percorridos: o plasma perde força com a distância. */
  traveled: number;
  owner?: RAPIER.Collider;
}

const _dir = new THREE.Vector3();
const _hitAt = new THREE.Vector3();
const _hitNormal = new THREE.Vector3();
const _look = new THREE.Vector3();
const _side = new THREE.Vector3();
const _eject = new THREE.Vector3();
const _pellet = new THREE.Vector3();
const _spread: Spread = { x: 0, y: 0 };
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Projéteis de plasma com pool fixo. Simulados no tick fixo com raycast do
 * segmento percorrido (não atravessa nada em alta velocidade); o render interpola.
 */
export class ProjectileSystem {
  /** Chamado a cada impacto (Mech ou destrutível; quem decide é o CombatSystem). `damage` já vem com a queda por distância; `owner` = quem atirou. */
  onHit?: (hit: PhysicsHit, dir: THREE.Vector3, damage: number, owner?: RAPIER.Collider, w?: WeaponStats, distance?: number) => void;
  /** Um tiro saiu (o servidor do multiplayer manda como evento). */
  onFired?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;
  /** Quem desenha o clarão, o brilho da cabeça, o rastro e a marca (P160; só o cliente liga). */
  fx?: ShotFx;

  private readonly pool: Projectile[] = [];
  private readonly friendlyMat: THREE.MeshBasicMaterial;
  private readonly hostileMat: THREE.MeshBasicMaterial;
  /** Tiro de energia comum (plasma, blaster, escopeta): faixa com cauda; o trilho e o EMP seguem com a esfera esticada. */
  private readonly orbGeo = new THREE.SphereGeometry(0.2, 8, 6);
  private readonly streakGeo = buildStreakGeometry();
  private readonly friendlyStreak = buildStreakMaterial(GLOW.friendlyPlasma);
  private readonly hostileStreak = buildStreakMaterial(GLOW.hostilePlasma);
  /** A arma elétrica usa a mesma faixa, em azul-branco (jogador) e violeta (inimigo): não se confunde com o plasma. */
  private readonly friendlyArcStreak = buildStreakMaterial(GLOW.friendlyArc);
  private readonly hostileArcStreak = buildStreakMaterial(GLOW.hostileArc);
  /** A arma de gelo usa a mesma faixa, em branco-gelo (jogador) e lilás pálido (inimigo): não se confunde com o plasma nem com a elétrica. */
  private readonly friendlyIceStreak = buildStreakMaterial(GLOW.friendlyIce);
  private readonly hostileIceStreak = buildStreakMaterial(GLOW.hostileIce);
  /** O tiro de metal: corpo de aço sólido (a geometria é uma só para o pool) e uma cauda quente de luz atrás dele. */
  private readonly slugGeo = buildSlugGeometry();
  private readonly friendlySteel = buildSteelMaterial(STEEL.friendly);
  private readonly hostileSteel = buildSteelMaterial(STEEL.hostile);
  private readonly friendlySlugTail = buildStreakMaterial(SLUG_TAIL.friendly);
  private readonly hostileSlugTail = buildStreakMaterial(SLUG_TAIL.hostile);

  constructor(
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly particles: ParticleSystem,
    size = 64,
  ) {
    const mat = new THREE.MeshBasicMaterial({ color: GLOW.friendlyPlasma });
    this.hostileMat = new THREE.MeshBasicMaterial({ color: GLOW.hostilePlasma });
    this.friendlyMat = mat;
    // Primer escondido da faixa: o pool nasce com a esfera e só ganha o material da faixa no primeiro tiro, então a
    // pré-compilação (`core/ShaderWarmup.ts`) não a veria; este objeto leva o programa dela para o carregamento.
    // Os dois lados (jogador e inimigo) usam o mesmo programa; um só basta.
    const primer = new THREE.Mesh(this.streakGeo, this.friendlyStreak);
    primer.visible = false;
    scene.add(primer);
    for (let i = 0; i < size; i++) {
      const mesh = new THREE.Mesh(this.orbGeo, mat);
      mesh.scale.set(1, 1, 6);
      mesh.visible = false;
      scene.add(mesh);
      const body = new THREE.Mesh(this.slugGeo, this.friendlySteel);
      body.visible = false;
      scene.add(body);
      this.pool.push({
        mesh, body, tail: 0,
        prev: new THREE.Vector3(),
        pos: new THREE.Vector3(),
        origin: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
        hostile: false,
        fxTrail: -1,
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
    // A escopeta (P160) sai em balins: um projétil por balin, no desenho fixo do cone (`Pellets`); um só evento de tiro e um só clarão.
    let first: Projectile | undefined;
    const pellets = w.pellets;
    if (!pellets) first = this.launch(origin, dir, owner, hostile, w);
    else {
      for (let k = 0; k < pellets.count; k++) {
        const p = this.launch(origin, applySpread(_pellet.copy(dir), spreadAt(k, pellets.cone, _spread)), owner, hostile, w);
        first ??= p;
      }
    }
    if (!first) return;
    this.muzzle(origin, dir, w);
    first.fxTrail = this.fx ? this.fx.fired(origin, dir, w, hostile) : -1;
  }

  /** Um projétil do pool sai de `origin` rumo a `dir` (unitária). Pool cheio: o tiro não sai. */
  private launch(origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, hostile: boolean, w: WeaponStats): Projectile | undefined {
    let p: Projectile | undefined;
    for (const q of this.pool) if (q.life <= 0) { p = q; break; }
    if (!p) return undefined;
    p.fxTrail = -1;
    p.pos.copy(origin);
    p.prev.copy(origin);
    p.origin.copy(origin);
    p.hostile = hostile;
    p.velocity.copy(dir).multiplyScalar(w.speed);
    p.life = w.maxRange / w.speed;
    p.owner = owner;
    p.weapon = w;
    p.traveled = 0;
    p.mesh.position.copy(origin);
    p.mesh.lookAt(_look.copy(origin).add(dir));
    // Tiro comum: faixa com cauda. Trilho e EMP (têm `tracer`): a esfera esticada de sempre, com o traço do trilho.
    const arc = w.tracer === 'arc';
    const ice = w.tracer === 'ice';
    const metal = w.tracer === 'shell' || w.tracer === 'slug' ? KINETIC[w.tracer] : undefined;
    const streak = w.tracer === undefined || arc || ice || metal !== undefined;
    p.tail = metal ? metal.tail : streak ? streakLength(w.speed) : 0;
    p.mesh.geometry = streak ? this.streakGeo : this.orbGeo;
    p.mesh.material = streak
      ? metal ? (hostile ? this.hostileSlugTail : this.friendlySlugTail)
        : arc ? (hostile ? this.hostileArcStreak : this.friendlyArcStreak)
        : ice ? (hostile ? this.hostileIceStreak : this.friendlyIceStreak)
        : hostile ? this.hostileStreak : this.friendlyStreak
      : hostile ? this.hostileMat : this.friendlyMat;
    if (w.tracer === 'rail') p.mesh.scale.set(0.45, 0.45, 18);
    else if (w.tracer === 'pulse') p.mesh.scale.set(2.5, 2.5, 2.5);
    else if (metal) p.mesh.scale.set(metal.tailWidth, metal.tailWidth, growingLength(p.tail, 0));
    else p.mesh.scale.set(STREAK_HEAD_WIDTH, STREAK_HEAD_WIDTH, growingLength(p.tail, 0));
    p.mesh.visible = true;
    // O corpo de aço só existe nos tiros de metal: na mesma posição e direção da cabeça da cauda.
    p.body.visible = metal !== undefined;
    if (metal) {
      p.body.material = hostile ? this.hostileSteel : this.friendlySteel;
      p.body.scale.set(metal.radius, metal.radius, metal.length);
      p.body.position.copy(origin);
      p.body.quaternion.copy(p.mesh.quaternion);
    }
    return p;
  }

  fixedUpdate(dt: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;

      const speed = p.velocity.length();
      const step = Math.min(speed * dt, p.weapon.maxRange - p.traveled);
      if (step <= 0) { this.kill(p); continue; }
      _dir.copy(p.velocity).divideScalar(speed);
      const hit = this.physics.raycast(p.pos, _dir, step, p.owner, true); // `true`: o tiro também acerta as caixas-alvo (coqueiros, P138)

      if (hit) {
        // O resultado do raycast é reaproveitado: copia antes que o onHit dispare outro.
        _hitNormal.copy(hit.normal);
        _hitAt.copy(hit.point).addScaledVector(_hitNormal, 0.05);
        // Superfície parada (colisor sem corpo: parede, chão, prédio) pode ficar com a marca do tiro; um Mech, não (a marca sairia andando).
        const onStatic = this.fx !== undefined && (hit.collider.parent?.() ?? null) === null;
        this.onHit?.(hit, _dir, hitDamage(p.weapon, p.traveled + hit.distance), p.owner, p.weapon, p.traveled + hit.distance);

        // O impacto é da arma (`fx/impactFx.ts`): faíscas verdes, raios azuis, flocos de gelo, anéis de EMP ou faíscas de metal.
        for (const o of IMPACT_FX[p.weapon.id]) this.particles.burst(_hitAt, _hitNormal, o);
        if (this.fx) {
          this.fx.impact(_hitAt, _hitNormal, p.weapon, p.hostile, onStatic);
          this.fx.landed(p.fxTrail, p.origin, _hitAt, p.weapon, p.hostile);
        }
        this.kill(p);
        continue;
      }

      p.prev.copy(p.pos);
      p.pos.addScaledVector(_dir, step);
      // Alguns tiros deixam um rastro de partículas no caminho (`fx/impactFx.ts`): o gelo, uma bruma de frio a cada metro e um floco pequeno a cada 3,5 m; o obus, um fiapo de fumaça a cada 3 m.
      // Com o `fx` (o cliente), o obus deixa a fita de fumaça dele (`fx/Ribbons.ts`) no lugar dos fiapos; a bruma do gelo continua.
      const trail = p.weapon.tracer === 'ice' || (p.weapon.tracer === 'shell' && !this.fx) ? TRAIL_FX[p.weapon.tracer] : undefined;
      if (trail) {
        for (const t of trail) {
          if (Math.floor((p.traveled + step) / t.every) === Math.floor(p.traveled / t.every)) continue;
          for (const o of t.fx) this.particles.burst(p.pos, _dir, o);
        }
      }
      p.traveled += step;
      p.life -= dt;
      if (p.life <= 0) {
        this.fx?.landed(p.fxTrail, p.origin, p.pos, p.weapon, p.hostile);
        this.kill(p);
      }
    }
  }

  render(alpha: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.mesh.position.lerpVectors(p.prev, p.pos, alpha);
      if (p.body.visible) p.body.position.copy(p.mesh.position);
      // A cauda cresce com o caminho já andado: nasce na boca em vez de atravessar o robô que atirou.
      if (p.tail > 0) p.mesh.scale.z = growingLength(p.tail, p.traveled);
      this.fx?.flying(p.fxTrail, p.mesh.position, p.weapon, p.hostile);
    }
  }

  /** Some com todos os projéteis em voo (rodada nova). */
  clear(): void {
    for (const p of this.pool) {
      p.life = 0;
      p.fxTrail = -1;
      p.mesh.visible = p.body.visible = false;
    }
  }

  /**
   * O clarão da boca do tiro de metal (`fx/muzzleFx.ts`): a língua de fogo, a fumaça e, no automático, o estojo vazio, que salta para o lado
   * e para cima do cano. As outras armas seguem com o clarão genérico de quem atira.
   */
  private muzzle(origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats): void {
    const fx = MUZZLE_FX[w.id];
    if (!fx) return;
    for (const o of fx.flash) this.particles.burst(origin, dir, o);
    if (!fx.casing) return;
    _side.crossVectors(dir, UP);
    if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0); // atirando reto para cima ou para baixo
    _side.normalize();
    this.particles.burst(origin, _eject.copy(_side).multiplyScalar(0.9).addScaledVector(UP, 0.5), fx.casing);
  }

  private kill(p: Projectile): void {
    p.life = 0;
    p.fxTrail = -1;
    p.mesh.visible = false;
    p.body.visible = false;
  }
}
