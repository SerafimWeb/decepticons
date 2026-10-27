import type { LadoDoBot } from '../sim/esquadrao';
import { TacticalRadar, transformeDoRadar, type RadarQuadro } from './TacticalRadar';

export interface PontoDoMapa {
  lado: LadoDoBot;
  x: number;
  z: number;
}

/** A planta do mapa (prédios, zonas, rótulos), sem nenhuma unidade: o que o WARGAME precisa para desenhar o fundo. */
export type PlantaEstatica = Pick<RadarQuadro, 'mapa' | 'meia' | 'meiaZ' | 'zonas' | 'rotulos' | 'mar' | 'caixas'>;

/**
 * O mapa clicável de autoria do WARGAME (P262): a mesma planta do radar tático (`TacticalRadar`, 100% reaproveitado
 * para o desenho — prédios, zonas, rótulos, anéis de distância), sem nenhuma unidade viva — só os pontos que o
 * roteiro já tem marcados (um por batida com ordem), desenhados na cor do lado (o próprio `TacticalRadar` já pinta
 * `aliados` de ciano e `inimigos` de vermelho). Clicar no mapa converte o pixel em ponto do mundo
 * (`transformeDoRadar`, a mesma conta que o radar usa para desenhar, invertida — sem raycasting 3D nenhum: é um
 * mapa plano) e chama `onClicar`; quem decide o que aquele clique vira (qual batida, qual lado) é o painel (G3).
 */
export class RoteiroMapa {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly radar: TacticalRadar;
  private pontos: readonly PontoDoMapa[] = [];
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
    return {
      ...this.planta,
      voce: null,
      aliados: this.pontos.filter((p) => p.lado === 'aliado'),
      inimigos: this.pontos.filter((p) => p.lado === 'inimigo').map((p) => ({ x: p.x, z: p.z, grande: true })),
    };
  }

  /** Liga o desenho (o painel chama ao abrir: o mapa só existe enquanto a janela está aberta). */
  ligar(): void {
    this.radar.acender();
  }

  /** Desliga e solta o observador de tamanho (o painel chama ao fechar). */
  desligar(): void {
    this.radar.dispose();
  }

  /** Os pontos marcados agora (um por batida com ordem); redesenha na hora (sem isto, a mudança só apareceria no próximo redimensionamento). */
  atualizarPontos(pontos: readonly PontoDoMapa[]): void {
    this.pontos = pontos;
    this.radar.desenhar();
  }
}
