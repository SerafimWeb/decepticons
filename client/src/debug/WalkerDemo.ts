import * as THREE from 'three';
import { AMAZONIA_DRAGA_INICIO_X, rioEmX } from '../environment/AmazoniaLayout';
import { alturaDoTerreno } from '../environment/AmazoniaTerreno';
import { loadWalkerAsset, WalkerVisual } from '../entities/WalkerVisual';

/**
 * A DEMONSTRAÇÃO DO DRAGA-01 (P180, parte A): com `?walker` no link (`walkerLink.ts`), o Draga anda em círculo (70 m de raio) em volta de onde o jogador nasceu e **mira o convés para ele**, em qualquer
 * mapa. **É só desenho**: o Draga ainda não é um inimigo (não tem corpo na simulação, não atira nem recebe tiro: isso é a parte C do plano, `AMAZONIA.md` § 7). Existe para o Comandante
 * ver o robô andando no jogo de verdade e conferir a escala, o andar e as cores. Marcado como DEMO em `STATUS_REAL.md` (R13).
 *
 * G3: módulo independente, ligado em `Game.ts` por uma chamada por quadro. **Custo:** um desenho (27 mil triângulos) e 18 ossos; nada alocado por quadro (a marcha escreve numa pose única).
 */
const RAIO_M = 70;
const VELOCIDADE_MS = 2.6;
/** O leito do Draga na Amazônia: ele sobe o rio (rumo a oeste, à aldeia) a partir de `AMAZONIA_DRAGA_INICIO_X` e para antes da aldeia. */
export const X_DA_PARADA_DO_DRAGA = -700;

/** O x do Draga `t` segundos depois de largar: anda rio acima a `VELOCIDADE_MS` e para em `X_DA_PARADA_DO_DRAGA` (nunca entra na aldeia). */
export function xDoDragaNoRio(t: number): number {
  const s = Number.isFinite(t) ? Math.max(0, t) : 0; // tempo torto (NaN) não envenena a posição: conta como o instante da largada
  return Math.max(X_DA_PARADA_DO_DRAGA, AMAZONIA_DRAGA_INICIO_X - VELOCIDADE_MS * s);
}

/** Como o Draga anda: em círculo em volta do jogador (`?walker` em qualquer mapa) ou rio acima, arrastando a frente do rio (a Amazônia). */
export interface OpcoesDoDraga {
  modo: 'circulo' | 'rio';
  /** Chamado a cada quadro com o x do Draga (no modo rio): a Amazônia põe a frente do rio nele. */
  aoAndar?: (x: number) => void;
}

/** O ângulo do rumo `(dx, dz)` no referencial do Mech (frente -Z; rotation.y positivo vira a frente para a esquerda). */
export function rumoDe(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

/** A diferença entre dois ângulos, em (-π, π]. */
export function diferencaDeAngulo(a: number, b: number): number {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

export class WalkerDemo {
  private visual: WalkerVisual | null = null;
  /** Começa bem à frente do jogador (a frente é -Z): o círculo passa por (centro.x, centro.z - raio). */
  private angulo = -Math.PI / 2;
  private tempoNoRio = 0;
  private readonly centro = new THREE.Vector3();

  /** `centro`: onde o círculo fica (o nascimento do jogador); `alturaDoChao(x, z)`: o relevo do mapa. */
  constructor(
    private readonly scene: THREE.Scene,
    centro: THREE.Vector3,
    private readonly alturaDoChao: (x: number, z: number) => number,
    private readonly opcoes: OpcoesDoDraga = { modo: 'circulo' },
  ) {
    this.centro.copy(centro);
    void loadWalkerAsset()
      .then((asset) => {
        this.visual = new WalkerVisual(asset);
        this.scene.add(this.visual.root);
      })
      .catch((e) => console.warn('Draga-01 (demonstração): não carregou', e));
  }

  /** Um quadro: anda no círculo, acompanha o relevo e vira o convés para `alvo` (o jogador). */
  update(dt: number, alvo: THREE.Vector3): void {
    const v = this.visual;
    if (!v) return;
    if (this.opcoes.modo === 'rio') {
      // rio acima, pelo leito: o veneno nasce nele (a frente do rio é o x dele) e ele para antes da aldeia
      const x0 = xDoDragaNoRio(this.tempoNoRio);
      this.tempoNoRio += dt;
      const x1 = xDoDragaNoRio(this.tempoNoRio);
      const z1 = rioEmX(x1);
      v.root.position.set(x1, alturaDoTerreno(x1, z1), z1);
      v.root.rotation.y = rumoDe(-1, 0);
      v.deckYaw = diferencaDeAngulo(rumoDe(alvo.x - x1, alvo.z - z1), v.root.rotation.y);
      v.update(dt, dt > 0 ? Math.abs(x0 - x1) / dt : 0);
      this.opcoes.aoAndar?.(x1);
      return;
    }
    this.angulo += (VELOCIDADE_MS / RAIO_M) * dt;
    const x = this.centro.x + Math.cos(this.angulo) * RAIO_M;
    const z = this.centro.z + Math.sin(this.angulo) * RAIO_M;
    v.root.position.set(x, this.alturaDoChao(x, z), z);
    // o rumo da marcha é a tangente do círculo
    const rumo = rumoDe(-Math.sin(this.angulo), Math.cos(this.angulo));
    v.root.rotation.y = rumo;
    v.deckYaw = diferencaDeAngulo(rumoDe(alvo.x - x, alvo.z - z), rumo);
    v.update(dt, VELOCIDADE_MS);
  }
}
