import * as THREE from 'three';

/**
 * Rastros contínuos em fita (P160): a fumaça que o foguete, o míssil e o obus deixam no ar, e a língua de fogo do motor. Antes o rastro era uma
 * fila de pontinhos (uma partícula a cada tantos metros): de perto, uma linha pontilhada. Agora é uma **fita virada para a câmera** que nasce fina
 * na cauda do projétil, alarga e some com a idade, com a borda macia; depois que o projétil explode, o resto da fita fica no ar e se desfaz.
 *
 * Como funciona: cada fita é um anel de pontos (um a cada `spacing` m de caminho); a cabeça acompanha o projétil a cada quadro (`head`). A cada
 * quadro, a CPU monta os dois vértices de cada ponto (a largura vai para o lado, perpendicular ao caminho e à câmera). Um pool de fitas por
 * material, **um desenho por pool**; os vértices das fitas paradas ficam em área zero (o placa de vídeo descarta de graça).
 *
 * Custo de CPU: ~10 operações por ponto vivo por quadro (40 fitas × 32 pontos ≈ 2 600 vértices: ~0,1 ms). Nada é alocado por quadro (G4/G5). Só
 * o cliente monta (o servidor não desenha): quem simula o projétil recebe um `TrailSink` opcional e só avisa onde a cabeça está.
 */

/** O desenho de um rastro. Cor em HDR na fita que soma luz; em 0–1 na de fumaça. */
export interface RibbonStyle {
  /** Largura (m) na cabeça e no fim da vida de cada ponto: a fumaça abre. */
  width0: number;
  width1: number;
  /** Segundos de vida de cada ponto. */
  life: number;
  color: THREE.Color;
  /** Opacidade (fumaça) ou brilho (luz) na cabeça. */
  alpha: number;
  /** Metros entre dois pontos da fita. */
  spacing: number;
  /** Quanto o ponto sobe por segundo depois de deixado (a fumaça quente sobe). */
  rise: number;
  /** Em quantos pontos a fita acende atrás da cabeça (a fumaça começa um pouco atrás do bico); 0 = acesa já na cabeça (o fogo do motor). */
  headFade: number;
}

/** Quem desenha rastros (o cliente); a simulação só avisa. Os números são de fita: -1 = sem fita (pool cheio ou servidor). */
export interface TrailSink {
  start(kind: TrailKind, at: THREE.Vector3): number;
  head(id: number, at: THREE.Vector3): void;
  end(id: number): void;
}

/** Os rastros que o jogo conhece: a fumaça do foguete, a do míssil leve (fina e curta), a do cruzador (grossa e longa), a do obus e o fogo do motor. */
export type TrailKind = 'rocket' | 'micro' | 'cruise' | 'shell' | 'guided';

const VERT = /* glsl */ `
  attribute vec4 aColor;
  attribute float aEdge;
  varying vec4 vColor;
  varying float vEdge;
  #include <fog_pars_vertex>
  void main() {
    vColor = aColor;
    vEdge = aEdge;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG_SMOKE = /* glsl */ `
  varying vec4 vColor;
  varying float vEdge;
  #include <fog_pars_fragment>
  void main() {
    float e = 1.0 - vEdge * vEdge;
    float a = vColor.a * e;
    if (a < 0.004) discard;
    vec3 col = vColor.rgb * (0.75 + 0.25 * e);
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      col = mix(col, fogColor, fogFactor);
    #endif
    gl_FragColor = vec4(col, a);
  }
`;

const FRAG_GLOW = /* glsl */ `
  varying vec4 vColor;
  varying float vEdge;
  #include <fog_pars_fragment>
  void main() {
    float e = 1.0 - vEdge * vEdge;
    vec3 col = vColor.rgb * vColor.a * e * e;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      col *= 1.0 - fogFactor;
    #endif
    gl_FragColor = vec4(col, 1.0);
  }
`;

const _side = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _view = new THREE.Vector3();
const _cur = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _next = new THREE.Vector3();

/**
 * Um pool de fitas com o mesmo material. `ribbons` fitas de até `points` pontos cada. As fitas de um pool podem ter estilos diferentes
 * (o estilo é guardado por fita).
 */
export class RibbonPool {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.BufferGeometry;
  private readonly vpos: Float32Array;
  private readonly vcol: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colAttr: THREE.BufferAttribute;
  // Por ponto (fita × ponto): posição, idade e o "caroço" (a largura e a opacidade variam um pouco de ponto a ponto: a fumaça não é uma faixa lisa).
  private readonly px: Float32Array;
  private readonly age: Float32Array;
  private readonly lump: Float32Array;
  private lumpPhase = 0;
  // Por fita: o anel de pontos, a cabeça, o estado e o estilo.
  private readonly first: Int32Array; // índice do ponto mais velho no anel
  private readonly count: Int32Array; // pontos guardados
  private readonly headPos: Float32Array;
  private readonly lastPos: Float32Array; // o último ponto guardado (para medir o espaçamento)
  private readonly state: Uint8Array; // 0 = livre, 1 = presa ao projétil, 2 = solta (se desfazendo)
  private readonly style: (RibbonStyle | null)[];
  private readonly dirty: Uint8Array; // a fita tinha vértices no quadro anterior (precisa zerar ao morrer)
  private live = 0;

  constructor(readonly ribbons: number, readonly points: number, additive: boolean) {
    const verts = ribbons * points * 2;
    this.vpos = new Float32Array(verts * 3);
    this.vcol = new Float32Array(verts * 4);
    const edge = new Float32Array(verts);
    for (let v = 0; v < verts; v++) edge[v] = v % 2 === 0 ? -1 : 1;
    const index: number[] = [];
    for (let r = 0; r < ribbons; r++) {
      for (let p = 0; p < points - 1; p++) {
        const a = (r * points + p) * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.vpos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.vcol, 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('aColor', this.colAttr);
    this.geo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
    this.geo.setIndex(index);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: additive ? FRAG_GLOW : FRAG_SMOKE,
      uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      fog: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = additive ? 2 : 1;
    this.px = new Float32Array(ribbons * points * 3);
    this.age = new Float32Array(ribbons * points);
    this.lump = new Float32Array(ribbons * points);
    this.first = new Int32Array(ribbons);
    this.count = new Int32Array(ribbons);
    this.headPos = new Float32Array(ribbons * 3);
    this.lastPos = new Float32Array(ribbons * 3);
    this.state = new Uint8Array(ribbons);
    this.style = new Array<RibbonStyle | null>(ribbons).fill(null);
    this.dirty = new Uint8Array(ribbons);
  }

  /** Fitas em uso (presas ou se desfazendo). */
  get active(): number {
    return this.live;
  }

  /** Começa uma fita em `at`; devolve o número dela, ou -1 se o pool está cheio de fitas presas (a solta mais velha cede a vaga). */
  start(style: RibbonStyle, at: THREE.Vector3): number {
    let id = -1;
    for (let r = 0; r < this.ribbons; r++) if (this.state[r] === 0) { id = r; break; }
    if (id < 0) {
      // Cheio: a fita solta com o ponto mais velho cede o lugar (a mais perto de sumir).
      let oldest = -1;
      for (let r = 0; r < this.ribbons; r++) {
        if (this.state[r] !== 2) continue;
        const a = this.age[r * this.points + this.first[r]!]!;
        if (oldest < 0 || a > this.age[oldest * this.points + this.first[oldest]!]!) oldest = r;
      }
      if (oldest < 0) return -1;
      id = oldest;
    }
    this.state[id] = 1;
    this.style[id] = style;
    this.first[id] = 0;
    this.count[id] = 0;
    this.headPos[id * 3] = at.x;
    this.headPos[id * 3 + 1] = at.y;
    this.headPos[id * 3 + 2] = at.z;
    this.push(id, at.x, at.y, at.z);
    this.mesh.visible = true;
    return id;
  }

  /** A cabeça da fita `id` está em `at` (a cada quadro, na posição desenhada do projétil). */
  head(id: number, at: THREE.Vector3): void {
    if (id < 0 || this.state[id] !== 1) return;
    const h = id * 3;
    this.headPos[h] = at.x;
    this.headPos[h + 1] = at.y;
    this.headPos[h + 2] = at.z;
    const dx = at.x - this.lastPos[h]!;
    const dy = at.y - this.lastPos[h + 1]!;
    const dz = at.z - this.lastPos[h + 2]!;
    const sp = this.style[id]!.spacing;
    if (dx * dx + dy * dy + dz * dz >= sp * sp) this.push(id, at.x, at.y, at.z);
  }

  /** O projétil acabou: a fita para de crescer e se desfaz sozinha. */
  end(id: number): void {
    if (id < 0 || this.state[id] !== 1) return;
    const h = id * 3;
    this.push(id, this.headPos[h]!, this.headPos[h + 1]!, this.headPos[h + 2]!);
    this.state[id] = 2;
  }

  /** Envelhece os pontos e monta os vértices virados para a câmera em `eye`. */
  update(dt: number, eye: THREE.Vector3): void {
    if (!this.mesh.visible) return;
    const P = this.points;
    let live = 0;
    for (let r = 0; r < this.ribbons; r++) {
      if (this.state[r] === 0) {
        if (this.dirty[r]) this.collapse(r);
        continue;
      }
      const st = this.style[r]!;
      // Envelhece; os pontos velhos saem pelo começo do anel.
      for (let k = 0; k < this.count[r]!; k++) {
        const i = r * P + ((this.first[r]! + k) % P);
        this.age[i] = this.age[i]! + dt;
        this.px[i * 3 + 1] = this.px[i * 3 + 1]! + st.rise * dt;
      }
      while (this.count[r]! > 0 && this.age[r * P + this.first[r]!]! >= st.life) {
        this.first[r] = (this.first[r]! + 1) % P;
        this.count[r] = this.count[r]! - 1;
      }
      if (this.state[r] === 2 && this.count[r]! < 2) {
        this.state[r] = 0;
        this.style[r] = null;
        this.collapse(r);
        continue;
      }
      live++;
      this.build(r, st, eye);
    }
    this.live = live;
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    if (live === 0) {
      for (let r = 0; r < this.ribbons; r++) if (this.dirty[r]) this.collapse(r);
      this.mesh.visible = false;
    }
  }

  clear(): void {
    for (let r = 0; r < this.ribbons; r++) {
      this.state[r] = 0;
      this.style[r] = null;
      this.count[r] = 0;
      this.collapse(r);
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.live = 0;
    this.mesh.visible = false;
  }

  private push(r: number, x: number, y: number, z: number): void {
    const P = this.points;
    if (this.count[r]! >= P - 1) {
      // Anel cheio (a última vaga é da cabeça): o ponto mais velho sai.
      this.first[r] = (this.first[r]! + 1) % P;
      this.count[r] = this.count[r]! - 1;
    }
    const i = r * P + ((this.first[r]! + this.count[r]!) % P);
    this.px[i * 3] = x;
    this.px[i * 3 + 1] = y;
    this.px[i * 3 + 2] = z;
    this.age[i] = 0;
    // O caroço ondula devagar ao longo da fita (duas ondas de passos diferentes, sem sorteio): saltar de ponto a ponto faria contas, não fumaça.
    this.lumpPhase = (this.lumpPhase + 0.83) % 6283.2;
    this.lump[i] = 0.5 + 0.3 * Math.sin(this.lumpPhase) + 0.2 * Math.sin(this.lumpPhase * 2.3 + 1);
    this.count[r] = this.count[r]! + 1;
    this.lastPos[r * 3] = x;
    this.lastPos[r * 3 + 1] = y;
    this.lastPos[r * 3 + 2] = z;
  }

  /** O ponto `k` da fita `r` em `out` (o último de uma fita presa é a cabeça, na posição desenhada do projétil neste quadro). */
  private pointAt(r: number, k: number, n: number, attached: boolean, out: THREE.Vector3): void {
    if (attached && k === n) {
      out.set(this.headPos[r * 3]!, this.headPos[r * 3 + 1]!, this.headPos[r * 3 + 2]!);
      return;
    }
    const i = r * this.points + ((this.first[r]! + k) % this.points);
    out.set(this.px[i * 3]!, this.px[i * 3 + 1]!, this.px[i * 3 + 2]!);
  }

  /** Os vértices da fita `r`: do ponto mais velho à cabeça. Os vértices que sobram no fim ficam no último ponto, com alfa zero. */
  private build(r: number, st: RibbonStyle, eye: THREE.Vector3): void {
    const P = this.points;
    const n = this.count[r]!;
    const attached = this.state[r] === 1;
    const total = attached ? n + 1 : n;
    const base = r * P * 2;
    for (let k = 0; k < P; k++) {
      const v = base + k * 2;
      if (k >= total) {
        // Sobra: área zero, no último ponto.
        this.vpos[v * 3] = this.vpos[v * 3 + 3] = _cur.x;
        this.vpos[v * 3 + 1] = this.vpos[v * 3 + 4] = _cur.y;
        this.vpos[v * 3 + 2] = this.vpos[v * 3 + 5] = _cur.z;
        this.vcol[v * 4 + 3] = this.vcol[v * 4 + 7] = 0;
        continue;
      }
      this.pointAt(r, k, n, attached, _cur);
      this.pointAt(r, Math.max(0, k - 1), n, attached, _prev);
      this.pointAt(r, Math.min(total - 1, k + 1), n, attached, _next);
      _tan.subVectors(_next, _prev);
      _view.subVectors(eye, _cur);
      _side.crossVectors(_tan, _view);
      const len = _side.length();
      if (len > 1e-6) _side.multiplyScalar(1 / len);
      else _side.set(0, 1, 0);
      const isHead = attached && k === n;
      const pi = r * P + ((this.first[r]! + k) % P);
      const age = isHead ? 0 : this.age[pi]!;
      const lump = isHead ? 0.5 : this.lump[pi]!;
      const t = Math.min(1, age / st.life);
      // Nasce fina na cauda do projétil e abre com a idade (cada ponto um pouco mais ou menos: o caroço); a fumaça acende aos poucos atrás do bico.
      const w = (st.width0 + (st.width1 - st.width0) * Math.sqrt(t)) * 0.5 * (0.7 + 0.6 * lump * t + 0.3 * (1 - t));
      const fadeIn = st.headFade > 0 ? Math.min(1, (total - 1 - k) / st.headFade) : 1;
      const a = st.alpha * (1 - t) * (1 - t) * fadeIn * (0.85 + 0.3 * lump);
      this.vpos[v * 3] = _cur.x - _side.x * w;
      this.vpos[v * 3 + 1] = _cur.y - _side.y * w;
      this.vpos[v * 3 + 2] = _cur.z - _side.z * w;
      this.vpos[v * 3 + 3] = _cur.x + _side.x * w;
      this.vpos[v * 3 + 4] = _cur.y + _side.y * w;
      this.vpos[v * 3 + 5] = _cur.z + _side.z * w;
      this.vcol[v * 4] = this.vcol[v * 4 + 4] = st.color.r;
      this.vcol[v * 4 + 1] = this.vcol[v * 4 + 5] = st.color.g;
      this.vcol[v * 4 + 2] = this.vcol[v * 4 + 6] = st.color.b;
      this.vcol[v * 4 + 3] = this.vcol[v * 4 + 7] = a;
    }
    this.dirty[r] = 1;
  }

  /** Zera os vértices da fita `r` (área zero, alfa zero). */
  private collapse(r: number): void {
    const base = r * this.points * 2;
    this.vpos.fill(0, base * 3, (base + this.points * 2) * 3);
    this.vcol.fill(0, base * 4, (base + this.points * 2) * 4);
    this.dirty[r] = 0;
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }
}

const c = (r: number, g: number, b: number): THREE.Color => new THREE.Color(r, g, b);

/** A fumaça e o fogo de cada rastro (`TrailKind`). */
export const TRAIL_STYLE: Readonly<Record<TrailKind, { smoke: RibbonStyle; fire: RibbonStyle | null }>> = {
  rocket: {
    smoke: { width0: 0.3, width1: 1.9, life: 1.3, color: c(0.17, 0.165, 0.16), alpha: 0.5, spacing: 1.1, rise: 0.6, headFade: 2 },
    fire: { width0: 0.5, width1: 0.12, life: 0.13, color: c(3.4, 1.4, 0.35), alpha: 1, spacing: 0.6, rise: 0, headFade: 0 },
  },
  guided: {
    smoke: { width0: 0.28, width1: 1.6, life: 1.2, color: c(0.17, 0.19, 0.23), alpha: 0.45, spacing: 1, rise: 0.5, headFade: 2 },
    fire: { width0: 0.45, width1: 0.1, life: 0.12, color: c(1.2, 1.9, 3.0), alpha: 1, spacing: 0.6, rise: 0, headFade: 0 },
  },
  micro: {
    smoke: { width0: 0.12, width1: 0.7, life: 0.6, color: c(0.2, 0.195, 0.19), alpha: 0.38, spacing: 1.2, rise: 0.4, headFade: 1.5 },
    fire: null,
  },
  cruise: {
    smoke: { width0: 0.55, width1: 3.2, life: 2.4, color: c(0.2, 0.2, 0.2), alpha: 0.55, spacing: 2.4, rise: 0.8, headFade: 2 },
    fire: { width0: 0.9, width1: 0.2, life: 0.16, color: c(3.6, 1.5, 0.4), alpha: 1, spacing: 1.2, rise: 0, headFade: 0 },
  },
  shell: {
    smoke: { width0: 0.22, width1: 1.3, life: 0.8, color: c(0.16, 0.155, 0.15), alpha: 0.38, spacing: 1.6, rise: 0.3, headFade: 1.5 },
    fire: null,
  },
};

/**
 * Os rastros do jogo: três pools (fumaça grossa, fumaça fina dos mísseis leves e o fogo do motor), uma `TrailSink` para a simulação. A fita de
 * fogo de cada projétil anda junto com a de fumaça: o número devolvido é o da fumaça, e o do fogo fica guardado ao lado.
 */
export class Trails implements TrailSink {
  readonly smoke = new RibbonPool(48, 40, false);
  readonly thin = new RibbonPool(96, 12, false);
  readonly fire = new RibbonPool(48, 8, true);
  readonly meshes: readonly THREE.Mesh[] = [this.smoke.mesh, this.thin.mesh, this.fire.mesh];
  /** O número da fita de fogo que anda com cada fita de fumaça (-1 = sem fogo); o número devolvido codifica o pool (fino = +1000). */
  private readonly fireOf = new Int32Array(48).fill(-1);

  get active(): number {
    return this.smoke.active + this.thin.active + this.fire.active;
  }

  start(kind: TrailKind, at: THREE.Vector3): number {
    const st = TRAIL_STYLE[kind];
    if (kind === 'micro') {
      const id = this.thin.start(st.smoke, at);
      return id < 0 ? -1 : id + 1000;
    }
    const id = this.smoke.start(st.smoke, at);
    if (id < 0) return -1;
    this.fire.end(this.fireOf[id]!);
    this.fireOf[id] = st.fire ? this.fire.start(st.fire, at) : -1;
    return id;
  }

  head(id: number, at: THREE.Vector3): void {
    if (id >= 1000) return this.thin.head(id - 1000, at);
    if (id < 0) return;
    this.smoke.head(id, at);
    this.fire.head(this.fireOf[id]!, at);
  }

  end(id: number): void {
    if (id >= 1000) return this.thin.end(id - 1000);
    if (id < 0) return;
    this.smoke.end(id);
    this.fire.end(this.fireOf[id]!);
    this.fireOf[id] = -1;
  }

  update(dt: number, eye: THREE.Vector3): void {
    this.smoke.update(dt, eye);
    this.thin.update(dt, eye);
    this.fire.update(dt, eye);
  }

  clear(): void {
    this.smoke.clear();
    this.thin.clear();
    this.fire.clear();
    this.fireOf.fill(-1);
  }
}
