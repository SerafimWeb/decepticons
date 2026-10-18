import type { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { ShaderPass as PassoDeShader } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

/**
 * O ANTISSERRILHADO DO JOGO (FXAA): uma passada de tela cheia **depois** do tone mapping (o FXAA lê a cor já em sRGB, como foi desenhado para ler). Substitui o **MSAA 4× do alvo HDR** que o
 * composer tinha: medido na GPU integrada desta máquina (AMD Vega 11, a janela do Comandante, 1936×1156 pixels, `medicoes/amazonia-gpu.mjs --matriz`), o MSAA custava **~17 dos 27 ms de cada
 * quadro** (o bloom, o cobertor de ondas e o tone mapping desenham tela cheia **dentro** do alvo multiamostrado, e cada um paga a resolução das amostras): **27 fps viravam ~66** só por tirá-lo, em
 * todos os mapas. O FXAA custa uma leitura de textura por pixel (~1 ms) e suaviza as bordas sem pagar por amostra. Módulo independente (G3).
 *
 * O `resolution` do shader é o tamanho de um texel; o composer chama `setSize` com os pixels de verdade (já com o pixelRatio), então a conta acompanha a janela e a qualidade.
 */
export function criarFxaa(): ShaderPass {
  const passo = new PassoDeShader(FXAAShader);
  const texel = passo.material.uniforms.resolution!.value as { set(x: number, y: number): void };
  passo.setSize = (largura: number, altura: number): void => texel.set(1 / Math.max(1, largura), 1 / Math.max(1, altura));
  return passo;
}
