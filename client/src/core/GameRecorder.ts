import type { AudioSystem } from '../audio/AudioSystem';
import type { CadeiaDeVoz } from '../voice/EfeitosDeVoz';

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
 * **Narração (P230, F8):** a mesma gravação com a **voz do jogador** (microfone) na mistura. O microfone entra só na gravação, **nunca na saída do jogo** (quem narra não se ouve em eco, e os
 * outros sons não ganham a voz por cima). Vale offline e online. Quem abre o microfone é o `Game` (conta de maior de 18 anos, o aparelho escolhido nas Configurações); aqui só se mistura e se solta.
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
/** Quem monta o efeito na voz (`voice/EfeitosDeVoz.ts`, sob demanda) no contexto de áudio do jogo; `null` = sem efeito. */
export type FabricaDeCadeiaDeVoz = (ctx: AudioContext) => CadeiaDeVoz | null;

export class GameRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private audioDest: MediaStreamAudioDestinationNode | null = null;
  private videoTrack: CanvasCaptureMediaStreamTrack | null = null;
  private indicador: HTMLElement | null = null;
  /** A voz de quem narra, na mistura da gravação (só com a narração ligada). */
  private fonteMic: MediaStreamAudioSourceNode | null = null;
  /** O efeito na voz (P231), entre o microfone e a mistura da gravação; `null` = a voz vai pura. */
  private cadeia: CadeiaDeVoz | null = null;
  private microfone: MediaStream | null = null;
  private aviso: HTMLElement | null = null;
  private avisoTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly audio: AudioSystem,
  ) {}

  get gravando(): boolean {
    return this.recorder !== null && this.recorder.state !== 'inactive';
  }

  /** Liga/desliga (a mesma tecla faz as duas coisas). Sem suporte do navegador, não faz nada — silencioso,
   * como o resto do jogo trata recurso ausente. */
  alternar(microfone: MediaStream | null = null, efeito: FabricaDeCadeiaDeVoz | null = null): void {
    if (this.gravando) {
      soltarMicrofone(microfone); // um microfone que chegou tarde (o pedido de permissão demorou) não fica aberto
      void this.parar();
      return;
    }
    // Narração sem o áudio do jogo ainda (o primeiro gesto não aconteceu): uma gravação sem a voz seria enganosa, e o microfone aberto não teria quem o solte. Não grava, solta e avisa.
    if (microfone && !this.audio.context) {
      soltarMicrofone(microfone);
      this.avisar('NARRAÇÃO: o áudio do jogo ainda não começou. Clique no jogo e tente de novo.');
      return;
    }
    this.iniciar(microfone, efeito);
    if (!this.gravando) soltarMicrofone(microfone); // sem suporte: o microfone aberto à toa é solto na hora
  }

  /** Uma frase curta no canto (4 s): é como a gravação escondida diz que não pôde fazer o que foi pedido (sem microfone, sem conta de adulto). */
  avisar(texto: string): void {
    if (typeof document === 'undefined') return;
    if (!this.aviso) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:48px;right:12px;z-index:9999;max-width:340px;padding:6px 10px;background:rgba(6,8,10,.9);border:1px solid #ff2d3d;border-radius:3px;font:12px/1.35 "Consolas","Courier New",monospace;letter-spacing:.5px;color:#ffd0d4;pointer-events:none;';
      document.body.appendChild(el);
      this.aviso = el;
    }
    this.aviso.textContent = texto;
    clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => {
      this.aviso?.remove();
      this.aviso = null;
    }, 4000);
  }

  /** Chamado uma vez por quadro pelo `Game.frame()`, logo depois do `composer.render()`. Fora de gravação é
   * um `if` e um `return` — o guarda mais barato possível (G4: nada alocado, nada calculado). */
  capturarQuadro(): void {
    this.videoTrack?.requestFrame();
  }

  private iniciar(microfone: MediaStream | null, efeito: FabricaDeCadeiaDeVoz | null): void {
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
      // A narração: a voz de quem joga entra na MISTURA DA GRAVAÇÃO e em nenhum outro lugar (não vai à saída do jogo).
      if (microfone) {
        this.fonteMic = ctx.createMediaStreamSource(microfone);
        // O efeito entra entre o microfone e a mistura; se ele falhar ao montar, a voz vai pura (um take sem efeito vale mais que um take perdido).
        this.cadeia = montarCadeia(efeito, ctx);
        if (this.cadeia) {
          this.fonteMic.connect(this.cadeia.entrada);
          this.cadeia.saida.connect(this.audioDest);
        } else {
          this.fonteMic.connect(this.audioDest);
        }
        this.microfone = microfone;
      }
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
    this.mostrarIndicador(this.microfone !== null);
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
    this.cadeia?.desligar();
    this.cadeia = null;
    if (this.fonteMic) {
      try {
        this.fonteMic.disconnect();
      } catch {
        // já desconectado
      }
      this.fonteMic = null;
    }
    soltarMicrofone(this.microfone);
    this.microfone = null;
    if (this.audioDest) {
      this.audio.disconnectRecorder(this.audioDest);
      this.audioDest = null;
    }
  }

  private mostrarIndicador(narrando: boolean): void {
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;top:12px;right:12px;z-index:9999;display:flex;align-items:center;gap:6px;' +
      'padding:5px 10px;background:rgba(6,8,10,.85);border:1px solid #ff2d3d;border-radius:3px;' +
      'font:12px/1 "Consolas","Courier New",monospace;letter-spacing:1px;color:#ff2d3d;pointer-events:none;';
    el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#ff2d3d;animation:cm-rec-pulse 1s ease-in-out infinite"></span>' + (narrando ? 'REC · NARRAÇÃO' : 'REC');
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

/** Monta o efeito na voz; qualquer falha vira "sem efeito" (a voz vai pura). */
function montarCadeia(efeito: FabricaDeCadeiaDeVoz | null, ctx: AudioContext): CadeiaDeVoz | null {
  if (!efeito) return null;
  try {
    return efeito(ctx);
  } catch {
    return null;
  }
}

/** Solta o microfone (as faixas): o microfone aberto esquecido é o pior defeito possível. */
function soltarMicrofone(microfone: MediaStream | null): void {
  if (microfone) for (const faixa of microfone.getTracks()) faixa.stop();
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
