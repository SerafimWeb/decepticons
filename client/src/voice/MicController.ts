/** Como o microfone abre: `sempre` (aberto, a tecla alterna o mudo) ou `ptt` (só enquanto a tecla está apertada). */
export type ModoMic = 'sempre' | 'ptt';

/** O que o navegador deu: `pedindo` (esperando a resposta), `ativo`, `negado` (o jogador recusou) ou `sem` (sem microfone, ou ele caiu). */
export type EstadoMic = 'pedindo' | 'ativo' | 'negado' | 'sem';

/** O que o controle precisa de uma faixa de áudio (a `MediaStreamTrack` serve). */
export interface FaixaMic {
  enabled: boolean;
}

/**
 * Quando o microfone transmite (P205). Só liga e desliga a faixa (`track.enabled`): com ela desligada o navegador manda silêncio e, com o DTX do Opus (`opus.ts`), quase nenhum
 * pacote. Uma tecla só, dois jeitos: no modo `sempre` ela alterna o mudo (com o mouse travado no jogo, um botão na tela não alcança); no `ptt` vale enquanto apertada.
 */
export class MicController {
  mode: ModoMic = 'sempre';
  /** Mudo escolhido pelo jogador (só no modo `sempre`). */
  mudo = false;
  /** A tecla do PTT está apertada agora. */
  apertada = false;
  private faixa: FaixaMic | null = null;

  /** Liga a faixa do microfone (ou tira, com `null`) e acerta o estado dela. */
  usar(faixa: FaixaMic | null): void {
    this.faixa = faixa;
    this.aplicar();
  }

  setModo(modo: ModoMic): void {
    this.mode = modo;
    this.apertada = false;
    this.aplicar();
  }

  /** A tecla do chat de voz (`down` ao apertar, `false` ao soltar). */
  aoTecla(down: boolean): void {
    if (this.mode === 'ptt') this.apertada = down;
    else if (down) this.mudo = !this.mudo;
    this.aplicar();
  }

  /** A janela perdeu o foco: o PTT não pode ficar preso aberto. */
  soltar(): void {
    this.apertada = false;
    this.aplicar();
  }

  get temMic(): boolean {
    return this.faixa !== null;
  }

  /** Está mandando voz agora? */
  get transmitindo(): boolean {
    return this.faixa !== null && (this.mode === 'sempre' ? !this.mudo : this.apertada);
  }

  private aplicar(): void {
    if (this.faixa) this.faixa.enabled = this.transmitindo;
  }
}
