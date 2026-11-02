import * as THREE from 'three';
import type { MechBase } from '../entities/MechBase';
import type { PlanoDeMissao } from '../sim/MissaoDeCombate';

/**
 * O marcador dos alvos da missão de combate (P314, corte 2): um losango vermelho girando sobre cada robô marcado, para o jogador saber
 * quem derrubar. Até três marcas (a destruição), criadas uma vez e reutilizadas: nada se cria por quadro (G4). Na aniquilação não há alvo
 * marcado (o inimigo inteiro conta), e fora da missão tudo fica escondido.
 */

const MAX_MARCAS = 3;
/** Onde o losango fica: a fração da altura do robô, acima do chão. */
const FRACAO_DA_ALTURA = 1.15;

export class MarcadorDeAlvo {
  private readonly marcas: THREE.Mesh[] = [];
  private readonly geometria = new THREE.OctahedronGeometry(0.45);
  private readonly material = new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.85, depthWrite: false });

  constructor(private readonly cena: THREE.Scene) {
    for (let i = 0; i < MAX_MARCAS; i++) {
      const marca = new THREE.Mesh(this.geometria, this.material);
      marca.visible = false;
      marca.renderOrder = 10;
      cena.add(marca);
      this.marcas.push(marca);
    }
  }

  /** Põe uma marca sobre cada alvo vivo do plano (os primeiros do elenco). `t` é o relógio em segundos, para o giro. `plano` null esconde tudo. */
  atualizar(plano: PlanoDeMissao | null, mechs: readonly MechBase[], t: number): void {
    const n = plano && !plano.exterminio ? Math.min(plano.alvos, MAX_MARCAS) : 0;
    for (let i = 0; i < MAX_MARCAS; i++) {
      const marca = this.marcas[i]!;
      const alvo = i < n ? mechs[i] : undefined;
      if (!alvo || !alvo.alive) {
        marca.visible = false;
        continue;
      }
      marca.visible = true;
      marca.position.set(alvo.root.position.x, alvo.root.position.y + alvo.stats.height * FRACAO_DA_ALTURA, alvo.root.position.z);
      marca.rotation.y = t * 2;
    }
  }

  /** Esconde todas as marcas (o fim da missão). */
  esconder(): void {
    for (const marca of this.marcas) marca.visible = false;
  }

  /** Tira as marcas da cena e solta a geometria e o material. */
  dispose(): void {
    for (const marca of this.marcas) this.cena.remove(marca);
    this.geometria.dispose();
    this.material.dispose();
  }
}
