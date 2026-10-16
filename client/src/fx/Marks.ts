import * as THREE from 'three';
import { GLSL_NORMAL_SEGURA } from '../environment/glslSeguro';

/**
 * Marcas no cenário (P160): o que o tiro e a explosão deixam onde batem. Antes nada ficava: a parede e o chão saíam de uma luta como entraram.
 *
 * Camada **escura** (mistura normal):
 * - `scorch`: o **queimado** da explosão no chão, irregular, com o miolo em brasa que esfria;
 * - `hole`: o **furo quente** do tiro na parede ou no chão: um queimado pequeno com o miolo em brasa na cor do tiro, que esfria em segundos;
 * - `frost`: a **geada** do tiro de gelo: uma estrela pálida que derrete.
 *
 * Camada **de luz** (soma luz):
 * - `glow`: o **clarão no chão** sob a explosão (a luz que o fogo joga no asfalto, sem luz dinâmica: um disco que acende e apaga);
 * - `ring`: a **onda de choque** que corre rente ao chão.
 *
 * Cada marca é um quadrado deitado na superfície (a normal do acerto), desenhado pelo shader, sem textura. Pool fixo por camada (um desenho
 * cada); cheio, a mais velha cede o lugar. Por quadro, a CPU só envelhece as marcas vivas (um número por marca). O servidor não monta.
 */

export const MARK = { scorch: 0, hole: 1, frost: 2, glow: 10, ring: 11 } as const;
export type MarkKind = (typeof MARK)[keyof typeof MARK];

/** Teto (G5) da camada escura (queimados, furos, geada) e da de luz (clarões e anéis). */
export const MAX_DARK_MARKS = 160;
export const MAX_LIGHT_MARKS = 48;

/** Quanto a marca sai da superfície (m), além do deslocamento do polígono: não pisca com o chão. */
const LIFT = 0.025;

const VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute vec3 aNorm;
  attribute vec4 aData;   // tamanho (m), giro/semente, tipo, idade de 0 a 1
  attribute vec4 aColor;  // cor quente (HDR) e força
  varying vec2 vUv;
  varying vec4 vData;
  varying vec4 vColor;
  ${GLSL_NORMAL_SEGURA}
  #include <fog_pars_vertex>
  void main() {
    vUv = position.xy * 2.0;
    vData = aData;
    vColor = aColor;
    vec3 n = normalSegura(aNorm);
    vec3 ref = abs(n.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 t = normalSegura(cross(ref, n));
    vec3 b = cross(n, t);
    float c = cos(aData.y);
    float s = sin(aData.y);
    vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aData.x;
    vec3 world = aPos + t * p.x + b * p.y;
    vec4 mvPosition = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

/** A borda irregular (sem `atan`: a direção do pixel em vez do ângulo, que no centro seria indefinido). */
const GLSL_EDGE = /* glsl */ `
  float wobble(vec2 uv, float r, float seed) {
    vec2 d = uv / max(r, 1e-4);
    return sin(d.x * 7.0 + seed * 3.1) * 0.07 + sin(d.y * 9.0 + seed * 1.7) * 0.06 + sin((d.x + d.y) * 13.0 + seed * 5.3) * 0.04;
  }
`;

const FRAG_DARK = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vData;
  varying vec4 vColor;
  #include <fog_pars_fragment>
  ${GLSL_EDGE}
  void main() {
    float r = length(vUv);
    if (r > 1.0) discard;
    float age = vData.w;
    float kind = vData.z;
    float seed = vData.y;
    vec3 col;
    float a;
    if (kind < 0.5) {
      // Queimado: borda irregular, miolo mais escuro, brasa no centro que esfria no primeiro quarto da vida.
      float edge = 0.78 + wobble(vUv, r, seed);
      a = (1.0 - smoothstep(edge * 0.55, edge, r)) * 0.86;
      float heat = (1.0 - smoothstep(0.0, 0.28, age)) * (1.0 - smoothstep(0.0, edge * 0.6, r));
      col = mix(vec3(0.02, 0.018, 0.016), vColor.rgb, heat);
      a = max(a, heat);
    } else if (kind < 1.5) {
      // Furo: um queimado pequeno e irregular com o miolo em brasa na cor do tiro, que encolhe e esfria na primeira metade da vida.
      float edge = 0.7 + wobble(vUv, r, seed);
      float dark = 1.0 - smoothstep(edge * 0.45, edge, r);
      float cool = smoothstep(0.0, 0.5, age);
      float hot = (1.0 - smoothstep(0.0, edge * (0.5 - 0.35 * cool), r)) * (1.0 - cool);
      col = mix(vec3(0.012, 0.011, 0.01), vColor.rgb, hot);
      a = max(dark * 0.85, hot);
    } else {
      // Geada: estrela de seis braços, pálida, que derrete.
      vec2 d = vUv;
      float arms = 0.0;
      for (int k = 0; k < 3; k++) {
        float ang = float(k) * 1.0472 + seed;
        vec2 dir = vec2(cos(ang), sin(ang));
        float along = dot(d, dir);
        float across = abs(dot(d, vec2(-dir.y, dir.x)));
        arms = max(arms, max(1.0 - across * 9.0, 0.0) * (1.0 - smoothstep(0.5, 1.0, abs(along))));
      }
      float core = 1.0 - smoothstep(0.1, 0.45, r);
      col = vColor.rgb;
      a = max(arms, core) * 0.8;
    }
    // Some no fim da vida.
    a *= (1.0 - smoothstep(0.7, 1.0, age)) * vColor.a;
    if (a < 0.01) discard;
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

const FRAG_LIGHT = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vData;
  varying vec4 vColor;
  #include <fog_pars_fragment>
  void main() {
    float r = length(vUv);
    if (r > 1.0) discard;
    float age = vData.w;
    float a;
    if (vData.z < 10.5) {
      // Clarão no chão: disco macio que acende e apaga.
      float h = 1.0 - r;
      a = h * h * (1.0 - age) * (1.0 - age);
    } else {
      // Anel de choque: um aro que corre para fora (o tamanho cresce na CPU) e afina.
      a = max(1.0 - abs(r - 0.86) * (10.0 + age * 14.0), 0.0) * (1.0 - age);
    }
    vec3 col = vColor.rgb * a * vColor.a;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      col *= 1.0 - fogFactor;
    #endif
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Uma camada de marcas: um lote, um material, um anel de vagas. */
class MarkLayer {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly pos: Float32Array;
  private readonly norm: Float32Array;
  private readonly data: Float32Array;
  private readonly col: Float32Array;
  private readonly attrs: THREE.InstancedBufferAttribute[];
  private readonly dataAttr: THREE.InstancedBufferAttribute;
  private readonly life: Float32Array;
  private readonly total: Float32Array;
  private readonly size0: Float32Array;
  private readonly size1: Float32Array;
  private cursor = 0;
  private live = 0;

  constructor(readonly max: number, fragmentShader: string, light: boolean) {
    this.geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geo.index = quad.index;
    this.geo.setAttribute('position', quad.getAttribute('position'));
    this.pos = new Float32Array(max * 3);
    this.norm = new Float32Array(max * 3);
    this.data = new Float32Array(max * 4);
    this.col = new Float32Array(max * 4);
    this.life = new Float32Array(max);
    this.total = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    const a = (arr: Float32Array, n: number) => new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    this.dataAttr = a(this.data, 4);
    this.attrs = [a(this.pos, 3), a(this.norm, 3), this.dataAttr, a(this.col, 4)];
    this.geo.setAttribute('aPos', this.attrs[0]!);
    this.geo.setAttribute('aNorm', this.attrs[1]!);
    this.geo.setAttribute('aData', this.dataAttr);
    this.geo.setAttribute('aColor', this.attrs[3]!);
    this.geo.instanceCount = max;
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader,
      uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: light ? THREE.AdditiveBlending : THREE.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // As marcas vão por baixo de tudo que é transparente (fumaça, fogo, partículas): estão grudadas na superfície.
    this.mesh.renderOrder = -1;
  }

  get active(): number {
    return this.live;
  }

  add(at: THREE.Vector3, normal: THREE.Vector3, kind: number, size0: number, size1: number, life: number, color: THREE.Color, strength: number, seed: number): void {
    if (!(life > 0) || !(size1 > 0)) return;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = at.x + normal.x * LIFT;
    this.pos[i * 3 + 1] = at.y + normal.y * LIFT;
    this.pos[i * 3 + 2] = at.z + normal.z * LIFT;
    this.norm[i * 3] = normal.x;
    this.norm[i * 3 + 1] = normal.y;
    this.norm[i * 3 + 2] = normal.z;
    this.data[i * 4] = size0;
    this.data[i * 4 + 1] = seed;
    this.data[i * 4 + 2] = kind;
    this.data[i * 4 + 3] = 0;
    this.col[i * 4] = color.r;
    this.col[i * 4 + 1] = color.g;
    this.col[i * 4 + 2] = color.b;
    this.col[i * 4 + 3] = strength;
    this.life[i] = this.total[i] = life;
    this.size0[i] = size0;
    this.size1[i] = size1;
    for (const attr of this.attrs) attr.needsUpdate = true;
    this.mesh.visible = true;
  }

  update(dt: number): void {
    if (!this.mesh.visible) return;
    let live = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i]! <= 0) continue;
      this.life[i] = this.life[i]! - dt;
      if (this.life[i]! <= 0) {
        this.data[i * 4] = 0; // tamanho zero: o quadrado some (degenerado)
        continue;
      }
      live++;
      const t = 1 - this.life[i]! / this.total[i]!;
      this.data[i * 4 + 3] = t;
      // O tamanho corre do nascer ao fim com freio (o anel de choque sai rápido e desacelera); as marcas paradas têm size0 = size1.
      const ease = 1 - (1 - t) * (1 - t) * (1 - t);
      this.data[i * 4] = this.size0[i]! + (this.size1[i]! - this.size0[i]!) * ease;
    }
    this.live = live;
    this.dataAttr.needsUpdate = true;
    if (live === 0) this.mesh.visible = false;
  }

  clear(): void {
    this.life.fill(0);
    for (let i = 0; i < this.max; i++) this.data[i * 4] = 0;
    this.dataAttr.needsUpdate = true;
    this.live = 0;
    this.mesh.visible = false;
  }
}

/** As duas camadas de marcas (escura e de luz), com a mesma porta de entrada. */
export class Marks {
  readonly dark = new MarkLayer(MAX_DARK_MARKS, FRAG_DARK, false);
  readonly light = new MarkLayer(MAX_LIGHT_MARKS, FRAG_LIGHT, true);
  /** Semente das marcas: cada uma gira e torce a borda de um jeito (sem sorteio: um contador). */
  private seed = 0;

  /** Os dois lotes, para pôr na cena. */
  readonly meshes: readonly THREE.Mesh[] = [this.dark.mesh, this.light.mesh];

  get active(): number {
    return this.dark.active + this.light.active;
  }

  /**
   * Uma marca na superfície de normal `normal` (unitária). `size0`→`size1` é o diâmetro (m) do nascer ao fim; `color` é a brasa (escura) ou a luz
   * (clarão, anel), em HDR; `strength` multiplica a opacidade (escura) ou o brilho (luz).
   */
  add(kind: MarkKind, at: THREE.Vector3, normal: THREE.Vector3, size0: number, size1: number, life: number, color: THREE.Color, strength = 1): void {
    this.seed = (this.seed + 2.39996) % 6.2832; // ângulo de ouro: as marcas seguidas nunca saem iguais
    const layer = kind >= MARK.glow ? this.light : this.dark;
    layer.add(at, normal, kind, size0, size1, life, color, strength, this.seed);
  }

  update(dt: number): void {
    this.dark.update(dt);
    this.light.update(dt);
  }

  clear(): void {
    this.dark.clear();
    this.light.clear();
  }
}
