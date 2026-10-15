import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LuminosityHighPassShader } from 'three/addons/shaders/LuminosityHighPassShader.js';
import { describe, expect, it } from 'vitest';
import { GLSL_LIMPA_TEXEL, protegerBloom, protegerFragmento } from './bloomSeguro';

/** A rede de segurança do bloom (o "quadrado preto", P130/P136): o high-pass troca NaN e infinito por zero antes de qualquer conta. */
describe('a rede de segurança do bloom', () => {
  const original = LuminosityHighPassShader.fragmentShader;

  it('encaixa no high-pass do three instalado: a limpeza vem logo depois de ler a cena e antes da luminância', () => {
    const protegido = protegerFragmento(original);
    expect(protegido).not.toBe(original);
    const leitura = protegido.indexOf('vec4 texel = texture2D( tDiffuse, vUv );');
    const limpeza = protegido.indexOf('texel = limpaTexel(texel);');
    const luminancia = protegido.indexOf('luminance( texel.xyz )');
    expect(leitura).toBeGreaterThan(-1);
    expect(limpeza).toBeGreaterThan(leitura);
    expect(luminancia).toBeGreaterThan(limpeza);
  });

  it('a função é declarada uma vez, antes do main, e o main segue um só', () => {
    const protegido = protegerFragmento(original);
    expect(protegido.match(/vec4 limpaTexel\(/g)).toHaveLength(1);
    expect(protegido.match(/void\s+main\s*\(/g)).toHaveLength(1);
    expect(protegido.indexOf('vec4 limpaTexel(')).toBeLessThan(protegido.search(/void\s+main\s*\(/));
  });

  it('é idempotente: proteger duas vezes não repete a limpeza', () => {
    const uma = protegerFragmento(original);
    expect(protegerFragmento(uma)).toBe(uma);
  });

  it('o teste é por bits do expoente (vale com qualquer otimização de ponto flutuante), em todos os canais, e zera os negativos', () => {
    expect(GLSL_LIMPA_TEXEL).toContain('floatBitsToUint');
    expect(GLSL_LIMPA_TEXEL).toContain('0x7F800000u');
    for (const canal of ['x', 'y', 'z', 'w']) expect(GLSL_LIMPA_TEXEL).toContain(`t.${canal} = 0.0;`);
    expect(GLSL_LIMPA_TEXEL).toContain('max(t.xyz, vec3(0.0))');
    // Nada de `x != x` nem `isnan`: o compilador pode apagá-los com a otimização de ponto flutuante rápido.
    expect(GLSL_LIMPA_TEXEL).not.toMatch(/isnan|!=\s*t\./);
  });

  it('falha alto se o three mudar a leitura da cena (em vez de deixar o bloom sem proteção em silêncio)', () => {
    expect(() => protegerFragmento('void main() { gl_FragColor = vec4(1.0); }')).toThrow(/bloomSeguro/);
  });

  it('protege o passe de verdade: o high-pass do UnrealBloomPass ganha a limpeza e é marcado para recompilar', () => {
    const passe = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.5, 0.9);
    const versao = passe.materialHighPassFilter.version;
    protegerBloom(passe);
    expect(passe.materialHighPassFilter.fragmentShader).toContain('limpaTexel');
    expect(passe.materialHighPassFilter.version).toBeGreaterThan(versao);
    passe.dispose();
  });
});
