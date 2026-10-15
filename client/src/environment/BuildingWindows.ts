import * as THREE from 'three';
import { PALETTE } from '../core/palette';
import { GLSL_NORMAL_SEGURA } from './glslSeguro';

/**
 * Janelas acesas nos prédios da Arena, desenhadas no próprio shader do material (zero geometria, zero textura, zero draw
 * call novo, nada por quadro). A grade vive em coordenadas do mundo: vale em qualquer face e para qualquer tamanho de
 * prédio, sem depender de UV (os prédios são uma caixa esticada, e UV esticaria as janelas).
 * Referência de qualidade: `.decepticons/REFERENCIA_VISUAL.md` (os prédios eram blocos lisos com arestas neon).
 */

/** Medidas da grade, em metros. A altura do andar é a das faixas neon do `Arena.addBuilding` (a cada 5 m). */
export const WINDOWS = {
  /** Largura de cada coluna (janela + parede). */
  pitch: 3.2,
  /** Largura da janela. */
  width: 1.4,
  /** Altura de um andar: a janela fica entre duas faixas neon. */
  floor: 5,
  /** Onde a janela começa e quanto mede, dentro do andar. */
  bottom: 1.4,
  height: 2.1,
  /** Fração das janelas acesas. */
  litShare: 0.3,
  /** Fração das acesas em tom de sódio (laranja), para a cidade não ser de uma cor só. */
  sodiumShare: 0.22,
  /** Brilho das janelas; passa de 1 para pegar no bloom sem estourar a fachada. */
  intensity: 1.05,
} as const;

const num = (n: number): string => n.toFixed(4);

const VERTEX_DECLARATIONS = 'varying vec3 vWindowPos;';
const VERTEX_BODY = 'vWindowPos = (modelMatrix * vec4(transformed, 1.0)).xyz;';

const FRAGMENT_DECLARATIONS = `varying vec3 vWindowPos;
uniform vec3 windowColor;
uniform vec3 windowSodium;
${GLSL_NORMAL_SEGURA}
float windowHash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }`;

/**
 * Normal da face lida das derivadas da posição no mundo (cada face de uma caixa é plana), para saber se a janela fica no
 * eixo x ou z, e sem janela no teto. O sorteio de cada janela vem da célula no mundo: prédios vizinhos não repetem o padrão.
 */
const FRAGMENT_BODY = `{
  vec3 faceN = abs(normalSegura(cross(dFdx(vWindowPos), dFdy(vWindowPos))));
  float alongX = step(faceN.z, faceN.x);
  float across = mix(vWindowPos.x, vWindowPos.z, alongX);
  vec2 cell = vec2(floor(across / ${num(WINDOWS.pitch)}), floor(vWindowPos.y / ${num(WINDOWS.floor)}));
  vec2 inCell = vec2(fract(across / ${num(WINDOWS.pitch)}), fract(vWindowPos.y / ${num(WINDOWS.floor)}));
  float halfW = ${num(WINDOWS.width / WINDOWS.pitch / 2)};
  float inX = step(0.5 - halfW, inCell.x) * step(inCell.x, 0.5 + halfW);
  float inY = step(${num(WINDOWS.bottom / WINDOWS.floor)}, inCell.y) * step(inCell.y, ${num((WINDOWS.bottom + WINDOWS.height) / WINDOWS.floor)});
  float facade = step(faceN.y, 0.5);
  vec2 id = cell + vec2(alongX * 41.0, 0.0);
  float lit = step(1.0 - ${num(WINDOWS.litShare)}, windowHash(id));
  float sodium = step(1.0 - ${num(WINDOWS.sodiumShare)}, windowHash(id + 7.3));
  float level = 0.65 + 0.35 * windowHash(id + 19.1);
  totalEmissiveRadiance += mix(windowColor, windowSodium, sodium) * level * inX * inY * lit * facade;
}`;

/** Aplica a troca de trechos de shader. Separado do material para o teste conferir os pontos de encaixe no three atual. */
export function patchWindowShader(shader: { vertexShader: string; fragmentShader: string }): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERTEX_DECLARATIONS}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_BODY}`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAGMENT_DECLARATIONS}`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAGMENT_BODY}`);
}

/**
 * Põe janelas acesas, na cor `accent` do prédio, num material de prédio já clonado (o clone é de cada prédio: a câmera
 * o torna translúcido atrás do Mech, e as janelas somem junto porque a emissão sai com a mesma opacidade).
 */
export function windowedBuildingMaterial(material: THREE.MeshStandardMaterial, accent: number): THREE.MeshStandardMaterial {
  const windowColor = { value: new THREE.Color(accent).multiplyScalar(WINDOWS.intensity) };
  const windowSodium = { value: new THREE.Color(PALETTE.sodium).multiplyScalar(WINDOWS.intensity) };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windowColor = windowColor;
    shader.uniforms.windowSodium = windowSodium;
    patchWindowShader(shader);
  };
  material.customProgramCacheKey = () => 'cybermech-building-windows-v1';
  return material;
}
