import * as THREE from 'three';
import { GLOW } from '../core/palette';

/**
 * O feixe do raio laser (`Beam` em `combat/weapons.ts`), só desenho: cada pulso acende uma linha do cano até onde bateu e ela se apaga em `glow` segundos; como o próximo pulso sai
 * antes (`fireInterval` < `glow`), os pulsos seguidos parecem **um feixe contínuo**. Quem decide onde o pulso bateu e o dano é a partida (`Match.beamPulse`); o cliente online
 * desenha o pulso dos outros jogadores a partir do evento de tiro (`Match.drawBeam`).
 *
 * Duas instâncias por pulso, num `InstancedMesh` cada (duas chamadas de desenho para todos os feixes da cena, nunca uma por feixe): o brilho largo e translúcido e o núcleo fino e
 * claro. Pool fixo de {@link MAX_BEAMS}: cheio, o pulso mais velho cede o lugar. Custo de CPU: dois `setMatrixAt` por feixe aceso por tick; nada é alocado (G4/G5).
 */
export const MAX_BEAMS = 40;

/** A largura do brilho e do núcleo (raio, em m), com o pulso recém-aceso. */
const HALO = 0.07;
const CORE = 0.026;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
/** O núcleo é quase branco em qualquer lado: o que muda a cor do feixe é o brilho em volta. */
const CORE_COLOR = new THREE.Color(2.6, 2.6, 2.6);

interface Beam {
  /** Segundos de brilho que restam (0 = apagado). */
  left: number;
  /** Duração total do brilho deste pulso. */
  total: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

export class BeamVisuals {
  private readonly pool: Beam[] = [];
  private readonly halo: THREE.InstancedMesh;
  private readonly core: THREE.InstancedMesh;
  private readonly colors: THREE.Color[] = [];

  constructor(scene: THREE.Scene) {
    // Um cilindro de raio 1 e comprimento 1 deitado ao longo de Z: a escala dá a largura e o comprimento de cada feixe.
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2);
    const add = (opacity: number): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.halo = new THREE.InstancedMesh(geo, add(0.5), MAX_BEAMS);
    this.core = new THREE.InstancedMesh(geo, add(0.95), MAX_BEAMS);
    for (let i = 0; i < MAX_BEAMS; i++) {
      this.pool.push({ left: 0, total: 1, from: new THREE.Vector3(), to: new THREE.Vector3() });
      this.colors.push(new THREE.Color());
      this.halo.setColorAt(i, this.colors[i]!);
      this.core.setColorAt(i, CORE_COLOR);
    }
    for (const mesh of [this.halo, this.core]) {
      mesh.count = 0;
      mesh.frustumCulled = false; // o feixe corta a cena toda: a caixa original não vale
      scene.add(mesh);
    }
  }

  /** Acende um pulso de `from` a `to`; `hostile` pinta o brilho de vermelho (o do jogador é magenta). `glow` = segundos aceso (`Beam.glow`). */
  spawn(from: THREE.Vector3, to: THREE.Vector3, hostile: boolean, glow: number): void {
    let k = this.pool.findIndex((b) => b.left <= 0);
    if (k < 0) {
      k = 0;
      for (let i = 1; i < this.pool.length; i++) if (this.pool[i]!.left < this.pool[k]!.left) k = i; // cheio: o mais perto de apagar cede o lugar
    }
    const b = this.pool[k]!;
    b.left = b.total = glow;
    b.from.copy(from);
    b.to.copy(to);
    this.colors[k]!.copy(hostile ? GLOW.hostileLaser : GLOW.friendlyLaser);
  }

  /** Um tick: os feixes envelhecem e as instâncias se refazem (mais finos conforme se apagam). */
  update(dt: number): void {
    let n = 0;
    for (let k = 0; k < this.pool.length; k++) {
      const b = this.pool[k]!;
      if (b.left <= 0) continue;
      b.left = Math.max(0, b.left - dt);
      if (b.left <= 0) continue;
      _a.copy(b.from);
      _b.copy(b.to);
      const len = _a.distanceTo(_b);
      if (len < 1e-3) continue;
      _mid.addVectors(_a, _b).multiplyScalar(0.5);
      _q.setFromUnitVectors(Z_AXIS, _b.sub(_a).multiplyScalar(1 / len));
      const fade = 0.35 + 0.65 * (b.left / b.total);
      this.halo.setMatrixAt(n, _m.compose(_mid, _q, _s.set(HALO * fade, HALO * fade, len)));
      this.core.setMatrixAt(n, _m.compose(_mid, _q, _s.set(CORE * fade, CORE * fade, len)));
      this.halo.setColorAt(n, this.colors[k]!);
      n++;
    }
    this.halo.count = this.core.count = n;
    this.halo.instanceMatrix.needsUpdate = this.core.instanceMatrix.needsUpdate = true;
    if (this.halo.instanceColor) this.halo.instanceColor.needsUpdate = true;
  }

  /** Rodada nova ou troca de partida: apaga todos os feixes. */
  clear(): void {
    for (const b of this.pool) b.left = 0;
    this.halo.count = this.core.count = 0;
  }

  /** Quantos feixes estão acesos (teste e diagnóstico). */
  get active(): number {
    let n = 0;
    for (const b of this.pool) if (b.left > 0) n++;
    return n;
  }
}
