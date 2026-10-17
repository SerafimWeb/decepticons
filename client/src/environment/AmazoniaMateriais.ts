import * as THREE from 'three';
import { AMAZONIA_DRAGA_INICIO_X } from './AmazoniaLayout';
import { BANDA_DA_FRENTE } from './AmazoniaRio';

/**
 * Os MATERIAIS DA AMAZÔNIA (P180, parte B): tudo o que o mapa mostra do **termômetro do rio** passa por **dois números** — a **frente** (o x onde o limpo vira morto, `AmazoniaRio.ts`) e o
 * **tempo** — que os shaders leem. Nada é calculado por quadro além deles: a água, o chão, a folhagem e a lagoa mudam de cor **na GPU**.
 *
 * A regra do GLSL é a de `AmazoniaRio.limpezaDoRio` (a mesma curva suave); sem \`pow\`/\`sqrt\` sem guarda (\`ShadersSemNaN.test.ts\`).
 */

/** Os uniformes que o mapa inteiro divide. */
export interface UniformesDaAmazonia {
  tempo: { value: number };
  /** A frente do rio (x): a montante é limpo, a jusante é morto. */
  frente: { value: number };
  banda: { value: number };
}

export function criarUniformes(): UniformesDaAmazonia {
  return { tempo: { value: 0 }, frente: { value: AMAZONIA_DRAGA_INICIO_X }, banda: { value: BANDA_DA_FRENTE } };
}

/** A função do GLSL: 1 limpo, 0 morto, a mesma curva de \`limpezaDoRio\` em JS. */
export const GLSL_LIMPEZA = /* glsl */ `
uniform float uFrente;
uniform float uBanda;
float limpezaDoRio(float x) {
  float t = clamp((x - (uFrente - uBanda)) / (2.0 * uBanda), 0.0, 1.0);
  return 1.0 - t * t * (3.0 - 2.0 * t);
}
`;

/**
 * Põe nos shaders de um material padrão (do Three) a **morte pela frente do rio**: o que está a jusante da frente perde a cor e vira cinza-marrom, na proporção de um atributo de
 * **vida** (\`aVida\`: 1 é vegetação, 0 é pedra, concreto e água, que não morrem). \`mundoX\` é o x do mundo do vértice (a malha do mapa já nasce em coordenadas do mundo).
 */
export function patchMorteDoRio(material: THREE.Material, u: UniformesDaAmazonia, intensidade = 0.82): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFrente = u.frente;
    shader.uniforms.uBanda = u.banda;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aVida;\nvarying float vVida;\nvarying float vMundoX;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvVida = aVida;\nvec4 pMundo = vec4(position, 1.0);\n#ifdef USE_INSTANCING\npMundo = instanceMatrix * pMundo;\n#endif\nvMundoX = (modelMatrix * pMundo).x;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vVida;\nvarying float vMundoX;\n${GLSL_LIMPEZA}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float morte = (1.0 - limpezaDoRio(vMundoX)) * clamp(vVida, 0.0, 1.0);
float luma = dot(diffuseColor.rgb, vec3(0.33));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.27, 0.19) * (0.55 + 0.9 * luma), morte * ${intensidade.toFixed(2)});`,
      );
  };
  material.customProgramCacheKey = () => `amazonia-morte-${intensidade.toFixed(2)}`;
}

/** O terreno: cor por vértice (zona, altura, lama, laterita) e a morte pela frente do rio. */
export function materialDoTerreno(u: UniformesDaAmazonia): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  patchMorteDoRio(m, u);
  return m;
}

/** A folhagem e o tronco (cor por vértice), com a morte pela frente do rio: a copa seca a jusante. */
export function materialDaFloresta(u: UniformesDaAmazonia): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });
  patchMorteDoRio(m, u, 0.92);
  return m;
}

/** As estruturas (aldeia, planta, torres): cor por vértice, um pouco de brilho de metal; a palha da aldeia seca com a frente do rio. */
export function materialDoCenario(u: UniformesDaAmazonia): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.25 });
  patchMorteDoRio(m, u, 0.7);
  return m;
}

const VERTEX_AGUA = /* glsl */ `
uniform float uTempo;
varying vec3 vMundo;
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vec3 p = position;
  p.y += 0.12 * sin(p.x * 0.09 + uTempo * 0.9) * sin(p.z * 0.11 + uTempo * 0.7);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vMundo = wp.xyz;
  vUv = uv;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENTO_AGUA = /* glsl */ `
uniform float uTempo;
varying vec3 vMundo;
varying vec2 vUv;
${GLSL_LIMPEZA}
#include <fog_pars_fragment>
void main() {
  float limpo = limpezaDoRio(vMundo.x);
  // a correnteza desloca o desenho rio abaixo (+x)
  vec2 c = vec2(vMundo.x - uTempo * 2.2, vMundo.z);
  float onda = 0.5 + 0.5 * sin(c.x * 0.35 + sin(c.y * 0.21) * 2.0) * sin(c.y * 0.17 + c.x * 0.05);
  // a água viva: verde-azulada, funda e clara
  vec3 viva = mix(vec3(0.04, 0.30, 0.27), vec3(0.18, 0.58, 0.52), onda * 0.55);
  // a água morta: marrom e preta, com faixas de óleo iridescente
  vec3 morta = mix(vec3(0.07, 0.05, 0.04), vec3(0.20, 0.14, 0.08), onda * 0.45);
  float faixa = 0.5 + 0.5 * sin(c.x * 0.11 + c.y * 0.07 + sin(c.x * 0.05) * 3.0);
  vec3 oleo = 0.5 + 0.5 * cos(6.2831 * (faixa + vec3(0.0, 0.33, 0.67)));
  float mancha = smoothstep(0.35, 0.8, 0.5 + 0.5 * sin(c.x * 0.045 + sin(c.y * 0.06) * 2.5));
  morta += oleo * 0.13 * mancha;
  vec3 cor = mix(morta, viva, limpo);
  // espuma nas margens (v vai de 0 a 1 de uma margem à outra): branca e leve na água viva, suja e escura na morta
  float borda = smoothstep(0.80, 1.0, abs(vUv.y - 0.5) * 2.0);
  float espuma = clamp(borda * (0.55 + 0.45 * sin(c.x * 0.8 + uTempo * 3.0)), 0.0, 1.0);
  cor = mix(cor, mix(vec3(0.50, 0.44, 0.34), vec3(0.88, 0.95, 0.93), limpo), espuma * 0.65);
  gl_FragColor = vec4(cor, mix(0.95, 0.86, limpo));
  #include <fog_fragment>
}
`;

/**
 * Os uniformes de um shader próprio: os da névoa (clonados) e os do mapa **como o mesmo objeto**. `UniformsUtils.merge` copia o VALOR (cada uniforme vira um objeto novo), e a água ficaria
 * para sempre com o tempo e a frente do instante da montagem: por isso os do mapa entram depois, por referência (o teste `Amazonia.test.ts` trava).
 */
function uniformesDoShader(compartilhados: Record<string, { value: number }>): Record<string, THREE.IUniform> {
  return { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...compartilhados };
}

/** A água do rio: um shader que lê a frente e o tempo. Transparente (um pouco), com a névoa da cena. */
export function materialDaAgua(u: UniformesDaAmazonia): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: uniformesDoShader({ uTempo: u.tempo, uFrente: u.frente, uBanda: u.banda }),
    vertexShader: VERTEX_AGUA,
    fragmentShader: FRAGMENTO_AGUA,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
}

const FRAGMENTO_REJEITOS = /* glsl */ `
uniform float uTempo;
varying vec3 vMundo;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  // a lagoa de rejeitos: sempre morta (preta, com óleo e uma película que gira devagar)
  vec2 c = vMundo.xz * 0.05 + vec2(uTempo * 0.01, -uTempo * 0.008);
  float faixa = 0.5 + 0.5 * sin(c.x * 9.0 + sin(c.y * 7.0) * 3.0);
  vec3 oleo = 0.5 + 0.5 * cos(6.2831 * (faixa + vec3(0.0, 0.33, 0.67)));
  float mancha = smoothstep(0.3, 0.85, 0.5 + 0.5 * sin(c.x * 5.0 + c.y * 4.0 + sin(c.x * 2.0) * 2.0));
  vec3 cor = vec3(0.045, 0.035, 0.03) + oleo * 0.12 * mancha + vec3(0.12, 0.08, 0.03) * (1.0 - mancha) * 0.35;
  gl_FragColor = vec4(cor, 0.96);
  #include <fog_fragment>
}
`;

/** A água da lagoa de rejeitos (a mesma malha de água, sem a frente: nunca é limpa). */
export function materialDosRejeitos(u: UniformesDaAmazonia): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: uniformesDoShader({ uTempo: u.tempo }),
    vertexShader: VERTEX_AGUA,
    fragmentShader: FRAGMENTO_REJEITOS,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
}

/** O céu: um domo de gradiente (horizonte de neblina quente, zênite azul) com o brilho do sol; sem textura, sem DOM. */
export function materialDoCeu(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uSol: { value: new THREE.Vector3(0.45, 0.62, -0.64).normalize() } },
    vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uSol;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 horizonte = vec3(0.78, 0.85, 0.78);
  vec3 alto = vec3(0.22, 0.46, 0.74);
  vec3 cor = mix(horizonte, alto, smoothstep(0.0, 0.55, h));
  float sol = clamp(dot(normalize(vDir), normalize(uSol)), 0.0, 1.0);
  cor += vec3(1.0, 0.92, 0.7) * (0.35 * smoothstep(0.92, 0.995, sol) + 0.9 * smoothstep(0.9993, 1.0, sol));
  gl_FragColor = vec4(cor, 1.0);
}`,
  });
}
