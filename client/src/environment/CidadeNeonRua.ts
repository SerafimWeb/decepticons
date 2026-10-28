import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../core/palette';
import { SHAPE, type BurstOptions, type ParticleSystem } from '../fx/ParticleSystem';
import { ALTURA_DO_POSTE, BRACO_DO_POSTE, RUA, type BueiroDaRua, type PosteDaRua } from './CidadeNeonLayout';
import type { UniformesDaCidade } from './CidadeNeonTorres';

/**
 * A RUA DA CIDADE NEON (P264, PR2). O Comandante achou os postes da PR1 "meio frágeis" e sem sentido "nesse quadriculado": "só se tiver o desenho
 * das ruas". Então o chão deixa de ser a grade Tron e vira **rua desenhada**, e o poste vira **poste de rua**:
 *
 *  - **O piso** é o mesmo plano de antes com outro material: o desenho inteiro sai do shader, pela posição no mundo (sem textura, nítido de perto
 *    e de longe): o **calçadão** de lajotas no meio, a **calçada** com o **meio-fio**, a **avenida** em anel junto da parede (asfalto, faixa
 *    branca tracejada, faixa dupla amarela, as **faixas de pedestre**) e as **poças** — mais escuras e mais lisas (o reflexo dos telões nasce
 *    mais forte nelas, `CidadeNeonReflexos.ts`, que usa a mesma conta).
 *  - **Os postes** têm a escala dos Mechs (10 m, coluna grossa, braço sobre a avenida, cabeça com a luz embaixo e uma faixa de neon na coluna),
 *    alinhados na calçada. Uns poucos têm defeito: piscam e falham. O piscar é conta do shader (zero CPU por quadro).
 *  - **Os bueiros**: tampas na avenida e grelhas junto das fachadas, soltando vapor do underground pelo `ParticleSystem` que já existe.
 *
 * **Custo:** o piso troca um material por outro do mesmo tipo (umas contas a mais por pixel do chão, menos a textura que ele lia); postes,
 * luzes e tampas são 4 draw calls instanciados; o vapor, 14 relógios por quadro (nenhuma alocação).
 */

/** As poças, em GLSL: o piso e o reflexo usam a mesma conta (a poça é mais escura no chão e reflete mais). */
export const POCA_GLSL = /* glsl */ `
float pocaDaRua(vec2 p) {
  float n = sin(p.x * 0.11 + sin(p.y * 0.07) * 2.0) * sin(p.y * 0.13 + sin(p.x * 0.05) * 1.7)
          + 0.5 * sin(p.x * 0.31 + p.y * 0.23) * sin(p.y * 0.29 - p.x * 0.17);
  return smoothstep(0.42, 0.78, n);
}
`;

const n = (v: number): string => v.toFixed(3);

const PISO_DECLARACOES = /* glsl */ `
varying vec3 vPosRua;
float hashRua(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float linhaRua(float x, float c, float meia, float aa) { return 1.0 - smoothstep(meia, meia + aa, abs(x - c)); }
float juntaRua(vec2 p, float lado, float aa) {
  vec2 d = abs(fract(p / lado) - 0.5) * lado;
  return smoothstep(lado * 0.5 - 0.06 - aa, lado * 0.5 - 0.06, max(d.x, d.y));
}
${POCA_GLSL}
`;

/** O centro da avenida, e as linhas que ela leva: as bordas brancas, o tracejado das pistas (a 3 m do centro) e a faixa dupla amarela. Tudo derivado de `RUA`. */
const CENTRO_DA_AVENIDA = (RUA.meioFio + RUA.borda) / 2;

/**
 * O desenho do piso: entra depois do `map_fragment` (a cor) e deixa `rugosidadeDaRua` e `pinturaDaRua` para os trechos de baixo. **Dois ramos:** o calçadão (onde se joga e
 * onde a câmera passa quase o tempo todo) só tem lajota e junta; a calçada, o meio-fio e a avenida (faixas, zebra, grão) só são calculados onde existem. O corte fica 0,5 m
 * para dentro do início da calçada, para o desbotado entre as duas não ser cortado (as cores dos dois trechos são quase iguais: nenhuma emenda aparece).
 */
const PISO_COR = /* glsl */ `
vec2 pr = vPosRua.xz;
float mq = max(abs(pr.x), abs(pr.y));
float aaP = max(max(fwidth(pr.x), fwidth(pr.y)), 0.003);
float aaR = max(fwidth(mq), 0.003);
vec3 corRua;
float rugosidadeDaRua = 0.72;
float pinturaDaRua = 0.0;
// O calçadão: lajotas de 3 m, cada uma num tom; um anel mais escuro desenha o meio da praça.
float laje = 0.8 + 0.32 * hashRua(floor(pr / 3.0));
corRua = vec3(0.014, 0.017, 0.02) * laje * (1.0 - 0.5 * juntaRua(pr, 3.0, aaP));
corRua *= 1.0 - 0.32 * linhaRua(length(pr), 22.5, 1.1, aaP);
if (mq > ${n(RUA.calcadao - 0.5)}) {
  float lateral = step(abs(pr.y), abs(pr.x));
  float sr = mix(pr.x, pr.y, lateral);
  float naRua = smoothstep(${n(RUA.meioFio)} - aaR, ${n(RUA.meioFio)} + aaR, mq) * (1.0 - smoothstep(${n(RUA.borda)} - aaR, ${n(RUA.borda)} + aaR, mq));
  float meioFio = linhaRua(mq, ${n(RUA.meioFio - 0.2)}, 0.2, aaR);
  float calcada = smoothstep(${n(RUA.calcadao)} - aaR, ${n(RUA.calcadao)} + aaR, mq) * (1.0 - naRua);
  // A calçada (a da praça e a das fachadas, além da parede): ladrilhos de 1,2 m, um pouco mais claros.
  vec3 corCalcada = vec3(0.018, 0.02, 0.022) * (0.86 + 0.2 * hashRua(floor(pr / 1.2))) * (1.0 - 0.45 * juntaRua(pr, 1.2, aaP));
  float fora = smoothstep(${n(RUA.borda)} - aaR, ${n(RUA.borda)} + aaR, mq);
  corRua = mix(corRua, corCalcada, max(calcada, fora));
  corRua = mix(corRua, vec3(0.04, 0.04, 0.038), meioFio);
  // A avenida: asfalto com grão (que some de longe, sem chuvisco), as bordas e o tracejado brancos, a faixa dupla amarela e as faixas de pedestre.
  float grao = mix(0.86 + 0.28 * hashRua(floor(pr * 2.0)), 1.0, smoothstep(0.08, 0.3, aaP));
  vec3 asfalto = vec3(0.006, 0.0068, 0.008) * grao;
  float tracejado = step(fract(sr / 9.0), 0.34);
  float branca = max(linhaRua(mq, ${n(RUA.meioFio + 0.45)}, 0.1, aaR), linhaRua(mq, ${n(RUA.borda - 0.45)}, 0.1, aaR));
  branca = max(branca, (linhaRua(mq, ${n(CENTRO_DA_AVENIDA - 3)}, 0.08, aaR) + linhaRua(mq, ${n(CENTRO_DA_AVENIDA + 3)}, 0.08, aaR)) * tracejado);
  float amarela = linhaRua(mq, ${n(CENTRO_DA_AVENIDA - 0.18)}, 0.08, aaR) + linhaRua(mq, ${n(CENTRO_DA_AVENIDA + 0.18)}, 0.08, aaR);
  float faixaDeLado = mix(${n(RUA.faixaDeLado)}, ${n(-RUA.faixaDeLado)}, lateral);
  float naFaixa = max(linhaRua(sr, ${n(RUA.faixaDoMeio)}, ${n(RUA.meiaFaixa)}, aaP), linhaRua(sr, faixaDeLado, ${n(RUA.meiaFaixa)}, aaP));
  float esquina = step(${n(RUA.meioFio)}, min(abs(pr.x), abs(pr.y)));
  float faixaAqui = naFaixa * (1.0 - esquina);
  float zebra = faixaAqui * step(0.5, fract((mq - ${n(RUA.meioFio)}) / 1.0)) * step(${n(RUA.meioFio + 0.6)}, mq) * step(mq, ${n(RUA.borda - 0.6)});
  branca = max(branca * (1.0 - faixaAqui), zebra);
  vec3 pista = mix(asfalto, vec3(0.075, 0.075, 0.07), branca);
  pista = mix(pista, vec3(0.08, 0.055, 0.008), amarela * (1.0 - faixaAqui));
  corRua = mix(corRua, pista, naRua);
  pinturaDaRua = naRua * max(branca, amarela);
  rugosidadeDaRua = mix(0.72, 0.5, naRua);
}
// As poças: mais escuras e mais lisas (a rua inteira está molhada; a poça é onde a água junta).
float poca = pocaDaRua(pr);
corRua *= mix(1.0, 0.5, poca);
rugosidadeDaRua = mix(rugosidadeDaRua, 0.4, poca);
diffuseColor.rgb = corRua;
`;

/**
 * Um material de piso que desenha a rua: o mesmo tipo do de antes (a luz da cena o ilumina igual). **Dielétrico** (metal 0: pedra, asfalto e água não são metal) e a poça com
 * rugosidade 0,4, não um espelho: com 0,1 ela refletia a luz principal e o mapa de ambiente num borrão branco do tamanho da tela, em ângulo rasante. O brilho de chão molhado
 * vem do rastro dos telões (`CidadeNeonReflexos.ts`), que não depende da luz da cena.
 */
export function materialDaRua(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.6 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosRua;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosRua = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PISO_DECLARACOES}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${PISO_COR}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rugosidadeDaRua;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.012, 0.012, 0.011) * pinturaDaRua;');
  };
  m.customProgramCacheKey = () => 'cybermech-rua-v1';
  return m;
}

// ---------------------------------------------------------------- os postes

const PISCAR_DO_POSTE_GLSL = /* glsl */ `
float brilhoDoPoste(float t, float fase, float defeito) {
  float respira = 0.9 + 0.1 * sin(t * 2.1 + fase);
  float batimento = sin(t * 11.3 + fase * 3.1) * sin(t * 3.7 + fase * 1.7);
  float falha = batimento > 0.9 ? 0.06 : (batimento > 0.72 ? 0.42 : 1.0);
  return respira * mix(1.0, falha, defeito);
}
`;
/** O piscar do poste: a luz, o reflexo e a poça de luz usam a mesma conta (piscam juntos). */
export { PISCAR_DO_POSTE_GLSL };

/** A estrutura do poste, em coordenadas locais (o braço aponta para +z): base, coluna, braço e a caixa da cabeça. */
function geometriaDoPoste(): THREE.BufferGeometry {
  const pecas = [
    new THREE.BoxGeometry(0.9, 0.6, 0.9).translate(0, 0.3, 0),
    new THREE.BoxGeometry(0.38, ALTURA_DO_POSTE + 0.2, 0.38).translate(0, (ALTURA_DO_POSTE + 0.2) / 2, 0),
    new THREE.BoxGeometry(0.24, 0.24, BRACO_DO_POSTE + 0.6).translate(0, ALTURA_DO_POSTE + 0.1, (BRACO_DO_POSTE + 0.6) / 2 - 0.2),
    new THREE.BoxGeometry(0.95, 0.34, 2.0).translate(0, ALTURA_DO_POSTE - 0.1, BRACO_DO_POSTE),
  ];
  return mergeGeometries(pecas, false);
}

/**
 * As partes que acendem: a lente da cabeça (parte 0) — uma faixa um pouco maior que a caixa, embaixo dela, para a luz ler também de lado e
 * de longe, não só de quem passa por baixo — e a faixa de neon na coluna, do lado da avenida (parte 1).
 */
function geometriaDaLuz(): THREE.BufferGeometry {
  const painel = new THREE.BoxGeometry(1.0, 0.14, 2.06).translate(0, ALTURA_DO_POSTE - 0.29, BRACO_DO_POSTE);
  const faixa = new THREE.BoxGeometry(0.07, 6.4, 0.07).translate(0, 5.4, 0.21);
  const parte = (g: THREE.BufferGeometry, v: number): THREE.BufferGeometry => {
    g.setAttribute('aParte', new THREE.Float32BufferAttribute(new Array<number>(g.getAttribute('position').count).fill(v), 1));
    return g;
  };
  return mergeGeometries([parte(painel, 0), parte(faixa, 1)], false);
}

const VERTEX_LUZ = /* glsl */ `
attribute float aParte;
attribute vec3 aCorLuz;
attribute vec3 aCorFaixa;
attribute vec2 aFase;
uniform float uTempo;
varying vec3 vCor;
varying vec3 vMundo;
${PISCAR_DO_POSTE_GLSL}
void main() {
  float b = brilhoDoPoste(uTempo, aFase.x, aFase.y);
  vCor = mix(aCorLuz * 3.2 * b, aCorFaixa * 2.4, aParte);
  vec4 mundo = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vMundo = mundo.xyz;
  gl_Position = projectionMatrix * viewMatrix * mundo;
}
`;

const FRAGMENT_LUZ = /* glsl */ `
uniform vec3 uLuz;
uniform vec3 fogColor;
uniform float fogDensity;
varying vec3 vCor;
varying vec3 vMundo;
void main() {
  float d = length(vMundo - cameraPosition);
  float f = 1.0 - exp(-fogDensity * fogDensity * d * d * 0.55);
  gl_FragColor = vec4(vCor * uLuz * (1.0 - 0.55 * f), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function criarPostes(postes: readonly PosteDaRua[], u: UniformesDaCidade): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'cidade-postes';
  const estrutura = new THREE.InstancedMesh(geometriaDoPoste(), new THREE.MeshStandardMaterial({ color: 0x1b2026, metalness: 0.6, roughness: 0.45 }), postes.length);
  const geoLuz = geometriaDaLuz();
  const corLuz = new Float32Array(postes.length * 3);
  const corFaixa = new Float32Array(postes.length * 3);
  const fase = new Float32Array(postes.length * 2);
  const c = new THREE.Color();
  postes.forEach((p, i) => {
    c.setHex(p.corLuz);
    corLuz.set([c.r, c.g, c.b], i * 3);
    c.setHex(p.corFaixa);
    corFaixa.set([c.r, c.g, c.b], i * 3);
    fase.set([p.fase, p.defeito ? 1 : 0], i * 2);
  });
  geoLuz.setAttribute('aCorLuz', new THREE.InstancedBufferAttribute(corLuz, 3));
  geoLuz.setAttribute('aCorFaixa', new THREE.InstancedBufferAttribute(corFaixa, 3));
  geoLuz.setAttribute('aFase', new THREE.InstancedBufferAttribute(fase, 2));
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLuz: { value: new THREE.Color() }, uTempo: { value: 0 } }]),
    vertexShader: VERTEX_LUZ,
    fragmentShader: FRAGMENT_LUZ,
    fog: true,
  });
  material.uniforms.uLuz = u.luz;
  material.uniforms.uTempo = u.tempo;
  const luz = new THREE.InstancedMesh(geoLuz, material, postes.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const um = new THREE.Vector3(1, 1, 1);
  const eixo = new THREE.Vector3(0, 1, 0);
  postes.forEach((p, i) => {
    m.compose(pos.set(p.x, 0, p.z), q.setFromAxisAngle(eixo, p.ry), um);
    estrutura.setMatrixAt(i, m);
    luz.setMatrixAt(i, m);
  });
  estrutura.frustumCulled = luz.frustumCulled = false;
  grupo.add(estrutura, luz);
  return grupo;
}

// ---------------------------------------------------------------- os bueiros

/** O vapor do underground: lento, largo e duradouro (lê como respiro da cidade, não como fumaça de combate). */
const VAPOR: BurstOptions = {
  count: 3,
  // Um pouco puxado para o turquesa da névoa, e fraco: perto da câmera, uma baforada branca vira uma mancha na tela.
  color: new THREE.Color(0.78, 0.92, 0.96).multiplyScalar(0.12),
  speed: 1.5,
  life: 4.2,
  size: 2.6,
  expansion: 1.9,
  spread: 0.24,
  gravity: -0.7,
  shape: SHAPE.puff,
};
const PARA_CIMA = new THREE.Vector3(0, 1, 0);

export class BueirosDaRua {
  private readonly relogios: Float32Array;
  private readonly posicoes: THREE.Vector3[];

  constructor(
    scene: THREE.Scene,
    private readonly bueiros: readonly BueiroDaRua[],
    private readonly particles: ParticleSystem | null,
  ) {
    const tampas = bueiros.filter((b) => !b.grelha);
    const grelhas = bueiros.filter((b) => b.grelha);
    const ferro = new THREE.MeshStandardMaterial({ color: 0x07080a, metalness: 0.7, roughness: 0.4 });
    const tampa = new THREE.InstancedMesh(new THREE.CircleGeometry(0.78, 20).rotateX(-Math.PI / 2), ferro, tampas.length);
    const aro = new THREE.InstancedMesh(new THREE.RingGeometry(0.78, 0.9, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.sodium).multiplyScalar(0.9) }), tampas.length);
    const grade = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.2, 1.1).rotateX(-Math.PI / 2), ferro, Math.max(1, grelhas.length));
    grade.count = grelhas.length;
    const m = new THREE.Matrix4();
    tampas.forEach((b, i) => {
      tampa.setMatrixAt(i, m.makeTranslation(b.x, 0.04, b.z));
      aro.setMatrixAt(i, m.makeTranslation(b.x, 0.045, b.z));
    });
    grelhas.forEach((b, i) => grade.setMatrixAt(i, m.makeTranslation(b.x, 0.04, b.z)));
    scene.add(tampa, aro, grade);
    this.posicoes = bueiros.map((b) => new THREE.Vector3(b.x, 0.15, b.z));
    // Cada um começa num ponto do ciclo: não respiram juntos.
    this.relogios = new Float32Array(bueiros.map((b, i) => (i * 0.37) % b.periodo));
  }

  /** Por quadro: o relógio de cada bueiro; quando vence, uma baforada (nada aloca). */
  update(dt: number): void {
    if (!this.particles) return;
    for (let i = 0; i < this.bueiros.length; i++) {
      const r = this.relogios[i]! - dt;
      if (r > 0) {
        this.relogios[i] = r;
        continue;
      }
      this.relogios[i] = r + this.bueiros[i]!.periodo;
      this.particles.burst(this.posicoes[i]!, PARA_CIMA, VAPOR);
    }
  }
}

/** O shader da luz dos postes (par vértice/fragmento) e o trecho do piso, para o teste (`CidadeNeonShaders.test.ts`). */
export const GLSL_RUA = { luz: { vertex: VERTEX_LUZ, fragment: FRAGMENT_LUZ }, piso: PISO_COR } as const;
