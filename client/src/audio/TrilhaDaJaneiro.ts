import type { AudioSystem } from './AudioSystem';

/**
 * A TRILHA SONORA DO 8 DE JANEIRO (P248, gravação trazida pelo Comandante — berrante e trompete, de um vídeo viral; o autor liberou o uso; metadados do arquivo original removidos antes de
 * entrar no repositório): toca em laço, baixinho, enquanto a missão estiver de pé. **Pedaço sob demanda** (G3): só quem abre essa missão a baixa.
 *
 * Simples de propósito: um `AudioBufferSourceNode` em laço, sem variação de tom nem camadas — se um dia pedir mistura com outros sons da fase, aí sim vale uma classe maior.
 */
export class TrilhaDaJaneiro {
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;

  constructor(private readonly audio: AudioSystem) {}

  /** Busca o arquivo, decodifica e toca em laço. Sem efeito se o áudio ainda não tem contexto (sem gesto do jogador) ou está desligado. */
  tocar(url: string, volume = 0.3): void {
    const out = this.audio.output;
    if (!out) return;
    fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((data) => (data ? out.ctx.decodeAudioData(data) : null))
      .then((buffer) => {
        if (!buffer || this.source) return; // já parou ou já tocando (não duplica se tocar() for chamado de novo)
        const saida = this.audio.output;
        if (!saida) return;
        this.gain = saida.ctx.createGain();
        this.gain.gain.value = volume;
        this.gain.connect(saida.out);
        this.source = saida.ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.loop = true;
        this.source.connect(this.gain);
        this.source.start();
      })
      .catch(() => {});
  }

  /** Para o laço e solta os nós (o chefão morreu, a missão acabou, o jogador saiu do mapa). */
  parar(): void {
    try {
      this.source?.stop();
    } catch {
      /* já parado */
    }
    this.source?.disconnect();
    this.gain?.disconnect();
    this.source = null;
    this.gain = null;
  }
}
