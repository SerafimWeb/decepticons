import { chegouAAldeia } from './DragaMarcha';

/**
 * A MISSÃO DO RIO (ordem P180, parte C, `AMAZONIA.md` § 6): a regra de fim da fase **RIO VIVO**, **pura** (G1/G2, G14: só números). Dois finais, os dois do Draga-01:
 *
 *  - **VITÓRIA:** o Draga caiu (o tronco zerou). A cura do rio e a invasão com androides (partes D e E) vêm depois; por ora, derrubar o Draga é vencer.
 *  - **DERROTA:** o Draga chegou à aldeia (o corpo cruzou `LINHA_DA_ALDEIA_X`). **O jogador morrer não perde a missão** (ele renasce na aldeia: quem perde é o rio), como na praia.
 *
 * Quem a alimenta é a partida (`Match`): a posição do chefe a cada tick (`null` se ele caiu) e os abates e o dano, para o placar de fim. O fim dispara **uma vez** (`aoTerminar`).
 * Custo: duas comparações por tick.
 */

export type FaseDaMissaoDoRio = 'marcha' | 'vitoria' | 'derrota';

/** O placar de fim (o mesmo molde do `MissionStats` das ondas, sem as ondas). */
export interface ResultadoDaMissaoDoRio {
  abates: number;
  danoCausado: number;
  segundos: number;
}

export class MissaoDoRio {
  fase: FaseDaMissaoDoRio = 'marcha';
  /** Segundos de marcha (o relógio só corre enquanto a missão está em andamento). */
  tempoS = 0;
  abates = 0;
  danoCausado = 0;

  constructor(private readonly aoTerminar?: (sobreviveu: boolean, resultado: ResultadoDaMissaoDoRio) => void) {}

  get terminou(): boolean {
    return this.fase !== 'marcha';
  }

  /** O resultado até agora (a tela de fim lê daqui). */
  get resultado(): ResultadoDaMissaoDoRio {
    return { abates: this.abates, danoCausado: this.danoCausado, segundos: this.tempoS };
  }

  registrarAbate(): void {
    if (!this.terminou) this.abates++;
  }

  registrarDano(quanto: number): void {
    if (!this.terminou && quanto > 0) this.danoCausado += quanto;
  }

  /**
   * Um tick: `chefeX` é o x do Draga, ou `null` se ele caiu. **Se os dois acontecem no mesmo tick (ele cai ao cruzar a linha), vale a vitória**: o tiro que derrubou o Draga chegou antes dele
   * pisar na aldeia.
   */
  fixedUpdate(dt: number, chefeX: number | null): void {
    if (this.terminou) return;
    this.tempoS += dt;
    if (chefeX === null) this.terminar('vitoria');
    else if (chegouAAldeia(chefeX)) this.terminar('derrota');
  }

  private terminar(fase: 'vitoria' | 'derrota'): void {
    this.fase = fase;
    this.aoTerminar?.(fase === 'vitoria', this.resultado);
  }

  /** Recomeça a missão (o jogo reinicia a partida). */
  reset(): void {
    this.fase = 'marcha';
    this.tempoS = 0;
    this.abates = 0;
    this.danoCausado = 0;
  }
}
