import * as THREE from 'three';
import type { WaveFrame } from './WaveRings';

/**
 * A névoa de calor (dono, 13/10: "tem que mostrar que está quente, usando o mesmo efeito visual do calor que faz um golpe de vista quando olhamos o asfalto quente; quero
 * replicar esse efeito no anel de calor e nas chamas do lança-chamas"). Cada pluma é um quadrado que **olha para a câmera** e **não tem cor própria**: ele desenha de novo
 * a imagem que está atrás dele **deslocada por um ruído que sobe** (a mesma cópia do quadro dos anéis da onda sônica, `FrameCopyPass`), então o cenário treme e ondula em cima do
 * fogo, como o ar quente sobre o asfalto. Sem a cópia (qualidade baixa, ou o primeiro quadro) a pluma vira um brilho quente quase invisível: não distorce, mas não quebra.
 *
 * Custo: **um draw call** (geometria instanciada, `HAZE_CAP` plumas no máximo), só desenhado enquanto há pluma viva; nenhuma alocação por quadro (vetores fixos). A cópia do quadro
 * só roda enquanto há pluma ou anel de onda vivo. Quem emite (`FlameVisuals`, `FireRingVisuals`) não faz nada com a névoa desligada (qualidade baixa).
 */
export const HAZE_CAP = 96;

const VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iPar; // tamanho (m), idade (0 a 1), força, semente
  varying vec2 vUv;
  varying vec4 vPar;
  void main() {
    vUv = uv;
    vPar = iPar;
    vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
    mv.xy += position.xy * iPar.x;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tFrame;
  uniform vec2 uRes;
  uniform float uReady;
  uniform float uTime;
  uniform float uBend;
  varying vec2 vUv;
  varying vec4 vPar;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec2 c = vUv * 2.0 - 1.0;
    float r = length(c);
    // A pluma nasce e morre suave (sem borda dura) e some nas bordas do quadrado.
    float life = sin(clamp(vPar.y, 0.0, 1.0) * 3.14159265);
    float a = smoothstep(1.0, 0.15, r) * life * vPar.z;
    if (a < 0.01) discard;
    if (uReady < 0.5) {
      gl_FragColor = vec4(1.0, 0.62, 0.3, a * 0.05);
      return;
    }
    vec2 uv = gl_FragCoord.xy / uRes;
    // Ruído esticado na vertical que sobe com o tempo: as listras do ar quente subindo.
    vec2 p = vec2(c.x * 3.2 + vPar.w * 31.0, c.y * 1.5 - uTime * 2.4 - vPar.y * 2.0);
    vec2 n = vec2(noise(p), noise(p + vec2(7.3, 3.1))) - 0.5;
    vec2 off = n * 2.0 * a * uBend * vec2(uRes.y / uRes.x, 1.0);
    vec3 col = texture2D(tFrame, uv + off).rgb;
    // Um tom quente muito leve: o ar sobre o fogo esquenta a cor do que se vê através dele.
    col *= vec3(1.0 + 0.1 * a, 1.0 + 0.03 * a, 1.0);
    gl_FragColor = vec4(col, clamp(a * 2.6, 0.0, 1.0));
  }
`;

export class HeatHaze {
  readonly mesh: THREE.Mesh;
  /** Ligada (qualidade média ou alta): desligada, ninguém emite e nada é desenhado. */
  enabled = true;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly posAttr: THREE.InstancedBufferAttribute;
  private readonly parAttr: THREE.InstancedBufferAttribute;
  // Uma pluma por posição; `life` 0 = posição livre.
  private readonly age = new Float32Array(HAZE_CAP);
  private readonly life = new Float32Array(HAZE_CAP);
  private readonly base = new Float32Array(HAZE_CAP * 3);
  private readonly rise = new Float32Array(HAZE_CAP);
  private readonly size = new Float32Array(HAZE_CAP);
  private readonly power = new Float32Array(HAZE_CAP);
  private readonly seed = new Float32Array(HAZE_CAP);
  private head = 0;
  private live = 0;
  private clock = 0;
  private shown = 0;

  constructor() {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    this.geometry.setAttribute('uv', quad.getAttribute('uv'));
    this.posAttr = new THREE.InstancedBufferAttribute(new Float32Array(HAZE_CAP * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.parAttr = new THREE.InstancedBufferAttribute(new Float32Array(HAZE_CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('iPos', this.posAttr);
    this.geometry.setAttribute('iPar', this.parAttr);
    this.geometry.instanceCount = 0;
    this.material = new THREE.ShaderMaterial({
      name: 'HeatHaze',
      uniforms: {
        tFrame: { value: null as THREE.Texture | null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uReady: { value: 0 },
        uTime: { value: 0 },
        uBend: { value: 0.022 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
    this.mesh.name = 'heat-haze';
  }

  /** Há pluma viva? Quem tem o `FrameCopyPass` o liga enquanto isto for verdade. */
  get active(): boolean {
    return this.live > 0;
  }

  /** Quantas plumas estão desenhadas agora. */
  get visibleCount(): number {
    return this.shown;
  }

  /**
   * Solta uma pluma em (x, y, z): `size` metros de lado, `life` segundos, `power` de 0 a 1 (quanto desloca a imagem) e `rise` metros que ela sobe até morrer.
   * Com a névoa desligada não faz nada; passando do teto, a mais velha dá lugar (o cursor é circular, como o das partículas).
   */
  emit(x: number, y: number, z: number, size: number, life: number, power: number, rise: number): void {
    if (!this.enabled || life <= 0) return;
    const s = this.head;
    this.head = (this.head + 1) % HAZE_CAP;
    if (this.life[s] <= 0) this.live++;
    this.age[s] = 0;
    this.life[s] = life;
    this.base[s * 3] = x;
    this.base[s * 3 + 1] = y;
    this.base[s * 3 + 2] = z;
    this.rise[s] = rise;
    this.size[s] = size;
    this.power[s] = power;
    // A semente muda o desenho do ruído de uma pluma para outra (função da posição no pool, sem sorteio).
    this.seed[s] = ((s + 1) * 0.6180339887) % 1;
  }

  update(dt: number): void {
    this.clock += dt;
    this.material.uniforms.uTime!.value = this.clock;
    const pos = this.posAttr.array as Float32Array;
    const par = this.parAttr.array as Float32Array;
    let n = 0;
    for (let s = 0; s < HAZE_CAP; s++) {
      if (this.life[s]! <= 0) continue;
      this.age[s]! += dt;
      const u = this.age[s]! / this.life[s]!;
      if (u >= 1) {
        this.life[s] = 0;
        this.live--;
        continue;
      }
      pos[n * 3] = this.base[s * 3]!;
      pos[n * 3 + 1] = this.base[s * 3 + 1]! + this.rise[s]! * u;
      pos[n * 3 + 2] = this.base[s * 3 + 2]!;
      // A pluma incha um pouco ao subir (o ar quente se espalha).
      par[n * 4] = this.size[s]! * (0.8 + 0.5 * u);
      par[n * 4 + 1] = u;
      par[n * 4 + 2] = this.power[s]!;
      par[n * 4 + 3] = this.seed[s]!;
      n++;
    }
    this.shown = n;
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    if (n > 0) {
      this.posAttr.needsUpdate = true;
      this.parAttr.needsUpdate = true;
    }
  }

  /** Aponta a névoa para a cópia do quadro (ou para nenhuma: brilho quente fraco). Uma vez por quadro, antes do desenho. */
  setFrame(frame: WaveFrame | null): void {
    const u = this.material.uniforms;
    if (frame && frame.ready) {
      u.tFrame!.value = frame.texture;
      (u.uRes!.value as THREE.Vector2).set(frame.width, frame.height);
      u.uReady!.value = 1;
    } else u.uReady!.value = 0;
  }

  /** Apaga as plumas (reiniciar a partida, entrar no Hangar). */
  clear(): void {
    this.life.fill(0);
    this.live = 0;
    this.shown = 0;
    this.geometry.instanceCount = 0;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
