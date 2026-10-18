import * as THREE from 'three';
import { INVASAO } from '../sim/InvasaoDoDraga';
import { NIVEL_DA_AGUA } from './AmazoniaLayout';
import { alturaDoTerreno } from './AmazoniaTerreno';

/**
 * O MARCADOR DA ESCOTILHA DO DRAGA (P180, parte E; `AMAZONIA.md` § 5.5): enquanto a escotilha está aberta, um **anel verde** no chão junto ao casco (do tamanho do raio em que o andróide conta como
 * "junto dela"), um **disco** dentro dele que cresce com a carga plantada e um **farol** vertical que se vê de longe entre as árvores. Só desenho, três malhas e **nenhuma conta por quadro** além de
 * posição e escala; fechada, as três ficam invisíveis (não contam desenho). Fica no pedaço sob demanda da Amazônia.
 */

const VERDE = new THREE.Color(0.25, 2.2, 1.1);
/** Quanto acima do chão (ou da água) o anel fica: o leito do rio está abaixo da água, e o anel tem de aparecer. */
const FOLGA_M = 0.6;
const ALTURA_DO_FAROL_M = 60;

export class MarcadorDaEscotilha {
  private readonly anel: THREE.Mesh;
  private readonly disco: THREE.Mesh;
  private readonly farol: THREE.Mesh;
  private readonly raiz = new THREE.Group();

  constructor(scene: THREE.Scene) {
    const material = (opacidade: number): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ color: VERDE, transparent: true, opacity: opacidade, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
    const raio = INVASAO.raioDaEscotilhaM;
    this.anel = new THREE.Mesh(new THREE.RingGeometry(raio - 0.7, raio, 40).rotateX(-Math.PI / 2), material(0.8));
    this.disco = new THREE.Mesh(new THREE.CircleGeometry(raio - 1, 32).rotateX(-Math.PI / 2), material(0.35));
    this.farol = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, ALTURA_DO_FAROL_M, 8, 1, true).translate(0, ALTURA_DO_FAROL_M / 2, 0), material(0.4));
    for (const m of [this.anel, this.disco, this.farol]) {
      m.frustumCulled = false;
      m.renderOrder = 5;
      this.raiz.add(m);
    }
    this.raiz.name = 'escotilha-do-draga';
    this.raiz.visible = false;
    scene.add(this.raiz);
  }

  get visivel(): boolean {
    return this.raiz.visible;
  }

  /** A carga plantada que o disco mostra (0 a 1) e o pulso do anel; para o chamador chamar uma vez por quadro. */
  atualizar(aberta: boolean, x: number, z: number, carga: number, tempoS: number): void {
    this.raiz.visible = aberta && Number.isFinite(x) && Number.isFinite(z);
    if (!this.raiz.visible) return;
    this.raiz.position.set(x, Math.max(alturaDoTerreno(x, z), NIVEL_DA_AGUA) + FOLGA_M, z);
    this.disco.scale.setScalar(Math.max(0.001, Math.min(1, carga)));
    (this.anel.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.3 * Math.sin(tempoS * 4);
  }
}
