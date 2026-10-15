import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * O "quadrado preto" da praia (P130/P136, 15/10): um `pow(1.0 - vAlt, 2.2)` na cortina das zonas dava NaN nos pixels de borda (o MSAA
 * avalia o pixel fora do triângulo e o `vAlt` sai um fio acima de 1), e o bloom espalhava esse NaN pela tela inteira. Só a GPU de verdade
 * mostra isso (o SwiftShader do smoke e do CI não): esta é a trava barata que roda em todo `npm test`. A prova na GPU é
 * `.decepticons/medicoes/varrer-nan.mjs` (antes da correção 197 de 216 poses com NaN; depois, 0 de 480).
 *
 * A regra: em GLSL, a base de um `pow`/`sqrt`/`log` nunca pode ser negativa, então o primeiro argumento começa em `max(`, `clamp(`, `abs(`
 * ou `exp(`; `acos`/`asin` levam `clamp(`; e a normal de uma face lida das derivadas passa por `normalSegura` (um `normalize` do vetor
 * nulo também é NaN).
 */

const PASTAS = ['../environment/', '../fx/', '../entities/', '../camera/', '../ui/'].map((p) => new URL(p, import.meta.url));

/** Os códigos-fonte que podem ter GLSL (sem os testes). */
function fontes(): { nome: string; texto: string }[] {
  const out: { nome: string; texto: string }[] = [];
  for (const pasta of PASTAS) {
    for (const arq of readdirSync(pasta)) {
      if (!arq.endsWith('.ts') || arq.endsWith('.test.ts')) continue;
      out.push({ nome: `${pasta.pathname.split('/').slice(-2, -1)[0]}/${arq}`, texto: readFileSync(new URL(arq, pasta), 'utf8') });
    }
  }
  return out;
}

const SEGUROS_PARA_BASE = /^(max|clamp|abs|exp)\s*\(/;
const SEGUROS_PARA_ARCO = /^clamp\s*\(/;

/** O primeiro argumento da chamada que abre em `texto[abre]` (o parêntese), respeitando parênteses aninhados. */
function primeiroArgumento(texto: string, abre: number): string {
  let profundidade = 0;
  for (let i = abre; i < texto.length; i++) {
    const c = texto[i];
    if (c === '(') profundidade++;
    else if (c === ')') {
      profundidade--;
      if (profundidade === 0) return texto.slice(abre + 1, i).trim();
    } else if (c === ',' && profundidade === 1) return texto.slice(abre + 1, i).trim();
  }
  return texto.slice(abre + 1).trim();
}

const linhaDe = (texto: string, indice: number): number => texto.slice(0, indice).split('\n').length;

/** Tira os comentários (de JS e de GLSL) sem mexer nas linhas: o que o comentário diz de `pow(x, y)` não é código. */
const semComentarios = (texto: string): string =>
  texto.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');

/** Os usos sem guarda de uma função de domínio restrito, em GLSL (as chamadas de JS, `Math.pow(...)`, ficam de fora). */
export function usosSemGuarda(fonte: string): string[] {
  const texto = semComentarios(fonte);
  const achados: string[] = [];
  const regra = (re: RegExp, seguros: RegExp, nome: string) => {
    for (const m of texto.matchAll(re)) {
      const abre = m.index! + m[0].length - 1;
      const arg = primeiroArgumento(texto, abre);
      if (!seguros.test(arg)) achados.push(`${nome}(${arg.slice(0, 60)}…) na linha ${linhaDe(texto, m.index!)}`);
    }
  };
  regra(/(?<![\w.])pow\s*\(/g, SEGUROS_PARA_BASE, 'pow');
  regra(/(?<![\w.])sqrt\s*\(/g, SEGUROS_PARA_BASE, 'sqrt');
  regra(/(?<![\w.])log2?\s*\(/g, SEGUROS_PARA_BASE, 'log');
  regra(/(?<![\w.])inversesqrt\s*\(/g, SEGUROS_PARA_BASE, 'inversesqrt');
  regra(/(?<![\w.])a(?:cos|sin)\s*\(/g, SEGUROS_PARA_ARCO, 'acos/asin');
  for (const m of texto.matchAll(/normalize\s*\(\s*cross\s*\(\s*dFdx/g)) achados.push(`normalize(cross(dFdx…)) na linha ${linhaDe(texto, m.index!)}: use normalSegura`);
  return achados;
}

describe('shaders sem NaN (o quadrado preto da praia, P130/P136)', () => {
  it('nenhum pow, sqrt ou log de GLSL leva base que possa ser negativa sem max/clamp/abs', () => {
    const problemas = fontes().flatMap((f) => usosSemGuarda(f.texto).map((u) => `${f.nome}: ${u}`));
    expect(problemas, `proteja a base com max(…, 0.0) ou clamp(…):\n${problemas.join('\n')}`).toEqual([]);
  });

  it('o analisador pega o defeito de verdade: o pow da cortina sem o clamp, o sqrt solto e a normal nula', () => {
    expect(usosSemGuarda('float base = pow(1.0 - vAlt, 2.2) * 0.22;')).toHaveLength(1);
    expect(usosSemGuarda('float halo = pow(max(1.0 - sqrt(r2), 0.0), 2.6);')).toHaveLength(1); // o sqrt(r2) de dentro também precisa de guarda
    expect(usosSemGuarda('vec3 nf = normalize(cross(dFdx(vMundo), dFdy(vMundo)));')).toHaveLength(1);
    expect(usosSemGuarda('float x = acos(dot(a, b));')).toHaveLength(1);
    // O que está certo passa, e o `Math.pow` de JS não é GLSL.
    expect(usosSemGuarda('float base = pow(clamp(1.0 - vAlt, 0.0, 1.0), 2.2);')).toEqual([]);
    expect(usosSemGuarda('float f = pow(max(c, 0.0), 2.2) + sqrt(max(r2, 0.0)) + exp(-x); const y = Math.pow(a - b, 2);')).toEqual([]);
    expect(usosSemGuarda('vec3 nf = normalSegura(cross(dFdx(vMundo), dFdy(vMundo)));')).toEqual([]);
  });

  it('o primeiro argumento respeita parênteses aninhados e vírgulas de dentro', () => {
    const t = 'pow(max(a, b), vec3(2.2))';
    expect(primeiroArgumento(t, t.indexOf('('))).toBe('max(a, b)');
    expect(usosSemGuarda('pow(vec3(1.0, 2.0, 3.0), vec3(2.2))')).toHaveLength(1);
  });
});
