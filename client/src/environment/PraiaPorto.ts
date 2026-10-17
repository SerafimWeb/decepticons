import * as THREE from 'three';
import { PRAIA_DESEMBARQUE, PRAIA_QUADRO_DE_LUZ } from './PraiaLayout';

/**
 * O PORTO, desenhado (P164, capítulo 1, frente 3):
 *  - **as portas dos contêineres de desembarque**: seis folhas (duas por contêiner) em duas malhas instanciadas (uma para o lado de cada dobradiça: nada é espelhado, senão as faces
 *    ficariam do avesso). Quando a onda entra em campo **as portas se abrem para fora**, com a luz de alerta acesa, e é por elas que os rebeldes saem; entre as ondas ficam fechadas.
 *    A abertura anda sozinha até o alvo (cerca de 2 s) e só se mexe nas matrizes enquanto a porta anda;
 *  - **o painel do quadro de luz da cidade**: uma tela na face de leste do armário (o armário em si é um bloco do layout): verde e firme com a cidade ligada, laranja trêmulo com o quadro
 *    sabotado, vermelho piscando e apagado com a cidade no escuro.
 *
 * **Custo:** três desenhos; por quadro, nada além de comparar a abertura com o alvo (e, andando, seis matrizes) e dois números do painel; nenhuma alocação.
 */

const FOLHA_LARGURA = (PRAIA_DESEMBARQUE.profundidade - 0.1) / 2;
const FOLHA_ALTURA = PRAIA_DESEMBARQUE.altura - 0.15;
const FOLHA_ESPESSURA = 0.12;
/** A abertura máxima de cada folha: ~105°, para fora. */
const ANGULO_ABERTO = (105 * Math.PI) / 180;
/** O quanto a abertura anda por segundo (1 / 0,55 ≈ 1,8 s para abrir ou fechar). */
const VELOCIDADE_DA_PORTA = 0.55;

/** A abertura (0 a 1) depois de `dt` segundos indo para o alvo (1 aberta, 0 fechada): anda em linha reta e para no alvo. Pura. */
export function aberturaDoDesembarque(atual: number, aberto: boolean, dt: number): number {
  const alvo = aberto ? 1 : 0;
  const passo = VELOCIDADE_DA_PORTA * Math.max(0, dt);
  if (atual < alvo) return Math.min(alvo, atual + passo);
  return Math.max(alvo, atual - passo);
}

export interface AparenciaDoQuadro {
  /** A cor da tela do painel (hexa). */
  cor: number;
  /** A força da luz da tela (0 a ~2). */
  intensidade: number;
}

/** A aparência do painel no estado `estado` (0 ligado, 1 sabotado, 2 apagado), com a vida (0 a 1) e o tempo. Pura: o desenho e o teste leem a mesma. */
export function aparenciaDoQuadro(estado: number, vida: number, elapsed: number): AparenciaDoQuadro {
  if (estado === 2) return { cor: 0xff2030, intensidade: Math.sin(elapsed * 3) > 0.4 ? 1.2 : 0.08 };
  if (estado === 1) {
    const dano = Math.min(1, Math.max(0, 1 - vida));
    return { cor: 0xff9a1a, intensidade: 0.6 + 0.9 * dano * (0.5 + 0.5 * Math.sin(elapsed * 11)) };
  }
  return { cor: 0x3dff7a, intensidade: 0.9 };
}

export class PraiaPorto {
  /** As folhas que articulam no canto de +z (o corpo vai para -z) e as do canto de -z (o corpo vai para +z). */
  private readonly folhasMais: THREE.InstancedMesh;
  private readonly folhasMenos: THREE.InstancedMesh;
  private readonly materialDasFolhas: THREE.MeshStandardMaterial;
  private readonly painel: THREE.Mesh;
  private abertura = 0;
  private aberto = false;
  private readonly dobradicasMais: { x: number; z: number }[] = [];
  private readonly dobradicasMenos: { x: number; z: number }[] = [];
  private readonly _m = new THREE.Matrix4();
  private readonly _q = new THREE.Quaternion();
  private readonly _p = new THREE.Vector3();
  private readonly _s = new THREE.Vector3(1, 1, 1);
  private readonly _eixo = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    const { x, linhas, comprimento, profundidade } = PRAIA_DESEMBARQUE;
    const xDaPorta = x + comprimento / 2;
    for (const z of linhas) {
      this.dobradicasMais.push({ x: xDaPorta, z: z + profundidade / 2 - 0.02 });
      this.dobradicasMenos.push({ x: xDaPorta, z: z - profundidade / 2 + 0.02 });
    }
    this.materialDasFolhas = new THREE.MeshStandardMaterial({ color: 0xb8431a, metalness: 0.45, roughness: 0.6, emissive: 0xff5a1a, emissiveIntensity: 0 });
    // A folha: uma chapa com a dobradiça na origem; o corpo vai para o lado de dentro do vão (-z para as de +z e +z para as de -z).
    const folha = (sentido: 1 | -1): THREE.InstancedMesh => {
      const g = new THREE.BoxGeometry(FOLHA_ESPESSURA, FOLHA_ALTURA, FOLHA_LARGURA);
      g.translate(FOLHA_ESPESSURA / 2, FOLHA_ALTURA / 2, (sentido * FOLHA_LARGURA) / 2);
      const malha = new THREE.InstancedMesh(g, this.materialDasFolhas, linhas.length);
      malha.frustumCulled = false;
      scene.add(malha);
      return malha;
    };
    this.folhasMais = folha(-1);
    this.folhasMenos = folha(1);
    this.posicionaAsFolhas();

    // O painel do quadro de luz: na face de leste do armário (1,2 m de fundo em x, o armário em x = -312).
    this.painel = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.5, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x0b1a10, metalness: 0.2, roughness: 0.5, emissive: 0x3dff7a, emissiveIntensity: 0.9 }),
    );
    this.painel.position.set(PRAIA_QUADRO_DE_LUZ.x + 0.65, 1.8, PRAIA_QUADRO_DE_LUZ.z);
    scene.add(this.painel);
  }

  /** As portas dos contêineres devem estar abertas (a onda está em campo)? A abertura anda até lá no `atualiza`. */
  setDesembarque(aberto: boolean): void {
    this.aberto = aberto;
  }

  /** Por quadro: leva a abertura ao alvo e, andando, refaz as seis matrizes; e pinta o painel do quadro (estado 0 a 2, vida 0 a 1). Sem alocar. */
  atualiza(dt: number, elapsed: number, estadoDoQuadro: number, vidaDoQuadro: number): void {
    const nova = aberturaDoDesembarque(this.abertura, this.aberto, dt);
    if (nova !== this.abertura) {
      this.abertura = nova;
      this.posicionaAsFolhas();
    }
    const a = aparenciaDoQuadro(estadoDoQuadro, vidaDoQuadro, elapsed);
    const material = this.painel.material as THREE.MeshStandardMaterial;
    material.emissive.setHex(a.cor);
    material.emissiveIntensity = a.intensidade;
  }

  /** O quanto as portas estão abertas agora (0 a 1). */
  get aberturaAtual(): number {
    return this.abertura;
  }

  private posicionaAsFolhas(): void {
    const angulo = this.abertura * ANGULO_ABERTO;
    this.materialDasFolhas.emissiveIntensity = this.abertura * 0.9;
    // As duas abrem para fora (o leste): a de +z gira com o ângulo negativo e a de -z com o positivo (rotação em torno de Y).
    this.poe(this.folhasMais, this.dobradicasMais, -angulo);
    this.poe(this.folhasMenos, this.dobradicasMenos, angulo);
  }

  private poe(malha: THREE.InstancedMesh, dobradicas: readonly { x: number; z: number }[], rot: number): void {
    this._q.setFromAxisAngle(this._eixo, rot);
    dobradicas.forEach((d, i) => malha.setMatrixAt(i, this._m.compose(this._p.set(d.x, 0, d.z), this._q, this._s)));
    malha.instanceMatrix.needsUpdate = true;
  }
}
