import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { criarFxaa } from './Fxaa';

describe('o antisserrilhado FXAA (P188: no lugar do MSAA 4× do alvo HDR, que custava ~17 dos 27 ms do quadro na GPU integrada)', () => {
  it('o composer o ajusta com os pixels de verdade (já com a escala da janela): o texel do shader é 1 / pixels', () => {
    const passo = criarFxaa();
    passo.setSize(1936, 1156);
    const r = passo.material.uniforms.resolution!.value as { x: number; y: number };
    expect(r.x).toBeCloseTo(1 / 1936, 9);
    expect(r.y).toBeCloseTo(1 / 1156, 9);
    passo.setSize(0, 0); // uma janela sem tamanho não vira divisão por zero
    expect(Number.isFinite(r.x) && Number.isFinite(r.y)).toBe(true);
  });

  it('o jogo NÃO volta ao MSAA: o alvo HDR do composer tem 0 amostras e o FXAA é a última passada (depois do tone mapping, que o FXAA lê em sRGB)', () => {
    const game = readFileSync(resolve(__dirname, '../core/Game.ts'), 'utf8');
    expect(game).toMatch(/new THREE\.WebGLRenderTarget\(1, 1, \{ type: THREE\.HalfFloatType, samples: 0 \}\)/);
    expect(game).not.toMatch(/samples: [1-9]/);
    expect(game).toMatch(/addPass\(new OutputPass\(\)\);\s*this\.fxaaPass = criarFxaa\(\);\s*this\.composer\.addPass\(this\.fxaaPass\)/);
  });
});
