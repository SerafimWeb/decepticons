import * as THREE from 'three';
import type { WeaponId, WeaponStats } from '../combat/weapons';
import type { BeamVisuals } from './BeamVisuals';
import { BILL, Billboards } from './Billboards';
import { EXPLOSION_LOOK, Explosions } from './Explosions';
import { Marks } from './Marks';
import type { ParticleSystem } from './ParticleSystem';
import { Trails, type TrailKind } from './Ribbons';
import { WEAPON_LOOK } from './weaponLook';

/**
 * O que a simulação de tiro avisa a quem desenha (P160). A simulação (`ProjectileSystem`, `RocketSystem`, `CruiseSystem`, `BarrageSystem`) roda igual
 * no servidor, que não desenha: lá este campo fica vazio e não custa nada. No cliente, o `WeaponFx` atende.
 */
export interface ShotFx {
  /** Saiu um tiro de `w` em `origin` rumo a `dir`: o clarão da boca; devolve o número do rastro do projétil (-1 = sem rastro). */
  fired(origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats, hostile: boolean): number;
  /** O projétil está em `at` neste quadro (a posição desenhada): o brilho da cabeça e a ponta do rastro. */
  flying(trail: number, at: THREE.Vector3, w: WeaponStats, hostile: boolean): void;
  /** O tiro bateu em `at` (normal `normal`); `onStatic` = numa superfície parada (parede, chão), onde pode ficar marca. */
  impact(at: THREE.Vector3, normal: THREE.Vector3, w: WeaponStats, hostile: boolean, onStatic: boolean): void;
  /** O projétil acabou (acertou ou chegou ao alcance) em `to`, tendo saído de `from`: o rastro se solta; o trilho deixa o raio iônico. */
  landed(trail: number, from: THREE.Vector3, to: THREE.Vector3, w: WeaponStats, hostile: boolean): void;
  /** Um rastro sem tiro (as bombas da chuva, que começam a cair longe do lançamento); devolve o número dele (-1 = pool cheio). */
  trail(kind: TrailKind, at: THREE.Vector3): number;
}

const _v = new THREE.Vector3();
const _at = new THREE.Vector3();
const _n = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const RAIL_COLOR = new THREE.Color(0.8, 1.4, 2.6);
const RAIL_HOSTILE = new THREE.Color(2.6, 0.6, 1.5);

/**
 * Os efeitos de arma do cliente num lugar só (P160): cartazes de luz (`Billboards`), marcas (`Marks`), rastros (`Trails`) e explosões
 * (`Explosions`), conduzidos pela tabela de aparência (`weaponLook.ts`). O `Game` cria um, põe os lotes na cena (`objects`), entrega como `fx` aos
 * sistemas de tiro, chama `beginFrame` antes de desenhar os projéteis e `update` depois.
 *
 * Custo: 10 desenhos para todos os efeitos da cena (cartazes 1, marcas 2, rastros 3, fogo, fumaça e estilhaços 3, e o raio do trilho no pool do
 * laser); CPU só nas peças vivas. Nada é alocado por quadro.
 */
export class WeaponFx implements ShotFx {
  readonly bill = new Billboards();
  readonly marks = new Marks();
  readonly trails = new Trails();
  readonly explosions: Explosions;
  readonly objects: readonly THREE.Object3D[];
  /** Contador de acertos por arma (a marca de quem acerta muito sai a cada N). */
  private readonly hits = new Map<WeaponId, number>();
  private flicker = 0;

  constructor(
    particles: ParticleSystem,
    private readonly camera: THREE.Camera,
    /** A altura do chão embaixo de (x, y, z), ou `null` se não há chão perto (o `PhysicsWorld.terrainY`). */
    private readonly groundAt: (x: number, y: number, z: number) => number | null,
    /** O pool de feixes (o do laser, `Match.beams`): o raio iônico do trilho sai nele. */
    private readonly beams: BeamVisuals | null = null,
  ) {
    this.explosions = new Explosions(this.bill, this.marks, particles);
    this.objects = [...this.marks.meshes, ...this.trails.meshes, ...this.explosions.objects, this.bill.mesh];
  }

  /** Peças de efeito vivas (painel de depuração e testes). */
  get active(): number {
    return this.bill.active + this.marks.active + this.trails.active + this.explosions.active;
  }

  fired(origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats, hostile: boolean): number {
    const look = WEAPON_LOOK[w.id];
    const m = look.muzzle;
    if (m) {
      const color = hostile ? m.hostile : m.friendly;
      _at.copy(origin).addScaledVector(dir, 0.25);
      this.bill.flash(_at, color, m.shape, m.size * 0.6, m.size, m.life, (this.flicker++ % 4) * 0.4);
      if (m.tongue) {
        // A língua de fogo deitada na direção do tiro, vista de lado: o comprimento é o quanto a direção aparece na tela (de costas para a câmera, quase nada).
        _v.copy(dir).transformDirection(this.camera.matrixWorldInverse);
        const side = Math.hypot(_v.x, _v.y);
        if (side > 0.15) {
          const len = m.size * 1.1 * side;
          _at.copy(origin).addScaledVector(dir, len * 0.5);
          this.bill.flash(_at, color, BILL.spike, len, len * 1.15, m.life * 0.8, Math.atan2(_v.y, _v.x));
        }
      }
    }
    return look.trail ? this.trails.start(look.trail, origin) : -1;
  }

  flying(trail: number, at: THREE.Vector3, w: WeaponStats, hostile: boolean): void {
    if (trail >= 0) this.trails.head(trail, at);
    const g = WEAPON_LOOK[w.id].glow;
    if (!g) return;
    // A estrela elétrica pisca (o brilho troca a cada quadro); o resto brilha firme.
    const pulse = g.shape === BILL.star ? 0.65 + 0.5 * ((this.flicker++ * 7) % 5) / 4 : 1;
    this.bill.put(at, hostile ? g.hostile : g.friendly, g.shape, g.size, pulse, g.shape === BILL.star ? this.flicker * 0.9 : 0);
  }

  impact(at: THREE.Vector3, normal: THREE.Vector3, w: WeaponStats, hostile: boolean, onStatic: boolean): void {
    const look = WEAPON_LOOK[w.id];
    if (look.hit) this.bill.flash(at, hostile ? look.hit.hostile : look.hit.friendly, look.hit.shape, look.hit.size * 0.5, look.hit.size, 0.1, this.flicker * 0.7);
    const mark = look.mark;
    if (mark && onStatic) {
      const n = (this.hits.get(w.id) ?? 0) + 1;
      this.hits.set(w.id, n);
      if (n % mark.every === 0) this.marks.add(mark.kind, at, normal, mark.size, mark.size, mark.life, hostile ? mark.hostile : mark.friendly);
    }
    if (look.blast && w.blastRadius > 0) this.explosion(at, w);
  }

  landed(trail: number, from: THREE.Vector3, to: THREE.Vector3, w: WeaponStats, hostile: boolean): void {
    if (trail >= 0) this.trails.end(trail);
    if (WEAPON_LOOK[w.id].rail && this.beams) this.beams.spawn(from, to, hostile, 0.4, hostile ? RAIL_HOSTILE : RAIL_COLOR, 1.25);
  }

  trail(kind: TrailKind, at: THREE.Vector3): number {
    return this.trails.start(kind, at);
  }

  /** A explosão de uma arma de área (foguete, míssil, bomba, obus), do tamanho do raio dela. */
  explosion(at: THREE.Vector3, w: WeaponStats): void {
    this.explosions.spawn(at, w.blastRadius, this.groundAt(at.x, at.y, at.z));
  }

  /** Um Mech de `height` m foi destruído em `at` (a posição dos pés): a explosão grande, com estilhaços. */
  wreck(at: THREE.Vector3, height: number): void {
    _at.copy(at).addScaledVector(UP, height * 0.45);
    const ground = this.groundAt(at.x, at.y + 1, at.z);
    this.explosions.spawn(_at, Math.max(4.5, height * 1.25), ground, EXPLOSION_LOOK.wreck);
    // Um segundo estouro, menor e mais alto, por dentro do primeiro: o reator que estoura junto com a carcaça.
    _n.copy(_at).addScaledVector(UP, height * 0.3);
    this.explosions.spawn(_n, Math.max(3, height * 0.7), ground, EXPLOSION_LOOK.wreck);
  }

  /** Antes de desenhar os projéteis do quadro (os brilhos do quadro anterior somem). */
  beginFrame(): void {
    this.bill.beginFrame();
  }

  /** Depois de desenhar os projéteis: tudo envelhece e os lotes se montam. */
  update(dt: number): void {
    this.trails.update(dt, this.camera.getWorldPosition(_v));
    this.explosions.update(dt);
    this.marks.update(dt);
    this.bill.update(dt);
  }

  clear(): void {
    this.bill.clear();
    this.marks.clear();
    this.trails.clear();
    this.explosions.clear();
  }
}
