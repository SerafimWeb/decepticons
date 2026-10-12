import * as THREE from 'three';
import type { WeaponStats } from '../combat/weapons';

/**
 * Os anéis da onda sônica (dono, 11/10: "o tiro dele, espero que seja um belo efeito de uma onda do som, **invisível, mas que dá pra ver
 * quebrando as moléculas do ar, como uma onda em anéis transparentes**"). Cada boca solta uma fila de anéis finos que correm pelo cone
 * até o alcance da arma e se abrem junto com ele. O anel **não tem cor própria**: ele **desloca a imagem que está atrás** (refração,
 * `FrameCopyPass`), com uma franja de cor nas bordas e um traço de brilho para o ar distorcido aparecer até em chão liso. Sem a cópia do
 * quadro (qualidade baixa, ou o primeiro quadro) o anel vira um brilho branco fraco: ainda se vê, só não distorce.
 *
 * Custo: **um draw call** (`InstancedMesh`, 48 anéis no máximo, 96 triângulos cada), só desenhado enquanto há anel vivo; nenhuma alocação por
 * quadro (tudo em vetores fixos). O servidor não monta nada (quem chama é o `Match.onWaveFx`, que só o cliente liga). Sem `Math.random`: o desenho
 * é função do instante, não sorteio.
 */
export const WAVE_RING_CAP = 48;
/** Quantos anéis saem por onda (por boca), um logo atrás do outro. */
export const RINGS_PER_WAVE = 6;
/** Segundos entre um anel e o seguinte. */
export const RING_GAP_S = 0.05;
/** Quanto vive cada anel (s): o tempo que ele leva da boca ao alcance. */
export const RING_LIFE_S = 0.55;
/** O raio mínimo junto da boca (m). */
const MIN_RADIUS = 0.3;
/** Metade da espessura da frente de onda (m): fina de longe, grossa de perto da boca (o `aWidth` limita). */
const HALF_THICKNESS_M = 0.4;
/** Onde o anel fica na malha (0 a 1 do raio externo): a escala do anel é `raio / BAND`, para a frente de onda cair no raio do cone. */
const BAND = 0.7;
/** O raio externo da malha (m), na escala 1. */
const OUTER = 0.5;

const VERT = /* glsl */ `
  attribute float aFade;
  attribute float aWidth;
  varying float vR;
  varying float vFade;
  varying float vWidth;
  varying vec2 vRadial;
  void main() {
    vR = length(position.xy) / ${OUTER.toFixed(1)};
    vFade = aFade;
    vWidth = aWidth;
    mat4 m = modelViewMatrix * instanceMatrix;
    vRadial = (m * vec4(normalize(position.xy + vec2(1e-6)), 0.0, 0.0)).xy;
    gl_Position = projectionMatrix * m * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tFrame;
  uniform vec2 uRes;
  uniform float uReady;
  uniform float uBend;
  varying float vR;
  varying float vFade;
  varying float vWidth;
  varying vec2 vRadial;
  void main() {
    float d = (vR - ${BAND.toFixed(2)}) / vWidth;
    float band = exp(-2.0 * d * d);
    float a = band * vFade;
    if (a < 0.01) discard;
    if (uReady < 0.5) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, a * 0.12);
      return;
    }
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 dir = normalize(vRadial + vec2(1e-5));
    // Odd around the front: pulls one side in and pushes the other out, like a lens ripple.
    float lens = d * band;
    vec2 off = dir * lens * uBend * vFade * vec2(uRes.y / uRes.x, 1.0);
    vec3 col = vec3(
      texture2D(tFrame, uv + off * 1.4).r,
      texture2D(tFrame, uv + off).g,
      texture2D(tFrame, uv + off * 0.6).b
    );
    col += vec3(0.025) * a;
    gl_FragColor = vec4(col, clamp(a * 1.6, 0.0, 1.0));
  }
`;

const _origin = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _m = new THREE.Matrix4();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_X = new THREE.Vector3(1, 0, 0);

/** O quadro que o anel lê: a cópia do `FrameCopyPass` (textura, tamanho em pixels e se já tem imagem). */
export interface WaveFrame {
  readonly texture: THREE.Texture;
  readonly width: number;
  readonly height: number;
  readonly ready: boolean;
}

export class WaveRings {
  readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly fade: THREE.InstancedBufferAttribute;
  private readonly width: THREE.InstancedBufferAttribute;
  // Um anel por posição, em vetores fixos. `age` < 0 espera a vez de sair; `alive` = 0 é posição livre.
  private readonly alive = new Uint8Array(WAVE_RING_CAP);
  private readonly age = new Float32Array(WAVE_RING_CAP);
  private readonly pos = new Float32Array(WAVE_RING_CAP * 3);
  private readonly dir = new Float32Array(WAVE_RING_CAP * 3);
  private readonly reach = new Float32Array(WAVE_RING_CAP);
  private readonly tan = new Float32Array(WAVE_RING_CAP);
  private head = 0;
  private live = 0;
  private shown = 0;

  constructor() {
    const geo = new THREE.RingGeometry(OUTER * 0.3, OUTER, 48, 1);
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(WAVE_RING_CAP), 1).setUsage(THREE.DynamicDrawUsage);
    this.width = new THREE.InstancedBufferAttribute(new Float32Array(WAVE_RING_CAP).fill(0.1), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFade', this.fade);
    geo.setAttribute('aWidth', this.width);
    this.material = new THREE.ShaderMaterial({
      name: 'WaveRing',
      uniforms: {
        tFrame: { value: null as THREE.Texture | null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uReady: { value: 0 },
        uBend: { value: 0.045 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, WAVE_RING_CAP);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.name = 'wave-rings';
  }

  /** Há anel vivo (esperando a vez ou no ar)? Quem tem o `FrameCopyPass` o liga enquanto isto for verdade. */
  get active(): boolean {
    return this.live > 0;
  }

  /** Quantos anéis estão desenhados agora (sem os que esperam a vez). */
  get visibleCount(): number {
    return this.shown;
  }

  /** Solta a onda de `w` em `origin`, na direção `dir`: `RINGS_PER_WAVE` anéis, um a cada `RING_GAP_S`. A arma sem onda não solta nada. */
  spawn(origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats): void {
    if (!w.wave) return;
    _fwd.copy(dir).normalize();
    for (let i = 0; i < RINGS_PER_WAVE; i++) {
      const s = this.head;
      this.head = (this.head + 1) % WAVE_RING_CAP;
      if (!this.alive[s]) this.live++;
      this.alive[s] = 1;
      this.age[s] = -i * RING_GAP_S;
      this.pos[s * 3] = origin.x;
      this.pos[s * 3 + 1] = origin.y;
      this.pos[s * 3 + 2] = origin.z;
      this.dir[s * 3] = _fwd.x;
      this.dir[s * 3 + 1] = _fwd.y;
      this.dir[s * 3 + 2] = _fwd.z;
      this.reach[s] = w.maxRange;
      this.tan[s] = Math.tan(w.wave.halfAngle);
    }
  }

  /** Onde cada anel está em `u` (0 a 1 da vida): distância na direção do tiro e raio do cone. A frente chega ao alcance e freia no fim. */
  static along(u: number, reach: number, tan: number): { dist: number; radius: number } {
    const dist = reach * (1 - (1 - u) * (1 - u));
    return { dist, radius: Math.max(MIN_RADIUS, dist * tan) };
  }

  /** Quanto o anel aparece em `u`: sobe nos primeiros 6% e some devagar até o fim. */
  static strength(u: number): number {
    const rise = Math.min(1, u / 0.06);
    return rise * rise * (3 - 2 * rise) * Math.pow(1 - u, 1.3);
  }

  /** Avança os anéis `dt` segundos e deixa as matrizes prontas. Sem anel vivo, não faz nada. */
  update(dt: number): void {
    if (this.live === 0) {
      if (this.mesh.visible) {
        this.mesh.visible = false;
        this.mesh.count = 0;
        this.shown = 0;
      }
      return;
    }
    let n = 0;
    for (let s = 0; s < WAVE_RING_CAP; s++) {
      if (!this.alive[s]) continue;
      const age = this.age[s]! + dt;
      this.age[s] = age;
      if (age >= RING_LIFE_S) {
        this.alive[s] = 0;
        this.live--;
        continue;
      }
      if (age < 0) continue;
      const u = age / RING_LIFE_S;
      const { dist, radius } = WaveRings.along(u, this.reach[s]!, this.tan[s]!);
      _fwd.set(this.dir[s * 3]!, this.dir[s * 3 + 1]!, this.dir[s * 3 + 2]!);
      _origin.set(this.pos[s * 3]!, this.pos[s * 3 + 1]!, this.pos[s * 3 + 2]!).addScaledVector(_fwd, dist);
      _right.crossVectors(Math.abs(_fwd.y) > 0.95 ? WORLD_X : WORLD_UP, _fwd).normalize();
      _up.crossVectors(_fwd, _right);
      const scale = radius / (BAND * OUTER);
      _right.multiplyScalar(scale);
      _up.multiplyScalar(scale);
      _m.makeBasis(_right, _up, _fwd).setPosition(_origin);
      this.mesh.setMatrixAt(n, _m);
      this.fade.setX(n, WaveRings.strength(u));
      this.width.setX(n, Math.min(0.1, Math.max(0.03, (HALF_THICKNESS_M * BAND) / radius)));
      n++;
    }
    this.shown = n;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.fade.needsUpdate = true;
    this.width.needsUpdate = true;
  }

  /** Aponta o anel para a cópia do quadro (ou para nenhuma: brilho fraco). Chamado uma vez por quadro, antes do desenho. */
  setFrame(frame: WaveFrame | null): void {
    const u = this.material.uniforms;
    if (frame && frame.ready) {
      u.tFrame!.value = frame.texture;
      (u.uRes!.value as THREE.Vector2).set(frame.width, frame.height);
      u.uReady!.value = 1;
    } else u.uReady!.value = 0;
  }

  /** Apaga os anéis (reiniciar a partida, entrar no Hangar). */
  clear(): void {
    this.alive.fill(0);
    this.live = 0;
    this.shown = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
