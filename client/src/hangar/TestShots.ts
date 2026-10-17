import * as THREE from 'three';
import { cruiseApex, cruisePoint } from '../combat/CruiseSystem';
import { lobDirection, lobFlightTime, lobPoint } from '../combat/lob';
import { applySpread, spreadAt, type Spread } from '../combat/spread';
import type { WeaponStats } from '../combat/weapons';
import { BeamVisuals } from '../fx/BeamVisuals';
import { hookRay } from '../fx/HookVisuals';
import { IMPACT_FX } from '../fx/impactFx';
import { ParticleSystem } from '../fx/ParticleSystem';
import { WeaponFx } from '../fx/WeaponFx';

/**
 * Os tiros do "Testar" do Hangar com a cara do jogo (P160 parte 3; o Comandante, 15/10: "selecionei e implementei elas mas parece que são armas
 * antigas"). Antes o teste desenhava todo tiro com o mesmo traço (ciano na energia, laranja na munição) — o primeiro lugar onde se vê uma arma não
 * mostrava nada do que ela é. Agora cada tiro do teste passa pela mesma camada de efeitos do jogo (`WeaponFx`: o clarão da boca, o brilho da cabeça,
 * o rastro em fita, o clarão do acerto, a explosão com corpo e o raio do trilho; o feixe do laser no `BeamVisuals`), com a **trajetória da família**:
 * reta na velocidade da arma (o trilho chega na hora, o teleguiado devagar), a salva do lançador leve com o desvio dela, os **nove balins** da escopeta
 * em cone, o **arco** do cruzador e o **arco com gravidade** da granada.
 *
 * Só desenho (o Hangar não tem física: o tiro vai do cano ao ponto do alvo). Pool fixo, nada alocado por quadro (G4/G5); a cena do Hangar paga o custo
 * só durante o teste.
 */

/** Tiros do teste no ar ao mesmo tempo (o lançador leve MK III nos dois ombros solta 64 em ~2 s). */
export const TEST_SHOTS = 160;

type Path = 'line' | 'cruise' | 'lob';

interface TestShot {
  live: boolean;
  w: WeaponStats;
  path: Path;
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** A direção de lançamento e a velocidade (só no arco da granada). */
  dir: THREE.Vector3;
  speed: number;
  /** Altura do ápice do arco do cruzador (m). */
  apex: number;
  t: number;
  dur: number;
  trail: number;
}

const _p = new THREE.Vector3();
const _d = new THREE.Vector3();
const _n = new THREE.Vector3();
const _spread: Spread = { x: 0, y: 0 };

/** Onde está o tiro `s` no tempo `t` (em `out`). Puro: o teste confere a trajetória sem a cena. */
export function testShotPoint(s: Pick<TestShot, 'w' | 'path' | 'from' | 'to' | 'dir' | 'speed' | 'apex' | 'dur'>, t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = s.dur > 0 ? Math.min(1, t / s.dur) : 1;
  if (s.path === 'cruise') return cruisePoint(s.from, s.to, s.apex, u, out);
  if (s.path === 'lob') return lobPoint(s.from, s.dir, s.speed, s.w.lob!.gravity, Math.min(t, s.dur), out);
  return out.lerpVectors(s.from, s.to, u);
}

export class TestShots {
  readonly particles: ParticleSystem;
  readonly beams: BeamVisuals;
  readonly fx: WeaponFx;
  /** Um tiro chegou ao alvo (o Hangar acende o alvo). */
  onHit?: () => void;
  private readonly pool: TestShot[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    camera: THREE.Camera,
    floorY = 0,
    particles?: ParticleSystem,
  ) {
    this.particles = particles ?? new ParticleSystem(900);
    scene.add(this.particles.points);
    this.beams = new BeamVisuals(scene);
    this.fx = new WeaponFx(this.particles, camera, () => floorY, this.beams);
    for (const o of this.fx.objects) scene.add(o);
    for (let i = 0; i < TEST_SHOTS; i++) {
      this.pool.push({ live: false, w: null as unknown as WeaponStats, path: 'line', from: new THREE.Vector3(), to: new THREE.Vector3(), dir: new THREE.Vector3(), speed: 0, apex: 0, t: 0, dur: 0, trail: -1 });
    }
  }

  /** Tiros no ar (o teste e o diagnóstico). */
  get active(): number {
    let n = 0;
    for (const s of this.pool) if (s.live) n++;
    return n;
  }

  /**
   * Um tiro do teste, de `from` (a boca) até `to` (o ponto do alvo). `k` é o número do tiro no teste (o desvio da salva sai dele, sem sorteio). Os balins
   * da escopeta saem todos juntos, no cone dela.
   */
  fire(from: THREE.Vector3, to: THREE.Vector3, w: WeaponStats, k: number): void {
    _d.subVectors(to, from);
    const dist = _d.length();
    if (dist < 1e-3) return;
    _d.multiplyScalar(1 / dist);
    if (w.hook) {
      // O arpão: o raio ciano acende do cano ao alvo, na hora (no teste não há robô para prender: o cabo preso só existe numa partida).
      hookRay(this.beams, from, to, false);
      this.fx.fired(from, _d, w, false);
      return;
    }
    if (w.beam) {
      // O laser: o feixe acende do cano ao alvo, na hora.
      this.beams.spawn(from, to, false, w.beam.glow);
      this.fx.fired(from, _d, w, false);
      this.arrive(to, w);
      return;
    }
    const trail = this.fx.fired(from, _d, w, false);
    if (w.pellets) {
      for (let i = 0; i < w.pellets.count; i++) {
        _p.copy(_d);
        applySpread(_p, spreadAt(i, w.pellets.cone, _spread));
        this.launch(from, _n.copy(from).addScaledVector(_p, dist), w, 'line', i === 0 ? trail : -1);
      }
      return;
    }
    if (w.salvo) {
      _p.copy(_d);
      applySpread(_p, spreadAt(k, w.salvo.cone, _spread));
      this.launch(from, _n.copy(from).addScaledVector(_p, dist), w, 'line', trail);
      return;
    }
    this.launch(from, to, w, w.cruise ? 'cruise' : w.lob ? 'lob' : 'line', trail);
  }

  /** Por quadro: os tiros andam, os que chegam acertam, e a camada de efeitos se monta. */
  update(dt: number): void {
    this.fx.beginFrame();
    for (const s of this.pool) {
      if (!s.live) continue;
      s.t += dt;
      if (s.t >= s.dur) {
        s.live = false;
        this.fx.landed(s.trail, s.from, s.to, s.w, false);
        this.arrive(s.to, s.w);
        continue;
      }
      this.fx.flying(s.trail, testShotPoint(s, s.t, _p), s.w, false);
    }
    this.particles.update(dt);
    this.beams.update(dt);
    this.fx.update(dt);
  }

  /** Teste novo ou Hangar fechado: some com tudo. */
  clear(): void {
    for (const s of this.pool) s.live = false;
    this.beams.clear();
    this.fx.clear();
  }

  private launch(from: THREE.Vector3, to: THREE.Vector3, w: WeaponStats, path: Path, trail: number): void {
    const s = this.pool.find((q) => !q.live);
    if (!s) return;
    s.live = true;
    s.w = w;
    s.path = path;
    s.from.copy(from);
    s.to.copy(to);
    s.t = 0;
    s.trail = trail;
    const dist = from.distanceTo(to);
    if (path === 'lob') {
      // O arco baixo na carga cheia (no Hangar não há cobertura no caminho).
      lobDirection(from, to, w.speed, w.lob!.gravity, false, s.dir);
      s.speed = w.speed;
      s.dur = lobFlightTime(from, to, s.dir, w.speed);
      if (!Number.isFinite(s.dur)) s.dur = dist / w.speed;
    } else if (path === 'cruise') {
      s.apex = cruiseApex(dist, w.cruise!.apex, w.cruise!.minApex, w.cruise!.maxApex);
      s.dur = (dist * 1.25) / w.speed;
    } else {
      s.dur = dist / w.speed;
    }
  }

  /** O tiro chegou: o clarão e as faíscas do acerto da arma, e a explosão das armas de área. */
  private arrive(at: THREE.Vector3, w: WeaponStats): void {
    // A normal do acerto: do alvo de volta para o Mech (no centro do galpão), deitada.
    _n.copy(this.scene.position).sub(at).setY(0);
    if (_n.lengthSq() < 1e-6) _n.set(0, 0, 1);
    _n.normalize();
    this.fx.impact(at, _n, w, false, false);
    for (const o of IMPACT_FX[w.id]) this.particles.burst(at, _n, o);
    // As armas de munição com explosão (foguete, míssil, granada) estouram aqui; o canhão de cerco já estoura pelo `impact` (a tabela de aparência).
    if (w.blastRadius > 0 && w.kind === 'ammo') this.fx.explosion(at, w);
    this.onHit?.();
  }
}
