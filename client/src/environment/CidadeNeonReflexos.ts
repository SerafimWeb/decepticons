import * as THREE from 'three';
import { GLSL_ANUNCIO_ATUAL, type EstadoDoOutdoor, type UniformesDosAnuncios } from './Outdoors';
import { PISCAR_DO_POSTE_GLSL, POCA_GLSL } from './CidadeNeonRua';
import type { UniformesDaCidade } from './CidadeNeonTorres';

/**
 * O CHÃO MOLHADO DA CIDADE NEON (P264, PR2): nas referências do Comandante a rua reflete cada outdoor e cada letreiro. Reflexo de verdade (a cena
 * desenhada de novo, espelhada) dobraria o custo do quadro na GPU integrada (G12); aqui é o truque barato de sempre, feito com cuidado:
 *
 *  - **O rastro de cada fonte de luz** é um quadrilátero deitado no chão, montado **no próprio vertex shader**, para a câmera da vez: num espelho,
 *    um ponto à altura `y` a uma distância `D` aparece no chão a `D·hc/(hc + y)` da câmera (`hc` = a altura dela). O rastro vai do reflexo da base
 *    da fonte ao do topo (o chão áspero o espicha um pouco) e afina para perto da câmera — na tela vira a faixa vertical de luz embaixo da fonte,
 *    que é o que um chão molhado mostra. É **mais forte nas poças** (a mesma conta de `CidadeNeonRua.ts`) e de raspão (Fresnel), e ondula com o
 *    mundo, não com a tela. Vale para qualquer câmera (a do jogador, a do CFTV, a do telão ao vivo), sem conta nenhuma na CPU.
 *  - **A poça de luz** debaixo de cada poste: um disco suave somado ao chão, que pisca junto com a luz do poste.
 *
 * **Limite conhecido:** o rastro não sabe o que está na frente da fonte (um prédio da praça que a esconda ainda deixa o reflexo dela no chão
 * perto da câmera). Fraco e espalhado, lê como brilho de chão molhado; resolver de verdade é o reflexo caro que este arquivo existe para evitar.
 *
 * **Custo:** 2 draw calls; nada na CPU por quadro. Na GPU, mistura aditiva numa parte do chão. Some na qualidade baixa (`setDetalhe`).
 */

/** Uma fonte de luz que o chão reflete: a base (x, z), a faixa de altura que brilha, a largura e a cor (linear, já com a intensidade). */
export interface FonteDeReflexo {
  readonly x: number;
  readonly z: number;
  readonly y0: number;
  readonly y1: number;
  readonly largura: number;
  readonly cor: THREE.Color;
  /** A fase do piscar de um poste e se ele tem defeito; −1 = não pisca. */
  readonly fase: number;
  readonly defeito: number;
  /** Quando a fonte é um outdoor (P267): a cor dela é a da imagem de agora (não a `cor` acima) e some quando o outdoor sai do ar. */
  readonly outdoor?: { readonly indice: number; readonly inicio: number; readonly fixo: number; readonly fase: number };
}

/** Os reflexos montados e o jeito de dizer, depois, quais outdoors estão no ar e onde cada um começa no anel da troca (P267). */
export interface ReflexosCriados {
  readonly grupo: THREE.Group;
  /** `estado[i]` é o do outdoor de índice `i` da lista dada ao criar (`FonteDeReflexo.outdoor.indice`). */
  atualizarOutdoors(estado: readonly EstadoDoOutdoor[]): void;
}

const VERTEX_RASTRO = /* glsl */ `
attribute vec4 aFonte;
attribute vec3 aExtra;
attribute vec3 aCor;
attribute vec4 aAnuncio;
uniform float uTempo;
varying vec2 vQuad;
varying vec3 vCor;
varying vec3 vMundo;
${PISCAR_DO_POSTE_GLSL}
${GLSL_ANUNCIO_ATUAL}
void main() {
  vec2 c = cameraPosition.xz;
  vec2 ds = aFonte.xy - c;
  float D = length(ds);
  vec2 dir = D > 0.001 ? ds / D : vec2(0.0, 1.0);
  vec2 lado = vec2(-dir.y, dir.x);
  float hc = max(cameraPosition.y, 0.6);
  float tPerto = hc / (hc + aFonte.w) * 0.62;
  float tLonge = min(1.0, hc / (hc + aFonte.z) * 1.35 + 0.03);
  float t = mix(tLonge, tPerto, position.y);
  vec2 p = c + ds * t + lado * (aExtra.x * max(t, 0.04) * position.x);
  vMundo = vec3(p.x, 0.035, p.y);
  vQuad = position.xy;
  // Um outdoor reflete a cor da imagem que está no ar agora (aAnuncio.y = −2 é "não é outdoor": a cor fixa da fonte) e nada reflete se ele saiu do ar (aAnuncio.w = 0).
  vec3 base = aAnuncio.y < -1.5 ? aCor : corDoAnuncio(aAnuncio, uTempo) * 1.2;
  vCor = base * (aExtra.y < 0.0 ? 1.0 : brilhoDoPoste(uTempo, aExtra.y, aExtra.z)) * step(0.5, aAnuncio.w);
  gl_Position = projectionMatrix * viewMatrix * vec4(vMundo, 1.0);
}
`;

const FRAGMENT_RASTRO = /* glsl */ `
uniform vec3 uLuz;
uniform float uTempo;
uniform vec3 fogColor;
uniform float fogDensity;
varying vec2 vQuad;
varying vec3 vCor;
varying vec3 vMundo;
${POCA_GLSL}
void main() {
  float q = vQuad.y;
  float perfil = smoothstep(0.0, 0.22, q) * (1.0 - smoothstep(0.55, 1.0, q));
  float borda = 1.0 - smoothstep(0.18, 0.5, abs(vQuad.x));
  float onda = 0.5 + 0.5 * sin(vMundo.x * 2.9 + vMundo.z * 0.7 + sin(vMundo.z * 1.3 + uTempo * 0.7) * 2.2) * sin(vMundo.z * 4.1 - vMundo.x * 0.6);
  vec3 v = vMundo - cameraPosition;
  float d = length(v);
  float raspao = 1.0 - clamp(abs(v.y) / max(d, 0.001), 0.0, 1.0);
  float fresnel = 0.25 + 0.75 * raspao * raspao * raspao;
  float f = 1.0 - exp(-fogDensity * fogDensity * d * d);
  float molhado = mix(0.4, 1.7, pocaDaRua(vMundo.xz));
  float a = perfil * borda * (0.45 + 0.55 * onda) * fresnel * molhado * (1.0 - f);
  gl_FragColor = vec4(vCor * uLuz * a * 0.5, 1.0);
}
`;

const VERTEX_POCA = /* glsl */ `
attribute vec4 aFonte;
attribute vec3 aExtra;
attribute vec3 aCor;
uniform float uTempo;
varying vec2 vQuad;
varying vec3 vCor;
varying vec3 vMundo;
${PISCAR_DO_POSTE_GLSL}
void main() {
  float raio = aExtra.x;
  vec3 p = vec3(aFonte.x + position.x * raio, 0.03, aFonte.y + position.y * raio);
  vMundo = p;
  vQuad = position.xy;
  vCor = aCor * (aExtra.y < 0.0 ? 1.0 : brilhoDoPoste(uTempo, aExtra.y, aExtra.z));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const FRAGMENT_POCA = /* glsl */ `
uniform vec3 uLuz;
uniform vec3 fogColor;
uniform float fogDensity;
varying vec2 vQuad;
varying vec3 vCor;
varying vec3 vMundo;
void main() {
  float r2 = dot(vQuad, vQuad);
  float d = length(vMundo - cameraPosition);
  // Some de perto (a câmera colada na poça a estourava em branco e ela virava uma mancha na tela) e na névoa.
  float a = (1.0 - smoothstep(0.0, 1.0, r2)) * 0.24 * smoothstep(2.5, 8.0, d);
  float f = 1.0 - exp(-fogDensity * fogDensity * d * d);
  gl_FragColor = vec4(vCor * uLuz * a * (1.0 - f), 1.0);
}
`;

function geometria(fontes: readonly FonteDeReflexo[], vertices: number[], indices: number[], extraX: (f: FonteDeReflexo) => number, comAnuncio = false): THREE.InstancedBufferGeometry {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  const fonte = new Float32Array(fontes.length * 4);
  const extra = new Float32Array(fontes.length * 3);
  const cor = new Float32Array(fontes.length * 3);
  fontes.forEach((f, i) => {
    fonte.set([f.x, f.z, f.y0, f.y1], i * 4);
    extra.set([extraX(f), f.fase, f.defeito], i * 3);
    cor.set([f.cor.r, f.cor.g, f.cor.b], i * 3);
  });
  geo.setAttribute('aFonte', new THREE.InstancedBufferAttribute(fonte, 4));
  geo.setAttribute('aExtra', new THREE.InstancedBufferAttribute(extra, 3));
  geo.setAttribute('aCor', new THREE.InstancedBufferAttribute(cor, 3));
  if (comAnuncio) {
    // (onde começa no anel, a imagem fixa ou −1, a fase, no ar?); −2 em y = a fonte não é um outdoor.
    const anuncio = new Float32Array(fontes.length * 4);
    fontes.forEach((f, i) => anuncio.set(f.outdoor ? [f.outdoor.inicio, f.outdoor.fixo, f.outdoor.fase, 1] : [0, -2, 0, 1], i * 4));
    const atributo = new THREE.InstancedBufferAttribute(anuncio, 4);
    atributo.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAnuncio', atributo);
  }
  geo.instanceCount = fontes.length;
  return geo;
}

function materialAditivo(vertex: string, fragment: string, u: UniformesDaCidade, a?: UniformesDosAnuncios): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLuz: { value: new THREE.Color() }, uTempo: { value: 0 } }]),
    vertexShader: vertex,
    fragmentShader: fragment,
    fog: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    // A posição nasce no vertex shader: a ordem dos vértices na tela muda com a câmera, então as duas faces valem.
    side: THREE.DoubleSide,
  });
  m.uniforms.uLuz = u.luz;
  m.uniforms.uTempo = u.tempo;
  if (a) {
    // O estado dos anúncios por referência: o mesmo dos painéis (qual imagem está no ar, o período, as cores).
    m.uniforms.uCiclo = a.ciclo;
    m.uniforms.uCicloN = a.cicloN;
    m.uniforms.uPeriodo = a.periodo;
    m.uniforms.uCores = a.cores;
  }
  return m;
}

/** Os rastros de reflexo e as poças de luz. `pocas` são as fontes que ganham poça de luz (os postes); `raioDaPoca` em metros. `anuncios` é o estado dos outdoors (qual imagem está no ar). */
export function criarReflexos(fontes: readonly FonteDeReflexo[], pocas: readonly FonteDeReflexo[], u: UniformesDaCidade, anuncios: UniformesDosAnuncios, raioDaPoca = 6): ReflexosCriados {
  const grupo = new THREE.Group();
  grupo.name = 'cidade-chao-molhado';
  // O rastro: x de −0,5 a 0,5 (através), y de 0 (o reflexo da base, longe) a 1 (o do topo, perto da câmera).
  const geoDoRastro = geometria(fontes, [-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], [0, 1, 2, 0, 2, 3], (f) => f.largura, true);
  const rastro = new THREE.Mesh(geoDoRastro, materialAditivo(VERTEX_RASTRO, FRAGMENT_RASTRO, u, anuncios));
  // Um quadrado de lado 2 (o vertex shader escala pelo raio da poça; o fragmento o arredonda).
  const poca = new THREE.Mesh(
    geometria(pocas, [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], [0, 1, 2, 0, 2, 3], () => raioDaPoca),
    materialAditivo(VERTEX_POCA, FRAGMENT_POCA, u),
  );
  // As posições nascem no vertex shader: a caixa de visibilidade da geometria não diz nada.
  rastro.frustumCulled = poca.frustumCulled = false;
  // Depois do chão e das zonas (que também são transparentes): o reflexo soma por cima delas.
  rastro.renderOrder = poca.renderOrder = 1;
  grupo.add(rastro, poca);
  const atributoDoAnuncio = geoDoRastro.getAttribute('aAnuncio') as THREE.InstancedBufferAttribute;
  const doOutdoor: { fonte: number; indice: number }[] = [];
  fontes.forEach((f, i) => f.outdoor && doOutdoor.push({ fonte: i, indice: f.outdoor.indice }));
  return {
    grupo,
    atualizarOutdoors(estado: readonly EstadoDoOutdoor[]): void {
      for (const { fonte, indice } of doOutdoor) {
        const e = estado[indice];
        if (!e) continue;
        atributoDoAnuncio.setX(fonte, e.inicio);
        atributoDoAnuncio.setW(fonte, e.visivel ? 1 : 0);
      }
      atributoDoAnuncio.needsUpdate = true;
    },
  };
}

/** Os shaders do chão molhado, como pares (vértice, fragmento): o teste confere a interface entre eles (`CidadeNeonShaders.test.ts`). */
export const GLSL_REFLEXOS = {
  rastro: { vertex: VERTEX_RASTRO, fragment: FRAGMENT_RASTRO },
  poca: { vertex: VERTEX_POCA, fragment: FRAGMENT_POCA },
} as const;
