/**
 * Trechos de GLSL que os shaders da praia dividem (P127): ruído de valor (barato, sem textura) e o fbm de quatro oitavas. Cada
 * módulo cola o que precisa; ficam aqui para o céu, o mar, o chão e as fachadas não repetirem a mesma conta.
 */
export const GLSL_RUIDO = /* glsl */ `
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
`;

/**
 * A sombra assada do chão (`PraiaSombras.ts`): a textura de duas camadas (R = sombra do sol, G = oclusão de ambiente) em coordenadas do
 * mundo. `GLSL_SOMBRA_DECLARA` entra nas declarações do fragmento; `GLSL_SOMBRA_APLICA` entra depois de `#include <aomap_fragment>` num
 * material padrão: apaga só a luz direta (o sol) na sombra e esfria a luz do céu que sobra, como no fim de tarde de verdade.
 */
export const GLSL_SOMBRA_DECLARA = /* glsl */ `
uniform sampler2D uSombra;
uniform vec4 uSombraArea;
vec2 sombraEm(vec2 xz) { return texture2D(uSombra, (xz - uSombraArea.xy) * uSombraArea.zw).rg; }
`;

export const glslSombraAplica = (pos: string): string => /* glsl */ `
{
  vec2 sb = sombraEm(${pos}.xz);
  // O sol está baixo: o chão recebe pouca luz direta (a hemisférica manda), então só apagá-la mal se nota. A sombra assada também
  // fecha a luz do céu ("escuro") e a esfria ("frio"): é o que dá o corpo da sombra de fim de tarde.
  float luzDoSol = 1.0 - 0.9 * sb.r;
  float escuro = 1.0 - 0.58 * sb.r;
  float abertura = 1.0 - 0.6 * sb.g;
  vec3 frio = mix(vec3(1.0), vec3(0.74, 0.85, 1.0), sb.r);
  reflectedLight.directDiffuse *= luzDoSol * escuro;
  reflectedLight.directSpecular *= luzDoSol;
  reflectedLight.indirectDiffuse *= abertura * frio * escuro;
  reflectedLight.indirectSpecular *= abertura * escuro;
}
`;
