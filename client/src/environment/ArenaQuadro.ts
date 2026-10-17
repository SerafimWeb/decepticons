import * as THREE from 'three';
import { PALETTE } from '../core/palette';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { ARENA_QUADRO_DE_LUZ, ARENA_QUADRO_VOLUME } from './ArenaLayout';
import { aparenciaDoQuadro } from './PraiaPorto';

/**
 * O TRANSFORMADOR DO BANCO VORCARIS (P164, parte E): o segundo quadro de luz do jogo, na Cidade Neon. Uma cabine de aço escuro com as arestas no azul do banco, uma **tela** na face voltada
 * para o meio da arena (a de +z) e um **farol** alto em cima, para o jogador achá-lo de longe. A tela e o farol leem a mesma aparência do painel do porto (`aparenciaDoQuadro`): **verde**
 * ligado, **laranja trêmulo** sabotado, **vermelho piscando** apagado. Tem **colisor** (é uma cabine: bloqueia como as barricadas).
 *
 * **Custo:** quatro desenhos estáticos (corpo, arestas, tela, farol), criados uma vez; por quadro, só as duas cores (sem alocar). Só existe na missão em ondas da Cidade Neon.
 */
/** A altura do farol sobre a cabine (m): os prédios vizinhos têm de 20 a 42 m, e o jogador precisa achar o transformador de qualquer lugar da arena. */
export const ALTURA_DO_FAROL = 9;

export class ArenaQuadro {
  readonly raiz = new THREE.Group();
  private readonly tela: THREE.Mesh;
  private readonly farol: THREE.Mesh;
  private readonly corDoFarol = new THREE.Color();

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    const { w, h, d } = ARENA_QUADRO_VOLUME;
    const { x, z } = ARENA_QUADRO_DE_LUZ;
    this.raiz.position.set(x, 0, z);

    const corpo = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x131d29, metalness: 0.45, roughness: 0.6 }));
    corpo.position.y = h / 2;
    const arestas = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
      new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.bankBlue).multiplyScalar(2.5) }),
    );
    arestas.position.y = h / 2;
    this.tela = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.7, h * 0.42, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x0b1a10, metalness: 0.2, roughness: 0.5, emissive: 0x3dff7a, emissiveIntensity: 0.9 }),
    );
    this.tela.position.set(0, h * 0.62, d / 2 + 0.04);
    this.farol = new THREE.Mesh(new THREE.BoxGeometry(0.34, ALTURA_DO_FAROL, 0.34), new THREE.MeshBasicMaterial({ color: 0x3dff7a }));
    this.farol.position.y = h + ALTURA_DO_FAROL / 2;
    this.raiz.add(corpo, arestas, this.tela, this.farol);
    scene.add(this.raiz);
    physics.addStaticBox(new THREE.Vector3(x, h / 2, z), new THREE.Vector3(w, h, d));
  }

  /** Por quadro: pinta a tela e o farol pelo estado (0 ligado, 1 sabotado, 2 apagado), a vida (0 a 1) e o tempo. Sem alocar. */
  atualiza(elapsed: number, estado: number, vida: number): void {
    const a = aparenciaDoQuadro(estado, vida, elapsed);
    const tela = this.tela.material as THREE.MeshStandardMaterial;
    tela.emissive.setHex(a.cor);
    tela.emissiveIntensity = a.intensidade;
    (this.farol.material as THREE.MeshBasicMaterial).color.copy(this.corDoFarol.setHex(a.cor).multiplyScalar(0.4 + 2.2 * a.intensidade));
  }
}
