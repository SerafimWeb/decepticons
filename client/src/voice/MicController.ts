import { type Canal, canalDe } from './canais';

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
  /** As teclas dos canais (P237): "só o time" e "só o jogador escolhido" apertadas agora. Valem mesmo com o microfone mudo (apertar é pedir para falar). */
  time = false;
  privado = false;
  private faixa: FaixaMic | null = null;

  /** Liga a faixa do microfone (ou tira, com `null`) e acerta o estado dela. */
  usar(faixa: FaixaMic | null): void {
    this.faixa = faixa;
    // Sem microfone as teclas de canal não podem ficar "apertadas" para sempre (o soltar da tecla se perde): ao voltar o microfone ninguém fala sem apertar de novo.
    if (!faixa) this.soltarCanais();
    this.aplicar();
  }

  setModo(modo: ModoMic): void {
    this.mode = modo;
    this.apertada = false;
    this.soltarCanais();
    this.aplicar();
  }

  /** A tecla do chat de voz (`down` ao apertar, `false` ao soltar). */
  aoTecla(down: boolean): void {
    if (this.mode === 'ptt') this.apertada = down;
    else if (down) this.mudo = !this.mudo;
    this.aplicar();
  }

  /** A tecla de um canal (P237): `down` ao apertar, `false` ao soltar. */
  aoTeclaCanal(canal: 'time' | 'privado', down: boolean): void {
    if (canal === 'time') this.time = down;
    else this.privado = down;
    this.aplicar();
  }

  private soltarCanais(): void {
    this.time = false;
    this.privado = false;
  }

  /** A janela perdeu o foco: o PTT e as teclas dos canais não podem ficar presos abertos. */
  soltar(): void {
    this.apertada = false;
    this.soltarCanais();
    this.aplicar();
  }

  /** A voz está aberta para **todos** pelo modo de sempre (aberto e sem mudo, ou o PTT apertado)? */
  private get abertoParaTodos(): boolean {
    return this.mode === 'sempre' ? !this.mudo : this.apertada;
  }

  /** O canal em que o microfone fala agora, ou `null` se está calado. */
  get canal(): Canal | null {
    return this.faixa === null ? null : canalDe(this.abertoParaTodos, this.time, this.privado);
  }

  get temMic(): boolean {
    return this.faixa !== null;
  }

  /** Está mandando voz agora? */
  get transmitindo(): boolean {
    return this.faixa !== null && (this.time || this.privado || this.abertoParaTodos);
  }

  private aplicar(): void {
    if (this.faixa) this.faixa.enabled = this.transmitindo;
  }
}
