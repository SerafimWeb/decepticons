import * as THREE from 'three';
import { SLIDE_DA_LOGO } from '../brand/anuncios';
import { PALETTE } from '../core/palette';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { lerConfigDeOutdoors, OUTDOORS_PATH, PARAMETROS_PADRAO, type ParametrosDeOutdoors } from '../../../shared/outdoors';
import { serverHttpUrl } from '../../../shared/net/serverUrl';
import { criarArte } from './CidadeNeonArte';
import { ALTURA_DO_POSTE, BRACO_DO_POSTE, layoutDaCidade } from './CidadeNeonLayout';
import { criarLetreiros, criarNeons } from './CidadeNeonLetreiros';
import { criarReflexos, type FonteDeReflexo, type ReflexosCriados } from './CidadeNeonReflexos';
import { BueirosDaRua, criarPostes, materialDaRua } from './CidadeNeonRua';
import { criarTorres, type TorresCriadas, type UniformesDaCidade } from './CidadeNeonTorres';
import { HologramaSerafim } from './HologramaSerafim';
import type { ArenaDoCenario, CenarioDaCidade, CenarioDaCidadeCarregado } from './mapasSobDemanda';
import { criarOutdoors, type OutdoorsCriados } from './Outdoors';
import { criarSupercomputadores, type SupercomputadoresCriados } from './Supercomputadores';

/**
 * O ENTORNO DA CIDADE NEON (P264, PR2): "quero que o cenário fique nesse nível dos exemplos que enviei" (quatro quadros de uma cidade cyberpunk).
 * Monta, por cima da Arena de sempre (a mesma física, os mesmos prédios da praça), a cidade em volta dela:
 *
 *  - o paredão de torres em três filas, sumindo na névoa (`CidadeNeonTorres.ts`);
 *  - os **outdoors da marca** (P266: o Olho do Pai, a Serafim Web e a logo, `Outdoors.ts` + `brand/anuncios.ts`; P267: cada um alterna entre as imagens, e o Comandante ajusta quantos aparecem, o período e
 *    quais anúncios entram, pelo painel OUTDOORS — a configuração fica no servidor, `shared/outdoors.ts`), os letreiros de bandeira e os desenhos em neon (`CidadeNeonLetreiros.ts`);
 *  - o **holograma 3D da logo** da Serafim, flutuando sobre o prédio Serafim (`HologramaSerafim.ts`, P266);
 *  - os **supercomputadores**: as barricadas que quebram ganham corpo de máquina (mini-Mac gigante, rack blindado, nó quântico, banco de servidores; `Supercomputadores.ts`, P272), com LEDs que respiram;
 *  - a rua no lugar da grade Tron, os postes e os bueiros com vapor (`CidadeNeonRua.ts`);
 *  - o chão molhado refletindo tudo isso (`CidadeNeonReflexos.ts`).
 *
 * **Só desenho, só no navegador:** é um pedaço carregado sob demanda (`mapasSobDemanda.ts`), que só baixa quem joga a Cidade Neon; o servidor e
 * os testes de regra montam a Arena sem ele. Nenhum colisor: tudo fica fora da praça, no chão ou no ar.
 *
 * **Custo total:** ~14 draw calls instanciados (1 dos painéis dos outdoors, 1 do brilho, 3 do holograma, 9 do resto); por quadro, um relógio (uniforme), o giro do holograma e os relógios dos bueiros
 * (nenhuma alocação). As imagens dos outdoors (~0,47 MB) e a textura do holograma (37 KB) baixam em segundo plano.
 */

/** A placa do Banco Vorcaris (`BankSign.ts`): o chão molhado também a reflete. */
const PLACA_DO_BANCO = { x: -28, z: -26.6, y0: 22.3, y1: 25.7, largura: 12 } as const;

/** Só o que fica de frente para a praça reflete no chão dela (a segunda fila está escondida atrás da primeira, inclusive no espelho). */
const ALCANCE_DO_REFLEXO = 140;

/** Quanto o jogo espera pela configuração dos outdoors antes de ficar com a padrão (ms). */
const ESPERA_MS = 4000;

export class CidadeNeonCenario implements CenarioDaCidade {
  readonly luzes: readonly THREE.Color[];
  readonly totalDeOutdoors: number;
  private readonly layout = layoutDaCidade();
  private readonly u: UniformesDaCidade = { tempo: { value: 0 }, luz: { value: new THREE.Color(1, 1, 1) } };
  private readonly detalhe = { value: 1 };
  private readonly torres: TorresCriadas;
  private readonly reflexos: ReflexosCriados;
  private readonly bueiros: BueirosDaRua;
  private readonly outdoors: OutdoorsCriados;
  private readonly holograma: HologramaSerafim;
  private readonly servidores: SupercomputadoresCriados;
  private parametros: ParametrosDeOutdoors = PARAMETROS_PADRAO;

  constructor(scene: THREE.Scene, arena: ArenaDoCenario, particles: ParticleSystem | null) {
    const layout = this.layout;
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
    this.torres = criarTorres(layout.torres, this.u);
    scene.add(this.torres.malha, this.outdoors.grupo, criarLetreiros(layout.letreiros, arte, this.u), criarNeons(layout.neons, arte, this.u), criarPostes(layout.postes, this.u));
    this.bueiros = new BueirosDaRua(scene, layout.bueiros, particles);
    this.holograma = new HologramaSerafim(scene, this.u.tempo);
    // As barricadas que quebram viram supercomputadores (o desenho; o colisor e a vida seguem os da Arena).
    this.servidores = criarSupercomputadores(this.u.tempo);
    arena.estilizarBarricadas(this.servidores.estilo);

    const cor = (hex: number, k: number): THREE.Color => new THREE.Color(hex).multiplyScalar(k);
    const daPraca = (x: number, z: number): boolean => Math.max(Math.abs(x), Math.abs(z)) < ALCANCE_DO_REFLEXO;
    const fontes: FonteDeReflexo[] = [];
    // Cada outdoor reflete no chão a cor da imagem que está no ar (o shader escolhe, `cor` aqui só preenche): e some do chão quando sai do ar.
    layout.outdoors.forEach((o, indice) => {
      if (!daPraca(o.x, o.z)) return;
      fontes.push({
        x: o.x,
        z: o.z,
        y0: o.y - o.h / 2,
        y1: o.y + o.h / 2,
        largura: o.w * 0.8,
        cor: cor(0x19d3ff, 1),
        fase: -1,
        defeito: 0,
        outdoor: { indice, inicio: Math.max(0, o.inicio), fixo: o.anuncio === 'logo' ? SLIDE_DA_LOGO : -1, fase: o.fase },
      });
    });
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
    this.reflexos = criarReflexos(fontes, cabecas, this.u, this.outdoors.anuncios);
    scene.add(this.reflexos.grupo);
    // A luz da cidade inteira (janelas, outdoors, letreiros, postes, reflexos) é este uniforme: o transformador do banco o escurece (`Arena.registraLuzes`).
    this.luzes = [this.u.luz.value, ...this.servidores.luzes];
    this.totalDeOutdoors = layout.outdoors.length;
    this.aplicarOutdoors(PARAMETROS_PADRAO);
  }

  /**
   * Aplica a configuração dos outdoors (P267: quantos aparecem, o período e os anúncios que alternam): o painel e o reflexo no chão acompanham, e o prédio cujo outdoor saiu do ar volta a acender as
   * janelas. Leve (uns poucos uniformes e três atributos pequenos): pode ser chamado a cada passo de um controle deslizante.
   */
  aplicarOutdoors(parametros: ParametrosDeOutdoors): void {
    this.parametros = parametros;
    const estado = this.outdoors.aplicar(parametros);
    const corpos = new Set<number>();
    estado.forEach((e, i) => e.visivel && corpos.add(this.layout.outdoors[i]!.torre));
    this.torres.hospedar(corpos);
    this.reflexos.atualizarOutdoors(estado);
  }

  /** A configuração dos outdoors que vale agora. */
  outdoorsDaVez(): ParametrosDeOutdoors {
    return this.parametros;
  }

  /**
   * Busca no servidor o que o Comandante gravou (uma vez; nunca lança, nunca trava o jogo): sem rede ou sem nada gravado, valem os padrões do código. O Comandante muda pelo painel OUTDOORS
   * (`ui/OutdoorsPanel.ts`) e vale para todos na próxima vez que a cidade monta.
   */
  async carregarOutdoors(gameServer: string | undefined | null, buscar: typeof fetch = (...a) => fetch(...a)): Promise<void> {
    const url = serverHttpUrl(gameServer, OUTDOORS_PATH);
    if (!url) return;
    try {
      const res = await buscar(url, { cache: 'no-store', mode: 'cors', signal: AbortSignal.timeout(ESPERA_MS) });
      if (!res.ok) return;
      const { quantidade, periodo, desligados } = lerConfigDeOutdoors(await res.json());
      this.aplicarOutdoors({ quantidade, periodo, desligados });
    } catch {
      /* sem rede: os padrões do código */
    }
  }

  /** Por quadro: o relógio (todo o piscar e a troca de anúncio são conta do shader), o giro do holograma (e o número das camadas dele, pela distância da câmera) e o vapor dos bueiros. */
  update(dt: number, camera?: THREE.Vector3): void {
    this.u.tempo.value += dt;
    this.holograma.update(dt, camera);
    this.bueiros.update(dt);
  }

  /** A qualidade baixa (G12) tira o chão molhado, a grade de LEDs e o brilho dos outdoors, e metade das camadas do holograma. */
  /** A fase escura (P282): o holograma se apaga com a cidade (`escuridao` de 0 a 1; apagado a partir de metade). As luzes das torres, dos outdoors e dos letreiros já caem pelo uniforme `luzes`. */
  setEscuridao(escuridao: number): void {
    this.holograma.setLigado(escuridao < 0.5);
  }

  setDetalhe(alto: boolean): void {
    this.outdoors.setDetalhe(alto);
    this.holograma.setDetalhe(alto);
    this.reflexos.grupo.visible = alto;
  }
}

/** O que o registro de pedaços sob demanda entrega ao jogo. */
export const cenarioDaCidade: CenarioDaCidadeCarregado = {
  construir: (scene, arena, particles) => new CidadeNeonCenario(scene, arena, particles),
};
