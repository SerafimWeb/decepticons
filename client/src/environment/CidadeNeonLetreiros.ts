import * as THREE from 'three';
import type { ArteDaCidade } from './CidadeNeonArte';
import type { LetreiroDaCidade, NeonDaCidade } from './CidadeNeonLayout';
import type { UniformesDaCidade } from './CidadeNeonTorres';

/**
 * OS LETREIROS DE BANDEIRA E OS DESENHOS EM NEON DO ENTORNO (P264, PR2): duas `InstancedMesh` (**2 draw calls** para tudo), cada uma com um shader pequeno que lê o atlas de
 * `CidadeNeonArte.ts`. Toda animação é função do relógio no próprio shader (zero trabalho de CPU por quadro, G4/G5). **Os telões saíram daqui na P266: viraram os outdoors da marca**
 * (`Outdoors.ts`, que lê o catálogo `brand/anuncios.ts`).
 *
 *  - o **letreiro de bandeira** é uma caixa fina com uma coluna de glifos e a moldura em tubo de neon nas duas faces; um glifo ou outro está **queimado** e outro **soluça**
 *    (o "neon falhando" que o Comandante pediu);
 *  - o **desenho em neon** é só o traço, somado à fachada (mistura aditiva): metade deles pisca de vez em quando.
 *
 * Nenhuma luz dinâmica nova: o que brilha passa do limiar do bloom e acende "de mentirinha", como todo neon deste jogo (G12).
 */

const NEVOA_GLSL = /* glsl */ `
uniform vec3 fogColor;
uniform float fogDensity;
float nevoa(vec3 p) {
  float d = length(p - cameraPosition);
  return 1.0 - exp(-fogDensity * fogDensity * d * d * 0.55);
}
float hashT(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float hashT2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

const VERTEX_PLANO = /* glsl */ `
attribute vec4 aDados;
attribute vec3 aCor;
varying vec2 vUv;
flat varying vec4 vDados;
flat varying vec3 vCor;
varying vec3 vMundo;
flat varying vec3 vNormal0;
void main() {
  vUv = uv;
  vDados = aDados;
  vCor = aCor;
  vNormal0 = normal;
  vec4 mundo = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vMundo = mundo.xyz;
  gl_Position = projectionMatrix * viewMatrix * mundo;
}
`;

/** O letreiro de bandeira: `aDados` = (coluna de glifos, semente, quanto sai da parede, altura). As faces grandes são as de ±x. */
const FRAGMENT_LETREIRO = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uTempo;
uniform vec3 uLuz;
varying vec2 vUv;
flat varying vec4 vDados;
flat varying vec3 vCor;
varying vec3 vMundo;
flat varying vec3 vNormal0;
${NEVOA_GLSL}
void main() {
  float face = step(0.5, abs(vNormal0.x));
  vec2 uv = clamp(vUv, 0.0, 1.0);
  float glifo = texture2D(uAtlas, vec2((vDados.x + 0.06 + uv.x * 0.88) / 8.0, 0.5 + (0.03 + uv.y * 0.94) * 0.5)).r;
  float celula = floor(uv.y * 4.0);
  float h1 = hashT2(vec2(celula, vDados.y * 91.0));
  float t = uTempo + vDados.y * 40.0;
  float bate = sin(t * 13.1 + celula * 1.7) * sin(t * 4.3 + vDados.y * 9.0);
  float aceso = (1.0 - step(0.9, h1)) * (1.0 - 0.85 * step(0.72, h1) * step(0.78, bate));
  vec2 m = min(uv, 1.0 - uv) * vec2(vDados.z, vDados.w);
  float aa = max(fwidth(m.x), fwidth(m.y));
  float moldura = 1.0 - smoothstep(0.07, 0.07 + aa + 0.03, min(m.x, m.y));
  float queda = 1.0 - 0.7 * step(0.996, hashT2(vec2(floor(t * 5.0), vDados.y * 17.0)));
  vec3 luz = face * (vCor * 2.4 * (glifo * aceso + moldura * 0.9) + vCor * 0.05) * queda;
  float f = nevoa(vMundo);
  vec3 corpo = vec3(0.012, 0.014, 0.02);
  gl_FragColor = vec4(mix(corpo, fogColor, f) + luz * uLuz * (1.0 - 0.55 * f), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** O desenho em neon (aditivo): `aDados` = (qual desenho, semente, 0, 0). */
const FRAGMENT_NEON = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uTempo;
uniform vec3 uLuz;
varying vec2 vUv;
flat varying vec4 vDados;
flat varying vec3 vCor;
varying vec3 vMundo;
${NEVOA_GLSL}
void main() {
  float d = vDados.x;
  vec2 a = vec2((mod(d, 4.0) + 0.02 + vUv.x * 0.96) * 0.25, (d < 3.5 ? 0.25 : 0.0) + (0.02 + vUv.y * 0.96) * 0.25);
  float traco = texture2D(uAtlas, a).r;
  float t = uTempo + vDados.y * 30.0;
  float bate = sin(t * 9.7 + vDados.y * 20.0) * sin(t * 3.1 + vDados.y * 7.0);
  float aceso = 1.0 - 0.8 * step(0.86, bate) * step(0.5, fract(vDados.y * 13.0));
  float f = nevoa(vMundo);
  gl_FragColor = vec4(vCor * 2.6 * traco * aceso * uLuz * (1.0 - 0.55 * f), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;


function material(fragment: string, u: UniformesDaCidade, atlas: THREE.Texture, extra: Record<string, THREE.IUniform> = {}, aditivo = false): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLuz: { value: new THREE.Color() }, uTempo: { value: 0 } }]),
    vertexShader: VERTEX_PLANO,
    fragmentShader: fragment,
    fog: true,
    ...(aditivo ? { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false } : {}),
  });
  // Por referência depois do merge (ele copia valores): o relógio, a luz, o atlas e o detalhe são os mesmos objetos de quem os muda.
  m.uniforms.uLuz = u.luz;
  m.uniforms.uTempo = u.tempo;
  m.uniforms.uAtlas = { value: atlas };
  for (const [k, v] of Object.entries(extra)) m.uniforms[k] = v;
  return m;
}

function instanciar(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, dados: Float32Array, cores: Float32Array, nome: string): THREE.InstancedMesh {
  geo.setAttribute('aDados', new THREE.InstancedBufferAttribute(dados, 4));
  geo.setAttribute('aCor', new THREE.InstancedBufferAttribute(cores, 3));
  const malha = new THREE.InstancedMesh(geo, mat, n);
  malha.frustumCulled = false;
  malha.name = nome;
  return malha;
}

const EIXO_Y = new THREE.Vector3(0, 1, 0);

/** Os letreiros de bandeira (caixas finas, glifos nas duas faces de ±x local). */
export function criarLetreiros(letreiros: readonly LetreiroDaCidade[], arte: ArteDaCidade, u: UniformesDaCidade): THREE.InstancedMesh {
  const dados = new Float32Array(letreiros.length * 4);
  const cores = new Float32Array(letreiros.length * 3);
  const cor = new THREE.Color();
  letreiros.forEach((l, i) => {
    dados.set([l.coluna, l.semente, l.largura, l.altura], i * 4);
    cor.setHex(l.cor);
    cores.set([cor.r, cor.g, cor.b], i * 3);
  });
  const malha = instanciar(new THREE.BoxGeometry(1, 1, 1), material(FRAGMENT_LETREIRO, u, arte.letreiros), letreiros.length, dados, cores, 'cidade-letreiros');
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  letreiros.forEach((l, i) => malha.setMatrixAt(i, m.compose(p.set(l.x, l.y, l.z), q.setFromAxisAngle(EIXO_Y, l.ry), s.set(l.espessura, l.altura, l.largura))));
  return malha;
}

/** Os desenhos em neon pregados nas fachadas (aditivos: só o traço soma luz). */
export function criarNeons(neons: readonly NeonDaCidade[], arte: ArteDaCidade, u: UniformesDaCidade): THREE.InstancedMesh {
  const dados = new Float32Array(neons.length * 4);
  const cores = new Float32Array(neons.length * 3);
  const cor = new THREE.Color();
  neons.forEach((n, i) => {
    dados.set([n.desenho, n.semente, 0, 0], i * 4);
    cor.setHex(n.cor);
    cores.set([cor.r, cor.g, cor.b], i * 3);
  });
  const malha = instanciar(new THREE.PlaneGeometry(1, 1), material(FRAGMENT_NEON, u, arte.letreiros, {}, true), neons.length, dados, cores, 'cidade-neons');
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  neons.forEach((n, i) => malha.setMatrixAt(i, m.compose(p.set(n.x, n.y, n.z), q.setFromAxisAngle(EIXO_Y, n.ry), s.set(n.lado, n.lado, 1))));
  return malha;
}

/** Os shaders dos letreiros e dos desenhos em neon, como pares (vértice, fragmento): o teste confere a interface entre eles (`CidadeNeonShaders.test.ts`). */
export const GLSL_LETREIROS = {
  letreiro: { vertex: VERTEX_PLANO, fragment: FRAGMENT_LETREIRO },
  neon: { vertex: VERTEX_PLANO, fragment: FRAGMENT_NEON },
} as const;
