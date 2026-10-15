import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Rede de segurança do bloom (o "quadrado preto" da praia, P130/P136).
 *
 * O bloom lê o buffer HDR da cena e o espalha pelas mipmaps. Um **NaN ou infinito em um pixel só** (um `pow` de base negativa num pixel de
 * borda, uma divisão por zero) contamina as mipmaps e o desenho final: a tela vira um retângulo preto, com HUD por cima, e fica assim
 * até algo mexer nos alvos de render (o rebaixamento de qualidade, que cura "sozinho"). Os shaders da praia foram corrigidos na raiz
 * (`glslSeguro.ts`, `ShadersSemNaN.test.ts`), mas um efeito novo de qualquer frente pode reabrir o buraco: aqui o high-pass do bloom troca o
 * que não é finito por zero (e os negativos por zero: o bloom só soma luz) antes de qualquer conta. O pior caso passa a ser um pixel
 * escuro, não a tela inteira.
 *
 * **Custo:** uma comparação de bits por canal no high-pass (que já lê a textura): irrelevante. O teste de bits (`floatBitsToUint`) vale em
 * qualquer compilador: um `x != x` ou `isnan` pode ser apagado pelas otimizações de ponto flutuante rápido de alguns drivers.
 */

/** A linha do high-pass do three que lê a cena (o teste confere que ela ainda existe na versão instalada). */
const LEITURA_DA_CENA = 'vec4 texel = texture2D( tDiffuse, vUv );';

export const GLSL_LIMPA_TEXEL = /* glsl */ `
vec4 limpaTexel(vec4 t) {
  uvec4 bits = floatBitsToUint(t);
  if ((bits.x & 0x7F800000u) == 0x7F800000u) t.x = 0.0;
  if ((bits.y & 0x7F800000u) == 0x7F800000u) t.y = 0.0;
  if ((bits.z & 0x7F800000u) == 0x7F800000u) t.z = 0.0;
  if ((bits.w & 0x7F800000u) == 0x7F800000u) t.w = 0.0;
  t.xyz = max(t.xyz, vec3(0.0));
  return t;
}
`;

/** O fragmento do high-pass com a limpeza antes da primeira conta. Idempotente; falha alto se o three mudar a leitura da cena. */
export function protegerFragmento(fragmentShader: string): string {
  if (fragmentShader.includes('limpaTexel')) return fragmentShader;
  if (!fragmentShader.includes(LEITURA_DA_CENA)) throw new Error('bloomSeguro: o high-pass do three mudou; atualize LEITURA_DA_CENA');
  return fragmentShader
    .replace(/void\s+main\s*\(\s*\)/, `${GLSL_LIMPA_TEXEL}\nvoid main()`)
    .replace(LEITURA_DA_CENA, `${LEITURA_DA_CENA}\n\ttexel = limpaTexel(texel);`);
}

/** Protege o bloom do jogo: chamar uma vez, logo depois de criar o passe (antes do primeiro desenho). */
export function protegerBloom(pass: UnrealBloomPass): void {
  const material = pass.materialHighPassFilter;
  material.fragmentShader = protegerFragmento(material.fragmentShader);
  material.needsUpdate = true;
}
