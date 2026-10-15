import * as THREE from 'three';
import { GLSL_RUIDO } from './PraiaGlsl';

/**
 * O CÉU DA PRAIA DOS CABOS (P127): o fim de tarde inteiro, calculado **na GPU** — um domo que acompanha a câmera (não tem posição:
 * está sempre no infinito) com o degradê do azul fundo ao rosado do horizonte, o **sol se pondo sobre o mar** (disco e halo, acima de 1
 * para acender no bloom) e **nuvens** de fim de tarde (rosadas por baixo, azuladas na sombra) que derivam devagar.
 *
 * O céu antigo era uma textura esticada **na tela**: a cor do horizonte ficava no pé da tela, olhasse a câmera para onde olhasse. Este
 * é um domo de verdade: erguer a câmera mostra o azul, virar para o sol mostra o brilho, e o mar reflete o mesmo céu (o mesmo trecho
 * de GLSL, `GLSL_CEU`, é usado aqui e no `PraiaMar.ts`).
 *
 * **Custo:** um desenho; sem custo de CPU (um uniforme de tempo). O fragmento só roda onde nada cobre o céu (o domo é desenhado por
 * último, com profundidade no fundo); 8 consultas de ruído por pixel de céu — folgado para uma GPU integrada a 720p (G12).
 */

/**
 * Para onde o sol está (um vetor unitário): **tocando o horizonte**, sobre o mar (z negativo), um pouco a oeste (P137: "o sol se pondo, vermelho,
 * no horizonte, do lado esquerdo da praia"). A conta das sombras assadas lê só o x e o z (a razão entre eles não mudou), então elas ficam como estavam.
 */
export const DIRECAO_DO_SOL = new THREE.Vector3(-0.46, 0.03, -0.865).normalize();

/**
 * De onde vem a **luz** do sol (a que clareia as faces e sombreia): a mesma direção em planta, mas mais alta que o disco. Com a luz também rente
 * ao horizonte, as faces de cima ficariam sem sol direto e o mapa viraria uma silhueta; assim as faces voltadas para o mar ficam vermelhas e o
 * resto cai na luz do céu (a luminosidade geral desce, como o Comandante pediu, sem apagar).
 */
export const DIRECAO_DA_LUZ_DO_SOL = new THREE.Vector3(-0.46, 0.13, -0.865).normalize();

/** Para onde a lua cheia nasce: do outro lado do mar (leste), um pouco mais alta que o sol, "alinhada" com ele no horizonte (P137). */
export const DIRECAO_DA_LUA = new THREE.Vector3(0.5, 0.1, -0.86).normalize();

/** A cor da névoa e do horizonte (sRGB): um rosa-alaranjado de fim de tarde, mais escuro que o de antes (a luminosidade geral baixou, P137). */
export const COR_DA_NEVOA = 0xcf7f60;

/**
 * Trecho de GLSL compartilhado: a cor do céu numa direção (`ceuCor`), em RGB linear. Precisa dos uniformes `uSolDir`, `uLuaDir` e `uNevoa`.
 * (P137) O fim de tarde é **de dois lados**: do lado do sol (oeste) o horizonte queima em vermelho e laranja; do lado da lua (leste) o céu esfria em
 * rosa e violeta; o zênite é um azul-marinho. Os dois astros têm o halo deles (o da lua é frio e fraco).
 */
export const GLSL_CEU = /* glsl */ `
uniform vec3 uSolDir;
uniform vec3 uLuaDir;
uniform vec3 uNevoa;
vec3 srgb(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
vec3 ceuCor(vec3 d) {
  float t = clamp(d.y, 0.0, 1.0);
  // De que lado do céu: 0 no do sol (quente), 1 no da lua (frio), pelo azimute.
  vec2 h = d.xz / max(length(d.xz), 0.001);
  float frio = smoothstep(-0.25, 0.9, clamp(dot(h, uLuaDir.xz) - dot(h, uSolDir.xz), -1.0, 1.0));
  vec3 c = mix(uNevoa, srgb(vec3(0.62, 0.45, 0.66)), frio);
  c = mix(c, mix(srgb(vec3(1.0, 0.34, 0.15)), srgb(vec3(0.76, 0.42, 0.66)), frio), smoothstep(0.0, 0.05, t));
  c = mix(c, mix(srgb(vec3(0.66, 0.30, 0.46)), srgb(vec3(0.36, 0.34, 0.66)), frio), smoothstep(0.04, 0.3, t));
  c = mix(c, srgb(vec3(0.19, 0.19, 0.46)), smoothstep(0.24, 0.62, t));
  c = mix(c, srgb(vec3(0.05, 0.08, 0.24)), smoothstep(0.5, 0.95, t));
  float cs = max(dot(d, uSolDir), 0.0);
  c += vec3(1.0, 0.22, 0.06) * pow(max(cs, 0.0), 4.0) * 0.5;
  c += vec3(1.0, 0.36, 0.1) * pow(max(cs, 0.0), 14.0) * 0.3 + vec3(1.0, 0.5, 0.18) * pow(max(cs, 0.0), 120.0) * 0.7;
  float cl = max(dot(d, uLuaDir), 0.0);
  c += vec3(0.45, 0.58, 1.0) * pow(max(cl, 0.0), 6.0) * 0.1 + vec3(0.6, 0.74, 1.0) * pow(max(cl, 0.0), 70.0) * 0.2;
  return c;
}
`;

const VERTICE = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww; // sempre no fundo, sem sair do lugar quando a câmera anda
}
`;

const FRAGMENTO = /* glsl */ `
varying vec3 vDir;
uniform float uTempo;
uniform float uDetalhe;
${GLSL_CEU}
${GLSL_RUIDO}
void main() {
  vec3 d = normalize(vDir);
  vec3 c = ceuCor(d);
  float cs = dot(d, uSolDir);
  // O disco do sol, vermelho-alaranjado: acima de 1 para acender no bloom.
  c += vec3(3.2, 1.0, 0.38) * smoothstep(0.99935, 0.99965, cs);
  // A lua cheia, branco-azulada, nascendo do outro lado: o disco (2,2°, com os "mares" mais escuros) e só o lado voltado para ela.
  float cm = dot(d, uLuaDir);
  if (cm > 0.9985) {
    // Só perto da lua (3,1°): o resto do céu não paga as contas do disco. Em qualidade baixa o disco é liso (sem o ruído dos "mares").
    vec3 t1 = normalize(cross(uLuaDir, vec3(0.0, 1.0, 0.0)));
    vec3 t2 = cross(t1, uLuaDir);
    vec2 q = vec2(dot(d, t1), dot(d, t2)) / 0.0385;
    float disco = 1.0 - smoothstep(0.93, 1.0, length(q));
    float mares = uDetalhe > 0.5 ? 0.84 + 0.3 * vn(q * 2.3 + 7.0) - 0.14 * vn(q * 5.1) : 0.9;
    c += vec3(1.05, 1.22, 1.6) * mares * disco;
  }
  // As nuvens: uma camada plana projetada no céu, com a borda voltada para o sol acesa e o resto na sombra.
  // Em qualidade baixa (uDetalhe = 0) o céu fica só no degradê e no sol: 8 consultas de ruído a menos por pixel.
  if (uDetalhe > 0.5) {
  float h = max(d.y, 0.02);
  vec2 uv = d.xz / h * 0.6 + uTempo * vec2(0.010, 0.004);
  float n = fbm(uv * 1.25);
  float dens = smoothstep(0.50, 0.80, n);
  float mask = smoothstep(0.03, 0.2, d.y) * (1.0 - 0.45 * smoothstep(0.8, 1.0, d.y));
  float n2 = fbm(uv * 1.25 + uSolDir.xz * 0.2);
  float lit = clamp((n - n2) * 5.0 + 0.45 + 0.4 * max(cs, 0.0), 0.0, 1.0);
  vec3 sombra = srgb(vec3(0.26, 0.2, 0.42));
  vec3 acesa = srgb(vec3(1.0, 0.46, 0.3)) * (1.0 + 0.6 * pow(max(cs, 0.0), 3.0));
  c = mix(c, mix(sombra, acesa, lit), dens * mask * 0.92);
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

export class PraiaCeu {
  readonly domo: THREE.Mesh;

  /** `tempo`: o uniforme de tempo da praia (as nuvens derivam com ele). */
  constructor(scene: THREE.Scene, tempo: { value: number }, detalhe: { value: number }) {
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTICE,
      fragmentShader: FRAGMENTO,
      uniforms: {
        uTempo: tempo,
        uDetalhe: detalhe,
        uSolDir: { value: DIRECAO_DO_SOL },
        uLuaDir: { value: DIRECAO_DA_LUA },
        uNevoa: { value: new THREE.Color(COR_DA_NEVOA) },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.domo = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
    this.domo.frustumCulled = false;
    this.domo.renderOrder = 1000; // por último entre os opacos: só pinta o que nada cobre
    scene.add(this.domo);
  }
}
