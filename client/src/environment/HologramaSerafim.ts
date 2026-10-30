import * as THREE from 'three';
import { ARQUIVO_DO_HOLOGRAMA } from '../brand/anuncios';
import { SERAFIM_TOWER } from './SerafimTower';

/**
 * O HOLOGRAMA DA SERAFIM (P266, ordem do Comandante de 28/10): "use o vetorserafim.png como nossa LOGO e o principal holograma (coloque ele em 3D flutuando em cima do prédio Serafim)".
 * A logo (a arte de verdade, `client/public/brand/serafim-logo-holo.webp`) vira um **volume**: até 17 camadas dela empilhadas em profundidade, desenhadas com mistura aditiva e giradas devagar em
 * torno do eixo vertical. De frente é a logo inteira, com o brilho das trilhas; de lado, as camadas se separam — é o jeito clássico de fazer um holograma convencer sem malha nenhuma (a logo é
 * simétrica: a face de trás espelhada é igual). Um anel projetor no teto do prédio e um feixe fino sobem até ele, e uma aura ciano o faz aparecer de longe.
 *
 * **Custo (G4/G5/G12):** uma `InstancedMesh` de até 17 quadros (34 triângulos) + o anel, o feixe e a aura (3 chamadas pequenas); o brilho, a varredura e o pisca são conta de shader sobre o relógio.
 * Por quadro, a CPU gira o grupo e compara uma distância (sem alocar). Sem luz dinâmica, sem colisor (fica no ar, a 62 m do chão). A imagem baixa em segundo plano e entra em fade.
 * **A GPU é o custo de verdade, e é de preenchimento** (medido na AMD Vega 11 do Comandante: com as 17 camadas, de baixo dele o holograma custava +3 a +9 ms por quadro): cada camada é um quadro de 44 m
 * em mistura aditiva, e de perto elas enchem a tela. Por isso o **número de camadas cai com a distância até a câmera** (`fatiasPorDistancia`: de 17 longe a 4 perto, com o brilho de cada uma
 * compensado para a soma continuar igual) e a qualidade baixa desenha no máximo metade delas.
 */

/** Onde ele flutua e como: o centro sobre o Prédio Serafim, `tamanho` é o lado do quadro da logo (a logo ocupa ~92% dele). */
export const HOLOGRAMA = Object.freeze({
  x: SERAFIM_TOWER.x,
  z: SERAFIM_TOWER.z,
  /** A altura do centro (m): o teto do prédio, a folga e meio holograma. */
  y: SERAFIM_TOWER.height + 6 + 18,
  /** O lado do quadro da logo (m): 36 m, mais largo que o dobro do prédio (14 m) — é "o principal holograma", tem de ser lido de qualquer ponto da praça. */
  tamanho: 36,
  profundidade: 5.5,
  fatias: 17,
  /** Quanto ele gira (rad/s), quanto balança na vertical (m) e em que ritmo (rad/s). */
  giro: 0.3,
  balanco: 0.8,
  ritmo: 0.8,
  /** O lado da aura (m): o brilho ciano em volta, que o faz aparecer de longe e de lado (o sprite olha sempre para a câmera). */
  aura: 62,
  /** O quadro de cada camada é um pouco maior que a logo (×1,22): sobra margem para o brilho em forma de logo não ser cortado na borda. */
  margem: 1.22,
  /** Quantas camadas desenhar, pela distância (m) do centro dele até a câmera: `minimo` até `perto`, todas a partir de `longe`, e uma rampa no meio. */
  lod: Object.freeze({ perto: 70, longe: 170, minimo: 4 }),
});

/**
 * Quantas camadas desenhar a esta distância da câmera: a rampa de `HOLOGRAMA.lod`, limitada ao máximo do nível de detalhe (todas na alta; metade na baixa). Sem distância conhecida (NaN), o máximo.
 */
export function fatiasPorDistancia(distancia: number, alto: boolean): number {
  const maximo = alto ? HOLOGRAMA.fatias : Math.ceil(HOLOGRAMA.fatias / 2);
  if (Number.isNaN(distancia)) return maximo;
  const { perto, longe, minimo } = HOLOGRAMA.lod;
  const t = Math.min(1, Math.max(0, (distancia - perto) / (longe - perto)));
  return Math.min(maximo, Math.round(minimo + (maximo - minimo) * t));
}

const MARGEM = HOLOGRAMA.margem.toFixed(3);
const PROFUNDIDADE = HOLOGRAMA.profundidade.toFixed(3);

const VERTEX = /* glsl */ `
attribute float aFatia;
uniform float uFatias;
varying vec2 vUv;
varying float vFatia;
varying vec3 vMundo;
void main() {
  // O quadro é ${MARGEM}× a logo: o uv recua do meio, e a logo cai no centro com o tamanho certo.
  vUv = (uv - 0.5) * ${MARGEM} + 0.5;
  // As camadas se espalham pela profundidade inteira, seja qual for o número delas (perto, ou na qualidade baixa, são poucas e mais afastadas).
  vFatia = uFatias > 1.5 ? aFatia / (uFatias - 1.0) : 0.5;
  vec4 local = instanceMatrix * vec4(position, 1.0);
  local.z += (vFatia - 0.5) * ${PROFUNDIDADE};
  vec4 mundo = modelMatrix * local;
  vMundo = mundo.xyz;
  gl_Position = projectionMatrix * viewMatrix * mundo;
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uLogo;
uniform float uTempo;
uniform float uAlfa;
uniform float uMostrar;
varying vec2 vUv;
varying float vFatia;
varying vec3 vMundo;
void main() {
  // A logo nítida mais ela mesma borrada pelo mipmap (bias 4,2): um brilho em forma da própria logo, sem uma segunda textura.
  // O brilho some antes da borda do quadro (a janela vai de 1 a 0 entre 0,35 e 0,60 do centro), para não aparecer um corte reto.
  vec2 ao_centro = abs(vUv - 0.5);
  float janela = 1.0 - smoothstep(0.35, 0.60, max(ao_centro.x, ao_centro.y));
  vec3 tex = texture2D(uLogo, vUv).rgb + 0.85 * janela * texture2D(uLogo, vUv, 4.2).rgb;
  // A varredura sobe pelo volume (linhas finas em movimento) e a luz pisca de leve, como projeção de verdade.
  float varredura = 0.8 + 0.2 * sin(vMundo.y * 6.5 - uTempo * 3.1);
  float pisca = 0.95 + 0.05 * sin(uTempo * 17.0) * sin(uTempo * 5.3);
  // As camadas do meio um pouco mais fortes: o volume tem miolo.
  float miolo = 1.0 - abs(vFatia - 0.5) * 0.8;
  float mostrar = uMostrar < 0.0 ? 0.0 : smoothstep(0.0, 1.5, uTempo - uMostrar);
  gl_FragColor = vec4(tex * varredura * pisca * miolo * uAlfa * mostrar, 1.0);
}
`;

/** O degradê radial da aura (a intensidade vai nos três canais: com a mistura aditiva e a cor do material, vira luz ciano que some na borda). Gerado aqui, sem arquivo. */
function texturaDaAura(): THREE.DataTexture {
  const n = 128;
  const dados = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(((x + 0.5) / n) * 2 - 1, ((y + 0.5) / n) * 2 - 1);
      const v = Math.round(Math.pow(Math.max(0, 1 - r), 2.4) * 255);
      dados.set([v, v, v, 255], (y * n + x) * 4);
    }
  }
  const t = new THREE.DataTexture(dados, n, n);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export class HologramaSerafim {
  readonly grupo = new THREE.Group();
  private readonly fatias: THREE.InstancedMesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly anel: THREE.Mesh;
  private readonly feixe: THREE.Mesh;
  private readonly aura: THREE.Sprite;
  private readonly total = HOLOGRAMA.fatias;
  private readonly alfaCheia = 0.26;
  private tempo = 0;
  private alto = true;
  /** A distância da câmera ao holograma no último quadro (m); infinita até a primeira câmera chegar (todas as camadas). */
  private distancia = Number.POSITIVE_INFINITY;

  constructor(scene: THREE.Scene, tempo: { value: number }) {
    this.grupo.name = 'cidade-holograma';
    this.grupo.position.set(HOLOGRAMA.x, HOLOGRAMA.y, HOLOGRAMA.z);

    const mostrar = { value: -1 };
    let textura: THREE.Texture;
    if (typeof document === 'undefined') {
      textura = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      (textura as THREE.DataTexture).needsUpdate = true;
      mostrar.value = 0;
    } else {
      textura = new THREE.TextureLoader().load(
        `${import.meta.env.BASE_URL}brand/${ARQUIVO_DO_HOLOGRAMA}`,
        () => (mostrar.value = tempo.value), // o fade conta no relógio do shader, o do mapa
        undefined,
        () => console.warn('a textura do holograma não baixou; ele não aparece'),
      );
      textura.colorSpace = THREE.SRGBColorSpace;
      textura.anisotropy = 4;
    }
    this.material = new THREE.ShaderMaterial({
      uniforms: { uLogo: { value: textura }, uTempo: tempo, uAlfa: { value: this.alfaCheia }, uMostrar: mostrar, uFatias: { value: this.total } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Todas as instâncias são o mesmo quadro; quem as separa em profundidade é o vertex shader (pelo índice e pelo número de camadas de agora), então mudar `count` não mexe em matriz nenhuma.
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.setAttribute('aFatia', new THREE.InstancedBufferAttribute(Float32Array.from({ length: this.total }, (_, i) => i), 1));
    this.fatias = new THREE.InstancedMesh(geo, this.material, this.total);
    const lado = HOLOGRAMA.tamanho * HOLOGRAMA.margem;
    const m = new THREE.Matrix4().makeScale(lado, lado, 1);
    for (let i = 0; i < this.total; i++) this.fatias.setMatrixAt(i, m);
    this.fatias.frustumCulled = false;
    this.fatias.name = 'cidade-holograma-fatias';
    this.grupo.add(this.fatias);
    // A aura: um degradê radial ciano somado atrás do holograma (um sprite: sempre de frente para a câmera, sem conta por quadro).
    this.aura = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texturaDaAura(), color: new THREE.Color(0x19d3ff).multiplyScalar(1.5), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.32 }),
    );
    this.aura.scale.set(HOLOGRAMA.aura, HOLOGRAMA.aura, 1);
    this.aura.name = 'cidade-holograma-aura';
    this.grupo.add(this.aura);
    scene.add(this.grupo);

    // O anel projetor no teto do prédio e o feixe que sobe até o holograma (mistura aditiva, cor da logo).
    const ciano = new THREE.Color(0x19d3ff);
    const base = SERAFIM_TOWER.height; // o teto do prédio
    const aditivo = (cor: THREE.Color, opacidade: number): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ color: cor.clone().multiplyScalar(2.2), transparent: true, opacity: opacidade, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.anel = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.8, 64).rotateX(-Math.PI / 2), aditivo(ciano, 0.7));
    this.anel.position.set(HOLOGRAMA.x, base + 0.2, HOLOGRAMA.z);
    this.anel.name = 'cidade-holograma-anel';
    const altura = HOLOGRAMA.y - HOLOGRAMA.tamanho * 0.45 - (base + 0.2);
    this.feixe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 2.6, altura, 20, 1, true), aditivo(ciano, 0.2));
    this.feixe.position.set(HOLOGRAMA.x, base + 0.2 + altura / 2, HOLOGRAMA.z);
    this.feixe.name = 'cidade-holograma-feixe';
    scene.add(this.anel, this.feixe);
  }

  /** Liga ou apaga o holograma (o anel projetor, o feixe, as camadas e a aura) com a luz da cidade (P282, a fase escura). */
  setLigado(ligado: boolean): void {
    this.grupo.visible = ligado;
    this.anel.visible = ligado;
    this.feixe.visible = ligado;
  }

  /**
   * Por quadro: gira e balança o grupo (só atribui números: nada aloca) e, com a câmera, ajusta o número de camadas à distância. O relógio dos shaders é o do mapa.
   * Sem câmera (os testes), mantém o que já estava.
   */
  update(dt: number, camera?: { readonly x: number; readonly y: number; readonly z: number }): void {
    this.tempo += dt;
    this.grupo.rotation.y = this.tempo * HOLOGRAMA.giro;
    this.grupo.position.y = HOLOGRAMA.y + Math.sin(this.tempo * HOLOGRAMA.ritmo) * HOLOGRAMA.balanco;
    (this.anel.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.2 * Math.sin(this.tempo * 2.4);
    if (camera) {
      const p = this.grupo.position;
      this.distancia = Math.hypot(camera.x - p.x, camera.y - p.y, camera.z - p.z);
      this.aplicarFatias();
    }
  }

  /** A qualidade (G12): a baixa desenha no máximo metade das camadas, e a rampa de distância vale nas duas. */
  setDetalhe(alto: boolean): void {
    this.alto = alto;
    this.aplicarFatias();
  }

  /** O número de camadas de agora, com o brilho de cada uma compensado para a soma continuar a mesma (menos camadas, cada uma mais forte). Só mexe nos uniformes quando o número muda. */
  private aplicarFatias(): void {
    const n = fatiasPorDistancia(this.distancia, this.alto);
    if (n === this.fatias.count) return;
    this.fatias.count = n;
    this.material.uniforms.uFatias!.value = n;
    this.material.uniforms.uAlfa!.value = (this.alfaCheia * this.total) / n;
  }

  get quantasFatias(): number {
    return this.fatias.count;
  }
}

/** Os shaders do holograma, como par (vértice, fragmento): o teste confere a interface entre eles (`CidadeNeonShaders.test.ts`). */
export const GLSL_HOLOGRAMA = { vertex: VERTEX, fragment: FRAGMENT } as const;
