/**
 * A sequência de abates do jogador (P96, "2/3/4 abates em poucos segundos, com som próprio"): só conta e diz o número. Quem mostra é o `KillBanner`; quem toca
 * o som é o `AudioSystem`. É da tela, não da simulação (G1/G2): o relógio é o de quem chama, e nada aqui entra no estado da partida.
 *
 * **A regra:** um abate dentro de `JANELA_DA_SEQUENCIA_S` do anterior continua a sequência; depois disso começa outra (1). Morrer zera. Custo: um número somado por abate.
 */
export const JANELA_DA_SEQUENCIA_S = 5;

export class SequenciaDeAbates {
  private n = 0;
  private ultimo = Number.NEGATIVE_INFINITY;
  private recorde = 0;

  /** Registra um abate do jogador no instante `agora` (segundos, qualquer relógio que só cresça). Devolve a sequência: 1, 2, 3… */
  abate(agora: number): number {
    this.n = agora - this.ultimo <= JANELA_DA_SEQUENCIA_S ? this.n + 1 : 1;
    this.ultimo = agora;
    if (this.n > this.recorde) this.recorde = this.n;
    return this.n;
  }

  /** O jogador morreu (ou a rodada recomeçou): a sequência volta a zero. O recorde fica. */
  zerar(): void {
    this.n = 0;
    this.ultimo = Number.NEGATIVE_INFINITY;
  }

  /** A sequência de agora (0 se zerada). */
  get atual(): number {
    return this.n;
  }

  /** A maior sequência desde que o objeto nasceu (a do resumo da rodada). */
  get melhor(): number {
    return this.recorde;
  }

  /** Zera também o recorde (rodada nova). */
  reiniciar(): void {
    this.zerar();
    this.recorde = 0;
  }
}
