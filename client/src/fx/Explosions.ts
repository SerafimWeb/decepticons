import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { GLSL_NORMAL_SEGURA } from '../environment/glslSeguro';
import { BILL, type Billboards } from './Billboards';
import { MARK, type Marks } from './Marks';
import type { ParticleSystem } from './ParticleSystem';
import { SHAPE } from './particleShapes';

/**
 * A explosão com corpo (P160; dono, 16/10: "evolua nossas armas… pra ficar realmente BOM"). Antes o estouro era só uma nuvem de pontos que somava
 * luz: a "fumaça" também somava luz, então nunca escurecia, e não havia bola de fogo, chão queimado nem estilhaço. Agora cada explosão é um conjunto,
 * no estilo do jogo (low-poly, faces chapadas):
 *
 * 1. **clarão** branco-quente (um cartaz, `Billboards`) que dura um sexto de segundo;
 * 2. **bola de fogo**: poliedros que fervem (a forma ondula), crescem e esfriam do branco ao laranja e ao vermelho, mais quentes no miolo. Mistura
 *    normal, não soma luz: dez bolas sobrepostas continuam laranja (somando, viravam um borrão branco que cobria a tela, medido na bancada);
 * 3. **fumaça escura de verdade** (mistura normal, não soma luz): poliedros cinza-escuros iluminados de cima, acesos de laranja por dentro no
 *    começo, que sobem, crescem e se desfazem;
 * 4. **estilhaços**: pedaços de metal em brasa que voam, caem, quicam no chão e esfriam;
 * 5. **faíscas** (o `ParticleSystem` de sempre, agora alongadas e com gravidade);
 * 6. no chão (`Marks`): o **clarão no asfalto** (a luz do fogo, sem luz dinâmica), a **onda de choque** rente ao chão e o **queimado** que esfria
 *    e fica alguns segundos. No ar (longe do chão), a onda é um aro de frente para a câmera.
 *
 * Tudo **escala com o raio da explosão da arma**: o míssil leve (2,2 m) faz uma bola pequena e pouca fumaça; o foguete (6 m) é a medida; o cruzador
 * (9 m) e a morte de um Mech, maiores. Só desenho: o dano em área é do `CombatSystem`. O servidor não monta nada (quem chama é o `Game`).
 *
 * Custo (G4/G5): pools fixos (fogo {@link MAX_FIRE}, fumaça {@link MAX_SMOKE}, estilhaços {@link MAX_CHUNKS}), cheios cedem a vaga mais velha; um
 * desenho por pool; por quadro a CPU move só as peças vivas e escreve a matriz delas. Nada é alocado depois da construção. A aparência sorteia com
 * semente (`mulberry32`), não com `Math.random`, para a bancada de captura e os testes saírem sempre iguais.
 */

export const MAX_FIRE = 128;
export const MAX_SMOKE = 160;
export const MAX_CHUNKS = 96;

/** O jeito de uma explosão: as cores (fogo e clarão em HDR; fumaça em 0–1) e o que ela deixa. */
export interface ExplosionLook {
  /** Multiplica a rampa do fogo (branco → laranja → vermelho); (1, 1, 1) = fogo de pólvora. */
  fire: THREE.Color;
  /** A cor da fumaça nova (fica mais clara ao se desfazer). */
  smoke: THREE.Color;
  /** O clarão, o brilho no chão e a onda de choque. */
  flash: THREE.Color;
  /** A brasa do queimado no chão. */
  ember: THREE.Color;
  /** Solta estilhaços de metal. */
  debris: boolean;
}

export const EXPLOSION_LOOK = {
  /** Foguetes, mísseis, obus: fogo de pólvora e fumaça preta. */
  fire: { fire: new THREE.Color(1, 1, 1), smoke: new THREE.Color(0.034, 0.032, 0.03), flash: new THREE.Color(2.6, 1.8, 1.0), ember: new THREE.Color(3.2, 1.2, 0.3), debris: true },
  /** A morte de um Mech: o mesmo fogo, mais estilhaço e fumaça mais grossa (o tamanho vem do raio). */
  wreck: { fire: new THREE.Color(1, 0.92, 0.85), smoke: new THREE.Color(0.026, 0.026, 0.026), flash: new THREE.Color(2.8, 2.0, 1.2), ember: new THREE.Color(3.4, 1.1, 0.25), debris: true },
} as const satisfies Record<string, ExplosionLook>;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _ground = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const SPARK = new THREE.Color(3.0, 1.5, 0.45);
const EMBER_DOT = new THREE.Color(2.6, 0.9, 0.2);

const FOG_MIX = /* glsl */ `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    col = mix(col, fogColor, fogFactor);
  #endif
`;

/** O poliedro ferve: cada vértice anda para fora ou para dentro conforme a posição (os vértices repetidos andam juntos: a malha não racha). */
const PUFF_VERT = /* glsl */ `
  attribute vec4 aPuff;   // idade 0–1, semente, calor, opacidade
  attribute vec3 aTint;
  varying vec4 vPuff;
  varying vec3 vTint;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vPuff = aPuff;
    vTint = aTint;
    vec3 p = position;
    float s = aPuff.y * 37.0;
    float wob = sin(p.x * 5.1 + s + aPuff.x * 5.0) * sin(p.y * 4.3 + s * 0.7) * sin(p.z * 4.7 + s * 1.3 - aPuff.x * 3.0);
    p *= 1.0 + wob * 0.38;
    vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FIRE_FRAG = /* glsl */ `
  varying vec4 vPuff;
  varying vec3 vTint;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  ${GLSL_NORMAL_SEGURA}
  void main() {
    vec3 n = normalSegura(cross(dFdx(vWorld), dFdy(vWorld)));
    vec3 v = normalSegura(cameraPosition - vWorld);
    float facing = abs(dot(n, v));
    float t = vPuff.x;
    vec3 col = mix(vec3(2.6, 1.75, 0.7), vec3(2.2, 0.68, 0.09), smoothstep(0.0, 0.22, t));
    col = mix(col, vec3(0.55, 0.08, 0.02), smoothstep(0.25, 0.85, t));
    // O miolo (de frente para a câmera) é mais quente; a borda escurece para o vermelho.
    col *= vTint * (0.3 + 0.7 * facing * facing);
    float a = vPuff.w * (1.0 - smoothstep(0.55, 1.0, t));
    ${FOG_MIX}
    gl_FragColor = vec4(col, a);
  }
`;

const SMOKE_FRAG = /* glsl */ `
  varying vec4 vPuff;
  varying vec3 vTint;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  ${GLSL_NORMAL_SEGURA}
  void main() {
    vec3 n = normalSegura(cross(dFdx(vWorld), dFdy(vWorld)));
    float lit = 0.6 + 0.4 * max(dot(n, vec3(0.37, 0.89, 0.27)), 0.0);
    float t = vPuff.x;
    vec3 col = mix(vTint, vTint * 1.5, smoothstep(0.1, 1.0, t)) * lit;
    // O fogo acende a fumaça nova por dentro, mais forte nas faces de baixo (onde o fogo está).
    float heat = (1.0 - smoothstep(0.0, 0.3, t)) * vPuff.z;
    col += vec3(1.5, 0.5, 0.1) * heat * (1.1 - lit);
    float a = vPuff.w * (1.0 - smoothstep(0.2, 1.0, t)) * 0.8;
    ${FOG_MIX}
    gl_FragColor = vec4(col, a);
  }
`;

const CHUNK_VERT = /* glsl */ `
  attribute float aHeat;
  varying float vHeat;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vHeat = aHeat;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const CHUNK_FRAG = /* glsl */ `
  varying float vHeat;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  ${GLSL_NORMAL_SEGURA}
  void main() {
    vec3 n = normalSegura(cross(dFdx(vWorld), dFdy(vWorld)));
    float lit = 0.3 + 0.7 * max(dot(n, vec3(0.37, 0.89, 0.27)), 0.0);
    vec3 col = vec3(0.1, 0.105, 0.11) * lit + vec3(3.2, 1.15, 0.25) * vHeat * vHeat;
    ${FOG_MIX}
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Um pool de poliedros que nascem, andam, crescem e somem (o fogo ou a fumaça). */
class PuffLayer {
  readonly mesh: THREE.InstancedMesh;
  private readonly puff: Float32Array;
  private readonly tint: Float32Array;
  private readonly puffAttr: THREE.InstancedBufferAttribute;
  private readonly tintAttr: THREE.InstancedBufferAttribute;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly rot: Float32Array; // matriz de rotação 3 × 3 de cada um, sorteada no nascer
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly s0: Float32Array;
  private readonly s1: Float32Array;
  private readonly rise: Float32Array;
  private readonly drag: Float32Array;
  private cursor = 0;
  private live = 0;

  constructor(readonly max: number, fragmentShader: string, additive: boolean, order: number) {
    const geo = new THREE.IcosahedronGeometry(0.5, 1);
    this.puff = new Float32Array(max * 4);
    this.tint = new Float32Array(max * 3);
    this.puffAttr = new THREE.InstancedBufferAttribute(this.puff, 4).setUsage(THREE.DynamicDrawUsage);
    this.tintAttr = new THREE.InstancedBufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPuff', this.puffAttr);
    geo.setAttribute('aTint', this.tintAttr);
    const material = new THREE.ShaderMaterial({
      vertexShader: PUFF_VERT,
      fragmentShader,
      uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // O fogo se desenha depois da fumaça (por cima dela: nasce dentro e brilha através).
    this.mesh.renderOrder = order;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, _m);
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.rot = new Float32Array(max * 9);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.rise = new Float32Array(max);
    this.drag = new Float32Array(max);
  }

  get active(): number {
    return this.live;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, s0: number, s1: number, life: number, rise: number, drag: number, heat: number, alpha: number, tint: THREE.Color, rand: () => number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    _q.setFromEuler(_e.set(rand() * 6.283, rand() * 6.283, rand() * 6.283));
    _m.makeRotationFromQuaternion(_q);
    const e = _m.elements;
    const r = this.rot;
    r[i * 9] = e[0]!; r[i * 9 + 1] = e[1]!; r[i * 9 + 2] = e[2]!;
    r[i * 9 + 3] = e[4]!; r[i * 9 + 4] = e[5]!; r[i * 9 + 5] = e[6]!;
    r[i * 9 + 6] = e[8]!; r[i * 9 + 7] = e[9]!; r[i * 9 + 8] = e[10]!;
    this.age[i] = 0;
    this.life[i] = life;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.rise[i] = rise;
    this.drag[i] = drag;
    this.puff[i * 4] = 0;
    this.puff[i * 4 + 1] = rand();
    this.puff[i * 4 + 2] = heat;
    this.puff[i * 4 + 3] = alpha;
    this.tint[i * 3] = tint.r;
    this.tint[i * 3 + 1] = tint.g;
    this.tint[i * 3 + 2] = tint.b;
    this.tintAttr.needsUpdate = true;
    this.mesh.visible = true;
  }

  update(dt: number): void {
    if (!this.mesh.visible) return;
    const m = this.mesh.instanceMatrix.array as Float32Array;
    let live = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i]! <= 0) continue;
      this.age[i] = this.age[i]! + dt;
      const o = i * 16;
      if (this.age[i]! >= this.life[i]!) {
        this.life[i] = 0;
        m.fill(0, o, o + 16); // escala zero: some
        continue;
      }
      live++;
      const t = this.age[i]! / this.life[i]!;
      const k = Math.max(0, 1 - this.drag[i]! * dt);
      const i3 = i * 3;
      this.vel[i3] = this.vel[i3]! * k;
      this.vel[i3 + 1] = this.vel[i3 + 1]! * k + this.rise[i]! * dt;
      this.vel[i3 + 2] = this.vel[i3 + 2]! * k;
      this.pos[i3] = this.pos[i3]! + this.vel[i3]! * dt;
      this.pos[i3 + 1] = this.pos[i3 + 1]! + this.vel[i3 + 1]! * dt;
      this.pos[i3 + 2] = this.pos[i3 + 2]! + this.vel[i3 + 2]! * dt;
      // Cresce depressa no começo e quase para no fim (a bola de fogo "estoura" e a fumaça se espalha devagar).
      const u = 1 - t;
      const s = this.s0[i]! + (this.s1[i]! - this.s0[i]!) * (1 - u * u * u);
      const r = this.rot;
      const r9 = i * 9;
      m[o] = r[r9]! * s; m[o + 1] = r[r9 + 1]! * s; m[o + 2] = r[r9 + 2]! * s; m[o + 3] = 0;
      m[o + 4] = r[r9 + 3]! * s; m[o + 5] = r[r9 + 4]! * s; m[o + 6] = r[r9 + 5]! * s; m[o + 7] = 0;
      m[o + 8] = r[r9 + 6]! * s; m[o + 9] = r[r9 + 7]! * s; m[o + 10] = r[r9 + 8]! * s; m[o + 11] = 0;
      m[o + 12] = this.pos[i3]!; m[o + 13] = this.pos[i3 + 1]!; m[o + 14] = this.pos[i3 + 2]!; m[o + 15] = 1;
      this.puff[i * 4] = t;
    }
    this.live = live;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.puffAttr.needsUpdate = true;
    if (live === 0) this.mesh.visible = false;
  }

  clear(): void {
    this.life.fill(0);
    (this.mesh.instanceMatrix.array as Float32Array).fill(0);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.live = 0;
    this.mesh.visible = false;
  }
}

/** Os estilhaços: pedaços de metal que voam em brasa, caem, quicam no chão e esfriam. */
class Chunks {
  readonly mesh: THREE.InstancedMesh;
  private readonly heat: Float32Array;
  private readonly heatAttr: THREE.InstancedBufferAttribute;
  private readonly pos = new Float32Array(MAX_CHUNKS * 3);
  private readonly vel = new Float32Array(MAX_CHUNKS * 3);
  private readonly axis = new Float32Array(MAX_CHUNKS * 3);
  private readonly angle = new Float32Array(MAX_CHUNKS);
  private readonly spin = new Float32Array(MAX_CHUNKS);
  private readonly size = new Float32Array(MAX_CHUNKS);
  private readonly life = new Float32Array(MAX_CHUNKS);
  private readonly age = new Float32Array(MAX_CHUNKS);
  private readonly floor = new Float32Array(MAX_CHUNKS);
  private cursor = 0;
  private live = 0;

  constructor() {
    const geo = new THREE.DodecahedronGeometry(0.5, 0);
    this.heat = new Float32Array(MAX_CHUNKS);
    this.heatAttr = new THREE.InstancedBufferAttribute(this.heat, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aHeat', this.heatAttr);
    const material = new THREE.ShaderMaterial({ vertexShader: CHUNK_VERT, fragmentShader: CHUNK_FRAG, uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog), fog: true });
    this.mesh = new THREE.InstancedMesh(geo, material, MAX_CHUNKS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_CHUNKS; i++) this.mesh.setMatrixAt(i, _m);
  }

  get active(): number {
    return this.live;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, floor: number, rand: () => number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_CHUNKS;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    _v.set(rand() - 0.5, rand() - 0.5, rand() - 0.5);
    if (_v.lengthSq() < 1e-6) _v.set(0, 1, 0);
    _v.normalize();
    this.axis[i3] = _v.x; this.axis[i3 + 1] = _v.y; this.axis[i3 + 2] = _v.z;
    this.angle[i] = rand() * 6.283;
    this.spin[i] = 6 + rand() * 14;
    this.size[i] = size;
    this.life[i] = 1.8 + rand() * 1.2;
    this.age[i] = 0;
    this.floor[i] = floor;
    this.heat[i] = 1;
    this.mesh.visible = true;
  }

  update(dt: number): void {
    if (!this.mesh.visible) return;
    let live = 0;
    for (let i = 0; i < MAX_CHUNKS; i++) {
      if (this.life[i]! <= 0) continue;
      this.age[i] = this.age[i]! + dt;
      if (this.age[i]! >= this.life[i]!) {
        this.life[i] = 0;
        _m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m);
        continue;
      }
      live++;
      const i3 = i * 3;
      this.vel[i3 + 1] = this.vel[i3 + 1]! - 24 * dt;
      this.pos[i3] = this.pos[i3]! + this.vel[i3]! * dt;
      this.pos[i3 + 1] = this.pos[i3 + 1]! + this.vel[i3 + 1]! * dt;
      this.pos[i3 + 2] = this.pos[i3 + 2]! + this.vel[i3 + 2]! * dt;
      const half = this.size[i]! * 0.4;
      if (this.pos[i3 + 1]! < this.floor[i]! + half) {
        // Quica: perde quase toda a altura e boa parte do avanço, e gira menos.
        this.pos[i3 + 1] = this.floor[i]! + half;
        if (this.vel[i3 + 1]! < 0) this.vel[i3 + 1] = -this.vel[i3 + 1]! * 0.3;
        this.vel[i3] = this.vel[i3]! * 0.55;
        this.vel[i3 + 2] = this.vel[i3 + 2]! * 0.55;
        this.spin[i] = this.spin[i]! * 0.5;
      }
      this.angle[i] = this.angle[i]! + this.spin[i]! * dt;
      this.heat[i] = Math.max(0, 1 - this.age[i]! / 1.1);
      // Some encolhendo no último meio segundo.
      const s = this.size[i]! * Math.min(1, (this.life[i]! - this.age[i]!) / 0.5);
      _q.setFromAxisAngle(_v.set(this.axis[i3]!, this.axis[i3 + 1]!, this.axis[i3 + 2]!), this.angle[i]!);
      _m.compose(_v.set(this.pos[i3]!, this.pos[i3 + 1]!, this.pos[i3 + 2]!), _q, _s.set(s, s * 0.7, s * 1.2));
      this.mesh.setMatrixAt(i, _m);
    }
    this.live = live;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.heatAttr.needsUpdate = true;
    if (live === 0) this.mesh.visible = false;
  }

  clear(): void {
    this.life.fill(0);
    (this.mesh.instanceMatrix.array as Float32Array).fill(0);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.live = 0;
    this.mesh.visible = false;
  }
}

/** Quantas peças cada parte da explosão solta para um raio de `radius` m (o foguete, 6 m, é a medida). Separado para o teste conferir o teto. */
export function explosionCounts(radius: number, debris: boolean): { fire: number; smoke: number; chunks: number; sparks: number } {
  const s = Math.min(2.2, Math.max(0.3, radius / 6));
  return {
    fire: Math.min(9, Math.max(2, Math.round(1 + 4 * s))),
    smoke: Math.min(11, Math.max(2, Math.round(1 + 5 * s))),
    chunks: debris && radius >= 3 ? Math.min(14, Math.round(3 + 5 * s)) : 0,
    sparks: Math.round(8 + 16 * s),
  };
}

/** Até que altura acima do chão a explosão ainda marca o chão (fração do raio). */
const GROUND_REACH = 0.85;

export class Explosions {
  private readonly fire = new PuffLayer(MAX_FIRE, FIRE_FRAG, false, 2);
  private readonly smoke = new PuffLayer(MAX_SMOKE, SMOKE_FRAG, false, 1);
  private readonly chunks = new Chunks();
  private readonly rand = mulberry32(0x5eed);
  /** Os lotes para pôr na cena (os cartazes e as marcas são de quem os criou). */
  readonly objects: readonly THREE.Object3D[] = [this.smoke.mesh, this.fire.mesh, this.chunks.mesh];

  constructor(
    private readonly bill: Billboards,
    private readonly marks: Marks,
    private readonly particles: ParticleSystem,
  ) {}

  /** Peças vivas (fogo + fumaça + estilhaços): o painel de depuração e os testes leem. */
  get active(): number {
    return this.fire.active + this.smoke.active + this.chunks.active;
  }

  /**
   * Uma explosão de raio `radius` (m) em `at`. `groundY` = a altura do chão embaixo dela (`null` = sem chão por perto: nada de marca nem quique).
   */
  spawn(at: THREE.Vector3, radius: number, groundY: number | null, look: ExplosionLook = EXPLOSION_LOOK.fire): void {
    const R = Math.max(0.5, radius);
    const s = Math.min(2.2, Math.max(0.3, R / 6));
    const n = explosionCounts(R, look.debris);
    const rand = this.rand;
    const nearGround = groundY !== null && at.y - groundY < R * GROUND_REACH;
    // 1. Clarão: o branco do estouro e um halo maior que apaga logo depois.
    this.bill.flash(at, look.flash, BILL.glow, 0.5 * R, 1.6 * R, 0.13);
    this.bill.flash(at, look.flash, BILL.star, 0.9 * R, 1.3 * R, 0.06, rand() * 3.14);
    // 2. Bola de fogo: o primeiro no centro, os outros em volta, todos saindo para fora e subindo um pouco.
    for (let k = 0; k < n.fire; k++) {
      const off = k === 0 ? 0 : 0.32 * R;
      this.dir(rand, k === 0 ? 0 : 0.35);
      const sp = (3 + 6 * rand()) * s;
      this.fire.spawn(
        at.x + _v.x * off, at.y + _v.y * off * 0.7, at.z + _v.z * off,
        _v.x * sp, _v.y * sp + 1.5 * s, _v.z * sp,
        0.18 * R, (0.55 + 0.3 * rand()) * R * (k === 0 ? 1.15 : 0.85),
        0.42 + 0.3 * rand(), 1.2 * s, 3.2, 1, 1, look.fire, rand,
      );
    }
    // 3. Fumaça: nasce dentro do fogo, mais larga, sobe e se espalha devagar; a de baixo fica rente ao chão.
    for (let k = 0; k < n.smoke; k++) {
      this.dir(rand, 0.5);
      const off = (0.15 + 0.3 * rand()) * R;
      const sp = (1.5 + 3.5 * rand()) * s;
      this.smoke.spawn(
        at.x + _v.x * off, at.y + Math.abs(_v.y) * off * 0.5, at.z + _v.z * off,
        _v.x * sp, Math.abs(_v.y) * sp + (2 + 3 * rand()) * s, _v.z * sp,
        0.3 * R, (0.75 + 0.45 * rand()) * R,
        1.5 + 1.2 * rand() + 0.4 * s, 1.8 * s, 1.6, 1, 1, look.smoke, rand,
      );
    }
    // 4. Estilhaços (só onde há chão para quicar).
    if (n.chunks > 0 && nearGround) {
      for (let k = 0; k < n.chunks; k++) {
        this.dir(rand, 0.6);
        const sp = (9 + 12 * rand()) * Math.sqrt(s);
        this.chunks.spawn(at.x, at.y + 0.3, at.z, _v.x * sp, Math.abs(_v.y) * sp + (5 + 6 * rand()) * Math.sqrt(s), _v.z * sp, (0.18 + 0.32 * rand()) * Math.sqrt(s), groundY!, rand);
      }
    }
    // 5. Faíscas e brasas (o pool de partículas).
    this.particles.burst(at, UP, { count: n.sparks, color: SPARK, speed: 30 * Math.sqrt(s), life: 0.6, size: 2.2, spread: 2.2, gravity: 16, shape: SHAPE.streak });
    this.particles.burst(at, UP, { count: Math.round(n.sparks / 2), color: EMBER_DOT, speed: 12 * Math.sqrt(s), life: 1.1, size: 1.3, spread: 2, gravity: 9, shape: SHAPE.dot });
    // 6. O chão: a luz do fogo, a onda de choque e o queimado. No ar, a onda é um aro de frente.
    if (nearGround) {
      _ground.set(at.x, groundY!, at.z);
      this.marks.add(MARK.glow, _ground, UP, 2.2 * R, 2.5 * R, 0.4, look.flash, 0.28);
      this.marks.add(MARK.ring, _ground, UP, 0.5 * R, 2.8 * R, 0.4, look.flash, 0.4);
      this.marks.add(MARK.scorch, _ground, UP, 1.25 * R, 1.25 * R, 9 + 5 * s, look.ember, 1);
    } else {
      this.bill.flash(at, look.flash, BILL.ring, 0.6 * R, 2.6 * R, 0.3);
    }
  }

  update(dt: number): void {
    this.fire.update(dt);
    this.smoke.update(dt);
    this.chunks.update(dt);
  }

  clear(): void {
    this.fire.clear();
    this.smoke.clear();
    this.chunks.clear();
  }

  /** Uma direção sorteada em `_v`: `up` puxa para cima (0 = esfera, 1 = quase só para cima). */
  private dir(rand: () => number, up: number): void {
    const y = up + (1 - up) * (rand() * 2 - 1);
    const a = rand() * 6.283;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    _v.set(Math.cos(a) * r, y, Math.sin(a) * r);
  }
}
