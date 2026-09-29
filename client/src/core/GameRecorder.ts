import type { AudioSystem } from '../audio/AudioSystem';

/**
 * Gravação nativa de gameplay, em alta qualidade, direto do WebGL (dono: "gravando a tela no OBS e ta
 * ficando bem ruim a qualidade... se pudermos gravar direto no jogo ficaria perfeito"). `canvas.captureStream`
 * + `MediaRecorder`, sem recodificar a tela inteira do PC — só os pixels do jogo, no framerate real, com o
 * áudio do próprio `AudioSystem` misturado.
 *
 * **Só para o dono, de propósito (decisão de 28/09: "não vamos deixar os usuários fazerem suas próprias
 * gravações, primeiro vamos só nós usarmos").** Sem botão nem menu: liga com uma tecla que não está no
 * `keys-help` da tela inicial, um indicador `● REC` aparece só enquanto grava. Nada disso é carregado ou
 * medido para quem não aperta a tecla.
 *
 * **"Modo captura" (`Game.ts`, no mesmo F9):** trava a resolução no máximo e desliga o rebaixamento
 * automático de qualidade (G12) enquanto grava — sem isso, a própria gravação derruba o FPS, e a
 * qualidade adaptativa reagiria baixando a resolução no meio do take (o mesmo problema que o dono já
 * descrevia do OBS, só que causado pelo próprio jogo se reagindo à carga da gravação).
 *
 * **Custo:** zero enquanto não está gravando (nenhum listener, nenhum nó extra no grafo de áudio, nenhum
 * quadro extra copiado). Gravando, é o próprio navegador comprimindo em paralelo (thread separada do
 * `MediaRecorder`); o único custo no `frame()` do jogo é um `captureFrame()` — sem ele o `MediaRecorder`
 * não pega nenhum quadro num canvas WebGL, porque o `WebGLRenderer` não guarda o buffer entre quadros
 * (`preserveDrawingBuffer` continua `false` para todo mundo: ligar isso sempre custaria GPU de todo jogador
 * só para os raros minutos em que o dono grava — o `captureStream(0)` + pedido manual de quadro pega o
 * conteúdo certo, no instante certo, sem esse custo permanente).
 */
export class GameRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private audioDest: MediaStreamAudioDestinationNode | null = null;
  private videoTrack: CanvasCaptureMediaStreamTrack | null = null;
  private indicador: HTMLElement | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly audio: AudioSystem,
  ) {}

  get gravando(): boolean {
    return this.recorder !== null && this.recorder.state !== 'inactive';
  }

  /** Liga/desliga (a mesma tecla faz as duas coisas). Sem suporte do navegador, não faz nada — silencioso,
   * como o resto do jogo trata recurso ausente. */
  alternar(): void {
    if (this.gravando) void this.parar();
    else this.iniciar();
  }

  /** Chamado uma vez por quadro pelo `Game.frame()`, logo depois do `composer.render()`. Fora de gravação é
   * um `if` e um `return` — o guarda mais barato possível (G4: nada alocado, nada calculado). */
  capturarQuadro(): void {
    this.videoTrack?.requestFrame();
  }

  private iniciar(): void {
    if (this.gravando) return;
    if (typeof this.canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') return;
    const mime = melhorFormato();
    if (!mime) return;

    // 0 = modo manual: o navegador só desenha um quadro novo quando `capturarQuadro()` pede — pega o
    // conteúdo certo do WebGL sem precisar de `preserveDrawingBuffer` ligado o tempo todo.
    const videoStream = this.canvas.captureStream(0);
    this.videoTrack = (videoStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined) ?? null;
    const tracks: MediaStreamTrack[] = videoStream.getVideoTracks();
    const ctx = this.audio.context;
    if (ctx) {
      this.audioDest = ctx.createMediaStreamDestination();
      this.audio.connectRecorder(this.audioDest);
      tracks.push(...this.audioDest.stream.getAudioTracks());
    }

    this.chunks = [];
    try {
      this.recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 16_000_000 });
    } catch {
      this.limparAudioDest();
      return;
    }
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(1000); // um pedaço por segundo: um crash não perde a gravação inteira
    this.mostrarIndicador();
  }

  private parar(): Promise<void> {
    return new Promise((resolve) => {
      const rec = this.recorder;
      if (!rec || rec.state === 'inactive') {
        resolve();
        return;
      }
      rec.onstop = () => {
        this.baixar();
        this.limparAudioDest();
        this.recorder = null;
        this.videoTrack = null;
        this.esconderIndicador();
        resolve();
      };
      rec.stop();
    });
  }

  private baixar(): void {
    if (this.chunks.length === 0) {
      // Aconteceu em teste headless sob renderização por software (SwiftShader): o navegador nunca
      // entregou um quadro dentro do tempo gravado. Num navegador de verdade, com GPU, não é esperado —
      // mas um aviso é mais barato que um silêncio que parece "gravei e não salvou nada".
      console.warn('[GameRecorder] gravação terminou sem quadros — nada para baixar');
      return;
    }
    const blob = new Blob(this.chunks, { type: this.chunks[0]!.type || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cybermech-${carimbo()}.webm`;
    // Alguns navegadores só disparam o download com o link de fato no documento (headless Chrome, por
    // exemplo, ignora o clique num <a> solto).
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    this.chunks = [];
  }

  private limparAudioDest(): void {
    if (this.audioDest) {
      this.audio.disconnectRecorder(this.audioDest);
      this.audioDest = null;
    }
  }

  private mostrarIndicador(): void {
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;top:12px;right:12px;z-index:9999;display:flex;align-items:center;gap:6px;' +
      'padding:5px 10px;background:rgba(6,8,10,.85);border:1px solid #ff2d3d;border-radius:3px;' +
      'font:12px/1 "Consolas","Courier New",monospace;letter-spacing:1px;color:#ff2d3d;pointer-events:none;';
    el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#ff2d3d;animation:cm-rec-pulse 1s ease-in-out infinite"></span>REC';
    if (!document.getElementById('cm-rec-style')) {
      const style = document.createElement('style');
      style.id = 'cm-rec-style';
      style.textContent = '@keyframes cm-rec-pulse{50%{opacity:.25}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(el);
    this.indicador = el;
  }

  private esconderIndicador(): void {
    this.indicador?.remove();
    this.indicador = null;
  }
}

/** VP9 é o melhor que o Chrome grava em tempo real sem perder quadro; H.264 é o fallback mais compatível. */
function melhorFormato(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
  const candidatos = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=h264,opus', 'video/webm'];
  return candidatos.find((c) => MediaRecorder.isTypeSupported(c)) ?? null;
}

function carimbo(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}
