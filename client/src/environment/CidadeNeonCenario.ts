import * as THREE from 'three';
import { PALETTE } from '../core/palette';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { COR_DO_ANUNCIO, criarArte } from './CidadeNeonArte';
import { ALTURA_DO_POSTE, BRACO_DO_POSTE, layoutDaCidade } from './CidadeNeonLayout';
import { criarReflexos, type FonteDeReflexo } from './CidadeNeonReflexos';
import { BueirosDaRua, criarPostes, materialDaRua } from './CidadeNeonRua';
import { criarLetreiros, criarNeons, criarTeloes } from './CidadeNeonTeloes';
import { criarTorres, type UniformesDaCidade } from './CidadeNeonTorres';
import type { ArenaDoCenario, CenarioDaCidade, CenarioDaCidadeCarregado } from './mapasSobDemanda';

/**
 * O ENTORNO DA CIDADE NEON (P264, PR2): "quero que o cenário fique nesse nível dos exemplos que enviei" (quatro quadros de uma cidade cyberpunk).
 * Monta, por cima da Arena de sempre (a mesma física, os mesmos prédios da praça), a cidade em volta dela:
 *
 *  - o paredão de torres em três filas, sumindo na névoa (`CidadeNeonTorres.ts`);
 *  - os telões de propaganda, os letreiros de bandeira e os desenhos em neon (`CidadeNeonTeloes.ts`, arte em `CidadeNeonArte.ts`);
 *  - a rua no lugar da grade Tron, os postes e os bueiros com vapor (`CidadeNeonRua.ts`);
 *  - o chão molhado refletindo tudo isso (`CidadeNeonReflexos.ts`).
 *
 * **Só desenho, só no navegador:** é um pedaço carregado sob demanda (`mapasSobDemanda.ts`), que só baixa quem joga a Cidade Neon; o servidor e
 * os testes de regra montam a Arena sem ele. Nenhum colisor: tudo fica fora da praça ou no chão.
 *
 * **Custo total:** 11 draw calls instanciados; por quadro, um relógio (uniforme) e os relógios dos bueiros (nenhuma alocação). A arte é
 * desenhada em canvas uma vez, na montagem (~2 atlas de 1024²).
 */

/** A placa do Banco Vorcaris (`BankSign.ts`): o chão molhado também a reflete. */
const PLACA_DO_BANCO = { x: -28, z: -26.6, y0: 22.3, y1: 25.7, largura: 12 } as const;

/** Só o que fica de frente para a praça reflete no chão dela (a segunda fila está escondida atrás da primeira, inclusive no espelho). */
const ALCANCE_DO_REFLEXO = 140;

export class CidadeNeonCenario implements CenarioDaCidade {
  readonly luzes: readonly THREE.Color[];
  private readonly u: UniformesDaCidade = { tempo: { value: 0 }, luz: { value: new THREE.Color(1, 1, 1) } };
  private readonly detalhe = { value: 1 };
  private readonly chaoMolhado: THREE.Object3D;
  private readonly bueiros: BueirosDaRua;

  constructor(scene: THREE.Scene, arena: ArenaDoCenario, particles: ParticleSystem | null) {
    const layout = layoutDaCidade();
    const arte = criarArte();
    // O chão: a rua desenhada no lugar da grade Tron (o Comandante: "nesse quadriculado não achei bom não").
    if (arena.chao) {
      const antigo = arena.chao.material as THREE.MeshStandardMaterial;
      arena.chao.material = materialDaRua();
      antigo.map?.dispose(); // a textura de placas do piso antigo (128²) não é mais lida
      antigo.dispose();
    }
    if (arena.grade) arena.grade.visible = false;
    scene.add(
      criarTorres(layout.torres, this.u),
      criarTeloes(layout.teloes, arte, this.u, this.detalhe),
      criarLetreiros(layout.letreiros, arte, this.u),
      criarNeons(layout.neons, arte, this.u),
      criarPostes(layout.postes, this.u),
    );
    this.bueiros = new BueirosDaRua(scene, layout.bueiros, particles);

    const cor = (hex: number, k: number): THREE.Color => new THREE.Color(hex).multiplyScalar(k);
    const daPraca = (x: number, z: number): boolean => Math.max(Math.abs(x), Math.abs(z)) < ALCANCE_DO_REFLEXO;
    const fontes: FonteDeReflexo[] = [];
    for (const t of layout.teloes) {
      if (!daPraca(t.x, t.z)) continue;
      fontes.push({ x: t.x, z: t.z, y0: t.y - t.h / 2, y1: t.y + t.h / 2, largura: t.w * 0.8, cor: cor(COR_DO_ANUNCIO[(t.vertical ? 0 : 4) + t.primeiro]!, 1.2), fase: -1, defeito: 0 });
    }
    for (const l of layout.letreiros) fontes.push({ x: l.x, z: l.z, y0: l.y - l.altura / 2, y1: l.y + l.altura / 2, largura: l.largura * 0.7, cor: cor(l.cor, 1.5), fase: -1, defeito: 0 });
    for (const n of layout.neons) fontes.push({ x: n.x, z: n.z, y0: n.y - n.lado / 2, y1: n.y + n.lado / 2, largura: n.lado * 0.5, cor: cor(n.cor, 1), fase: -1, defeito: 0 });
    // A cabeça de cada poste fica sobre a avenida, na ponta do braço: o reflexo e a poça de luz nascem dela, e piscam junto.
    const cabecas: FonteDeReflexo[] = layout.postes.map((p) => ({
      x: p.x + p.fx * BRACO_DO_POSTE,
      z: p.z + p.fz * BRACO_DO_POSTE,
      y0: ALTURA_DO_POSTE - 0.45,
      y1: ALTURA_DO_POSTE - 0.15,
      largura: 1.4,
      cor: cor(p.corLuz, 2.2),
      fase: p.fase,
      defeito: p.defeito ? 1 : 0,
    }));
    fontes.push(...cabecas, { ...PLACA_DO_BANCO, cor: cor(PALETTE.bankBlue, 1.6), fase: -1, defeito: 0 });
    this.chaoMolhado = criarReflexos(fontes, cabecas, this.u);
    scene.add(this.chaoMolhado);
    // A luz da cidade inteira (janelas, telões, letreiros, postes, reflexos) é este uniforme: o transformador do banco o escurece (`Arena.registraLuzes`).
    this.luzes = [this.u.luz.value];
  }

  /** Por quadro: o relógio (todo o piscar e a troca de anúncio são conta do shader) e o vapor dos bueiros. */
  update(dt: number): void {
    this.u.tempo.value += dt;
    this.bueiros.update(dt);
  }

  /** A qualidade baixa (G12) tira o chão molhado e a grade de LEDs dos telões. */
  setDetalhe(alto: boolean): void {
    this.detalhe.value = alto ? 1 : 0;
    this.chaoMolhado.visible = alto;
  }
}

/** O que o registro de pedaços sob demanda entrega ao jogo. */
export const cenarioDaCidade: CenarioDaCidadeCarregado = {
  construir: (scene, arena, particles) => new CidadeNeonCenario(scene, arena, particles),
};
