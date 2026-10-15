import * as THREE from 'three';
import { GLSL_RUIDO } from './PraiaGlsl';
import { COR_DA_NEVOA, DIRECAO_DO_SOL, GLSL_CEU } from './PraiaCeu';
import { NIVEL_DO_MAR, PRAIA_FUNDURA_MAXIMA } from './PraiaTerreno';

/**
 * O MAR DA PRAIA DOS CABOS (P127): um plano enorme e transparente cujo shader faz tudo na GPU — **cor pela fundura** (turquesa clarinho
 * na beira, azul fundo mar adentro: o fundo de areia aparece pelo raso), **ondas** (quatro senoides que correm para a praia, só no
 * brilho: a malha não se mexe), **espuma** na linha d'água e na arrebentação, o **reflexo do céu** pelo fresnel (o mesmo `ceuCor`
 * do domo) e o **caminho de brilho do sol** sobre a água.
 *
 * A fundura vem da MESMA função do terreno, reescrita em GLSL (`PraiaTerreno.alturaDoChao`): a linha d'água ondulada e a rampa do
 * fundo coincidem com o colisor, então o que a cor mostra de raso é raso de verdade (e o Mech vadeia ali).
 *
 * **Custo:** um desenho de 2 triângulos; sem CPU por quadro (um uniforme de tempo). Em tela cheia de mar, ~70 operações por pixel.
 */

const GLSL_COSTA = /* glsl */ `
float costaEm(float x) { return -36.0 + 6.5 * sin(x / 61.0 + 0.8) + 3.2 * sin(x / 23.0 + 2.1); }
// A fundura da água (m) em p = (x, z): a mesma curva do terreno (PraiaTerreno.alturaDoChao), do lado do mar.
float funduraDoMar(vec2 p) {
  float s = costaEm(p.x) - p.y;
  if (s <= 0.0) return 0.0;
  return ${(PRAIA_FUNDURA_MAXIMA + NIVEL_DO_MAR).toFixed(2)} * tanh(pow(s / 44.0, 1.2));
}
`;

const VERTICE = /* glsl */ `
varying vec3 vMundo;
#include <fog_pars_vertex>
void main() {
  vec4 mundo = modelMatrix * vec4(position, 1.0);
  vMundo = mundo.xyz;
  vec4 mvPosition = viewMatrix * mundo;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENTO = /* glsl */ `
varying vec3 vMundo;
uniform float uTempo;
uniform float uDetalhe;
${GLSL_CEU}
${GLSL_COSTA}
${GLSL_RUIDO}
#include <fog_pars_fragment>
// Gradiente das ondas: quatro senoides (a maior corre para a praia, as outras cruzam), devolvidas como a inclinação em x e z.
vec2 inclinacao(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec4 k = vec4(0.11, 0.19, 0.37, 0.71);
  vec4 dirx = vec4(0.30, -0.45, 0.8, -0.2);
  vec4 dirz = vec4(0.95, 0.9, 0.6, 1.0);
  vec4 amp = vec4(0.16, 0.10, 0.055, 0.03);
  vec4 vel = vec4(1.1, 1.5, 2.1, 3.0);
  for (int i = 0; i < 4; i++) {
    float f = dot(p, vec2(dirx[i], dirz[i])) * k[i] + t * vel[i];
    float c = cos(f) * amp[i] * k[i];
    g += c * vec2(dirx[i], dirz[i]);
  }
  // O arrepio fino da superfície (o brilho do sol vem daqui).
  if (uDetalhe > 0.5) g += (vec2(vn(p * 1.7 + t * 0.6), vn(p * 1.7 + 31.0 - t * 0.5)) - 0.5) * 0.085;
  return g;
}
void main() {
  vec2 p = vMundo.xz;
  float fundura = funduraDoMar(p);
  vec3 V = normalize(cameraPosition - vMundo);
  vec2 g = inclinacao(p, uTempo);
  vec3 N = normalize(vec3(-g.x * 3.0, 1.0, -g.y * 3.0));

  // A cor pela fundura: turquesa na beira, azul fundo no largo.
  vec3 raso = srgb(vec3(0.50, 0.92, 0.88));
  vec3 medio = srgb(vec3(0.10, 0.64, 0.80));
  vec3 fundo = srgb(vec3(0.04, 0.34, 0.62));
  vec3 abismo = srgb(vec3(0.02, 0.20, 0.45));
  vec3 cor = mix(raso, medio, smoothstep(0.1, 3.2, fundura));
  cor = mix(cor, fundo, smoothstep(2.5, 8.0, fundura));
  cor = mix(cor, abismo, smoothstep(7.0, 13.0, fundura));
  float alfa = mix(0.30, 0.97, smoothstep(0.0, 3.4, fundura));

  // O reflexo do céu: mais forte de raspão (fresnel). Reflete o mesmo céu do domo.
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  float fres = 0.05 + 0.95 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
  cor = mix(cor, ceuCor(normalize(R)), clamp(fres * 0.85, 0.0, 1.0));
  alfa = mix(alfa, 1.0, fres * 0.6);

  // O caminho de brilho do sol: o ponto brilhante da luz batendo na água, com a luz larga em volta.
  vec3 H = normalize(uSolDir + V);
  float spec = pow(max(dot(N, H), 0.0), 420.0) * 3.2 + pow(max(dot(N, H), 0.0), 30.0) * 0.16;
  cor += vec3(1.0, 0.78, 0.5) * spec;
  alfa = max(alfa, min(1.0, spec));

  // A espuma: o lavado da onda na beira e a linha de arrebentação logo adiante.
  float ruido = uDetalhe > 0.5 ? vn(p * 0.9 + uTempo * 0.25) : 0.6;
  float lavado = 0.12 + 0.12 * sin(uTempo * 0.9 + p.x * 0.06) + 0.08 * (ruido - 0.5);
  float espuma = smoothstep(lavado + 0.16, lavado - 0.04, fundura) * (0.55 + 0.45 * smoothstep(0.25, 0.7, ruido));
  float arreb = 1.9 + 0.9 * sin(uTempo * 0.45 + p.x * 0.035);
  espuma = max(espuma, smoothstep(0.45, 0.0, abs(fundura - arreb)) * 0.45 * smoothstep(0.4, 0.7, ruido));
  vec3 branco = vec3(0.86, 0.87, 0.84);
  cor = mix(cor, branco, clamp(espuma, 0.0, 1.0));
  alfa = max(alfa, espuma);

  gl_FragColor = vec4(cor, alfa);
  #include <fog_fragment>
}
`;

export class PraiaMar {
  readonly malha: THREE.Mesh;

  constructor(scene: THREE.Scene, tempo: { value: number }, detalhe: { value: number }) {
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTICE,
      fragmentShader: FRAGMENTO,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTempo: tempo, uDetalhe: detalhe, uSolDir: { value: DIRECAO_DO_SOL }, uNevoa: { value: new THREE.Color(COR_DA_NEVOA) } },
      ]),
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    // Um plano que vai muito além do mapa (o horizonte do mar não pode ter borda), na altura da superfície.
    this.malha = new THREE.Mesh(new THREE.PlaneGeometry(3600, 2600), material);
    this.malha.rotation.x = -Math.PI / 2;
    this.malha.position.set(0, NIVEL_DO_MAR, -1100);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 2;
    scene.add(this.malha);
  }
}
