import * as THREE from 'three';
import { anuncioPorId, type Anuncio, type IdDoAnuncio } from '../brand/anuncios';

/**
 * OS OUTDOORS DA MARCA (P266, ordem do Comandante de 28/10): painéis de LED verticais (1:2) nas fachadas, que mostram os anúncios do catálogo (`brand/anuncios.ts`). Este módulo é de
 * **qualquer mapa** (não conhece a Cidade Neon): recebe uma lista de lugares (`OutdoorDaCena`) e devolve as malhas. A Cidade Neon o usa agora; a Estação dos Cabos o usará depois, com
 * menos outdoors ("em menos frequência", ordem do Comandante), só passando outra lista.
 *
 * **Como desenha (G4/G5/G12):** uma `InstancedMesh` por anúncio (7 chamadas de desenho para todos os outdoors) e mais uma para o brilho de todos. Tudo é conta de shader sobre um relógio
 * (uniforme): o LED (grade de pontos, que de longe vira a média, sem moiré), a varredura clara que desce, o defeito de sinal raro e, no outdoor que **alterna**, a troca de slide com
 * falha de sinal. Nada de CPU por quadro. As imagens baixam em segundo plano (nunca seguram a abertura do jogo) e entram em fade quando chegam; antes disso o painel fica apagado.
 * O **brilho** é um quadro aditivo atrás de cada outdoor, na cor do anúncio: ilumina a fachada em volta, como um telão de verdade (sem luz dinâmica: nenhum `PointLight`).
 *
 * **Memória:** cada imagem é 512×1024 (2 MB na GPU, ~2,7 com mipmaps): os 10 arquivos do catálogo somam ~27 MB de memória de vídeo, mas só ~0,47 MB de download.
 */

/** Onde um outdoor fica: o centro do painel, a rotação em Y (o plano nasce olhando para +z), o tamanho (m) e o anúncio. */
export interface OutdoorDaCena {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ry: number;
  readonly w: number;
  readonly h: number;
  readonly anuncio: IdDoAnuncio;
  /** Deslocamento do tempo (s): os que alternam não trocam todos juntos, e o defeito de sinal não cai em coro. */
  readonly fase: number;
}

/** O relógio e a luz que o mapa divide com os outros materiais dele (o mesmo objeto, não uma cópia): a luz escurece com a energia (o transformador do banco). */
export interface UniformesDeCena {
  readonly tempo: { value: number };
  readonly luz: { value: THREE.Color };
}

export interface OutdoorsCriados {
  readonly grupo: THREE.Group;
  /** Uma malha por anúncio que aparece na lista. */
  readonly malhas: ReadonlyMap<IdDoAnuncio, THREE.InstancedMesh>;
  /** O brilho de todos os outdoors numa malha só. */
  readonly brilho: THREE.InstancedMesh | null;
  /** A qualidade (G12): sem detalhe, tira a grade de LED e o brilho. */
  setDetalhe(alto: boolean): void;
}

/** Quanto o brilho passa da borda do painel, em fração da largura. */
const MARGEM_DO_BRILHO = 0.34;
/** O quanto o painel fica na frente do brilho (m): o brilho está colado à parede, o painel um pouco à frente. */
const AFASTAMENTO_DO_BRILHO = 0.14;

const VERTEX_PAINEL = /* glsl */ `
attribute float aFase;
varying vec2 vUv;
varying vec3 vMundo;
flat varying float vFase;
void main() {
  vUv = uv;
  vFase = aFase;
  vec4 mundo = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vMundo = mundo.xyz;
  gl_Position = projectionMatrix * viewMatrix * mundo;
}
`;

const FRAGMENT_PAINEL = /* glsl */ `
uniform sampler2D uImagem0;
uniform sampler2D uImagem1;
uniform sampler2D uImagem2;
uniform sampler2D uImagem3;
uniform float uTempo;
uniform float uSlides;
uniform float uPeriodo;
uniform float uMostrar;
uniform float uDetalhe;
uniform vec3 uLuz;
uniform vec3 fogColor;
uniform float fogDensity;
varying vec2 vUv;
varying vec3 vMundo;
flat varying float vFase;

float hashT(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

vec3 slide(float i, vec2 uv) {
  if (i < 0.5) return texture2D(uImagem0, uv).rgb;
  if (i < 1.5) return texture2D(uImagem1, uv).rgb;
  if (i < 2.5) return texture2D(uImagem2, uv).rgb;
  return texture2D(uImagem3, uv).rgb;
}

void main() {
  float t = uTempo + vFase;
  float ciclo = t / uPeriodo;
  float k = floor(ciclo);
  float f = fract(ciclo);
  float varios = step(1.5, uSlides);
  float i0 = mod(k, uSlides);
  float i1 = mod(k + 1.0, uSlides);
  // A troca de slide (só de quem alterna): nos últimos 14% do slide, a imagem seguinte entra com falha de sinal. De vez em quando (uma vez a cada ~35 s) até o que é fixo falha um instante.
  float mistura = smoothstep(0.86, 1.0, f) * varios;
  float falha = mistura * (1.0 - mistura) * 4.0 + step(0.993, hashT(floor(t * 4.0) + vFase * 13.0)) * 0.6;
  vec2 uv = vUv;
  float faixa = floor(uv.y * 36.0);
  uv.x += (hashT(faixa + k * 7.0 + floor(t * 24.0)) - 0.5) * 0.09 * falha;
  // A segunda imagem só é lida durante a troca (e só de quem alterna): o resto do tempo é uma leitura de textura por pixel, não duas. O desvio é coerente (só o relógio e a fase da instância o decidem).
  vec3 img = slide(i0, uv);
  if (mistura > 0.001) img = mix(img, slide(i1, uv), mistura);
  img *= 1.0 - 0.7 * falha * step(0.55, hashT(faixa * 1.7 + k));

  // O LED: uma grade de pontos (72 × 144); de longe a grade vira a média (a pegada do pixel passa do ponto), sem moiré. A varredura clara desce devagar.
  vec2 leds = vec2(72.0, 144.0);
  vec2 g = abs(fract(vUv * leds) - 0.5);
  float led = 1.0 - smoothstep(0.3, 0.48, max(g.x, g.y));
  float pegada = max(fwidth(vUv.x * leds.x), fwidth(vUv.y * leds.y));
  float grade = mix(mix(0.55, 1.1, led), 0.88, smoothstep(0.25, 0.7, pegada));
  float d = fract(vUv.y + t * 0.06) - 0.5;
  float varre = 1.0 + 0.16 * exp(-d * d * 220.0);

  // A imagem chegou há quanto tempo: entra em fade (uMostrar < 0 = ainda não chegou: o painel fica apagado).
  float mostrar = uMostrar < 0.0 ? 0.0 : smoothstep(0.0, 1.2, uTempo - uMostrar);
  vec3 luz = img * 1.3 * mix(1.0, grade * varre, uDetalhe) * mostrar + vec3(0.012, 0.02, 0.03);
  float dist = length(vMundo - cameraPosition);
  float nevoa = 1.0 - exp(-fogDensity * fogDensity * dist * dist * 0.55);
  gl_FragColor = vec4(luz * uLuz * (1.0 - 0.55 * nevoa) + fogColor * nevoa * 0.35, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const VERTEX_BRILHO = /* glsl */ `
attribute vec3 aCor;
attribute vec3 aMedidas;
varying vec2 vUv;
varying vec3 vMundo;
flat varying vec3 vCor;
flat varying vec3 vMedidas;
void main() {
  vUv = uv;
  vCor = aCor;
  vMedidas = aMedidas;
  vec4 mundo = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vMundo = mundo.xyz;
  gl_Position = projectionMatrix * viewMatrix * mundo;
}
`;

/** O brilho em volta do painel (aditivo): a força cai com a distância à borda do painel, em metros, e some na margem. */
const FRAGMENT_BRILHO = /* glsl */ `
uniform vec3 uLuz;
uniform float uTempo;
uniform vec3 fogColor;
uniform float fogDensity;
varying vec2 vUv;
varying vec3 vMundo;
flat varying vec3 vCor;
flat varying vec3 vMedidas;
void main() {
  // vMedidas = (largura do painel, altura do painel, margem), todos em metros; o quadro do brilho tem (largura + 2 margem) × (altura + 2 margem).
  vec2 painel = vMedidas.xy;
  float margem = max(vMedidas.z, 0.001);
  vec2 pm = (vUv - 0.5) * (painel + 2.0 * margem);
  vec2 fora = max(abs(pm) - 0.5 * painel, 0.0);
  float dist = length(fora);
  float forca = exp(-(dist * dist) / (margem * margem * 0.2)) * (1.0 - smoothstep(0.55, 1.0, dist / margem));
  float dist3 = length(vMundo - cameraPosition);
  float nevoa = 1.0 - exp(-fogDensity * fogDensity * dist3 * dist3);
  gl_FragColor = vec4(vCor * forca * 0.5 * uLuz * (1.0 - nevoa), 1.0);
}
`;

/** A textura que o painel mostra enquanto a imagem não chegou (e no Node, onde não há `document` para baixar imagem). */
function texturaDeEspera(): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([3, 5, 8, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Baixa uma imagem do catálogo em segundo plano (nunca trava a abertura). `aoChegar` roda quando ela está pronta; se falhar, o painel só fica apagado. */
function baixar(arquivo: string, aoChegar: () => void): THREE.Texture {
  if (typeof document === 'undefined') return texturaDeEspera();
  const textura = new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}anuncios/${arquivo}`,
    aoChegar,
    undefined,
    () => console.warn(`o anúncio ${arquivo} não baixou; o outdoor fica apagado`),
  );
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  return textura;
}

function materialDoPainel(anuncio: Anuncio, u: UniformesDeCena, detalhe: { value: number }): THREE.ShaderMaterial {
  let faltam = anuncio.arquivos.length;
  const mostrar = { value: -1 };
  const texturas = anuncio.arquivos.map((a) =>
    baixar(a, () => {
      if (--faltam === 0) mostrar.value = u.tempo.value; // todas chegaram: o painel acende em fade
    }),
  );
  if (typeof document === 'undefined') mostrar.value = 0; // no Node não há o que esperar: já "chegou"
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLuz: { value: new THREE.Color() }, uTempo: { value: 0 } }]),
    vertexShader: VERTEX_PAINEL,
    fragmentShader: FRAGMENT_PAINEL,
    fog: true,
  });
  // Por referência depois do merge (ele copia valores): o relógio, a luz e o detalhe são os mesmos objetos de quem os muda.
  material.uniforms.uLuz = u.luz;
  material.uniforms.uTempo = u.tempo;
  material.uniforms.uDetalhe = detalhe;
  material.uniforms.uMostrar = mostrar;
  material.uniforms.uSlides = { value: texturas.length };
  material.uniforms.uPeriodo = { value: anuncio.periodoDoSlide > 0 ? anuncio.periodoDoSlide : 6 };
  // Quem tem uma imagem só repete a mesma nas quatro entradas (o slide é escolhido por índice, fixo em 0).
  for (let i = 0; i < 4; i++) material.uniforms[`uImagem${i}`] = { value: texturas[i] ?? texturas[0]! };
  return material;
}

function materialDoBrilho(u: UniformesDeCena): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLuz: { value: new THREE.Color() }, uTempo: { value: 0 } }]),
    vertexShader: VERTEX_BRILHO,
    fragmentShader: FRAGMENT_BRILHO,
    fog: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  m.uniforms.uLuz = u.luz;
  m.uniforms.uTempo = u.tempo;
  return m;
}

const EIXO_Y = new THREE.Vector3(0, 1, 0);

/** Cria os outdoors da lista. Lista vazia = grupo vazio (um mapa sem outdoor não paga nada). */
export function criarOutdoors(lista: readonly OutdoorDaCena[], u: UniformesDeCena, detalhe: { value: number }): OutdoorsCriados {
  const grupo = new THREE.Group();
  grupo.name = 'cidade-outdoors';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();

  const porAnuncio = new Map<IdDoAnuncio, OutdoorDaCena[]>();
  for (const o of lista) {
    const l = porAnuncio.get(o.anuncio) ?? [];
    l.push(o);
    porAnuncio.set(o.anuncio, l);
  }

  const malhas = new Map<IdDoAnuncio, THREE.InstancedMesh>();
  for (const [id, os] of porAnuncio) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.setAttribute('aFase', new THREE.InstancedBufferAttribute(Float32Array.from(os.map((o) => o.fase)), 1));
    const malha = new THREE.InstancedMesh(geo, materialDoPainel(anuncioPorId(id), u, detalhe), os.length);
    os.forEach((o, i) => malha.setMatrixAt(i, m.compose(p.set(o.x, o.y, o.z), q.setFromAxisAngle(EIXO_Y, o.ry), s.set(o.w, o.h, 1))));
    malha.frustumCulled = false;
    malha.name = `cidade-outdoor-${id}`;
    grupo.add(malha);
    malhas.set(id, malha);
  }

  let brilho: THREE.InstancedMesh | null = null;
  if (lista.length) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const cores = new Float32Array(lista.length * 3);
    const medidas = new Float32Array(lista.length * 3);
    const cor = new THREE.Color();
    lista.forEach((o, i) => {
      cor.setHex(anuncioPorId(o.anuncio).cor);
      cores.set([cor.r, cor.g, cor.b], i * 3);
      medidas.set([o.w, o.h, o.w * MARGEM_DO_BRILHO], i * 3);
    });
    geo.setAttribute('aCor', new THREE.InstancedBufferAttribute(cores, 3));
    geo.setAttribute('aMedidas', new THREE.InstancedBufferAttribute(medidas, 3));
    brilho = new THREE.InstancedMesh(geo, materialDoBrilho(u), lista.length);
    lista.forEach((o, i) => {
      const margem = o.w * MARGEM_DO_BRILHO;
      // Um pouco atrás do painel (rumo à parede): a normal do plano, depois de girar em Y, é (sen ry, 0, cos ry).
      p.set(o.x - Math.sin(o.ry) * AFASTAMENTO_DO_BRILHO, o.y, o.z - Math.cos(o.ry) * AFASTAMENTO_DO_BRILHO);
      brilho!.setMatrixAt(i, m.compose(p, q.setFromAxisAngle(EIXO_Y, o.ry), s.set(o.w + 2 * margem, o.h + 2 * margem, 1)));
    });
    brilho.frustumCulled = false;
    brilho.renderOrder = 1;
    brilho.name = 'cidade-outdoors-brilho';
    grupo.add(brilho);
  }

  return {
    grupo,
    malhas,
    brilho,
    setDetalhe(alto: boolean): void {
      detalhe.value = alto ? 1 : 0;
      if (brilho) brilho.visible = alto;
    },
  };
}

/** Os materiais de cada anúncio (para o teste conferir que dividem o mesmo relógio e a mesma luz do mapa). */
export function materiaisDosOutdoors(o: OutdoorsCriados): THREE.ShaderMaterial[] {
  return [...o.malhas.values()].map((malha) => malha.material as THREE.ShaderMaterial).concat(o.brilho ? [o.brilho.material as THREE.ShaderMaterial] : []);
}

/** Os shaders dos outdoors, como pares (vértice, fragmento): o teste confere a interface entre eles (`CidadeNeonShaders.test.ts`). */
export const GLSL_OUTDOORS = {
  painel: { vertex: VERTEX_PAINEL, fragment: FRAGMENT_PAINEL },
  brilho: { vertex: VERTEX_BRILHO, fragment: FRAGMENT_BRILHO },
} as const;
