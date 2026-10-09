import * as THREE from 'three';

/**
 * Sombra de contato sob os robôs: um disco escuro e macio por unidade, num único `InstancedMesh` (1 draw call, sem mapa de
 * sombra e sem luz extra). Dá chão aos robôs ("flutuavam") e mostra a altura do pulo, por quase nada de GPU.
 * Render puro (não é regra de jogo): lê a posição interpolada, nunca altera a simulação (G2). Zero alocação por quadro (G4).
 * Referência de qualidade: `.decepticons/REFERENCIA_VISUAL.md` (a sombra suave sob os robôs).
 */

/** O que a sombra precisa de uma unidade (um `MechBase` serve; o teste usa um falso). */
export interface ShadowCaster {
  readonly root: THREE.Object3D;
  readonly stats: { readonly radius: number };
  readonly grounded: boolean;
  readonly alive: boolean;
}

/** Altura do chão sob (x, z), olhando de `fromY` para baixo; `null` se não houver. */
export type GroundHeight = (x: number, z: number, fromY: number) => number | null;

/** Quantas unidades têm sombra ao mesmo tempo (a partida tem no máximo uma dúzia; sobra folga). */
export const SHADOW_CAPACITY = 32;
/** Raio do disco em múltiplos do raio da cápsula do robô: um pouco maior que o pé, para sobrar uma borda macia. */
export const SHADOW_SPREAD = 1.8;
/**
 * Deslocamento do disco, em múltiplos do raio dele, para longe da luz principal (a direcional de `Arena.ts` está em
 * +x, +z): a sombra aparece como orla em qualquer câmera (de cima, o robô cobriria o disco todo) e combina com a luz.
 */
export const SHADOW_SHIFT_X = -0.2;
export const SHADOW_SHIFT_Z = -0.15;
/** Acima do chão, em metros: passa por cima da grade (0,02) e do disco de zona (0,03) sem brigar com eles. */
export const SHADOW_LIFT = 0.06;
/** Altura (m) em que a sombra já encolheu até o mínimo. */
const FADE_HEIGHT = 14;
/** Menor tamanho da sombra, em fração do tamanho no chão. */
const MIN_SCALE = 0.35;
/** Até onde procurar o chão sob um robô no ar. */
const GROUND_REACH = 80;

/** Tamanho da sombra com a altura `h` (m) acima do chão: 1 no chão, `MIN_SCALE` a partir de `FADE_HEIGHT`. */
export function shadowScale(h: number): number {
  const t = Math.min(1, Math.max(0, h / FADE_HEIGHT));
  return 1 - (1 - MIN_SCALE) * t;
}

/** Opacidade da borda ao centro do disco (0 = borda, 1 = centro): núcleo escuro e orla que some devagar. */
export function shadowFalloff(r: number): number {
  const t = Math.min(1, Math.max(0, 1 - r));
  // Queda linear: o expoente 1,5 testado primeiro deixava só um núcleo pequeno, quase invisível no chão escuro.
  return t * 0.95;
}

/** Textura do disco: preto com alfa em queda radial. Gerada em memória (sem arquivo, sem DOM). */
export function buildShadowTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const a = shadowFalloff(Math.hypot(dx, dy) * 2);
      data.set([0, 0, 0, Math.round(a * 255)], (y * size + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export class ShadowBlobs {
  readonly mesh: THREE.InstancedMesh;
  private count = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly noRotation = new THREE.Quaternion();

  constructor(
    scene: THREE.Scene,
    private readonly groundHeight: GroundHeight,
    private readonly capacity = SHADOW_CAPACITY,
  ) {
    // O plano nasce deitado (normal para cima): a matriz de cada instância só translada e escala.
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: buildShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.count = 0;
    // As instâncias andam pela arena toda: a esfera da geometria base não vale como volume de corte.
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Abre o quadro: esquece as sombras do quadro anterior. */
  begin(): void {
    this.count = 0;
  }

  /** Põe a sombra de uma unidade (ignora quem morreu ou está escondido, e o que passar da capacidade). */
  add(unit: ShadowCaster): void {
    if (this.count >= this.capacity || !unit.alive || !unit.root.visible) return;
    const p = unit.root.position;
    // No chão (ou numa rampa, ou na plataforma) a sombra fica nos pés; no ar, procura o chão embaixo e encolhe.
    let groundY = p.y;
    if (!unit.grounded) {
      const below = this.groundHeight(p.x, p.z, p.y + 0.5);
      groundY = below ?? 0;
    }
    const height = Math.max(0, p.y - groundY);
    const r = unit.stats.radius * SHADOW_SPREAD * shadowScale(height);
    this.pos.set(p.x + r * SHADOW_SHIFT_X, groundY + SHADOW_LIFT, p.z + r * SHADOW_SHIFT_Z);
    this.scale.set(r * 2, 1, r * 2);
    this.mesh.setMatrixAt(this.count++, this.matrix.compose(this.pos, this.noRotation, this.scale));
  }

  /** Fecha o quadro: só as sombras postas agora são desenhadas. */
  end(): void {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Quantas sombras o último quadro desenhou (teste e painel). */
  get drawn(): number {
    return this.count;
  }
}

/** Ligação com a física: altura do terreno estático (ignora Mechs e destroços). */
export function terrainGround(physics: { terrainY(x: number, z: number, fromY: number, maxDist: number): number | null }): GroundHeight {
  return (x, z, fromY) => physics.terrainY(x, z, fromY, GROUND_REACH);
}
