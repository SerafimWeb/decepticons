import * as THREE from 'three';
import type { TorreDaCidade } from './CidadeNeonLayout';

/**
 * AS TORRES DO ENTORNO DA CIDADE NEON (P264, PR2): todas as caixas de `CidadeNeonLayout` num `InstancedMesh` só (**1 draw call**), com um shader
 * sem iluminação (o corpo é escuro de propósito: o que desenha a cidade à noite é o que acende). Tudo é calculado no próprio shader, sem textura:
 *
 *  - **janelas** finas, por andar (cada andar sorteia a ocupação; cada janela, o tom: branco-azulado, sódio ou a cor da torre), mais claras em
 *    cima (a luz do teto do cômodo); **de longe a grade vira a média** (sem cintilar quando a janela fica menor que um pixel);
 *  - **faixa de neon nas quinas** (uma torre em quatro) e **na coroa**, na cor da torre — o traço vertical das referências, sem virar brinquedo;
 *  - **lojas no térreo** (vitrine e letreiro a cada 5 m, cores da rua) e **a luz da rua subindo pela base**;
 *  - **antena** com a luz vermelha piscando no topo;
 *  - **a névoa** leva o corpo até a cor do horizonte (mais acesa perto do chão: a luz da cidade presa no ar), e a luz só **atravessa** em parte
 *    (70% dela some ao longe) — é o que faz a segunda e a terceira fila lerem como silhueta pontilhada de janelas, em camadas.
 *
 * **Custo:** 1 draw call para ~190 caixas (~2 300 triângulos); por quadro, nada além do relógio (`tempo`, um uniforme compartilhado). O custo real
 * é de preenchimento: o mesmo de uma fachada com `BuildingWindows.ts` (uns `hash` por pixel), sem a iluminação PBR que o horizonte antigo pagava.
 * As torres da primeira fila vêm primeiro no buffer: elas preenchem a profundidade antes, e as de trás falham no teste cedo.
 */

const VERTEX = /* glsl */ `
attribute vec4 aTorre;
attribute vec3 aCor;
varying vec3 vLocal;
flat varying vec3 vTamanho;
flat varying vec3 vNormal0;
varying vec3 vMundo;
flat varying vec4 vTorre;
flat varying vec3 vCor;
void main() {
  vec3 tamanho = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vLocal = position * tamanho;
  vTamanho = tamanho;
  vNormal0 = normal;
  vec4 mundo = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vMundo = mundo.xyz;
  vTorre = aTorre;
  vCor = aCor;
  gl_Position = projectionMatrix * viewMatrix * mundo;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 fogColor;
uniform float fogDensity;
uniform vec3 uLuz;
uniform float uTempo;
varying vec3 vLocal;
flat varying vec3 vTamanho;
flat varying vec3 vNormal0;
varying vec3 vMundo;
flat varying vec4 vTorre;
flat varying vec3 vCor;

float hashJ(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec3 n = abs(vNormal0);
  float teto = step(0.5, n.y);
  float eixoX = step(n.z, n.x) * (1.0 - teto);
  float sinal = step(0.0, vNormal0.x + vNormal0.z);
  float u = mix(vLocal.x, vLocal.z, eixoX);
  float largura = mix(vTamanho.x, vTamanho.z, eixoX);
  float y = vLocal.y;
  float altura = vTamanho.y;
  float yMundo = vMundo.y;
  float semente = vTorre.x;
  float tipo = vTorre.y;

  // O corpo: aço escuro, cada face num tom (a cidade lê em volume, não em recorte) e a luz da rua subindo pela base.
  float tom = mix(mix(0.78, 1.0, sinal), mix(0.62, 0.9, sinal), eixoX);
  vec3 corpo = vec3(0.011, 0.017, 0.026) * mix(tom, 0.45, teto);
  float rua = exp(-yMundo / 12.0) * (1.0 - teto);
  corpo += mix(vec3(0.07, 0.012, 0.055), vec3(0.0, 0.05, 0.065), fract(semente * 13.7)) * rua;

  // As janelas: passo, andar e tamanho sorteados por torre; a grade centrada na face, com uma margem sem janela nas quinas.
  float passo = mix(1.7, 2.8, fract(semente * 7.13));
  float andar = mix(3.3, 4.4, fract(semente * 3.71));
  float largJ = mix(0.4, 0.78, fract(semente * 5.31));
  float altJ = mix(0.4, 0.7, fract(semente * 9.17));
  float margem = 1.0;
  float terreo = tipo < 0.5 ? 5.6 : 0.8;
  float coroa = altura - mix(1.5, 4.0, fract(semente * 1.73));
  float uteis = largura - 2.0 * margem;
  float colunas = max(1.0, floor(uteis / passo));
  float ux = u + largura * 0.5 - margem - (uteis - colunas * passo) * 0.5;
  float uy = y - terreo;
  vec2 celula = vec2(floor(ux / passo), floor(uy / andar));
  vec2 dentro = vec2(fract(ux / passo), fract(uy / andar));
  float naFace = step(0.0, ux) * step(ux, colunas * passo) * step(0.0, uy) * step(y, coroa) * (1.0 - teto) * step(tipo, 1.5);
  float janela = step(abs(dentro.x - 0.5), largJ * 0.5) * step(0.2, dentro.y) * step(dentro.y, 0.2 + altJ);
  float face = eixoX * 2.0 + sinal;
  vec2 id = celula + vec2(face * 97.0 + semente * 311.0, semente * 173.0);
  float ocupacao = clamp(vTorre.z + (hashJ(vec2(celula.y, semente * 53.0 + face)) - 0.5) * 0.9, 0.0, 1.0);
  float acesa = step(1.0 - ocupacao, hashJ(id));
  float quente = step(0.72, hashJ(id + 3.1));
  vec3 corJ = mix(vec3(0.6, 0.86, 1.0), vec3(1.0, 0.64, 0.3), quente);
  corJ = mix(corJ, vCor, 0.45 * step(0.82, hashJ(id + 9.7)));
  float nivel = 0.32 + 0.68 * hashJ(id + 19.1);
  float gradiente = mix(0.75, 1.15, clamp((dentro.y - 0.2) / max(altJ, 0.01), 0.0, 1.0));
  vec3 janelas = corJ * (nivel * gradiente * acesa + 0.035) * janela * naFace;
  float pegada = max(fwidth(ux), fwidth(uy));
  float longe = smoothstep(passo * 0.2, passo * 0.65, pegada);
  vec3 media = vec3(0.68, 0.8, 0.92) * (vTorre.z * 0.66 + 0.035) * largJ * altJ * naFace;
  janelas = mix(janelas, media, longe);

  // A faixa de neon nas quinas e a da coroa (metade das torres): nunca mais fina que um pixel, para a de longe ainda ler como traço.
  float aa = max(fwidth(u), fwidth(y));
  float temFaixa = step(0.72, fract(semente * 23.3)) * step(tipo, 0.5);
  float quina = largura * 0.5 - abs(u);
  float largF = max(0.14, aa * 1.2);
  float faixa = temFaixa * (1.0 - smoothstep(largF, largF + aa + 0.02, quina)) * (1.0 - teto) * step(terreo, y) * step(y, coroa);
  float temCoroa = step(0.35, fract(semente * 41.9)) * step(tipo, 1.5) * (1.0 - teto);
  float alturaF = max(0.7, aa * 1.5);
  float faixaCoroa = temCoroa * step(coroa + 0.3, y) * step(y, coroa + 0.3 + alturaF);

  // As lojas do térreo: uma a cada 5 m, a vitrine fraca embaixo e o letreiro forte em cima, nas cores da rua.
  // Só nos 4 m de baixo (o resto da torre nem entra: sem derivada aqui dentro, então o desvio é seguro).
  vec3 lojas = vec3(0.0);
  if (tipo < 0.5 && teto < 0.5 && yMundo > 0.6 && yMundo < 4.4) {
    float corrido = u + largura * 0.5;
    float trecho = floor(corrido / 5.0);
    float hl = hashJ(vec2(trecho + face * 31.0, semente * 91.0));
    vec3 corLoja = hl < 0.3 ? vec3(1.0, 0.16, 0.8) : hl < 0.55 ? vec3(0.0, 0.85, 1.0) : hl < 0.8 ? vec3(1.0, 0.5, 0.12) : vec3(0.75, 0.2, 1.0);
    float dentroLoja = fract(corrido / 5.0);
    float vitrine = step(0.08, dentroLoja) * step(dentroLoja, 0.92) * step(0.22, hashJ(vec2(trecho + face * 7.0, semente * 13.0)));
    float placa = step(3.3, yMundo);
    // A vitrine é escura (o interior da loja), com os caixilhos a cada 1,2 m; o letreiro em cima é o que acende forte.
    float caixilho = step(0.1, fract(corrido / 1.2));
    vec3 interior = mix(vec3(0.5, 0.42, 0.32), corLoja, 0.35) * caixilho * 0.11;
    lojas = vitrine * mix(interior, corLoja * 1.5, placa);
  }

  // A antena: a luz vermelha do topo pisca devagar, cada uma no seu tempo.
  float antena = step(1.5, tipo);
  float pisca = step(0.55, fract(uTempo * 0.6 + semente * 5.0));
  vec3 farol = vec3(1.0, 0.08, 0.06) * 3.0 * antena * step(altura - 0.9, y) * pisca;

  vec3 luz = janelas + vCor * 1.6 * (faixa + faixaCoroa * 0.85) + lojas + farol;

  // A névoa: o corpo some na cor do horizonte, mais acesa perto do chão (a luz da cidade presa no ar); a luz atravessa só em parte —
  // é o que separa as três filas em camadas, como nas referências.
  float dist = length(vMundo - cameraPosition);
  float f = 1.0 - exp(-fogDensity * fogDensity * dist * dist * 0.65);
  vec3 nevoa = fogColor * (1.0 + 1.1 * exp(-max(yMundo, 0.0) / 30.0));
  vec3 cor = mix(corpo, nevoa, f) + luz * uLuz * (1.0 - 0.7 * f);
  gl_FragColor = vec4(cor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Os uniformes que vários materiais da cidade dividem: o relógio e a luz (que o transformador do banco escurece). */
export interface UniformesDaCidade {
  readonly tempo: { value: number };
  readonly luz: { value: THREE.Color };
}

/** Monta as torres. As da primeira fila vêm primeiro no buffer (ver o comentário do arquivo). */
export function criarTorres(torres: readonly TorreDaCidade[], u: UniformesDaCidade): THREE.InstancedMesh {
  const ordem = [...torres].sort((a, b) => a.anel - b.anel);
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const dados = new Float32Array(ordem.length * 4);
  const cores = new Float32Array(ordem.length * 3);
  const cor = new THREE.Color();
  for (let i = 0; i < ordem.length; i++) {
    const t = ordem[i]!;
    dados.set([t.semente, t.tipo, t.ocupacao, t.anel], i * 4);
    cor.setHex(t.cor);
    cores.set([cor.r, cor.g, cor.b], i * 3);
  }
  geo.setAttribute('aTorre', new THREE.InstancedBufferAttribute(dados, 4));
  geo.setAttribute('aCor', new THREE.InstancedBufferAttribute(cores, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLuz: { value: new THREE.Color() }, uTempo: { value: 0 } }]),
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    fog: true,
  });
  // O merge copia o valor: os uniformes da cidade entram por referência depois dele (o relógio anda e a luz escurece em todos de uma vez).
  material.uniforms.uLuz = u.luz;
  material.uniforms.uTempo = u.tempo;

  const malha = new THREE.InstancedMesh(geo, material, ordem.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (let i = 0; i < ordem.length; i++) {
    const t = ordem[i]!;
    malha.setMatrixAt(i, m.compose(p.set(t.x, t.y0, t.z), q, s.set(t.w, t.h, t.d)));
  }
  // A cidade inteira cerca a praça: está sempre em parte na tela, então o teste de visibilidade só custaria.
  malha.frustumCulled = false;
  malha.name = 'cidade-torres';
  return malha;
}

/** Os shaders das torres, como par (vértice, fragmento): o teste confere a interface entre eles (`CidadeNeonShaders.test.ts`). */
export const GLSL_TORRES = { vertex: VERTEX, fragment: FRAGMENT } as const;
