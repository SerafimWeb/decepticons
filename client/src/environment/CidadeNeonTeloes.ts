import * as THREE from 'three';
import type { ArteDaCidade } from './CidadeNeonArte';
import type { LetreiroDaCidade, NeonDaCidade, TelaoDaCidade } from './CidadeNeonLayout';
import type { UniformesDaCidade } from './CidadeNeonTorres';

/**
 * OS TELÕES, OS LETREIROS DE BANDEIRA E OS DESENHOS EM NEON DO ENTORNO (P264, PR2): três `InstancedMesh` (**3 draw calls** para tudo), cada um
 * com um shader pequeno que lê o atlas de `CidadeNeonArte.ts`. Toda animação é função do relógio no próprio shader (zero trabalho de CPU por
 * quadro, G4/G5):
 *
 *  - o **telão** troca de anúncio a cada 6–13 s (cada um no seu tempo) e a troca chega com **falha de sinal** (faixas deslocadas e as cores
 *    separadas); de vez em quando soluça no meio. De perto é uma **grade de LEDs**, com uma faixa clara de varredura descendo — de longe a grade
 *    vira a média (sem moiré). Em qualidade baixa (`detalhe` 0), só a imagem;
 *  - o **letreiro de bandeira** é uma caixa fina com uma coluna de glifos e a moldura em tubo de neon nas duas faces; um glifo ou outro está
 *    **queimado** e outro **soluça** (o "neon falhando" que o Comandante pediu);
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

/**
 * O telão: `aDados` = (grupo 0 em pé | 4 deitado, primeiro anúncio, fase, período). A cada três trocas, uma é **grafismo animado** (o
 * equalizador de LED ou os anéis pulsando em volta de um glifo), e metade dos telões mostra os anúncios **noutra paleta** (a matiz girada):
 * com só oito anúncios, é o que impede a mesma imagem de se repetir igual pela cidade inteira.
 */
const FRAGMENT_TELAO = /* glsl */ `
uniform sampler2D uAtlas;
uniform sampler2D uLetreiros;
uniform float uTempo;
uniform vec3 uLuz;
uniform float uDetalhe;
varying vec2 vUv;
flat varying vec4 vDados;
varying vec3 vMundo;
${NEVOA_GLSL}
vec2 noAtlas(float anuncio, vec2 uv) {
  uv = clamp(uv, 0.015, 0.985);
  if (anuncio < 3.5) return vec2((anuncio + uv.x) * 0.25, 0.5 + uv.y * 0.5);
  float j = anuncio - 4.0;
  return vec2((mod(j, 2.0) + uv.x) * 0.5, (j < 1.5 ? 0.25 : 0.0) + uv.y * 0.25);
}
vec3 paletaNeon(float h) {
  h = fract(h);
  return h < 0.2 ? vec3(1.0, 0.17, 0.84) : (h < 0.4 ? vec3(0.0, 0.9, 1.0) : (h < 0.6 ? vec3(1.0, 0.82, 0.1) : (h < 0.8 ? vec3(0.62, 0.25, 1.0) : vec3(1.0, 0.25, 0.2))));
}
// A matiz girada em volta do eixo cinza (Rodrigues): a mesma imagem, outra paleta.
vec3 girarMatiz(vec3 c, float a) {
  vec3 k = vec3(0.57735);
  float ca = cos(a);
  return max(c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca), vec3(0.0));
}
vec3 grafismo(vec2 uv, float t, float k, float s, bool emPe) {
  vec3 a = paletaNeon(s + k * 0.31);
  vec3 b = paletaNeon(s + k * 0.31 + 0.4);
  if (mod(k, 2.0) < 0.5) {
    // O equalizador: barras de LED em segmentos, subindo e descendo cada uma no seu ritmo.
    float barras = emPe ? 7.0 : 14.0;
    float i = floor(uv.x * barras);
    float alto = 0.12 + 0.72 * abs(sin(t * (1.3 + hashT(i + s * 10.0) * 2.4) + i * 1.7));
    float coluna = step(0.14, fract(uv.x * barras)) * step(fract(uv.x * barras), 0.86);
    float segmento = step(0.3, fract(uv.y * (emPe ? 30.0 : 15.0)));
    vec3 fundo = mix(vec3(0.02, 0.0, 0.05), a * 0.12, uv.y);
    return fundo + mix(a, b, uv.y) * step(uv.y, alto) * coluna * segmento * 1.15;
  }
  // Os anéis: ondas saindo do meio e um glifo aceso no centro.
  vec2 c = (uv - 0.5) * (emPe ? vec2(1.0, 2.0) : vec2(2.0, 1.0));
  float r = length(c);
  float anel = (1.0 - smoothstep(0.03, 0.09, abs(fract(r * 4.0 - t * 0.7) - 0.5))) * (1.0 - smoothstep(0.25, 1.0, r));
  vec2 g = clamp(c / 0.62 + 0.5, 0.0, 1.0);
  float coluna = floor(fract(s * 7.3) * 5.0);
  float celula = floor(fract(s * 3.1 + k * 0.5) * 4.0);
  float glifo = texture2D(uLetreiros, vec2((coluna + 0.06 + g.x * 0.88) / 8.0, 0.5 + (celula + 0.06 + g.y * 0.88) / 8.0)).r;
  glifo *= step(abs(c.x), 0.31) * step(abs(c.y), 0.31);
  return vec3(0.03, 0.0, 0.04) + a * anel * 0.9 + b * glifo * 1.4;
}
void main() {
  float t = uTempo + vDados.z;
  float ciclo = t / vDados.w;
  float k = floor(ciclo);
  float anuncio = vDados.x + mod(vDados.y + k, 4.0);
  float semente = fract(vDados.z * 0.6180339);
  float desdeATroca = fract(ciclo) * vDados.w;
  float falha = 1.0 - smoothstep(0.0, 0.4, desdeATroca);
  falha = max(falha, 0.6 * step(0.985, hashT(floor(t * 6.0) + vDados.z * 3.0)));
  vec2 uv = vUv;
  float faixa = floor(uv.y * 28.0);
  uv.x += (hashT(faixa + k * 7.0 + floor(t * 20.0)) - 0.5) * 0.14 * falha;
  float sep = 0.012 * falha;
  vec3 img;
  if (mod(k + floor(semente * 3.0), 3.0) < 0.5) {
    img = grafismo(clamp(uv, 0.0, 1.0), t, k, semente, vDados.x < 0.5);
  } else {
    img = vec3(
      texture2D(uAtlas, noAtlas(anuncio, uv + vec2(sep, 0.0))).r,
      texture2D(uAtlas, noAtlas(anuncio, uv)).g,
      texture2D(uAtlas, noAtlas(anuncio, uv - vec2(sep, 0.0))).b);
    float h = hashT(vDados.z * 7.1);
    img = girarMatiz(img, step(0.5, h) * (h < 0.75 ? 2.094 : 4.189));
  }
  img *= 1.0 - 0.75 * falha * step(0.5, hashT(faixa + k));
  vec2 leds = anuncio < 3.5 ? vec2(80.0, 160.0) : vec2(160.0, 80.0);
  vec2 g = abs(fract(vUv * leds) - 0.5);
  float led = 1.0 - smoothstep(0.3, 0.48, max(g.x, g.y));
  float pegada = max(fwidth(vUv.x * leds.x), fwidth(vUv.y * leds.y));
  float grade = mix(mix(0.5, 1.08, led), 0.86, smoothstep(0.25, 0.7, pegada));
  float d = fract(vUv.y + t * 0.08) - 0.5;
  float varre = 1.0 + 0.22 * exp(-d * d * 180.0);
  vec3 luz = img * 1.35 * mix(1.0, grade * varre, uDetalhe);
  float f = nevoa(vMundo);
  gl_FragColor = vec4(luz * uLuz * (1.0 - 0.55 * f) + fogColor * f * 0.35, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
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

/** Os telões. `detalhe` é o uniforme da grade de LEDs e da varredura (1 alto, 0 baixo). */
export function criarTeloes(teloes: readonly TelaoDaCidade[], arte: ArteDaCidade, u: UniformesDaCidade, detalhe: { value: number }): THREE.InstancedMesh {
  const dados = new Float32Array(teloes.length * 4);
  const cores = new Float32Array(teloes.length * 3);
  teloes.forEach((t, i) => dados.set([t.vertical ? 0 : 4, t.primeiro, t.fase, t.periodo], i * 4));
  const malha = instanciar(
    new THREE.PlaneGeometry(1, 1),
    material(FRAGMENT_TELAO, u, arte.anuncios, { uDetalhe: detalhe, uLetreiros: { value: arte.letreiros } }),
    teloes.length,
    dados,
    cores,
    'cidade-teloes',
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  teloes.forEach((t, i) => malha.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q.setFromAxisAngle(EIXO_Y, t.ry), s.set(t.w, t.h, 1))));
  return malha;
}

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

/** Os shaders dos telões, dos letreiros e dos desenhos em neon, como pares (vértice, fragmento): o teste confere a interface entre eles (`CidadeNeonShaders.test.ts`). */
export const GLSL_TELOES = {
  telao: { vertex: VERTEX_PLANO, fragment: FRAGMENT_TELAO },
  letreiro: { vertex: VERTEX_PLANO, fragment: FRAGMENT_LETREIRO },
  neon: { vertex: VERTEX_PLANO, fragment: FRAGMENT_NEON },
} as const;
