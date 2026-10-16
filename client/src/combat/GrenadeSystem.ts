import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import type { ShotFx } from '../fx/WeaponFx';
import type { PhysicsHit, PhysicsWorld } from '../physics/PhysicsWorld';
import { lobAngleDirection, lobDirection, lobFlightTime, lobPoint, lobSpeedFor } from './lob';
import type { WeaponStats } from './weapons';

/** Granadas no ar ao mesmo tempo (G5): quatro por carga, dois ombros, alguns jogadores; cheio, a mais velha estoura no lugar. */
export const MAX_GRENADES = 24;
/** Abaixo disto (m/s) depois de um quique, a granada para no chão e espera a espoleta. */
const REST_SPEED = 1.5;
/** Segundos de vida no máximo (uma granada presa num canto nunca fica para sempre). */
const MAX_LIFE = 10;
/** Em quantos trechos o arco é conferido contra o cenário na hora do tiro. */
const ARC_SAMPLES = 12;
/** Normal com `y` acima disto é chão (a granada crava); abaixo, parede (ela tabela). */
const GROUND_NORMAL = 0.6;
/** O arco baixo serve se chega a esta fração do caminho sem bater no cenário. */
const CLEAR_ENOUGH = 0.9;
/** As elevações que o lançador tenta, da mais baixa à mais alta, quando o arco baixo bate na cobertura (rad: 35° a 75°). */
const LOFT_ANGLES = [35, 45, 55, 65, 75].map((g) => (g * Math.PI) / 180);

interface Grenade {
  live: boolean;
  weapon: WeaponStats;
  owner?: RAPIER.Collider;
  prev: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** Já tocou o cenário: a espoleta corre. */
  touched: boolean;
  fuse: number;
  age: number;
  /** Parada no chão (sem velocidade), esperando a espoleta. */
  resting: boolean;
  /** Giro do desenho (rad); só desenho. */
  spin: number;
  fxTrail: number;
}

const _dir = new THREE.Vector3();
/** A direção escolhida pelo `fire` (não pode ser o `_dir`: lançar com o pool cheio estoura a mais velha, e a explosão usa o `_dir`). */
const _launchDir = new THREE.Vector3();
const _step = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _vn = new THREE.Vector3();
const _at = new THREE.Vector3();
const _low = new THREE.Vector3();
const _try = new THREE.Vector3();
const _toAim = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _axis = new THREE.Vector3(1, 0.3, 0.2).normalize();

/** O raio bateu num robô (corpo cinemático) ou numa caixa-alvo (sensor): aí a granada explode em vez de quicar. */
function hitsBody(hit: PhysicsHit): boolean {
  const c = hit.collider as RAPIER.Collider & { parent?: () => unknown; isSensor?: () => boolean };
  return (c.parent?.() ?? null) !== null || c.isSensor?.() === true;
}

/**
 * O lança-granadas (P160 parte 2b): granadas com **gravidade** no tick fixo (G1/G2: nada de sorteio; o mesmo arco no servidor e no cliente). O tiro
 * sai com a elevação que faz o arco **cair no ponto da mira** (`combat/lob.ts`); se o cenário barra o arco baixo antes de 90% do caminho, sai a menor
 * elevação de 35° a 75° que passa por cima, com a carga (a velocidade) que a faz cair no ponto. Cada tick, um raio do trecho andado: num robô ou numa caixa-alvo, **explode**; na parede **tabela**; no chão
 * **crava** e a espoleta começa a correr (`Lob.fuse`). Quem aplica o dano em área é o `CombatSystem` (`onExplode`), como nos foguetes.
 *
 * Custo: por granada no ar, um raio por tick; no disparo, até 24 raios curtos (os dois arcos conferidos). Pool fixo de {@link MAX_GRENADES}, desenho
 * num `InstancedMesh` só; nada alocado por tick (G4).
 */
export class GrenadeSystem {
  /** A granada explodiu em `at` (cópia reaproveitada: use na hora). `dir` é a direção em que ela andava. */
  onExplode?: (at: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;
  /** Uma granada saiu; `dir` é a direção **até a mira** (o servidor manda como evento de tiro; o cliente acha o ponto da mira por ela e refaz o arco). */
  onFired?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;
  /** Quem desenha o clarão, o brilho que pisca e a fita de fumaça (P160; só o cliente liga). */
  fx?: ShotFx;

  private readonly pool: Grenade[] = [];
  private readonly mesh: THREE.InstancedMesh;

  constructor(
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
  ) {
    for (let i = 0; i < MAX_GRENADES; i++) {
      this.pool.push({
        live: false, weapon: null as unknown as WeaponStats, prev: new THREE.Vector3(), pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        touched: false, fuse: 0, age: 0, resting: false, spin: 0, fxTrail: -1,
      });
    }
    // O corpo: um dodecaedro escuro de metal (a luz que pisca é o cartaz do `fx`), um pouco alongado.
    const geo = new THREE.DodecahedronGeometry(0.2, 0).scale(1, 1, 1.35);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.16, 0.17, 0.15) }), MAX_GRENADES);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Granadas no ar ou no chão esperando a espoleta (teste e diagnóstico). */
  get active(): number {
    let n = 0;
    for (const g of this.pool) if (g.live) n++;
    return n;
  }

  /**
   * Lança de `origin` para cair em `target` (o ponto da mira), escolhendo o arco e a carga (`aimArc`). O evento de tiro leva a direção **até a mira**
   * (como o do cruzador): quem desenha o tiro de outro jogador acha o ponto da mira por ela e refaz a mesma conta.
   */
  fire(origin: THREE.Vector3, target: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats): void {
    if (!w.lob) return;
    const speed = this.aimArc(origin, target, owner, w, _launchDir);
    _toAim.subVectors(target, origin);
    if (_toAim.lengthSq() > 1e-8) _toAim.normalize();
    else _toAim.copy(_launchDir);
    this.onFired?.(origin, _toAim, owner, w);
    this.launch(origin, _launchDir, owner, w, speed);
  }

  /** Lança de `origin` na direção `dir` (unitária) a `speed` m/s (sem ela, a da arma): o tiro já decidido, sem escolher arco nem avisar a rede. */
  launch(origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats, speed = w.speed): void {
    if (!w.lob) return;
    let g = this.pool.find((q) => !q.live);
    if (!g) {
      // Cheio: a mais velha estoura onde está (sumir com ela seria perder um tiro já pago).
      g = this.pool.reduce((a, q) => (q.age > a.age ? q : a));
      this.explode(g, _at.copy(g.pos));
    }
    g.live = true;
    g.weapon = w;
    g.owner = owner;
    g.prev.copy(origin);
    g.pos.copy(origin);
    g.vel.copy(dir).multiplyScalar(speed);
    g.touched = false;
    g.fuse = w.lob.fuse;
    g.age = 0;
    g.resting = false;
    g.spin = 0;
    g.fxTrail = this.fx ? this.fx.fired(origin, dir, w, false) : -1;
  }

  /**
   * A direção de lançamento (em `out`) e a velocidade (o retorno) para cair em `target`. Primeiro o arco **baixo** na carga cheia (rápido): serve se chega
   * a 90% do caminho sem bater no cenário. Senão, a **menor elevação de 35° a 75° que passa limpa**, com a carga que faz cair no ponto (o arco por cima da
   * cobertura, sem virar um morteiro de 40 m de altura). Nada limpo: o que for mais longe. Fora do alcance: o tiro de 45° na carga cheia. A mira prevista
   * do jogador usa a mesma conta.
   */
  aimArc(origin: THREE.Vector3, target: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats, out: THREE.Vector3): number {
    const lob = w.lob!;
    if (!lobDirection(origin, target, w.speed, lob.gravity, false, _low)) {
      out.copy(_low);
      return w.speed;
    }
    let best = this.clearance(origin, _low, w.speed, target, owner, w);
    out.copy(_low);
    if (best >= CLEAR_ENOUGH) return w.speed;
    let speed = w.speed;
    const lowAngle = Math.asin(Math.max(-1, Math.min(1, _low.y)));
    for (const angle of LOFT_ANGLES) {
      if (angle <= lowAngle) continue;
      const v = lobSpeedFor(origin, target, angle, lob.gravity);
      if (!(v <= w.speed)) continue;
      lobAngleDirection(origin, target, angle, _try);
      const clear = this.clearance(origin, _try, v, target, owner, w);
      if (clear > best) {
        best = clear;
        out.copy(_try);
        speed = v;
      }
      if (clear >= CLEAR_ENOUGH) break;
    }
    return speed;
  }

  /** Que fração do voo até `target` o arco que sai com `dir` a `speed` faz antes de bater no **cenário** (um robô no caminho não conta: ali ela explode, que é o que se quer). */
  clearance(origin: THREE.Vector3, dir: THREE.Vector3, speed: number, target: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats): number {
    const lob = w.lob!;
    const T = lobFlightTime(origin, target, dir, speed);
    if (!Number.isFinite(T)) return 1;
    lobPoint(origin, dir, speed, lob.gravity, 0, _a);
    for (let k = 1; k <= ARC_SAMPLES; k++) {
      lobPoint(origin, dir, speed, lob.gravity, (T * k) / ARC_SAMPLES, _b);
      _step.subVectors(_b, _a);
      const len = _step.length();
      if (len > 1e-6) {
        const hit = this.physics.raycast(_a, _step.multiplyScalar(1 / len), len, owner, true);
        // Bater no fim do último trecho é chegar (o alvo está no chão ou na parede).
        if (hit && !hitsBody(hit) && (k < ARC_SAMPLES || hit.distance < len * 0.8)) return (k - 1 + hit.distance / len) / ARC_SAMPLES;
      }
      _a.copy(_b);
    }
    return 1;
  }

  fixedUpdate(dt: number): void {
    for (const g of this.pool) {
      if (!g.live) continue;
      g.age += dt;
      g.prev.copy(g.pos);
      if (g.touched) {
        g.fuse -= dt;
        if (g.fuse <= 0 || g.age >= MAX_LIFE) {
          this.explode(g, _at.copy(g.pos));
          continue;
        }
      } else if (g.age >= MAX_LIFE) {
        this.explode(g, _at.copy(g.pos));
        continue;
      }
      if (g.resting) continue;
      g.vel.y -= g.weapon.lob!.gravity * dt;
      g.spin += dt * 9;
      _step.copy(g.vel).multiplyScalar(dt);
      const len = _step.length();
      if (len < 1e-6) continue;
      _dir.copy(_step).multiplyScalar(1 / len);
      const hit = this.physics.raycast(g.pos, _dir, len, g.owner, true);
      if (!hit) {
        g.pos.add(_step);
        continue;
      }
      if (hitsBody(hit)) {
        // Acerto direto num robô (ou numa caixa-alvo): explode na hora, um pouco antes da superfície.
        this.explode(g, _at.copy(hit.point).addScaledVector(_dir, -0.15));
        continue;
      }
      // Quica: a parte da velocidade na direção da normal volta, a rente à superfície perde. No chão (normal para cima) ela crava e a espoleta corre;
      // na parede, tabela (volta mais e quase não perde a rente) e segue voando.
      const lob = g.weapon.lob!;
      _n.copy(hit.normal);
      const ground = _n.y > GROUND_NORMAL;
      _vn.copy(_n).multiplyScalar(g.vel.dot(_n));
      g.vel.sub(_vn).multiplyScalar(ground ? lob.friction : 0.9).addScaledVector(_vn, -(ground ? lob.bounce : lob.wallBounce));
      g.pos.copy(hit.point).addScaledVector(_n, 0.18);
      if (ground) g.touched = true;
      if (g.vel.length() < REST_SPEED) {
        g.vel.set(0, 0, 0);
        g.resting = _n.y > 0.5; // só para em chão (numa parede, cai)
      }
    }
  }

  /** Desenho do quadro: o corpo girando na posição entre os dois ticks, e o brilho e a fita pelo `fx`. */
  render(alpha: number): void {
    let n = 0;
    for (const g of this.pool) {
      if (!g.live) continue;
      _at.lerpVectors(g.prev, g.pos, alpha);
      _q.setFromAxisAngle(_axis, g.spin);
      this.mesh.setMatrixAt(n++, _m.compose(_at, _q, _s));
      this.fx?.flying(g.fxTrail, _at, g.weapon, false);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Rodada nova: some com tudo, sem explodir. */
  clear(): void {
    for (const g of this.pool) {
      g.live = false;
      g.fxTrail = -1;
    }
    this.mesh.count = 0;
  }

  private explode(g: Grenade, at: THREE.Vector3): void {
    g.live = false;
    this.fx?.landed(g.fxTrail, at, at, g.weapon, false);
    g.fxTrail = -1;
    _dir.copy(g.vel);
    if (_dir.lengthSq() > 1e-8) _dir.normalize();
    else _dir.set(0, -1, 0);
    this.onExplode?.(at, _dir, g.owner, g.weapon);
  }
}
