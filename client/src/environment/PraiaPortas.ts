import * as THREE from 'three';
import { PORTAS_DA_ESTACAO } from '../sim/PortasDaEstacao';

/**
 * AS DUAS PORTAS DO PRÉDIO DA ESTAÇÃO (P163, frente 2), desenhadas: uma em cada fachada (a principal, voltada para o pátio e o portão do mar; a dos fundos, para a rua de
 * trás). **Fechada**, é uma chapa de aço com a luz ciano da estação; **forçada**, vai ficando laranja e treme conforme a vida cai; **arrombada**, escurece, **abre de lado** e pisca
 * em vermelho. É só desenho: o estado vem de `PortasDaEstacao` (por `Praia.setPortas`).
 *
 * **Custo:** dois desenhos (uma caixa cada, com material próprio) e, por quadro, a cor, a emissão e a posição de duas malhas: nenhuma alocação.
 */

const LARGURA = 5;
const ALTURA = 4;
const ESPESSURA = 0.35;
/** As fachadas do prédio (288, 64), 40 × 28 m: a sul em z = 50 e a norte em z = 78. A porta encosta nelas, para fora. */
const FACHADA_SUL_Z = 50;
const FACHADA_NORTE_Z = 78;

export interface AparenciaDaPorta {
  /** A cor da chapa (hexa). */
  cor: number;
  /** A cor da luz da porta (hexa). */
  emissiva: number;
  /** A força da luz (0 a ~2). */
  intensidade: number;
  /** O quanto a porta abriu de lado (0 fechada, perto de 0,8 arrombada). */
  abertura: number;
}

/** A aparência da porta `i` no estado `estado` (0 fechada, 1 forçada, 2 arrombada), com a vida (0 a 1) e o tempo. Pura: o desenho e o teste leem a mesma. */
export function aparenciaDaPorta(estado: number, vida: number, elapsed: number, i: number): AparenciaDaPorta {
  if (estado === 2) return { cor: 0x20120f, emissiva: 0xff2030, intensidade: Math.sin(elapsed * 7 + i) > 0 ? 1.6 : 0.3, abertura: 0.78 };
  if (estado === 1) {
    const dano = Math.min(1, Math.max(0, 1 - vida));
    return { cor: 0x4a3a30, emissiva: 0xff8a1a, intensidade: 0.8 + 0.6 * dano * (0.6 + 0.4 * Math.sin(elapsed * 9 + i * 2)), abertura: 0.06 * dano };
  }
  return { cor: 0x34404a, emissiva: 0x18d8ff, intensidade: 0.35, abertura: 0 };
}

export class PraiaPortas {
  private readonly malhas: THREE.Mesh[] = [];
  private readonly xBase: number[] = [];

  constructor(scene: THREE.Scene) {
    const geometria = new THREE.BoxGeometry(LARGURA, ALTURA, ESPESSURA);
    PORTAS_DA_ESTACAO.forEach((p, i) => {
      const material = new THREE.MeshStandardMaterial({ color: 0x34404a, metalness: 0.5, roughness: 0.55, emissive: 0x18d8ff, emissiveIntensity: 0.35 });
      const malha = new THREE.Mesh(geometria, material);
      const z = i === 0 ? FACHADA_SUL_Z - ESPESSURA / 2 + 0.02 : FACHADA_NORTE_Z + ESPESSURA / 2 - 0.02;
      malha.position.set(p.x, ALTURA / 2, z);
      malha.matrixAutoUpdate = true;
      scene.add(malha);
      this.malhas.push(malha);
      this.xBase.push(p.x);
    });
  }

  /** Por quadro: o estado (0 a 2) e a vida (0 a 1) de cada porta e o tempo. Sem alocar. */
  atualiza(elapsed: number, estado: ArrayLike<number>, vida: ArrayLike<number>): void {
    for (let i = 0; i < this.malhas.length; i++) {
      const a = aparenciaDaPorta(estado[i] ?? 0, vida[i] ?? 1, elapsed, i);
      const malha = this.malhas[i]!;
      const material = malha.material as THREE.MeshStandardMaterial;
      material.color.setHex(a.cor);
      material.emissive.setHex(a.emissiva);
      material.emissiveIntensity = a.intensidade;
      // Abre de lado: a borda esquerda fica onde estava e a chapa encolhe para ela, deixando o vão do lado direito.
      malha.scale.x = 1 - a.abertura;
      malha.position.x = this.xBase[i]! - (a.abertura * LARGURA) / 2;
    }
  }
}
