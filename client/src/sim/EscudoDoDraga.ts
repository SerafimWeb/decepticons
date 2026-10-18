/**
 * O ESCUDO DO DRAGA-01 (ordem P180, parte D; `AMAZONIA.md` § 6, ato 1): *"há uma enorme força de defesa deles e teremos que desmantelar"*. O Draga marcha protegido por um **escudo** que três
 * **geradores** alimentam, espalhados pela margem e pela mina. **Enquanto algum gerador está de pé, o Draga leva 90% menos dano**; derrubar os três derruba o escudo, e dali em diante ele é um
 * alvo como outro qualquer (o corpo, as pernas e o resto da missão seguem a parte C). O escudo **não volta** sozinho: a missão obriga o jogador a ir até a defesa antes de enfrentar a máquina.
 *
 * Regra **pura** (G1/G2, G14): só números, sem relógio nem sorteio; roda igual no cliente, no servidor e nos testes. Quem a usa (`Match`) liga a quebra de cada gerador a `quebrar(i)` e lê
 * `fator` para escalar o dano que o corpo do Draga recebe (`DragaMech.escudo`). Custo: zero por tick (um booleano e um número).
 */

/** Os números do escudo. */
export const ESCUDO_DO_DRAGA = {
  /** Quantos geradores o alimentam (os três pontos de `AMAZONIA_GERADORES`). */
  geradores: 3,
  /** Quanto do dano chega ao Draga com o escudo de pé (90% menos: chega 10%). */
  fatorComEscudo: 0.1,
  /** A vida de cada gerador: o canhão de plasma de fábrica (~25 por tiro) leva meio minuto; um canhão pesado (90 por tiro), uns dez segundos. */
  vidaDoGerador: 1500,
} as const;

export class EscudoDoDraga {
  private readonly vivos: boolean[];
  private _derrubadoNoTick = false;

  constructor(readonly total: number = ESCUDO_DO_DRAGA.geradores) {
    this.vivos = Array.from({ length: total }, () => true);
  }

  /** Quantos geradores ainda estão de pé. */
  get geradoresVivos(): number {
    let n = 0;
    for (const v of this.vivos) if (v) n++;
    return n;
  }

  /** O escudo está de pé? (Algum gerador vivo.) */
  get ativo(): boolean {
    return this.geradoresVivos > 0;
  }

  /** O multiplicador do dano que o Draga recebe agora (1 sem escudo). */
  get fator(): number {
    return this.ativo ? ESCUDO_DO_DRAGA.fatorComEscudo : 1;
  }

  /** O gerador `i` ainda está de pé? */
  vivo(i: number): boolean {
    return this.vivos[i] === true;
  }

  /** O último gerador caiu neste tick (o escudo acabou de cair): o aviso e o desenho da cúpula leem isto uma vez e limpam com `consumirQueda`. */
  get derrubadoNoTick(): boolean {
    return this._derrubadoNoTick;
  }

  consumirQueda(): void {
    this._derrubadoNoTick = false;
  }

  /** O gerador `i` caiu. Devolve `true` se com ele o escudo caiu (o último). Índice fora da faixa ou gerador já caído: não faz nada e devolve `false`. */
  quebrar(i: number): boolean {
    if (!Number.isInteger(i) || i < 0 || i >= this.vivos.length || !this.vivos[i]) return false;
    this.vivos[i] = false;
    if (!this.ativo) {
      this._derrubadoNoTick = true;
      return true;
    }
    return false;
  }

  /** Rodada nova: os geradores voltam e o escudo também. */
  reiniciar(): void {
    this.vivos.fill(true);
    this._derrubadoNoTick = false;
  }
}

/** O aviso da tela quando um gerador cai (`antes` e `depois` são os geradores de pé): o que resta, ou a queda do escudo. Sem queda, `null`. */
export function avisoDoEscudo(antes: number, depois: number): string | null {
  if (!(depois < antes)) return null;
  return depois <= 0 ? 'ESCUDO DO DRAGA CAIU' : `GERADOR CAIU · RESTAM ${depois}`;
}
