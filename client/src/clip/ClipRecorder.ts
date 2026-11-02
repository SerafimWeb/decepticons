import { recorteVerticalEm, type RecorteEditavel } from './recorte';
import { DURACAO_SEGMENTO_S, ehHoraDeNovoSegmento, escolherSegmento } from './segmentos';

/**
 * O clipe dos últimos 10 s em vertical (P309, a ordem "o clipe"). Liga com a tecla L: o jogo passa a copiar a cena, a cada quadro, para uma
 * saída de 9:16 (540 × 960) e a gravar em trechos sobrepostos (ver `segmentos.ts`). A tecla K salva os últimos 5 a 10 s como arquivo, sem
 * enviar nada a lugar nenhum: o arquivo fica no computador de quem gravou.
 *
 * **Custo:** desligado, zero (nenhum canvas, nenhum gravador, nenhum nó de áudio). Ligado, uma cópia 9:16 por quadro (`drawImage`) e dois
 * gravadores de vídeo ao mesmo tempo (o navegador comprime em outra thread). Por isso é opt-in: só custa CPU de quem liga.
 *
 * O clipe leva o que está na tela do jogo, sem o HUD (que é HTML por cima do canvas) e com o áudio do próprio jogo (mesma ponte do gravador F9).
 */
export const CLIPE_LARGURA = 540;
export const CLIPE_ALTURA = 960;
export const CLIPE_QUADROS_POR_S = 30;
const BITRATE_DO_CLIPE = 3_000_000;

/** O que o clipe precisa do áudio do jogo: o contexto e o ponto de gravação (o mesmo que o gravador F9 usa). */
export interface AudioDoClipe {
  readonly context: AudioContext | null;
  connectRecorder(dest: AudioNode): void;
  disconnectRecorder(dest: AudioNode): void;
}

interface Gravacao {
  readonly inicio: number;
  readonly gravador: MediaRecorder;
  readonly pedacos: Blob[];
}

/** O formato que o navegador grava: WebM (VP9, depois VP8) é o que o Chrome, o Edge e o Firefox gravam; MP4 só se for o único. `null` = nenhum. */
export function formatoDoClipe(suporta: (tipo: string) => boolean = (t) => MediaRecorder.isTypeSupported(t)): string | null {
  return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => suporta(t)) ?? null;
}

export class ClipRecorder {
  private saida: HTMLCanvasElement | null = null;
  private desenho: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private audioDest: MediaStreamAudioDestinationNode | null = null;
  private gravacoes: Gravacao[] = [];
  private ultimoInicio = Number.NEGATIVE_INFINITY;
  private formato: string | null = null;
  private ativo = false;

  constructor(
    private readonly fonte: HTMLCanvasElement,
    private readonly audio: AudioDoClipe | null = null,
  ) {}

  get ligado(): boolean {
    return this.ativo;
  }

  /** O recorte 9:16 do último quadro copiado (para conferir o enquadramento); `null` antes do primeiro. Um só objeto, reusado a cada quadro (G4). */
  private readonly recorte: RecorteEditavel = { sx: 0, sy: 0, sw: 0, sh: 0 };
  private ultimoRecorte: RecorteEditavel | null = null;
  get recorteAtual(): RecorteEditavel | null {
    return this.ultimoRecorte;
  }

  /** O formato que está gravando (para o nome do arquivo), ou `null` com o buffer desligado. */
  get formatoAtual(): string | null {
    return this.ativo ? this.formato : null;
  }

  /** Liga o buffer. `false` = este navegador não grava vídeo: nada muda. */
  ligar(): boolean {
    if (this.ativo) return true;
    if (typeof MediaRecorder === 'undefined' || typeof document === 'undefined') return false;
    this.formato = formatoDoClipe();
    if (!this.formato) return false;
    this.saida = document.createElement('canvas');
    this.saida.width = CLIPE_LARGURA;
    this.saida.height = CLIPE_ALTURA;
    this.desenho = this.saida.getContext('2d');
    if (!this.desenho) return false;
    this.stream = this.saida.captureStream(CLIPE_QUADROS_POR_S);
    const ctx = this.audio?.context;
    if (ctx && this.audio) {
      this.audioDest = ctx.createMediaStreamDestination();
      this.audio.connectRecorder(this.audioDest);
      for (const faixa of this.audioDest.stream.getAudioTracks()) this.stream.addTrack(faixa);
    }
    this.ativo = true;
    this.ultimoInicio = Number.NEGATIVE_INFINITY;
    return true;
  }

  /** Desliga: encerra as gravações e solta o áudio. O que estava guardado é descartado. */
  desligar(): void {
    for (const g of this.gravacoes) if (g.gravador.state !== 'inactive') g.gravador.stop();
    this.gravacoes = [];
    if (this.audioDest && this.audio) this.audio.disconnectRecorder(this.audioDest);
    this.audioDest = null;
    this.stream = null;
    this.saida = null;
    this.desenho = null;
    this.ativo = false;
  }

  /**
   * A cada quadro do jogo, depois de desenhar a cena: copia o recorte 9:16 para a saída e abre ou encerra as gravações do buffer.
   * Tem de rodar no mesmo quadro em que a cena foi desenhada (o WebGL só guarda o desenho até o fim do quadro). Desligado, não faz nada.
   * @param agora segundos (qualquer relógio que só cresce; o jogo passa o do quadro, em segundos)
   */
  frame(agora: number, centroX = 0.5): void {
    if (!this.ativo || !this.desenho) return;
    const r = recorteVerticalEm(this.fonte.width, this.fonte.height, centroX, this.recorte);
    this.ultimoRecorte = r;
    if (r.sw > 0) this.desenho.drawImage(this.fonte, r.sx, r.sy, r.sw, r.sh, 0, 0, CLIPE_LARGURA, CLIPE_ALTURA);
    if (ehHoraDeNovoSegmento(this.ultimoInicio, agora)) this.abrir(agora);
    // Sem alocar por quadro (G4): encerra as gravações que passaram de 10 s e tira as inativas, de trás para frente.
    for (let i = this.gravacoes.length - 1; i >= 0; i--) {
      const g = this.gravacoes[i];
      if (!g) continue;
      if (g.gravador.state === 'recording' && agora - g.inicio >= DURACAO_SEGMENTO_S) g.gravador.stop();
      if (g.gravador.state === 'inactive') this.gravacoes.splice(i, 1);
    }
  }

  /**
   * Salva o clipe: os últimos 5 a 10 s, em vertical, como arquivo. Encerra a gravação escolhida e devolve o arquivo; o buffer continua.
   * `null` = ainda não há gravação para salvar (acabou de ligar).
   */
  exportar(agora: number): Promise<Blob | null> {
    const i = escolherSegmento(
      this.gravacoes.map((g) => g.inicio),
      agora,
    );
    if (i < 0) return Promise.resolve(null);
    const [g] = this.gravacoes.splice(i, 1);
    if (!g || g.gravador.state === 'inactive') return Promise.resolve(null);
    const tipo = this.formato ?? 'video/webm';
    return new Promise((resolve) => {
      g.gravador.addEventListener('stop', () => resolve(new Blob(g.pedacos, { type: tipo })), { once: true });
      g.gravador.stop();
    });
  }

  private abrir(agora: number): void {
    if (!this.stream || !this.formato) return;
    const gravador = new MediaRecorder(this.stream, { mimeType: this.formato, videoBitsPerSecond: BITRATE_DO_CLIPE });
    const pedacos: Blob[] = [];
    gravador.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) pedacos.push(e.data);
    });
    gravador.start();
    this.gravacoes.push({ inicio: agora, gravador, pedacos });
    this.ultimoInicio = agora;
  }
}

let fimDoAviso: ReturnType<typeof setTimeout> | null = null;

/**
 * O aviso do clipe: uma linha no canto (ligado, salvo, sem gravação). `ms = 0` deixa na tela até o próximo aviso (o indicador de "ligado").
 * Só o texto entra na tela (textContent); o i18n traduz a linha como qualquer outro texto do HUD.
 */
export function avisoDoClipe(texto: string, ms = 2400): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('clip-aviso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'clip-aviso';
    el.className = 'clip-aviso';
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.classList.add('show');
  if (fimDoAviso !== null) clearTimeout(fimDoAviso);
  fimDoAviso = ms > 0 ? setTimeout(() => el?.classList.remove('show'), ms) : null;
}

/** Baixa o clipe como arquivo, com a data e a hora no nome. Só no navegador, depois do pedido do jogador. */
export function baixarClipe(blob: Blob, formato: string | null, agora: Date = new Date()): void {
  const p = (n: number) => String(n).padStart(2, '0');
  const ext = formato?.includes('mp4') ? 'mp4' : 'webm';
  const nome = `cybermech-clipe-${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
