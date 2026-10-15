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

/** Para onde o sol está (um vetor unitário): baixo no horizonte, sobre o mar (z negativo), um pouco a oeste. */
export const DIRECAO_DO_SOL = new THREE.Vector3(-0.46, 0.2, -0.865).normalize();

/** A cor da névoa e do horizonte (sRGB): quente, para o mar e a cidade longe se fundirem ao céu. */
export const COR_DA_NEVOA = 0xeebf94;

/** Trecho de GLSL compartilhado: a cor do céu numa direção (`ceuCor`), em RGB linear. Precisa do uniforme `uSolDir` e do `uNevoa`. */
export const GLSL_CEU = /* glsl */ `
uniform vec3 uSolDir;
uniform vec3 uNevoa;
vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
vec3 ceuCor(vec3 d) {
  float t = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(uNevoa, srgb(vec3(0.97, 0.62, 0.48)), smoothstep(0.0, 0.05, t));
  c = mix(c, srgb(vec3(0.55, 0.62, 0.84)), smoothstep(0.04, 0.34, t));
  c = mix(c, srgb(vec3(0.16, 0.34, 0.66)), smoothstep(0.26, 0.9, t));
  float cs = max(dot(d, uSolDir), 0.0);
  c += vec3(1.0, 0.5, 0.18) * pow(cs, 4.0) * 0.36;
  c += vec3(1.0, 0.72, 0.38) * pow(cs, 14.0) * 0.2 + vec3(1.0, 0.74, 0.42) * pow(cs, 120.0) * 0.7;
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
  // O disco do sol: acima de 1 para acender no bloom.
  c += vec3(3.4, 2.6, 1.6) * smoothstep(0.99935, 0.99965, cs);
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
  vec3 sombra = srgb(vec3(0.42, 0.40, 0.58));
  vec3 acesa = srgb(vec3(1.0, 0.74, 0.55)) * (1.0 + 0.6 * pow(max(cs, 0.0), 3.0));
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
