/**
 * A ENERGIA DO COMBATE (P315, a música que acompanha a ação): sobe com os acertos que envolvem o jogador e com os abates dele; cai com o
 * tempo (meia-vida de `meiaVidaS`). O nível dela escolhe a camada da música (`padraoDaMusica.ts`). Pura: sem áudio e sem relógio; quem
 * chama passa o tempo decorrido em `avancar`.
 */

/** O que cada evento soma: um acerto é um quarto de abate; um abate do jogador basta para a música subir de vez. */
export const PESO_ACERTO = 0.4;
export const PESO_ABATE = 6;
/** Acima deste valor, a tensão entra (baixo e bumbo). */
export const LIMIAR_TENSAO = 1.5;
/** Acima deste, o combate inteiro (caixa, chimbal e baixo nas colcheias). */
export const LIMIAR_COMBATE = 3.5;

export type NivelDaMusica = 0 | 1 | 2;

export class EnergiaDeCombate {
  private valor = 0;

  constructor(private readonly meiaVidaS = 4) {}

  get valorAtual(): number {
    return this.valor;
  }

  get nivel(): NivelDaMusica {
    if (this.valor >= LIMIAR_COMBATE) return 2;
    return this.valor >= LIMIAR_TENSAO ? 1 : 0;
  }

  registrar(peso: number): void {
    if (peso > 0) this.valor += peso;
  }

  /** Decai a energia pelo tempo decorrido, em segundos (meia-vida: a cada `meiaVidaS`, a metade). */
  avancar(dtS: number): void {
    if (dtS <= 0 || this.valor === 0) return;
    this.valor *= Math.pow(0.5, dtS / this.meiaVidaS);
    if (this.valor < 1e-3) this.valor = 0;
  }

  zerar(): void {
    this.valor = 0;
  }
}
