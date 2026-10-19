import type * as THREE from 'three';
import { MultidaoDesenho } from '../environment/MultidaoDesenho';
import { Multidao, type ConfigDaMultidao } from '../sim/Multidao';
import { PRACA_FONTES, PRACA_PREDIOS, PRACA_SAIDAS } from '../environment/PracaLayout';
import type { MapId } from '../environment/Bunker';
import type { PedidoDaMultidao } from './multidaoLink';

/**
 * A DEMONSTRAÇÃO DA MULTIDÃO (P217, passo 3 da ficha do 8 DE JANEIRO): com `?multidao=1` no link (`multidaoLink.ts`), a multidão chega à Cidade Neon pelos ônibus, bueiros e lixeiras de
 * um mapa de teste, marcha até três alvos do lado leste, para na fachada e foge; **quem chega perto do jogador foge**. Existe para ver a multidão andando no jogo de verdade (a escala,
 * o andar, as cores, o custo na GPU) antes de o mapa e a missão do 8 DE JANEIRO existirem. **Marcado como DEMO** em `STATUS_REAL.md` (R13): os tiros do jogador ainda não a atingem, não há
 * prédio nem integridade, e a Cidade Neon não é o cenário.
 *
 * G3: módulo independente, ligado em `Game.ts` por duas chamadas (`passo` por tick fixo, `desenhar` por quadro). Custo: a simulação (0,04 ms por tick, `medicoes/MULTIDAO.md`) e três desenhos.
 */

/** O mapa de teste na Cidade Neon (200 m): dois ônibus e quatro bueiros no oeste, três lixeiras no meio, três alvos no leste, duas saídas. */
export function configDaDemo(p: PedidoDaMultidao, mapa: MapId = 'arena'): ConfigDaMultidao {
  // No mapa do 8 DE JANEIRO (a Praça dos Três Poderes) a multidão sai dos ônibus, bueiros e lixeiras de verdade do mapa e marcha até a frente dos três prédios.
  if (mapa === 'janeiro') {
    return { semente: p.semente, cota: p.cota, duracaoTicks: 18_000, fontes: PRACA_FONTES, predios: PRACA_PREDIOS.map((q) => q.frente), saidas: PRACA_SAIDAS };
  }
  return {
    semente: p.semente,
    cota: p.cota,
    duracaoTicks: 18_000,
    fontes: [
      { tipo: 'onibus', x: -96, z: -42 },
      { tipo: 'onibus', x: -96, z: 42 },
      { tipo: 'bueiro', x: -70, z: -62 },
      { tipo: 'bueiro', x: -52, z: -12 },
      { tipo: 'bueiro', x: -44, z: 46 },
      { tipo: 'bueiro', x: -68, z: 18 },
      { tipo: 'lixeira', x: -22, z: -52 },
      { tipo: 'lixeira', x: -14, z: -22 },
      { tipo: 'lixeira', x: -26, z: 32 },
    ],
    predios: [
      { x: 72, z: -46, meia: 14 },
      { x: 72, z: 0, meia: 14 },
      { x: 72, z: 46, meia: 14 },
    ],
    saidas: [
      { x: -140, z: 0 },
      { x: 0, z: -140 },
      { x: 0, z: 140 },
    ],
  };
}

export class MultidaoDemo {
  readonly multidao: Multidao;
  readonly desenho: MultidaoDesenho;
  private tick: number;
  private readonly susto = [{ x: 0, z: 0 }];

  constructor(
    scene: THREE.Scene,
    pedido: PedidoDaMultidao,
    private readonly jogador: () => { x: number; z: number },
    mapa: MapId = 'arena',
  ) {
    this.multidao = new Multidao(configDaDemo(pedido, mapa));
    this.desenho = new MultidaoDesenho(this.multidao);
    this.multidao.aoMorrer = (i) => this.desenho.aoMorrer(i);
    this.multidao.aoFugir = (i) => this.desenho.aoMudar(i);
    this.multidao.aoSair = (i) => this.desenho.aoSair(i);
    this.tick = pedido.inicio;
    // Começar no meio da fase: a Praça já vem cheia (sem repetir os avisos do passado).
    if (this.tick > 0) this.multidao.avancar(this.tick, true);
    scene.add(this.desenho.grupo);
  }

  /** Um tick fixo de 60 Hz. */
  passo(): void {
    this.tick++;
    this.multidao.avancar(this.tick);
    const j = this.jogador();
    this.susto[0]!.x = j.x;
    this.susto[0]!.z = j.z;
    this.multidao.assustarPorPerto(this.susto, 6, this.tick);
  }

  /** Uma vez por quadro: o tick com a fração entre dois ticks. */
  desenhar(alpha: number): void {
    this.desenho.atualizar(this.tick + alpha);
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.desenho.grupo);
    this.desenho.dispose();
  }
}
