import { nivelDaOnda } from './saudeDoMic';

/**
 * O ENVIO DA VOZ (P237): o caminho do microfone até cada colega, passando por um grafo de Web Audio **só do chat**, num `AudioContext` próprio (a voz nunca depende do estado do áudio do jogo):
 *
 *   microfone → ganho (o ajuste do jogador) → limitador (o ganho nunca estoura) → analisador (o nível e a saúde do microfone)
 *                                                                    └→ uma porta (0 ou 1) por colega → o destino dele → a faixa que o WebRTC manda
 *
 * Três coisas que o envio direto da faixa crua não dava: **ganho** (o fone Bluetooth em modo mãos-livres é baixo), **leitura do nível** (para a barra do HUD e para saber que o microfone abriu mas
 * só entrega silêncio) e uma **porta por colega** (os canais: falar só com o time ou com um jogador escolhido é abrir ou fechar a porta, sem renegociar nada). Custo: um punhado de nós de áudio,
 * na thread do Web Audio; por quadro, nada; a leitura do nível roda a ~10 Hz (1.024 amostras). Se o navegador não o monta, o chat volta a mandar a faixa crua (nada quebra).
 */
export class EnvioDeVoz {
  private readonly fonte: MediaStreamAudioSourceNode;
  private readonly ganho: GainNode;
  private readonly limitador: DynamicsCompressorNode;
  private readonly analisador: AnalyserNode;
  private readonly pares = new Map<number, { porta: GainNode; destino: MediaStreamAudioDestinationNode }>();
  private onda: Float32Array<ArrayBuffer> = new Float32Array(1024);
  /** Quando nasceu (ms): um contexto que continua suspenso depois de alguns segundos não serve (o chat abandona o envio e volta à faixa crua). */
  readonly criadoEm = performance.now();

  constructor(
    readonly ctx: AudioContext,
    faixa: MediaStreamTrack,
    ganho: number,
  ) {
    void ctx.resume();
    this.fonte = ctx.createMediaStreamSource(new MediaStream([faixa]));
    this.ganho = ctx.createGain();
    this.ganho.gain.value = ganho;
    // O limitador: um compressor de razão alta perto do teto. Com ganho de até 4x, uma voz alta passaria de 1 e o codec cortaria.
    this.limitador = ctx.createDynamicsCompressor();
    this.limitador.threshold.value = -3;
    this.limitador.knee.value = 0;
    this.limitador.ratio.value = 20;
    this.limitador.attack.value = 0.001;
    this.limitador.release.value = 0.1;
    this.analisador = ctx.createAnalyser();
    this.analisador.fftSize = 1024;
    this.fonte.connect(this.ganho);
    this.ganho.connect(this.limitador);
    this.limitador.connect(this.analisador);
  }

  get funcionando(): boolean {
    return this.ctx.state === 'running';
  }

  setGanho(g: number): void {
    this.ganho.gain.value = g;
  }

  /** A faixa que vai a um colega (cria a porta dele na primeira vez). A porta nasce aberta. */
  faixaPara(id: number): MediaStreamTrack | null {
    let p = this.pares.get(id);
    if (!p) {
      const porta = this.ctx.createGain();
      porta.gain.value = 1;
      const destino = this.ctx.createMediaStreamDestination();
      this.limitador.connect(porta);
      porta.connect(destino);
      p = { porta, destino };
      this.pares.set(id, p);
    }
    return p.destino.stream.getAudioTracks()[0] ?? null;
  }

  /** Abre ou fecha a porta de um colega: é assim que um canal escolhe quem ouve. Instantâneo, sem renegociar. */
  abrirPara(id: number, aberto: boolean): void {
    const p = this.pares.get(id);
    if (p) p.porta.gain.value = aberto ? 1 : 0;
  }

  soltarPar(id: number): void {
    const p = this.pares.get(id);
    if (!p) return;
    this.pares.delete(id);
    try {
      this.limitador.disconnect(p.porta);
      p.porta.disconnect();
    } catch {
      // já solto
    }
    for (const t of p.destino.stream.getTracks()) t.stop();
  }

  /** O nível do que sai agora (já com o ganho): RMS e pico das últimas 1.024 amostras. */
  ler(): { rms: number; pico: number } {
    this.analisador.getFloatTimeDomainData(this.onda);
    return nivelDaOnda(this.onda);
  }

  dispose(): void {
    for (const id of [...this.pares.keys()]) this.soltarPar(id);
    try {
      this.fonte.disconnect();
      this.ganho.disconnect();
      this.limitador.disconnect();
      this.analisador.disconnect();
    } catch {
      // já solto
    }
    void this.ctx.close().catch(() => {});
  }
}
