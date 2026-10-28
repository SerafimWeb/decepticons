import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RUA } from './CidadeNeonLayout';
import { GLSL_REFLEXOS } from './CidadeNeonReflexos';
import { GLSL_RUA, materialDaRua } from './CidadeNeonRua';
import { GLSL_TELOES } from './CidadeNeonTeloes';
import { GLSL_TORRES } from './CidadeNeonTorres';

/**
 * O que só a GPU enxerga, conferido sem GPU (o smoke e o CI rodam em SwiftShader, que também só acusa o erro no navegador): a interface entre o vértice e o fragmento de cada
 * shader da cidade, o equilíbrio de chaves e parênteses, e o encaixe do piso no shader padrão do three (se uma atualização do three mudar um ponto de encaixe, o piso viraria
 * branco sem erro nenhum). Quem acrescentar um shader à cidade o acrescenta aqui.
 */

interface Par {
  vertex: string;
  fragment: string;
}

const PARES: Readonly<Record<string, Par>> = {
  torres: GLSL_TORRES,
  telao: GLSL_TELOES.telao,
  letreiro: GLSL_TELOES.letreiro,
  neon: GLSL_TELOES.neon,
  rastro: GLSL_REFLEXOS.rastro,
  poca: GLSL_REFLEXOS.poca,
  luzDosPostes: GLSL_RUA.luz,
};

/** As `varying` declaradas num shader: nome → "flat tipo" ou "tipo". */
function varyings(src: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const m of src.matchAll(/^\s*(flat\s+)?varying\s+(\w+)\s+(\w+)\s*;/gm)) mapa.set(m[3]!, `${m[1] ? 'flat ' : ''}${m[2]}`);
  return mapa;
}

const equilibrado = (src: string, abre: string, fecha: string): boolean => src.split(abre).length === src.split(fecha).length;

describe('os shaders da cidade em volta da Cidade Neon (P264, PR2)', () => {
  for (const [nome, par] of Object.entries(PARES)) {
    describe(nome, () => {
      it('cada varying que o fragmento lê o vértice escreve, com o mesmo tipo e o mesmo qualificador (flat ou não): um desencontro é erro de link na GPU', () => {
        const v = varyings(par.vertex);
        const f = varyings(par.fragment);
        expect(f.size, 'o fragmento tem de ler alguma coisa do vértice').toBeGreaterThan(0);
        for (const [n, tipo] of f) expect(v.get(n), `varying ${n}`).toBe(tipo);
      });

      it('chaves e parênteses fecham, tem main() e nenhum número virou NaN/undefined/Infinity na montagem do texto', () => {
        for (const src of [par.vertex, par.fragment]) {
          expect(equilibrado(src, '{', '}')).toBe(true);
          expect(equilibrado(src, '(', ')')).toBe(true);
          expect(src).toMatch(/void\s+main\s*\(\s*\)/);
          expect(src).not.toMatch(/NaN|undefined|Infinity/);
        }
      });

      it('as constantes por instância passam como flat (a semente alimenta hash caótico: 1 ulp de interpolação viraria ruído em algumas GPUs)', () => {
        for (const n of ['vDados', 'vTorre']) {
          const t = varyings(par.fragment).get(n);
          if (t) expect(t, n).toMatch(/^flat /);
        }
      });
    });
  }

  describe('o piso (a rua desenhada)', () => {
    const standard = (): { vertexShader: string; fragmentShader: string } => ({
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    });
    const aplicar = (): { vertexShader: string; fragmentShader: string } => {
      const shader = standard();
      (materialDaRua().onBeforeCompile as (s: typeof shader, r: unknown) => void)(shader, null);
      return shader;
    };

    it('encaixa no shader padrão do three: os cinco pontos de troca existem e cada um deixou o seu trecho', () => {
      const original = standard();
      for (const ponto of ['#include <common>', '#include <begin_vertex>']) expect(original.vertexShader).toContain(ponto);
      for (const ponto of ['#include <common>', '#include <map_fragment>', '#include <roughnessmap_fragment>', '#include <emissivemap_fragment>']) expect(original.fragmentShader).toContain(ponto);
      const s = aplicar();
      expect(s.vertexShader).toContain('varying vec3 vPosRua;');
      expect(s.vertexShader).toContain('vPosRua = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      expect(s.fragmentShader).toContain('varying vec3 vPosRua;');
      expect(s.fragmentShader).toContain('diffuseColor.rgb = corRua;');
      expect(s.fragmentShader).toContain('roughnessFactor = rugosidadeDaRua;');
      expect(s.fragmentShader).toContain('* pinturaDaRua;');
    });

    it('chaves e parênteses fecham e as medidas da rua entraram no texto, vindas de RUA (fonte única)', () => {
      const f = aplicar().fragmentShader;
      expect(equilibrado(f, '{', '}')).toBe(true);
      expect(equilibrado(f, '(', ')')).toBe(true);
      expect(f).not.toMatch(/NaN|undefined|Infinity/);
      for (const m of [RUA.calcadao, RUA.meioFio, RUA.borda, RUA.faixaDeLado, RUA.meiaFaixa]) expect(GLSL_RUA.piso, `${m}`).toContain(m.toFixed(3));
    });

    it('o ramo barato cobre a praça: o desvio da avenida começa dentro do calçadão, antes do desbotado da calçada (sem emenda)', () => {
      const corte = Number(/if \(mq > ([\d.]+)\)/.exec(GLSL_RUA.piso)![1]);
      expect(corte).toBeLessThan(RUA.calcadao);
      expect(corte).toBeGreaterThan(RUA.calcadao - 1);
    });
  });
});
