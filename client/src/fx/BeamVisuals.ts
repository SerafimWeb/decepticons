import * as THREE from 'three';
import { GLOW } from '../core/palette';
import { GLSL_NORMAL_SEGURA } from '../environment/glslSeguro';

/**
 * O feixe do raio laser (`Beam` em `combat/weapons.ts`), só desenho: cada pulso acende uma linha do cano até onde bateu e ela se apaga em `glow` segundos; como o próximo pulso sai
 * antes (`fireInterval` < `glow`), os pulsos seguidos parecem **um feixe contínuo**. Quem decide onde o pulso bateu e o dano é a partida (`Match.beamPulse`); o cliente online
 * desenha o pulso dos outros jogadores a partir do evento de tiro (`Match.drawBeam`).
 *
 * Duas instâncias por pulso, num `InstancedMesh` cada (duas chamadas de desenho para todos os feixes da cena, nunca uma por feixe): o brilho largo e translúcido e o núcleo fino e
 * claro. Pool fixo de {@link MAX_BEAMS}: cheio, o pulso mais velho cede o lugar. Custo de CPU: dois `setMatrixAt` por feixe aceso por tick; nada é alocado (G4/G5).
 *
 * **P160:** o brilho deixou de ser um cilindro de cor chapada (de perto, um cano de seis faces): o shader apaga a borda (o brilho é máximo no eixo
 * e some na silhueta) e faz a energia **correr** pelo feixe em faixas, do cano para o alvo. O mesmo pool desenha o **raio iônico do trilho**
 * (`WeaponFx.landed`): mais grosso, na cor do trilho, apagando em quase meio segundo.
 */
export const MAX_BEAMS = 40;

/** A largura do brilho e do núcleo (raio, em m), com o pulso recém-aceso. */
const HALO = 0.11;
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

/** O brilho: máximo no eixo, zero na silhueta, com faixas de energia que correm do cano ao alvo (`uTime`). */
const HALO_VERT = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vV;
  varying float vAlong;
  #include <fog_pars_vertex>
  void main() {
    vColor = instanceColor;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vN = normalMatrix * mat3(instanceMatrix) * normal;
    vV = -mvPosition.xyz;
    vAlong = (position.z + 0.5) * length(instanceMatrix[2].xyz);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const HALO_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vV;
  varying float vAlong;
  #include <fog_pars_fragment>
  ${GLSL_NORMAL_SEGURA}
  void main() {
    float f = abs(dot(normalSegura(vN), normalSegura(vV)));
    float band = 0.72 + 0.28 * sin(vAlong * 1.6 - uTime * 42.0) * sin(vAlong * 0.37 - uTime * 17.0);
    vec3 col = vColor * f * f * band * 1.35;
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

interface Beam {
  /** Segundos de brilho que restam (0 = apagado). */
  left: number;
  /** Duração total do brilho deste pulso. */
  total: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** Multiplica a largura (1 = o laser; o raio do trilho é mais grosso). */
  width: number;
}

export class BeamVisuals {
  private readonly pool: Beam[] = [];
  private readonly halo: THREE.InstancedMesh;
  private readonly core: THREE.InstancedMesh;
  private readonly colors: THREE.Color[] = [];
  private readonly haloMaterial: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    // Um cilindro de raio 1 e comprimento 1 deitado ao longo de Z: a escala dá a largura e o comprimento de cada feixe.
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2);
    const add = (opacity: number): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.haloMaterial = new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    });
    this.halo = new THREE.InstancedMesh(geo, this.haloMaterial, MAX_BEAMS);
    this.core = new THREE.InstancedMesh(geo, add(0.95), MAX_BEAMS);
    for (let i = 0; i < MAX_BEAMS; i++) {
      this.pool.push({ left: 0, total: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), width: 1 });
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

  /**
   * Acende um pulso de `from` a `to`; `hostile` pinta o brilho de vermelho (o do jogador é magenta). `glow` = segundos aceso (`Beam.glow`).
   * `color` troca a cor do brilho (o raio do trilho) e `width` multiplica a largura.
   */
  spawn(from: THREE.Vector3, to: THREE.Vector3, hostile: boolean, glow: number, color?: THREE.Color, width = 1): void {
    let k = this.pool.findIndex((b) => b.left <= 0);
    if (k < 0) {
      k = 0;
      for (let i = 1; i < this.pool.length; i++) if (this.pool[i]!.left < this.pool[k]!.left) k = i; // cheio: o mais perto de apagar cede o lugar
    }
    const b = this.pool[k]!;
    b.left = b.total = glow;
    b.from.copy(from);
    b.to.copy(to);
    b.width = width;
    this.colors[k]!.copy(color ?? (hostile ? GLOW.hostileLaser : GLOW.friendlyLaser));
  }

  /** Um tick: os feixes envelhecem e as instâncias se refazem (mais finos conforme se apagam). */
  update(dt: number): void {
    const time = this.haloMaterial.uniforms['uTime']!;
    time.value = (time.value + dt) % 1000;
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
      const fade = (0.35 + 0.65 * (b.left / b.total)) * b.width;
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
