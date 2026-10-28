import * as THREE from 'three';
import { anuncioPorId } from '../brand/anuncios';
import { PALETTE } from '../core/palette';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { criarArte } from './CidadeNeonArte';
import { ALTURA_DO_POSTE, BRACO_DO_POSTE, layoutDaCidade } from './CidadeNeonLayout';
import { criarLetreiros, criarNeons } from './CidadeNeonLetreiros';
import { criarReflexos, type FonteDeReflexo } from './CidadeNeonReflexos';
import { BueirosDaRua, criarPostes, materialDaRua } from './CidadeNeonRua';
import { criarTorres, type UniformesDaCidade } from './CidadeNeonTorres';
import { HologramaSerafim } from './HologramaSerafim';
import type { ArenaDoCenario, CenarioDaCidade, CenarioDaCidadeCarregado } from './mapasSobDemanda';
import { criarOutdoors, type OutdoorsCriados } from './Outdoors';

/**
 * O ENTORNO DA CIDADE NEON (P264, PR2): "quero que o cenário fique nesse nível dos exemplos que enviei" (quatro quadros de uma cidade cyberpunk).
 * Monta, por cima da Arena de sempre (a mesma física, os mesmos prédios da praça), a cidade em volta dela:
 *
 *  - o paredão de torres em três filas, sumindo na névoa (`CidadeNeonTorres.ts`);
 *  - os **outdoors da marca** (P266: o Olho do Pai, a Serafim Web e a logo, `Outdoors.ts` + `brand/anuncios.ts`), os letreiros de bandeira e os desenhos em neon (`CidadeNeonLetreiros.ts`);
 *  - o **holograma 3D da logo** da Serafim, flutuando sobre o prédio Serafim (`HologramaSerafim.ts`, P266);
 *  - a rua no lugar da grade Tron, os postes e os bueiros com vapor (`CidadeNeonRua.ts`);
 *  - o chão molhado refletindo tudo isso (`CidadeNeonReflexos.ts`).
 *
 * **Só desenho, só no navegador:** é um pedaço carregado sob demanda (`mapasSobDemanda.ts`), que só baixa quem joga a Cidade Neon; o servidor e
 * os testes de regra montam a Arena sem ele. Nenhum colisor: tudo fica fora da praça, no chão ou no ar.
 *
 * **Custo total:** ~20 draw calls instanciados (7 dos outdoors, 1 do brilho, 3 do holograma, 11 do resto); por quadro, um relógio (uniforme), o giro do holograma e os relógios dos bueiros
 * (nenhuma alocação). As imagens dos outdoors (~0,47 MB) e a textura do holograma (37 KB) baixam em segundo plano.
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
  private readonly outdoors: OutdoorsCriados;
  private readonly holograma: HologramaSerafim;

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
    this.outdoors = criarOutdoors(layout.outdoors, this.u, this.detalhe);
    scene.add(
      criarTorres(layout.torres, this.u),
      this.outdoors.grupo,
      criarLetreiros(layout.letreiros, arte, this.u),
      criarNeons(layout.neons, arte, this.u),
      criarPostes(layout.postes, this.u),
    );
    this.bueiros = new BueirosDaRua(scene, layout.bueiros, particles);
    this.holograma = new HologramaSerafim(scene, this.u.tempo);

    const cor = (hex: number, k: number): THREE.Color => new THREE.Color(hex).multiplyScalar(k);
    const daPraca = (x: number, z: number): boolean => Math.max(Math.abs(x), Math.abs(z)) < ALCANCE_DO_REFLEXO;
    const fontes: FonteDeReflexo[] = [];
    // Cada outdoor reflete no chão a cor do anúncio dele (o do slide que alterna, a do primeiro slide).
    for (const o of layout.outdoors) {
      if (!daPraca(o.x, o.z)) continue;
      fontes.push({ x: o.x, z: o.z, y0: o.y - o.h / 2, y1: o.y + o.h / 2, largura: o.w * 0.8, cor: cor(anuncioPorId(o.anuncio).cor, 1.2), fase: -1, defeito: 0 });
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
    // A luz da cidade inteira (janelas, outdoors, letreiros, postes, reflexos) é este uniforme: o transformador do banco o escurece (`Arena.registraLuzes`).
    this.luzes = [this.u.luz.value];
  }

  /** Por quadro: o relógio (todo o piscar e a troca de anúncio são conta do shader), o giro do holograma (e o número das camadas dele, pela distância da câmera) e o vapor dos bueiros. */
  update(dt: number, camera?: THREE.Vector3): void {
    this.u.tempo.value += dt;
    this.holograma.update(dt, camera);
    this.bueiros.update(dt);
  }

  /** A qualidade baixa (G12) tira o chão molhado, a grade de LEDs e o brilho dos outdoors, e metade das fatias do holograma. */
  setDetalhe(alto: boolean): void {
    this.outdoors.setDetalhe(alto);
    this.holograma.setDetalhe(alto);
    this.chaoMolhado.visible = alto;
  }
}

/** O que o registro de pedaços sob demanda entrega ao jogo. */
export const cenarioDaCidade: CenarioDaCidadeCarregado = {
  construir: (scene, arena, particles) => new CidadeNeonCenario(scene, arena, particles),
};
