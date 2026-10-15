import * as THREE from 'three';
import { GLSL_RUIDO } from './PraiaGlsl';
import { corDoChao, PRAIA_CELULA, alturaDoChao } from './PraiaTerreno';

/**
 * O CHÃO DESENHADO DA PRAIA (P127): uma única malha de relevo (a mesma função de altura do colisor — `PraiaTerreno.alturaDoChao`) com
 * **cor de vértice** (areia branca em manchas, a faixa molhada, o fundo do mar clareando perto da costa) e um **grão de areia** no
 * shader (ondulações do vento e brilho miúdo, em coordenadas do mundo). A malha cobre o mapa jogável e uma margem, para o chão não
 * acabar na parede invisível.
 *
 * **Custo:** um desenho, ~13 mil vértices, estático; o grão é uma conta por pixel.
 */

/** A região desenhada (m): o mapa (640 × 240) e uma margem de 60 m a leste e oeste e de 40 m depois da cidade. */
export const CHAO_DESENHADO = { minX: -380, maxX: 380, minZ: -124, maxZ: 160 } as const;

export function criarChao(scene: THREE.Scene): THREE.Mesh {
  const { minX, maxX, minZ, maxZ } = CHAO_DESENHADO;
  const celulasX = Math.round((maxX - minX) / PRAIA_CELULA);
  const celulasZ = Math.round((maxZ - minZ) / PRAIA_CELULA);
  const colunas = celulasZ + 1;
  const pos = new Float32Array((celulasX + 1) * colunas * 3);
  const cores = new Float32Array((celulasX + 1) * colunas * 3);
  const cor = new THREE.Color();
  for (let ix = 0; ix <= celulasX; ix++) {
    for (let iz = 0; iz <= celulasZ; iz++) {
      const x = minX + ix * PRAIA_CELULA;
      const z = minZ + iz * PRAIA_CELULA;
      const i = (ix * colunas + iz) * 3;
      pos[i] = x;
      pos[i + 1] = alturaDoChao(x, z);
      pos[i + 2] = z;
      const [r, g, b] = corDoChao(x, z);
      cor.setRGB(r, g, b, THREE.SRGBColorSpace);
      cores[i] = cor.r;
      cores[i + 1] = cor.g;
      cores[i + 2] = cor.b;
    }
  }
  const indices: number[] = [];
  for (let ix = 0; ix < celulasX; ix++) {
    for (let iz = 0; iz < celulasZ; iz++) {
      const a = ix * colunas + iz; // (ix, iz)
      const b = (ix + 1) * colunas + iz; // (ix + 1, iz)
      const c = a + 1; // (ix, iz + 1)
      const d = b + 1; // (ix + 1, iz + 1)
      indices.push(a, c, b, b, c, d); // normais para cima
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundoChao;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMundoChao = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vMundoChao;\n${GLSL_RUIDO}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 w = vMundoChao.xz;
          float largo = vn(w * 0.3);
          float medio = vn(w * 2.1);
          float fino = vn(w * 9.0);
          // As marolas que o vento desenha na areia: faixas finas que ondulam.
          float marola = 0.5 + 0.5 * sin(w.x * 0.8 + largo * 7.0 + w.y * 0.3);
          diffuseColor.rgb *= 0.92 + 0.13 * largo + 0.05 * (medio - 0.5) + 0.05 * (fino - 0.5) + 0.04 * (marola - 0.5);
        }`,
      );
  };
  material.customProgramCacheKey = () => 'cybermech-praia-chao';
  const malha = new THREE.Mesh(geo, material);
  scene.add(malha);
  return malha;
}
