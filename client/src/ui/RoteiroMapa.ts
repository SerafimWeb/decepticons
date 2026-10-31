import { marcosDoMapa, TacticalRadar, transformeDoRadar, type RadarQuadro } from './TacticalRadar';

/** A planta do mapa (prédios, zonas, rótulos), sem nenhuma unidade: o que o WARGAME precisa para desenhar o fundo. */
export type PlantaEstatica = Pick<RadarQuadro, 'mapa' | 'meia' | 'meiaZ' | 'zonas' | 'rotulos' | 'mar' | 'caixas'>;

/** O que o WARGAME põe por cima da planta (`desenhoDoMapa`, em `elencoDoWargame.ts`): os robôs onde nascem, as ordens como anéis numerados e as setas da batida em foco. */
export type DesenhoDoMapa = Pick<RadarQuadro, 'aliados' | 'inimigos' | 'marcas' | 'setas'> & { rotulos: readonly { x: number; z: number; texto: string; cor: string }[] };

const SEM_DESENHO: DesenhoDoMapa = { aliados: [], inimigos: [], rotulos: [], marcas: [], setas: [] };

/**
 * O mapa clicável de autoria do WARGAME (P262): a mesma planta do radar tático (`TacticalRadar`, 100% reaproveitado
 * para o desenho — prédios, zonas, rótulos, anéis de distância) com, por cima, **os robôs onde nascem, numerados**, as ordens como anéis numerados e as setas de quem vai aonde (P290: "não sei qual mech vai
 * em cada ponto"). Clicar no mapa converte o pixel em ponto do mundo (`transformeDoRadar`, a mesma conta que o radar usa para desenhar, invertida — sem raycasting 3D nenhum: é um mapa plano) e chama
 * `onClicar`; quem decide o que aquele clique vira (qual batida, qual lado) é o painel (G3).
 */
export class RoteiroMapa {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly radar: TacticalRadar;
  private desenho: DesenhoDoMapa = SEM_DESENHO;
  onClicar: ((x: number, z: number) => void) | null = null;

  constructor(private readonly planta: PlantaEstatica) {
    this.el = document.createElement('div');
    this.el.className = 'wargame-mapa';
    this.canvas = document.createElement('canvas');
    this.el.append(this.canvas);
    this.radar = new TacticalRadar(this.el, () => this.quadro());
    this.canvas.addEventListener('click', (e) => {
      if (!this.onClicar) return;
      const r = this.canvas.getBoundingClientRect();
      const meiaZ = this.planta.meiaZ ?? this.planta.meia;
      const { paraMundo } = transformeDoRadar(r.width, r.height, this.planta.meia, meiaZ);
      const { x, z } = paraMundo(e.clientX - r.left, e.clientY - r.top);
      this.onClicar(x, z);
    });
  }

  private quadro(): RadarQuadro {
    const d = this.desenho;
    // Os números dos robôs vêm junto dos marcos da planta (VORCARIS, SERAFIM): uma lista só de rótulos.
    const marcos = marcosDoMapa(this.planta);
    return { ...this.planta, rotulos: [...marcos, ...d.rotulos], voce: null, aliados: d.aliados, inimigos: d.inimigos, ...(d.marcas ? { marcas: d.marcas } : {}), ...(d.setas ? { setas: d.setas } : {}) };
  }

  /** Liga o desenho (o painel chama ao abrir: o mapa só existe enquanto a janela está aberta). */
  ligar(): void {
    this.radar.acender();
  }

  /** Desliga e solta o observador de tamanho (o painel chama ao fechar). */
  desligar(): void {
    this.radar.dispose();
  }

  /** O que desenhar agora; redesenha na hora (sem isto, a mudança só apareceria no próximo redimensionamento). */
  atualizar(desenho: DesenhoDoMapa): void {
    this.desenho = desenho;
    this.radar.desenhar();
  }
}
