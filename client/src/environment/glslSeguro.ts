/**
 * Trechos de GLSL que não geram NaN (o "quadrado preto" da praia, P130/P136).
 *
 * Um NaN num único pixel do buffer HDR não fica no pixel: o bloom o espalha pelas mipmaps e a tela vira um retângulo preto. Os shaders
 * da praia só têm três jeitos de gerá-lo, e cada um tem a sua guarda aqui ou no próprio shader:
 *  - `pow(x, y)` com `x < 0` (o MSAA avalia um pixel de borda fora do triângulo, e um `1.0 - vAlt` que devia ser ≥ 0 sai negativo): a base
 *    do `pow` leva sempre `max(…, 0.0)` ou `clamp(…)` (`ShadersSemNaN.test.ts` trava isso);
 *  - `normalize` de um vetor nulo (a normal da face lida das derivadas, em quem não está de frente): `normalSegura`;
 *  - divisão por zero e `sqrt` de negativo: não há nenhum nos shaders da praia (o teste também confere o `sqrt`).
 */

/** `normalize` que devolve "para cima" no vetor (quase) nulo em vez de NaN: o mesmo resultado em tudo que tem comprimento. */
export const GLSL_NORMAL_SEGURA = /* glsl */ `
vec3 normalSegura(vec3 v) {
  float l2 = dot(v, v);
  return l2 > 1e-20 ? v * inversesqrt(max(l2, 1e-20)) : vec3(0.0, 1.0, 0.0);
}
`;
