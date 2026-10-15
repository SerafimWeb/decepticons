import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Adereco } from './PraiaAderecos';
import { feixesDosRefletores, holofotesDaEstacao, luzesDaPraia, pocasDeLuz } from './PraiaLuzesDados';
import type { UniformesDaPraia } from './PraiaUniformes';

/**
 * AS LUZES DA PRAIA (P127, rodada de luz): o que faz o fim de tarde virar começo de noite. A ficha **proíbe luz nova** na cena (cada luz
 * dinâmica multiplica o custo de todo material), então a luz é **desenhada**, não calculada: tudo aqui é aditivo, sem profundidade e na GPU.
 *  - **os halos** (um desenho para ~300 pontos): o brilho macio em volta de cada lâmpada, do poste ao varal das barracas, do farol ao aviso
 *    vermelho das antenas e das lanchas rebeldes. Um quadro voltado para a câmera por luz, o miolo quente e a borda que some; o tempo
 *    (fixa, respira, pisca, cintila) é calculado no vértice;
 *  - **as poças de luz** no chão (um desenho): o círculo quente sob cada poste e na frente de cada barraca, e a poça grande dos refletores
 *    no pátio da estação;
 *  - **os feixes** (um desenho): a luz dos cinco refletores até o pátio, em cones de borda macia;
 *  - **os holofotes** (dois desenhos): as torres de vigia da estação **varrem** o mar e a areia.
 *
 * **Custo:** CPU por quadro: a rotação de 2 holofotes e do farol (3 matrizes). GPU: 5 desenhos, ~700 triângulos, a mistura aditiva em área
 * pequena (a qualidade baixa **desliga** as poças e os feixes e deixa só os halos; o rebaixamento automático faz o mesmo).
 */

const NEVOA_PADRAO = 0.0024;

/** O tempo das luzes, igual nos halos: fixa, respira, pisca (aceso ~0,4 s a cada 1,5 s), cintila. */
const GLSL_PULSO = /* glsl */ `
float pulso(float modo, float fase, float t) {
  if (modo < 0.5) return 1.0;
  if (modo < 1.5) return 0.8 + 0.2 * sin(t * 1.7 + fase);
  if (modo < 2.5) return step(fract((t + fase) / 1.5), 0.28) + 0.05;
  float f = sin(t * 31.0 + fase * 3.0) * sin(t * 4.7 + fase);
  return 0.55 + 0.45 * smoothstep(-0.6, 0.6, f);
}
`;

const VERTICE_DO_HALO = /* glsl */ `
attribute vec3 iCentro;
attribute vec4 iDados; // raio, modo, fase
attribute vec3 iCor;
uniform float uTempo;
uniform float uNevoa;
varying vec2 vUv;
varying vec3 vCor;
${GLSL_PULSO}
void main() {
  vec4 mv = modelViewMatrix * vec4(iCentro, 1.0);
  float dist = -mv.z;
  float longe = 1.0 - smoothstep(110.0, 250.0, dist);
  float perto = smoothstep(iDados.x * 1.4, iDados.x * 6.0, dist); // de perto o halo some: a câmera não fica dentro de um clarão
  float nevoa = exp(-uNevoa * uNevoa * dist * dist);
  float k = longe * perto * nevoa * pulso(iDados.y, iDados.z, uTempo);
  float raio = max(iDados.x, dist * 0.007);
  vUv = position.xy;
  vCor = iCor * k;
  mv.xy += position.xy * raio;
  mv.z += min(raio * 0.5, 2.0); // o quadro fica um pouco à frente da lâmpada: a caixa dela não o corta
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENTO_DO_HALO = /* glsl */ `
varying vec2 vUv;
varying vec3 vCor;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float halo = pow(max(1.0 - sqrt(max(r2, 0.0)), 0.0), 2.6);
  float miolo = exp(-r2 * 22.0);
  gl_FragColor = vec4(vCor * (halo * 0.38 + miolo * 0.6), 1.0);
}
`;

const VERTICE_DA_POCA = /* glsl */ `
attribute vec3 iCentro;
attribute vec2 iPoca; // raio, força
attribute vec3 iCor;
uniform float uNevoa;
varying vec2 vUv;
varying vec3 vCor;
void main() {
  vec4 mv = modelViewMatrix * vec4(iCentro + vec3(position.x * iPoca.x, 0.0, position.y * iPoca.x), 1.0);
  float dist = -mv.z;
  float k = (1.0 - smoothstep(120.0, 230.0, dist)) * exp(-uNevoa * uNevoa * dist * dist);
  vUv = position.xy;
  vCor = iCor * iPoca.y * k;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENTO_DA_POCA = /* glsl */ `
varying vec2 vUv;
varying vec3 vCor;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float a = pow(max(1.0 - r, 0.0), 1.7);
  gl_FragColor = vec4(vCor * a, 1.0);
}
`;

/** O feixe: o cone mais opaco no miolo (voltado para a câmera) e some na borda, e esvanece com a distância da lâmpada. */
const VERTICE_DO_FEIXE = /* glsl */ `
attribute float aT;
varying float vT;
varying vec3 vN;
varying vec3 vV;
varying float vDist;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  vT = aT;
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENTO_DO_FEIXE = /* glsl */ `
uniform vec3 uCor;
uniform float uAlfa;
varying float vT;
varying vec3 vN;
varying vec3 vV;
varying float vDist;
void main() {
  float frente = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
  // Some perto da lâmpada e perto da câmera: o feixe que passa a 5 m do rosto do jogador não pode virar um véu branco.
  float a = uAlfa * frente * (1.0 - vT * 0.8) * smoothstep(0.0, 0.16, vT) * smoothstep(5.0, 32.0, vDist);
  gl_FragColor = vec4(uCor * a, 1.0);
}
`;

function materialAditivo(vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>, profundidade = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    ...(profundidade ? { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } : {}),
  });
}

/** O quadro unitário (de -1 a 1) que cada luz instancia. */
function quadro(): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/**
 * Um cone aberto de `comprimento` m (a ponta na origem, a base em +x, com `raio` na boca) com o atributo `aT` (0 na lâmpada, 1 na ponta),
 * já inclinado `queda` rad para baixo. É a forma de um feixe de holofote; o do refletor aponta para o chão, então usa `apontar`.
 */
export function coneDeFeixe(comprimento: number, raio: number, segmentos = 14): THREE.BufferGeometry {
  const cone = new THREE.ConeGeometry(raio, comprimento, segmentos, 1, true);
  cone.translate(0, -comprimento / 2, 0); // a ponta na origem, a boca em -y
  const pos = cone.attributes.position!;
  const t = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) t[i] = -pos.getY(i) / comprimento;
  cone.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  return cone;
}

const BAIXO = new THREE.Vector3(0, -1, 0);
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

export class PraiaLuzes {
  private readonly holofotes: { raiz: THREE.Object3D; velocidade: number; fase: number }[] = [];
  private readonly soComDetalhe: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, u: UniformesDaPraia, lista: readonly Adereco[]) {
    const nevoa = scene.fog instanceof THREE.FogExp2 ? scene.fog.density : NEVOA_PADRAO;
    this.halos(scene, u, lista, nevoa);
    this.pocas(scene, lista, nevoa);
    this.feixes(scene, lista);
    this.holofotesDaEstacao(scene, lista);
  }

  /** Por quadro: gira os holofotes das torres de vigia (duas matrizes). */
  update(elapsed: number): void {
    for (const h of this.holofotes) h.raiz.rotation.y = h.fase + elapsed * h.velocidade;
  }

  /** Liga ou desliga o que é só de acabamento (as poças e os feixes): a qualidade baixa e o rebaixamento automático desligam. */
  setDetalhe(alto: boolean): void {
    for (const o of this.soComDetalhe) o.visible = alto;
  }

  private halos(scene: THREE.Scene, u: UniformesDaPraia, lista: readonly Adereco[], nevoa: number): void {
    const luzes = luzesDaPraia(lista);
    const n = luzes.length;
    const centro = new Float32Array(n * 3);
    const dados = new Float32Array(n * 4);
    const cor = new Float32Array(n * 3);
    luzes.forEach((l, i) => {
      centro.set([l.x, l.y, l.z], i * 3);
      dados.set([l.raio, l.modo, l.fase, 0], i * 4);
      cor.set([l.r, l.g, l.b], i * 3);
    });
    const g = quadro();
    g.setAttribute('iCentro', new THREE.InstancedBufferAttribute(centro, 3));
    g.setAttribute('iDados', new THREE.InstancedBufferAttribute(dados, 4));
    g.setAttribute('iCor', new THREE.InstancedBufferAttribute(cor, 3));
    g.instanceCount = n;
    const malha = new THREE.Mesh(g, materialAditivo(VERTICE_DO_HALO, FRAGMENTO_DO_HALO, { uTempo: u.tempo, uNevoa: { value: nevoa } }));
    malha.frustumCulled = false;
    malha.renderOrder = 5;
    scene.add(malha);
  }

  private pocas(scene: THREE.Scene, lista: readonly Adereco[], nevoa: number): void {
    const pocas = pocasDeLuz(lista);
    const n = pocas.length;
    const centro = new Float32Array(n * 3);
    const dados = new Float32Array(n * 2);
    const cor = new Float32Array(n * 3);
    pocas.forEach((p, i) => {
      centro.set([p.x, p.y, p.z], i * 3);
      dados.set([p.raio, p.forca], i * 2);
      cor.set([p.r, p.g, p.b], i * 3);
    });
    const g = quadro();
    g.setAttribute('iCentro', new THREE.InstancedBufferAttribute(centro, 3));
    g.setAttribute('iPoca', new THREE.InstancedBufferAttribute(dados, 2));
    g.setAttribute('iCor', new THREE.InstancedBufferAttribute(cor, 3));
    g.instanceCount = n;
    const malha = new THREE.Mesh(g, materialAditivo(VERTICE_DA_POCA, FRAGMENTO_DA_POCA, { uNevoa: { value: nevoa } }, true));
    malha.frustumCulled = false;
    malha.renderOrder = 4;
    scene.add(malha);
    this.soComDetalhe.push(malha);
  }

  /** Os feixes parados dos refletores: do banco de lâmpadas ao pátio, num só desenho. */
  private feixes(scene: THREE.Scene, lista: readonly Adereco[]): void {
    const feixes = feixesDosRefletores(lista);
    if (feixes.length === 0) return;
    const partes: THREE.BufferGeometry[] = [];
    for (const f of feixes) {
      const comprimento = Math.hypot(f.para[0] - f.de[0], f.para[1] - f.de[1], f.para[2] - f.de[2]);
      const g = coneDeFeixe(comprimento, f.raio);
      _dir.set(f.para[0] - f.de[0], f.para[1] - f.de[1], f.para[2] - f.de[2]).normalize();
      _q.setFromUnitVectors(BAIXO, _dir); // a boca (em -y) vai para o destino
      g.applyMatrix4(_m.compose(_p.set(f.de[0], f.de[1], f.de[2]), _q, _s));
      partes.push(g);
    }
    const g = mergeGeometries(partes, false);
    for (const p of partes) p.dispose();
    if (!g) return;
    const c = feixes[0]!;
    const malha = new THREE.Mesh(g, materialAditivo(VERTICE_DO_FEIXE, FRAGMENTO_DO_FEIXE, { uCor: { value: new THREE.Color(c.r, c.g, c.b) }, uAlfa: { value: c.alfa } }));
    malha.frustumCulled = false;
    malha.renderOrder = 3;
    scene.add(malha);
    this.soComDetalhe.push(malha);
  }

  /** Os holofotes das torres de vigia: um cone fino que gira (de 120 m), uma raiz por torre. */
  private holofotesDaEstacao(scene: THREE.Scene, lista: readonly Adereco[]): void {
    for (const h of holofotesDaEstacao(lista)) {
      const cone = coneDeFeixe(h.alcance, h.raio);
      cone.rotateZ(Math.PI / 2); // deitado, abrindo para +x
      cone.rotateZ(-0.05); // e um pouco para baixo: varre o chão, não o céu
      const malha = new THREE.Mesh(cone, materialAditivo(VERTICE_DO_FEIXE, FRAGMENTO_DO_FEIXE, { uCor: { value: new THREE.Color(1.3, 1.25, 1.1) }, uAlfa: { value: 0.16 } }));
      malha.frustumCulled = false;
      malha.renderOrder = 3;
      const raiz = new THREE.Group();
      raiz.position.set(h.x, h.y, h.z);
      raiz.add(malha);
      scene.add(raiz);
      this.holofotes.push({ raiz, velocidade: h.velocidade, fase: h.fase });
      this.soComDetalhe.push(raiz);
    }
  }
}
