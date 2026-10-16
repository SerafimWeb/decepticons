import * as THREE from 'three';

/**
 * Cartazes de luz virados para a câmera (P160): o **clarão da boca** (a estrela de quatro pontas do tiro), o **brilho da cabeça** do projétil
 * (o núcleo quente com halo que faz o tiro de energia parecer uma bola de luz, e não uma risca), o **clarão da explosão** e o **anel** de choque
 * visto de frente. O desenho de cada forma sai do shader (nenhuma textura), e todos os cartazes da cena vão num **desenho só**
 * (`InstancedBufferGeometry`, até {@link MAX_BILLBOARDS}).
 *
 * Dois tipos de cartaz, no mesmo lote:
 * - **com vida** (`flash`): nasce, cresce e apaga sozinho em `life` segundos (o clarão);
 * - **do quadro** (`put`): vale só para o quadro em que foi posto (o brilho que acompanha um projétil em voo: quem desenha o tiro o põe a cada quadro).
 *
 * Custo de CPU: escrever 9 números por cartaz aceso por quadro; nada é alocado depois da construção (G4/G5). Só o cliente monta (o servidor não
 * desenha). Soma luz (aditivo) e a névoa apaga o brilho com a distância (em vez de clarear a névoa).
 */

/** As formas que o shader desenha. */
export const BILL = {
  /** Núcleo quente e halo suave: a cabeça do tiro de energia, o clarão redondo. */
  glow: 0,
  /** Estrela de quatro pontas com núcleo: o clarão da boca. */
  star: 1,
  /** Um aro fino: a onda de choque vista de frente. */
  ring: 2,
  /** Uma língua deitada, mais grossa na base: o fogo que sai da boca visto de lado (gira com `angle`). */
  spike: 3,
} as const;
export type BillShape = (typeof BILL)[keyof typeof BILL];

/** Teto (G5): cartazes acesos ao mesmo tempo, somando os com vida e os do quadro. */
export const MAX_BILLBOARDS = 320;
/** Quantos cartazes com vida, no máximo; o resto do teto fica para os do quadro (os projéteis em voo). */
export const MAX_TIMED = 160;

const VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute vec4 aColor;
  attribute vec2 aSize;
  varying vec3 vColor;
  varying vec2 vUv;
  varying float vShape;
  #include <fog_pars_vertex>
  void main() {
    vUv = position.xy * 2.0;
    vColor = aColor.rgb;
    vShape = aColor.a;
    float c = cos(aSize.y);
    float s = sin(aSize.y);
    vec2 off = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aSize.x;
    vec4 mvPosition = modelViewMatrix * vec4(aPos, 1.0);
    mvPosition.xy += off;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying vec2 vUv;
  varying float vShape;
  #include <fog_pars_fragment>
  void main() {
    float r = length(vUv);
    float h = max(1.0 - r, 0.0);
    float a;
    if (vShape < 0.5) {
      a = h * h * 0.75 + max(1.0 - r * 3.2, 0.0) * 1.6;
    } else if (vShape < 1.5) {
      float rx = max(1.0 - abs(vUv.y) * 9.0, 0.0) * max(1.0 - abs(vUv.x), 0.0);
      float ry = max(1.0 - abs(vUv.x) * 9.0, 0.0) * max(1.0 - abs(vUv.y), 0.0);
      a = (rx + ry) * 1.3 + h * h * h * 1.4;
    } else if (vShape < 2.5) {
      a = max(1.0 - abs(r - 0.82) * 9.0, 0.0) * (1.0 - step(1.0, r));
    } else {
      float along = clamp(vUv.x * 0.5 + 0.5, 0.0, 1.0);
      float wid = (1.0 - along) * 0.55 + 0.04;
      a = max(1.0 - abs(vUv.y) / wid, 0.0) * (1.0 - along * along) * 1.6 + max(1.0 - r * 2.6, 0.0) * 1.2;
    }
    if (a < 0.004) discard;
    vec3 col = vColor * a;
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

export class Billboards {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly posAttr: THREE.InstancedBufferAttribute;
  private readonly colAttr: THREE.InstancedBufferAttribute;
  private readonly sizeAttr: THREE.InstancedBufferAttribute;
  // Os com vida: posição, cor, forma, tamanho no nascer e no fim, giro, vida.
  private readonly tPos = new Float32Array(MAX_TIMED * 3);
  private readonly tCol = new Float32Array(MAX_TIMED * 3);
  private readonly tShape = new Float32Array(MAX_TIMED);
  private readonly tSize0 = new Float32Array(MAX_TIMED);
  private readonly tSize1 = new Float32Array(MAX_TIMED);
  private readonly tAngle = new Float32Array(MAX_TIMED);
  private readonly tLife = new Float32Array(MAX_TIMED);
  private readonly tMax = new Float32Array(MAX_TIMED);
  private cursor = 0;
  /** Cartazes postos neste quadro (`put`), depois dos com vida. */
  private frame = 0;
  private timedLive = 0;

  constructor() {
    this.geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geo.index = quad.index;
    this.geo.setAttribute('position', quad.getAttribute('position'));
    this.pos = new Float32Array(MAX_BILLBOARDS * 3);
    this.col = new Float32Array(MAX_BILLBOARDS * 4);
    this.size = new Float32Array(MAX_BILLBOARDS * 2);
    this.posAttr = new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.InstancedBufferAttribute(this.size, 2).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aPos', this.posAttr);
    this.geo.setAttribute('aColor', this.colAttr);
    this.geo.setAttribute('aSize', this.sizeAttr);
    this.geo.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  /** Quantos cartazes estão acesos (com vida + do quadro). */
  get active(): number {
    return this.geo.instanceCount;
  }

  /** Quantos cartazes com vida ainda brilham. */
  get timed(): number {
    return this.timedLive;
  }

  /**
   * Um clarão com vida: nasce em `at` com `size0` metros, vai a `size1` e apaga em `life` s (o brilho cai do começo ao fim). `color` em HDR (>1 acende o bloom).
   * Cheio, o mais velho cede o lugar.
   */
  flash(at: THREE.Vector3, color: THREE.Color, shape: BillShape, size0: number, size1: number, life: number, angle = 0): void {
    if (!(life > 0)) return;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_TIMED;
    this.tPos[i * 3] = at.x;
    this.tPos[i * 3 + 1] = at.y;
    this.tPos[i * 3 + 2] = at.z;
    this.tCol[i * 3] = color.r;
    this.tCol[i * 3 + 1] = color.g;
    this.tCol[i * 3 + 2] = color.b;
    this.tShape[i] = shape;
    this.tSize0[i] = size0;
    this.tSize1[i] = size1;
    this.tAngle[i] = angle;
    this.tLife[i] = this.tMax[i] = life;
  }

  /** Começa o quadro: os cartazes do quadro anterior (`put`) somem. Chame antes dos `put` do quadro. */
  beginFrame(): void {
    this.frame = 0;
  }

  /** Um cartaz só para este quadro (o brilho de um projétil em voo). Passou do teto, é ignorado. */
  put(at: THREE.Vector3, color: THREE.Color, shape: BillShape, size: number, intensity = 1, angle = 0): void {
    const n = MAX_TIMED + this.frame;
    if (n >= MAX_BILLBOARDS) return;
    this.frame++;
    this.write(n, at.x, at.y, at.z, color.r * intensity, color.g * intensity, color.b * intensity, shape, size, angle);
  }

  /** Envelhece os com vida e monta o lote do quadro (os com vida primeiro, depois os `put`). */
  update(dt: number): void {
    let n = 0;
    let live = 0;
    for (let i = 0; i < MAX_TIMED; i++) {
      if (this.tLife[i]! <= 0) continue;
      this.tLife[i] = this.tLife[i]! - dt;
      if (this.tLife[i]! <= 0) continue;
      live++;
      const t = 1 - this.tLife[i]! / this.tMax[i]!; // 0 no nascer, 1 no fim
      const fade = (1 - t) * (1 - t);
      const size = this.tSize0[i]! + (this.tSize1[i]! - this.tSize0[i]!) * (1 - (1 - t) * (1 - t));
      this.write(n++, this.tPos[i * 3]!, this.tPos[i * 3 + 1]!, this.tPos[i * 3 + 2]!, this.tCol[i * 3]! * fade, this.tCol[i * 3 + 1]! * fade, this.tCol[i * 3 + 2]! * fade, this.tShape[i]!, size, this.tAngle[i]!);
    }
    this.timedLive = live;
    // Os do quadro foram escritos a partir de MAX_TIMED: chegam para logo depois dos com vida.
    if (this.frame > 0 && n < MAX_TIMED) {
      this.pos.copyWithin(n * 3, MAX_TIMED * 3, (MAX_TIMED + this.frame) * 3);
      this.col.copyWithin(n * 4, MAX_TIMED * 4, (MAX_TIMED + this.frame) * 4);
      this.size.copyWithin(n * 2, MAX_TIMED * 2, (MAX_TIMED + this.frame) * 2);
    }
    this.geo.instanceCount = n + this.frame;
    this.mesh.visible = this.geo.instanceCount > 0;
    if (this.mesh.visible) {
      this.posAttr.needsUpdate = true;
      this.colAttr.needsUpdate = true;
      this.sizeAttr.needsUpdate = true;
    }
  }

  /** Apaga tudo (rodada nova). */
  clear(): void {
    this.tLife.fill(0);
    this.frame = 0;
    this.timedLive = 0;
    this.geo.instanceCount = 0;
    this.mesh.visible = false;
  }

  private write(n: number, x: number, y: number, z: number, r: number, g: number, b: number, shape: number, size: number, angle: number): void {
    this.pos[n * 3] = x;
    this.pos[n * 3 + 1] = y;
    this.pos[n * 3 + 2] = z;
    this.col[n * 4] = r;
    this.col[n * 4 + 1] = g;
    this.col[n * 4 + 2] = b;
    this.col[n * 4 + 3] = shape;
    this.size[n * 2] = size;
    this.size[n * 2 + 1] = angle;
  }
}
