import * as THREE from 'three';
import { SLIDE_DA_LOGO, SLIDES, SLIDES_QUE_ALTERNAM, type IdDoAnuncio } from '../brand/anuncios';
import { PARAMETROS_PADRAO, type ParametrosDeOutdoors } from '../../../shared/outdoors';

/**
 * OS OUTDOORS DA MARCA (P266, 28/10; P267, 28/10): painéis de LED verticais (1:2) nas fachadas, que mostram as imagens do catálogo (`brand/anuncios.ts`). Este módulo é de **qualquer mapa** (não conhece a
 * Cidade Neon): recebe uma lista de lugares (`OutdoorDaCena`) e devolve as malhas. A Cidade Neon o usa agora; a Estação dos Cabos o usará depois, com menos outdoors ("em menos frequência", ordem do
 * Comandante), só passando outra lista.
 *
 * **Cada outdoor alterna** (P267: "trocar elas a cada 10 ou 15 segundos, pra ficar mais dinâmico"): todos andam num mesmo **anel** com as imagens que entram na troca; cada um começa num ponto do anel e
 * a cada período passa para a imagem seguinte, com falha de sinal na troca. A logo plana é fixa. O Comandante ajusta, pelo painel OUTDOORS, **quantos aparecem** (os maiores ficam por último a sair, e a
 * logo é sempre a última), **o período** e **quais anúncios entram no anel** — `aplicar()` recebe os três.
 *
 * **Como desenha (G4/G5/G12):** **uma `InstancedMesh` para todos os painéis** e mais uma para o brilho. Tudo é conta de shader sobre um relógio (uniforme): qual imagem está no ar, o LED (grade de pontos,
 * que de longe vira a média, sem moiré), a varredura clara que desce e o defeito de sinal. Nada de CPU por quadro; mudar a configuração mexe em uns poucos uniformes e num atributo de 40 números. As imagens
 * baixam em segundo plano (nunca seguram a abertura do jogo) e entram em fade quando chegam; antes disso o painel fica apagado. O **brilho** é um quadro aditivo atrás de cada outdoor, **na cor da imagem
 * de agora** (sem luz dinâmica: nenhum `PointLight`).
 *
 * **Memória:** cada imagem é 512×1024 (2 MB na GPU, ~2,7 com mipmaps): as 10 imagens somam ~27 MB de memória de vídeo, mas só ~0,47 MB de download. O shader lê uma textura por vez
 * (só na troca lê duas); 10 amostradores, dentro dos 16 que todo WebGL2 garante.
 */

/** Onde um outdoor fica: o centro do painel, a rotação em Y (o plano nasce olhando para +z), o tamanho (m) e o anúncio. */
export interface OutdoorDaCena {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ry: number;
  readonly w: number;
  readonly h: number;
  /** O anúncio com que começa; `logo` é fixo (não entra na troca), todos os outros alternam. */
  readonly anuncio: IdDoAnuncio;
  /** Onde começa no anel da troca: o índice da imagem (entre as que alternam). Ignorado na logo. */
  readonly inicio: number;
  /** O deslocamento do tempo, em fração do período (0 a 1): os outdoors não trocam todos juntos, e o defeito de sinal não cai em coro. */
  readonly fase: number;
}

/** O relógio e a luz que o mapa divide com os outros materiais dele (o mesmo objeto, não uma cópia): a luz escurece com a energia (o transformador do banco). */
export interface UniformesDeCena {
  readonly tempo: { value: number };
  readonly luz: { value: THREE.Color };
}

/**
 * O que os shaders dos outdoors (e o reflexo no chão, `CidadeNeonReflexos.ts`) leem para saber qual imagem está no ar: o anel da troca, o período, a cor de cada imagem e quando cada uma chegou. Os
 * mesmos objetos entram em todos os materiais (por referência, depois do `merge` dos uniformes, que copia valores): mudar um muda todos.
 */
export interface UniformesDosAnuncios {
  /** O anel: os índices das imagens que entram na troca, na ordem (o resto até `SLIDES.length` é enchimento). */
  readonly ciclo: { value: number[] };
  readonly cicloN: { value: number };
  /** De quanto em quanto tempo cada outdoor troca de imagem (s). */
  readonly periodo: { value: number };
  /** A cor de acento de cada imagem (linear). */
  readonly cores: { value: THREE.Vector3[] };
  /** Quando cada imagem chegou, no relógio do mapa (−1 = ainda não chegou). */
  readonly chegada: { value: number[] };
}

export function criarUniformesDosAnuncios(): UniformesDosAnuncios {
  const cor = new THREE.Color();
  return {
    ciclo: { value: Array.from({ length: SLIDES.length }, (_, i) => (i < SLIDES_QUE_ALTERNAM ? i : 0)) },
    cicloN: { value: SLIDES_QUE_ALTERNAM },
    periodo: { value: PARAMETROS_PADRAO.periodo },
    cores: { value: SLIDES.map((s) => { cor.setHex(s.cor); return new THREE.Vector3(cor.r, cor.g, cor.b); }) },
    chegada: { value: Array.from({ length: SLIDES.length }, () => -1) },
  };
}

/** O que `aplicar` diz de cada outdoor da lista (na ordem em que foi dada): se está no ar e onde ele começa no anel (já descontados os anúncios desligados). */
export interface EstadoDoOutdoor {
  readonly visivel: boolean;
  readonly inicio: number;
}

export interface OutdoorsCriados {
  readonly grupo: THREE.Group;
  /** Os painéis de todos os outdoors, numa malha só (`null` sem nenhum outdoor). */
  readonly painel: THREE.InstancedMesh | null;
  /** O brilho de todos os outdoors numa malha só. */
  readonly brilho: THREE.InstancedMesh | null;
  readonly anuncios: UniformesDosAnuncios;
  /** Aplica a configuração do Comandante: quantos aparecem, o período e os anúncios que ficam fora da troca. Devolve o estado de cada outdoor (para as janelas dos prédios e o reflexo no chão). */
  aplicar(parametros: ParametrosDeOutdoors): readonly EstadoDoOutdoor[];
  /** A qualidade (G12): sem detalhe, tira a grade de LED e o brilho. */
  setDetalhe(alto: boolean): void;
}

/** Quanto o brilho passa da borda do painel, em fração da largura. */
const MARGEM_DO_BRILHO = 0.34;
/** O quanto o painel fica na frente do brilho (m): o brilho está colado à parede, o painel um pouco à frente. */
const AFASTAMENTO_DO_BRILHO = 0.14;

const N = SLIDES.length;

/**
 * Qual imagem está no ar, e a cor dela. `a` = `aAnuncio` do outdoor: (onde começa no anel, a imagem fixa ou −1, a fase em fração do período, —). `slideDeAgora` devolve (imagem de agora, a seguinte, quanto da troca
 * já correu — 0 fora dela e de 0 a 1 nos últimos 14% do período —, o número da troca). Compartilhado pelo painel, pelo brilho e pelo reflexo no chão: os três têm de concordar sobre a imagem de agora.
 */
export const GLSL_ANUNCIO_ATUAL = /* glsl */ `
uniform float uCiclo[${N}];
uniform float uCicloN;
uniform float uPeriodo;
uniform vec3 uCores[${N}];
vec4 slideDeAgora(vec4 a, float tempo) {
  if (a.y >= 0.0) return vec4(a.y, a.y, 0.0, 0.0);
  float ciclo = (tempo + a.z * uPeriodo) / uPeriodo;
  float k = floor(ciclo);
  float n = max(uCicloN, 1.0);
  float p0 = mod(a.x + k, n);
  float p1 = mod(a.x + k + 1.0, n);
  return vec4(uCiclo[int(p0)], uCiclo[int(p1)], smoothstep(0.86, 1.0, ciclo - k), k);
}
vec3 corDoAnuncio(vec4 a, float tempo) {
  vec4 s = slideDeAgora(a, tempo);
  return mix(uCores[int(s.x)], uCores[int(s.y)], s.z);
}
`;

const SAMPLERS = Array.from({ length: N }, (_, i) => `uniform sampler2D uImagem${i};`).join('\n');
// O gradiente (para a escolha do mipmap) vem de fora, calculado onde todos os pixels passam: dentro de um `if` a derivada seria indefinida (o compilador do D3D avisa), então a leitura usa `textureGrad`.
const ESCOLHE_IMAGEM = `vec3 imagem(float i, vec2 uv, vec2 gx, vec2 gy) {\n  vec3 c = vec3(0.0);\n${Array.from({ length: N }, (_, i) => `  ${i === 0 ? '' : 'else '}if (i < ${i}.5) c = textureGrad(uImagem${i}, uv, gx, gy).rgb;`).join('\n')}\n  return c;\n}`;

const VERTEX_PAINEL = /* glsl */ `
attribute vec4 aAnuncio;
varying vec2 vUv;
varying vec3 vMundo;
flat varying vec4 vAnuncio;
void main() {
  vUv = uv;
  vAnuncio = aAnuncio;
  vec4 mundo = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vMundo = mundo.xyz;
  gl_Position = projectionMatrix * viewMatrix * mundo;
}
`;

const FRAGMENT_PAINEL = /* glsl */ `
${SAMPLERS}
uniform float uChegada[${N}];
uniform float uTempo;
uniform float uDetalhe;
uniform vec3 uLuz;
uniform vec3 fogColor;
uniform float fogDensity;
varying vec2 vUv;
varying vec3 vMundo;
flat varying vec4 vAnuncio;
${GLSL_ANUNCIO_ATUAL}

float hashT(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

${ESCOLHE_IMAGEM}

// A imagem entra em fade quando chega do servidor (chegada < 0 = ainda não chegou: o painel fica apagado).
float aparecida(float i) {
  float c = uChegada[int(i)];
  return c < 0.0 ? 0.0 : smoothstep(0.0, 1.2, uTempo - c);
}

void main() {
  vec4 s = slideDeAgora(vAnuncio, uTempo);
  float t = uTempo + vAnuncio.z * uPeriodo;
  // A troca de imagem: nos últimos 14% de cada período a seguinte entra com falha de sinal. De vez em quando (uma vez a cada ~35 s) até a logo fixa falha um instante.
  float mistura = s.z;
  float falha = mistura * (1.0 - mistura) * 4.0 + step(0.993, hashT(floor(t * 4.0) + vAnuncio.z * 13.0)) * 0.6;
  vec2 uv = vUv;
  float faixa = floor(uv.y * 36.0);
  uv.x += (hashT(faixa + s.w * 7.0 + floor(t * 24.0)) - 0.5) * 0.09 * falha;
  // A segunda imagem só é lida durante a troca: o resto do tempo é uma leitura de textura por pixel, não duas. O desvio é coerente (só o relógio e o outdoor o decidem).
  vec2 gx = dFdx(vUv);
  vec2 gy = dFdy(vUv);
  vec3 img = imagem(s.x, uv, gx, gy) * aparecida(s.x);
  if (mistura > 0.001) img = mix(img, imagem(s.y, uv, gx, gy) * aparecida(s.y), mistura);
  img *= 1.0 - 0.7 * falha * step(0.55, hashT(faixa * 1.7 + s.w));

  // O LED: uma grade de pontos (72 × 144); de longe a grade vira a média (a pegada do pixel passa do ponto), sem moiré. A varredura clara desce devagar.
  vec2 leds = vec2(72.0, 144.0);
  vec2 g = abs(fract(vUv * leds) - 0.5);
  float led = 1.0 - smoothstep(0.3, 0.48, max(g.x, g.y));
  float pegada = max(fwidth(vUv.x * leds.x), fwidth(vUv.y * leds.y));
  float grade = mix(mix(0.55, 1.1, led), 0.88, smoothstep(0.25, 0.7, pegada));
  float d = fract(vUv.y + t * 0.06) - 0.5;
  float varre = 1.0 + 0.16 * exp(-d * d * 220.0);

  vec3 luz = img * 1.3 * mix(1.0, grade * varre, uDetalhe) + vec3(0.012, 0.02, 0.03);
  float dist = length(vMundo - cameraPosition);
  float nevoa = 1.0 - exp(-fogDensity * fogDensity * dist * dist * 0.55);
  gl_FragColor = vec4(luz * uLuz * (1.0 - 0.55 * nevoa) + fogColor * nevoa * 0.35, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const VERTEX_BRILHO = /* glsl */ `
attribute vec4 aAnuncio;
attribute vec3 aMedidas;
uniform float uTempo;
varying vec2 vUv;
varying vec3 vMundo;
flat varying vec3 vCor;
flat varying vec3 vMedidas;
${GLSL_ANUNCIO_ATUAL}
void main() {
  vUv = uv;
  vCor = corDoAnuncio(aAnuncio, uTempo);
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

/** Baixa uma imagem do catálogo em segundo plano (nunca trava a abertura). `aoChegar` roda quando ela está pronta; se falhar, o painel só fica apagado naquela imagem. */
function baixar(arquivo: string, aoChegar: () => void): THREE.Texture {
  if (typeof document === 'undefined') return texturaDeEspera();
  const textura = new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}anuncios/${arquivo}`,
    aoChegar,
    undefined,
    () => console.warn(`o anúncio ${arquivo} não baixou; o outdoor fica apagado nessa imagem`),
  );
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  return textura;
}

function materialDoPainel(a: UniformesDosAnuncios, u: UniformesDeCena, detalhe: { value: number }): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLuz: { value: new THREE.Color() }, uTempo: { value: 0 } }]),
    vertexShader: VERTEX_PAINEL,
    fragmentShader: FRAGMENT_PAINEL,
    fog: true,
  });
  // Por referência depois do merge (ele copia valores): o relógio, a luz, o detalhe e o estado dos anúncios são os mesmos objetos de quem os muda.
  material.uniforms.uLuz = u.luz;
  material.uniforms.uTempo = u.tempo;
  material.uniforms.uDetalhe = detalhe;
  material.uniforms.uCiclo = a.ciclo;
  material.uniforms.uCicloN = a.cicloN;
  material.uniforms.uPeriodo = a.periodo;
  material.uniforms.uCores = a.cores;
  material.uniforms.uChegada = a.chegada;
  SLIDES.forEach((s, i) => {
    material.uniforms[`uImagem${i}`] = {
      value: baixar(s.arquivo, () => {
        a.chegada.value[i] = u.tempo.value; // a imagem acende em fade
      }),
    };
  });
  // No Node não há o que esperar: todas já "chegaram".
  if (typeof document === 'undefined') a.chegada.value.fill(0);
  return material;
}

function materialDoBrilho(a: UniformesDosAnuncios, u: UniformesDeCena): THREE.ShaderMaterial {
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
  m.uniforms.uCiclo = a.ciclo;
  m.uniforms.uCicloN = a.cicloN;
  m.uniforms.uPeriodo = a.periodo;
  m.uniforms.uCores = a.cores;
  return m;
}

const EIXO_Y = new THREE.Vector3(0, 1, 0);

/**
 * A ordem em que os outdoors saem do ar quando o Comandante pede menos: a logo plana é a última a sair (a marca), depois os maiores (os mais imponentes), e no empate a ordem da lista.
 * Devolve, para cada posição da lista, a posição dele na ordem (0 = o último a sair).
 */
export function prioridadeDosOutdoors(lista: readonly { readonly anuncio: IdDoAnuncio; readonly w: number }[]): number[] {
  const ordem = lista.map((_, i) => i).sort((a, b) => Number(lista[b]!.anuncio === 'logo') - Number(lista[a]!.anuncio === 'logo') || lista[b]!.w - lista[a]!.w || a - b);
  const posicao: number[] = Array(lista.length).fill(0);
  ordem.forEach((original, p) => (posicao[original] = p));
  return posicao;
}

/** Cria os outdoors da lista. Lista vazia = grupo vazio (um mapa sem outdoor não paga nada). Começa com a configuração padrão; o jogo chama `aplicar` com a do servidor quando ela chega. */
export function criarOutdoors(lista: readonly OutdoorDaCena[], u: UniformesDeCena, detalhe: { value: number }): OutdoorsCriados {
  const grupo = new THREE.Group();
  grupo.name = 'cidade-outdoors';
  const anuncios = criarUniformesDosAnuncios();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();

  const total = lista.length;
  const posicao = prioridadeDosOutdoors(lista); // posição da lista → instância (a instância 0 é a última a sair)
  const porInstancia: number[] = Array(total).fill(0);
  posicao.forEach((inst, original) => (porInstancia[inst] = original));
  /** Por instância: onde começa no anel (muda com a configuração), a imagem fixa ou −1, a fase e um reservado. */
  const atributo = new THREE.InstancedBufferAttribute(new Float32Array(total * 4), 4);
  atributo.setUsage(THREE.DynamicDrawUsage);
  porInstancia.forEach((original, inst) => {
    const o = lista[original]!;
    atributo.setXYZW(inst, Math.max(0, o.inicio), o.anuncio === 'logo' ? SLIDE_DA_LOGO : -1, o.fase, 0);
  });

  let painel: THREE.InstancedMesh | null = null;
  let brilho: THREE.InstancedMesh | null = null;
  if (total) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.setAttribute('aAnuncio', atributo);
    painel = new THREE.InstancedMesh(geo, materialDoPainel(anuncios, u, detalhe), total);
    porInstancia.forEach((original, inst) => {
      const o = lista[original]!;
      painel!.setMatrixAt(inst, m.compose(p.set(o.x, o.y, o.z), q.setFromAxisAngle(EIXO_Y, o.ry), s.set(o.w, o.h, 1)));
    });
    painel.frustumCulled = false;
    painel.name = 'cidade-outdoors-paineis';
    grupo.add(painel);

    const geoBrilho = new THREE.PlaneGeometry(1, 1);
    geoBrilho.setAttribute('aAnuncio', atributo);
    const medidas = new Float32Array(total * 3);
    porInstancia.forEach((original, inst) => {
      const o = lista[original]!;
      medidas.set([o.w, o.h, o.w * MARGEM_DO_BRILHO], inst * 3);
    });
    geoBrilho.setAttribute('aMedidas', new THREE.InstancedBufferAttribute(medidas, 3));
    brilho = new THREE.InstancedMesh(geoBrilho, materialDoBrilho(anuncios, u), total);
    porInstancia.forEach((original, inst) => {
      const o = lista[original]!;
      const margem = o.w * MARGEM_DO_BRILHO;
      // Um pouco atrás do painel (rumo à parede): a normal do plano, depois de girar em Y, é (sen ry, 0, cos ry).
      p.set(o.x - Math.sin(o.ry) * AFASTAMENTO_DO_BRILHO, o.y, o.z - Math.cos(o.ry) * AFASTAMENTO_DO_BRILHO);
      brilho!.setMatrixAt(inst, m.compose(p, q.setFromAxisAngle(EIXO_Y, o.ry), s.set(o.w + 2 * margem, o.h + 2 * margem, 1)));
    });
    brilho.frustumCulled = false;
    brilho.renderOrder = 1;
    brilho.name = 'cidade-outdoors-brilho';
    grupo.add(brilho);
  }

  let detalheAlto = true;
  const criados: OutdoorsCriados = {
    grupo,
    painel,
    brilho,
    anuncios,
    aplicar(parametros: ParametrosDeOutdoors): readonly EstadoDoOutdoor[] {
      // O anel: as imagens que alternam e cujo anúncio não foi desligado, na ordem do catálogo. Sem nenhuma (o servidor não deixa), vale todas.
      const fora = new Set<string>(parametros.desligados);
      let ativas: number[] = [];
      for (let i = 0; i < SLIDES_QUE_ALTERNAM; i++) if (!fora.has(SLIDES[i]!.anuncio)) ativas.push(i);
      if (!ativas.length) ativas = Array.from({ length: SLIDES_QUE_ALTERNAM }, (_, i) => i);
      for (let i = 0; i < N; i++) anuncios.ciclo.value[i] = ativas[i] ?? 0;
      anuncios.cicloN.value = ativas.length;
      anuncios.periodo.value = parametros.periodo;
      const noAr = Math.max(0, Math.min(Math.floor(parametros.quantidade), total));
      const estado: EstadoDoOutdoor[] = [];
      for (let original = 0; original < total; original++) {
        const o = lista[original]!;
        const inst = posicao[original]!;
        // Começa na primeira imagem ativa a partir da dele (se a dele saiu do anel, a seguinte), voltando ao começo se passou da última.
        const rank = o.anuncio === 'logo' ? 0 : Math.max(0, ativas.findIndex((i) => i >= o.inicio));
        atributo.setX(inst, rank);
        estado.push({ visivel: inst < noAr, inicio: rank });
      }
      atributo.needsUpdate = true;
      if (painel) painel.count = noAr;
      if (brilho) {
        brilho.count = noAr;
        brilho.visible = detalheAlto && noAr > 0;
      }
      return estado;
    },
    setDetalhe(alto: boolean): void {
      detalheAlto = alto;
      detalhe.value = alto ? 1 : 0;
      if (brilho) brilho.visible = alto && brilho.count > 0;
    },
  };
  criados.aplicar(PARAMETROS_PADRAO);
  return criados;
}

/** Os materiais dos outdoors (para o teste conferir que dividem o mesmo relógio e a mesma luz do mapa). */
export function materiaisDosOutdoors(o: OutdoorsCriados): THREE.ShaderMaterial[] {
  return [o.painel, o.brilho].filter((m): m is THREE.InstancedMesh => m !== null).map((m) => m.material as THREE.ShaderMaterial);
}

/** Os shaders dos outdoors, como pares (vértice, fragmento): o teste confere a interface entre eles (`CidadeNeonShaders.test.ts`). */
export const GLSL_OUTDOORS = {
  painel: { vertex: VERTEX_PAINEL, fragment: FRAGMENT_PAINEL },
  brilho: { vertex: VERTEX_BRILHO, fragment: FRAGMENT_BRILHO },
} as const;
