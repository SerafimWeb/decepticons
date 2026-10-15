import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import type { MaterialDaCamada } from './PraiaGeometrias';

/**
 * A VIDA DA PRAIA (P127): o que se mexe — as palmas ao vento, as velas tremulando, os faróis piscando e as **gaivotas** circulando
 * sobre o mar — tudo **no vertex shader**, com o mesmo uniforme de tempo da praia. **Custo de CPU: zero** (nenhum objeto se move
 * em JS, nada é alocado por quadro): o balanço é uma conta por vértice na GPU, e cada gaivota é um voo calculado pela fase dela.
 */

const DECLARA_VERTICE = /* glsl */ `
uniform float uTempo;
float faseDaInstancia() {
#ifdef USE_INSTANCING
  return instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.13;
#else
  return 0.0;
#endif
}
`;

/** O balanço de cada camada animada: onde o trecho entra no vertex shader (depois de `begin_vertex`). */
const BALANCO: Readonly<Partial<Record<MaterialDaCamada, string>>> = {
  folha: /* glsl */ `
    float fase = faseDaInstancia();
    float alt = smoothstep(3.0, 10.5, position.y);
    transformed.x += sin(uTempo * 1.4 + fase) * 0.24 * alt;
    transformed.z += cos(uTempo * 1.1 + fase * 1.3) * 0.18 * alt;
    transformed.y += sin(uTempo * 3.1 + fase + position.x * 1.7) * 0.07 * smoothstep(8.0, 11.0, position.y);
  `,
  vela: /* glsl */ `
    float fase = faseDaInstancia();
    transformed.x += sin(uTempo * 2.2 + position.y * 1.6 + fase) * 0.14 * smoothstep(1.0, 4.7, position.y);
  `,
};

/** Cria o material de uma camada (`tipo`) para o `tempo` da praia. `pisca`: o brilho liga e desliga (aviso de antena e de boia). */
export function materialDaCamada(tipo: MaterialDaCamada, tempo: { value: number }, pisca = false): THREE.Material {
  if (tipo === 'brilho') {
    // O brilho passa de 1 para acender no bloom; o `pisca` liga e desliga por instância (o aviso vermelho da antena).
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(3.2, 3.2, 3.2) });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTempo = tempo;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${DECLARA_VERTICE}\nvarying float vPulso;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvPulso = ${pisca ? 'step(0.0, sin(uTempo * 2.6 + faseDaInstancia() * 5.0))' : '0.88 + 0.12 * sin(uTempo * 1.7 + faseDaInstancia() * 3.0)'};`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vPulso;')
        .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb *= ${pisca ? '(0.12 + 0.88 * vPulso)' : 'vPulso'};`);
    };
    m.customProgramCacheKey = () => `cybermech-praia-brilho-${pisca ? 'pisca' : 'fixo'}`;
    return m;
  }
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.04,
    side: tipo === 'padrao' ? THREE.FrontSide : THREE.DoubleSide,
  });
  const balanco = BALANCO[tipo];
  if (balanco) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTempo = tempo;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${DECLARA_VERTICE}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n{ ${balanco} }`);
    };
    m.customProgramCacheKey = () => `cybermech-praia-${tipo}`;
  }
  return m;
}

// ─── As gaivotas ────────────────────────────────────────────────────────────────────────────────────────────────

/** Quantas gaivotas voam sobre a praia (uma malha instanciada, um desenho). */
export const GAIVOTAS = 18;

function geometriaDaGaivota(): THREE.BufferGeometry {
  // Cada vértice: x, y, z e o quanto ele bate com a asa (`aAsa`: 0 no corpo e na raiz da asa, 1 na ponta). O corpo é um losango
  // alongado em z, com a cabeça em +z; cada asa é um par de triângulos que sai do corpo para ±x.
  const v: readonly (readonly [number, number, number, number])[] = [
    [0, 0, 0.55, 0], [-0.16, 0, -0.2, 0], [0.16, 0, -0.2, 0],
    [0, 0.12, -0.05, 0], [0, 0, 0.55, 0], [0.16, 0, -0.2, 0],
    [0, 0, -0.55, 0], [-0.16, 0, -0.2, 0], [0.16, 0, -0.2, 0],
    // asa esquerda
    [-0.12, 0, 0.18, 0], [-1.35, 0, -0.1, 1], [-0.12, 0, -0.22, 0],
    [-1.35, 0, -0.1, 1], [-0.5, 0, -0.55, 0.45], [-0.12, 0, -0.22, 0],
    // asa direita
    [0.12, 0, 0.18, 0], [0.12, 0, -0.22, 0], [1.35, 0, -0.1, 1],
    [1.35, 0, -0.1, 1], [0.12, 0, -0.22, 0], [0.5, 0, -0.55, 0.45],
  ];
  const pos: number[] = [];
  const aAsa: number[] = [];
  const cor: number[] = [];
  for (const [x, y, z, asa] of v) {
    pos.push(x, y, z);
    aAsa.push(asa);
    // Branca, com a ponta da asa cinza.
    cor.push(0.96 - 0.4 * asa, 0.95 - 0.37 * asa, 0.92 - 0.32 * asa);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setAttribute('aAsa', new THREE.Float32BufferAttribute(aAsa, 1));
  return g;
}

/**
 * O bando de gaivotas: cada uma voa em círculos (raio, velocidade, fase e altura vêm de um atributo por instância) sobre o mar e a praia.
 * O voo e o bater de asas são do vertex shader; o centro da órbita é a posição da instância.
 */
export function criarGaivotas(scene: THREE.Scene, tempo: { value: number }): THREE.InstancedMesh {
  const rand = mulberry32(777);
  const g = geometriaDaGaivota();
  const voo = new Float32Array(GAIVOTAS * 4);
  const m = new THREE.Matrix4();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTempo = tempo;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAsa;\nattribute vec4 aVoo;\nuniform float uTempo;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float ang = aVoo.z + uTempo * aVoo.y;
          float sentido = sign(aVoo.y);
          // O rumo da gaivota é a tangente do círculo; o corpo gira para ele.
          vec2 tang = vec2(-sin(ang), cos(ang)) * sentido;
          float yaw = atan(tang.x, tang.y);
          vec3 p = transformed;
          p.y += aAsa * sin(uTempo * 7.5 + aVoo.z * 3.0) * 0.5; // o bater de asas
          p.y -= aAsa * 0.08; // asa um pouco arqueada
          float cy = cos(yaw);
          float sy = sin(yaw);
          p.xz = vec2(p.x * cy + p.z * sy, -p.x * sy + p.z * cy);
          p += vec3(cos(ang) * aVoo.x, aVoo.w + sin(ang * 2.3 + aVoo.z) * 1.6, sin(ang) * aVoo.x);
          transformed = p;
        }`,
      );
  };
  material.customProgramCacheKey = () => 'cybermech-praia-gaivota';
  const malha = new THREE.InstancedMesh(g, material, GAIVOTAS);
  for (let i = 0; i < GAIVOTAS; i++) {
    // O centro da órbita fica sobre a praia e o mar rasos ao longo da orla; o raio, a velocidade e a altura variam.
    m.makeTranslation(-260 + rand() * 520, 0, -70 + rand() * 60);
    malha.setMatrixAt(i, m);
    const sentido = rand() < 0.5 ? -1 : 1;
    voo.set([22 + rand() * 46, sentido * (0.16 + rand() * 0.2), rand() * Math.PI * 2, 16 + rand() * 26], i * 4);
  }
  g.setAttribute('aVoo', new THREE.InstancedBufferAttribute(voo, 4));
  malha.frustumCulled = false; // o voo sai da caixa da geometria (a posição é calculada no shader)
  scene.add(malha);
  return malha;
}
