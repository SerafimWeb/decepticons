import type { AudioSystem } from './AudioSystem';

/**
 * A TRILHA SONORA DO 8 DE JANEIRO (P248/P253, gravações trazidas pelo Comandante — berrante/trompete e um trompetista, de vídeos virais; o autor liberou o uso; metadados dos arquivos originais
 * removidos antes de entrar no repositório): alterna entre as faixas em laço, baixinho, enquanto a missão estiver de pé. **Pedaço sob demanda** (G3): só quem abre essa missão as baixa.
 *
 * **O contexto de áudio só nasce no primeiro clique do jogador** (política de autoplay do navegador, `AudioSystem.resume()`); a missão pode já ter carregado antes disso (ela monta no
 * construtor do `Game`, antes de qualquer clique) — sem repetir a tentativa, o som nunca tocava (achado em 24/10). `tocar()` agora tenta de novo a cada 500 ms até o contexto existir.
 */
export class TrilhaDaJaneiro {
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private buffers: AudioBuffer[] = [];
  private proxima = 0;
  private tentativa: ReturnType<typeof setTimeout> | null = null;
  private parado = false;

  constructor(private readonly audio: AudioSystem) {}

  /** Busca as faixas, decodifica e toca alternando entre elas em laço. Tenta de novo até o áudio ter contexto; sem efeito depois de `parar()`. */
  tocar(urls: readonly string[], volume = 0.3): void {
    if (this.parado || this.buffers.length || this.tentativa) return; // já tocando, já parou, ou já esperando o contexto
    const out = this.audio.output;
    if (!out) {
      this.tentativa = setTimeout(() => {
        this.tentativa = null;
        this.tocar(urls, volume);
      }, 500);
      return;
    }
    Promise.all(
      urls.map((url) =>
        fetch(url)
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
          .then((data) => out.ctx.decodeAudioData(data)),
      ),
    )
      .then((buffers) => {
        if (this.parado) return;
        this.buffers = buffers;
        const saida = this.audio.output;
        if (!saida) return;
        this.gain = saida.ctx.createGain();
        this.gain.gain.value = volume;
        this.gain.connect(saida.out);
        this.tocarProxima();
      })
      .catch(() => {});
  }

  /** Toca a próxima faixa do ciclo; encadeia a seguinte sozinha quando ela termina (sem laço por faixa: é o revezamento que faz o laço). */
  private tocarProxima(): void {
    const saida = this.audio.output;
    if (this.parado || !this.gain || !saida || !this.buffers.length) return;
    this.source = saida.ctx.createBufferSource();
    this.source.buffer = this.buffers[this.proxima % this.buffers.length]!;
    this.proxima++;
    this.source.connect(this.gain);
    this.source.onended = () => this.tocarProxima();
    this.source.start();
  }

  /** Para o revezamento e solta os nós (o chefão morreu, a missão acabou, o jogador saiu do mapa). */
  parar(): void {
    this.parado = true;
    if (this.tentativa) {
      clearTimeout(this.tentativa);
      this.tentativa = null;
    }
    if (this.source) this.source.onended = null;
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
