/**
 * A locução sintetizada da abertura da rodada ("Rodada 2", "Combate!"): o navegador fala com a voz do próprio sistema (`speechSynthesis`), sem arquivo de áudio.
 * Só da tela (G1/G2). Sem suporte, sem voz em português ou com o som desligado, **não fala e não falha**: a abertura continua com o número e os bipes.
 *
 * Uma frase por vez: falar a seguinte corta a anterior (a contagem não acumula fila atrás da tela). Custo: uma chamada ao navegador por frase, só na abertura.
 */
export interface Sintetizador {
  speak(u: unknown): void;
  cancel(): void;
}

export interface OpcoesDaLocucao {
  /** O sintetizador do navegador (`speechSynthesis`) ou um de mentira nos testes; `null` = sem locução. */
  sintetizador: Sintetizador | null;
  /** Cria a fala (`new SpeechSynthesisUtterance(texto)`); injetado para o teste não depender do navegador. */
  criar: (texto: string) => { lang: string; volume: number; rate: number };
  /** O som está ligado? (o mesmo interruptor do `AudioSystem`). */
  ligada: () => boolean;
  /** O volume mestre (0 a 1). */
  volume: () => number;
}

export class Locucao {
  constructor(private readonly o: OpcoesDaLocucao) {}

  /** Fala em português; devolve `false` se não falou (sem sintetizador, som desligado, volume zero ou erro do navegador). */
  falar(texto: string): boolean {
    const { sintetizador } = this.o;
    const volume = Math.min(1, Math.max(0, this.o.volume()));
    if (!sintetizador || !this.o.ligada() || volume <= 0 || !texto.trim()) return false;
    try {
      const u = this.o.criar(texto);
      u.lang = 'pt-BR';
      u.volume = volume;
      u.rate = 1.05;
      sintetizador.cancel();
      sintetizador.speak(u);
      return true;
    } catch {
      return false;
    }
  }
}

/** A locução do navegador de verdade (ou uma que nunca fala, onde não há `speechSynthesis`). */
export function locucaoDoNavegador(ligada: () => boolean, volume: () => number): Locucao {
  const ok = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  return new Locucao({
    sintetizador: ok ? window.speechSynthesis : null,
    criar: (texto) => new SpeechSynthesisUtterance(texto),
    ligada,
    volume,
  });
}
