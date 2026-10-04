import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { WeaponStats } from './weapons';

/** Lançamentos ao mesmo tempo no ar (teto: o mais velho é reaproveitado) e bombas por lançamento (teto de `Barrage.bombs`). */
const MAX_SALVOS = 6;
const MAX_BOMBS = 12;
/** De que altura sobre o chão cada bomba começa a cair (m). */
const FALL_HEIGHT = 55;
/** Ângulo áureo: espalha as bombas sem pontas repetidas nem sorteio (G2). */
const GOLDEN_ANGLE = 2.399963229728653;
const DOWN = new THREE.Vector3(0, -1, 0);
const _out = new THREE.Vector3();

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _from = new THREE.Vector3();
const _at = new THREE.Vector3();
const _flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

/**
 * Onde cai a bomba `i` de `n` em relação ao ponto da mira: um girassol (ângulo áureo) de raio `spread`, girado pela direção
 * de quem atirou (`yaw`) e por `volley` (dois lançadores no mesmo aperto não jogam as bombas nos mesmos lugares). Função pura
 * e contínua: o servidor e o cliente, com a mira quase igual, chegam a lugares quase iguais.
 */
export function bombOffset(i: number, n: number, spread: number, yaw: number, volley: number, out: { x: number; z: number }): void {
  const r = spread * Math.sqrt((i + 0.5) / n);
  const a = yaw + i * GOLDEN_ANGLE + volley * 0.9;
  out.x = Math.cos(a) * r;
  out.z = Math.sin(a) * r;
}

interface Salvo {
  live: boolean;
  /** Segundos desde o lançamento. */
  t: number;
  weapon: WeaponStats;
  owner?: RAPIER.Collider;
  origin: THREE.Vector3;
  /** Por bomba: onde cai (x, z), o terreno que o aviso achou (y), de que altura estava no tick anterior e se já explodiu. */
  x: Float32Array;
  z: Float32Array;
  ground: Float32Array;
  prevY: Float32Array;
  done: Uint8Array;
  bombs: number;
}

/**
 * A chuva de mísseis em voo (G3: módulo independente, ligado ao `Match` por callbacks; G4/G5: pool fixo e nada alocado
 * por tick). O lançamento sobe `ascent` s e some; a bomba `i` começa a cair `ascent + i·stagger` s depois, em linha reta
 * até o chão em `fall` s, e explode no primeiro que encontrar (chão, parede ou Mech), exceto o próprio dono. Quem aplica o dano
 * é o `CombatSystem` (`onExplode`), como nos foguetes. Os avisos no chão aparecem no lançamento e somem quando a bomba explode.
 *
 * Custo: no lançamento, um raio por bomba (achar o terreno do aviso); durante a queda, um raio curto por bomba por tick. No
 * pior caso (6 lançamentos de 8 bombas caindo ao mesmo tempo) são ~48 raios por tick.
 */
export class BarrageSystem {
  /** A bomba explodiu em `at` (cópia reaproveitada: use na hora). `dir` é para baixo. */
  onExplode?: (at: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;
  /** Um lançamento saiu (o servidor manda como evento de tiro). */
  onFired?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;

  private readonly salvos: Salvo[] = [];
  private readonly shells: THREE.Mesh[] = [];
  private readonly bombMesh: THREE.InstancedMesh;
  private readonly markMesh: THREE.InstancedMesh;
  private readonly offset = { x: 0, z: 0 };

  constructor(
    scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
  ) {
    const shellGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.2, 6);
    const shellMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.4, 0.4) });
    for (let i = 0; i < MAX_SALVOS; i++) {
      this.salvos.push({
        live: false,
        t: 0,
        weapon: null as unknown as WeaponStats,
        origin: new THREE.Vector3(),
        x: new Float32Array(MAX_BOMBS),
        z: new Float32Array(MAX_BOMBS),
        ground: new Float32Array(MAX_BOMBS),
        prevY: new Float32Array(MAX_BOMBS),
        done: new Uint8Array(MAX_BOMBS),
        bombs: 0,
      });
      const shell = new THREE.Mesh(shellGeo, shellMat);
      shell.visible = false;
      scene.add(shell);
      this.shells.push(shell);
    }
    const n = MAX_SALVOS * MAX_BOMBS;
    this.bombMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.1, 1.4, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.1, 0.3) }), n);
    this.markMesh = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.82, 1, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.5, 0.2), transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
      n,
    );
    for (const mesh of [this.bombMesh, this.markMesh]) {
      mesh.count = 0;
      mesh.frustumCulled = false; // as instâncias andam por fora da caixa original
      scene.add(mesh);
    }
  }

  /**
   * Lança a chuva de `origin`, com o centro em `target` (o ponto da mira). `dir` é a direção do tiro (o evento de rede) e dá o
   * giro do desenho; `volley` é a ordem do lançador no mesmo aperto (0 = o primeiro). Mira além do alcance da arma: a chuva cai
   * no limite do alcance, na mesma direção.
   */
  fire(origin: THREE.Vector3, dir: THREE.Vector3, target: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats, volley = 0): void {
    const b = w.barrage;
    if (!b) return;
    this.onFired?.(origin, dir, owner, w);
    const s = this.salvos.find((q) => !q.live) ?? this.salvos.reduce((a, q) => (q.t > a.t ? q : a));
    s.live = true;
    s.t = 0;
    s.weapon = w;
    s.owner = owner;
    s.origin.copy(origin);
    s.bombs = Math.min(MAX_BOMBS, b.bombs);
    // Além do alcance: recolhe o centro ao longo da linha de quem atira até ele (só no plano do chão).
    let cx = target.x;
    let cz = target.z;
    const dx = cx - origin.x;
    const dz = cz - origin.z;
    const dist = Math.hypot(dx, dz);
    if (dist > w.maxRange) {
      cx = origin.x + (dx / dist) * w.maxRange;
      cz = origin.z + (dz / dist) * w.maxRange;
    }
    const yaw = Math.atan2(-dir.x, -dir.z);
    for (let i = 0; i < s.bombs; i++) {
      bombOffset(i, s.bombs, b.spread, yaw, volley, this.offset);
      s.x[i] = cx + this.offset.x;
      s.z[i] = cz + this.offset.z;
      // O chão do aviso: o terreno embaixo, sem Mech (o Mech sai dali; se ainda estiver lá, a bomba o acha na queda).
      s.ground[i] = this.physics.terrainY(s.x[i]!, s.z[i]!, target.y + FALL_HEIGHT, FALL_HEIGHT * 3) ?? 0;
      s.prevY[i] = s.ground[i]! + FALL_HEIGHT;
      s.done[i] = 0;
    }
  }

  fixedUpdate(dt: number): void {
    for (const s of this.salvos) {
      if (!s.live) continue;
      s.t += dt;
      const b = s.weapon.barrage!;
      let open = 0;
      for (let i = 0; i < s.bombs; i++) {
        if (s.done[i]) continue;
        open++;
        const since = s.t - (b.ascent + i * b.stagger);
        if (since < 0) continue;
        const ground = s.ground[i]!;
        const y = ground + FALL_HEIGHT * Math.max(0, 1 - since / b.fall);
        const from = s.prevY[i]!;
        // Um raio curto do trecho que a bomba andou neste tick: bate no que estiver no caminho (parede, telhado, Mech).
        const hit = from > y ? this.physics.raycast(_from.set(s.x[i]!, from, s.z[i]!), DOWN, from - y, s.owner) : null;
        if (hit) this.land(s, i, _at.set(s.x[i]!, hit.point.y + 0.2, s.z[i]!));
        else if (y <= ground) this.land(s, i, _at.set(s.x[i]!, ground + 0.2, s.z[i]!));
        else s.prevY[i] = y;
      }
      if (open === 0) s.live = false;
    }
  }

  /** Desenho do quadro: lançamentos subindo, bombas caindo e avisos no chão. `alpha` = quanto do próximo tick já passou. */
  render(alpha: number): void {
    let bombs = 0;
    let marks = 0;
    for (let k = 0; k < this.salvos.length; k++) {
      const s = this.salvos[k]!;
      const shell = this.shells[k]!;
      if (!s.live) {
        shell.visible = false;
        continue;
      }
      const b = s.weapon.barrage!;
      const t = s.t + alpha / 60;
      // O lançamento sobe na vertical, à velocidade da arma, e some no alto.
      shell.visible = t < b.ascent;
      if (shell.visible) shell.position.set(s.origin.x, s.origin.y + s.weapon.speed * t, s.origin.z);
      for (let i = 0; i < s.bombs; i++) {
        if (s.done[i]) continue;
        const since = t - (b.ascent + i * b.stagger);
        const ground = s.ground[i]!;
        // Aviso no chão: respira, e fecha o círculo conforme a bomba chega.
        const pulse = 1 + 0.08 * Math.sin(t * 12 + i);
        const close = since > 0 ? 0.45 + 0.55 * Math.max(0, 1 - since / b.fall) : 1;
        _p.set(s.x[i]!, ground + 0.12, s.z[i]!);
        const radius = s.weapon.blastRadius * pulse * close;
        this.markMesh.setMatrixAt(marks++, _m.compose(_p, _flat, _s.set(radius, radius, 1)));
        if (since < 0) continue;
        _p.set(s.x[i]!, ground + FALL_HEIGHT * Math.max(0, 1 - since / b.fall), s.z[i]!);
        this.bombMesh.setMatrixAt(bombs++, _m.compose(_p, _q.identity(), _s.set(1, 1, 1)));
      }
    }
    this.bombMesh.count = bombs;
    this.markMesh.count = marks;
    this.bombMesh.instanceMatrix.needsUpdate = true;
    this.markMesh.instanceMatrix.needsUpdate = true;
  }

  /** Rodada nova: some com tudo o que está no ar, sem explodir. */
  clear(): void {
    for (const s of this.salvos) s.live = false;
    for (const shell of this.shells) shell.visible = false;
    this.bombMesh.count = 0;
    this.markMesh.count = 0;
  }

  /** Quantos lançamentos estão no ar (teste e diagnóstico). */
  get active(): number {
    return this.salvos.reduce((n, s) => n + (s.live ? 1 : 0), 0);
  }

  private land(s: Salvo, i: number, at: THREE.Vector3): void {
    s.done[i] = 1;
    this.onExplode?.(at, _out.copy(DOWN), s.owner, s.weapon); // cópia: quem ouve pode mexer na direção
  }
}
