import { decodeMural, encodeMuralPedido, MURAL_FECHOU, type MuralSala } from '../../../shared/net/mural';
import { Writer } from '../../../shared/net/codec';
import { messageType, MSG } from '../../../shared/net/messages';
import { serverWsUrl } from '../../../shared/net/serverUrl';

/** Em que pé está a conexão do mural, em palavras que a tela traduz. */
export type EstadoDoMural =
  /** O jogo não sabe onde está o servidor (build offline). */
  | 'sem-servidor'
  /** Falta o token do dono. */
  | 'sem-token'
  /** Ainda não abriu (ou a janela fechou). */
  | 'parado'
  | 'conectando'
  /** Chegou um quadro há pouco. */
  | 'ao-vivo'
  /** Caiu ou não respondeu: tenta de novo sozinho enquanto a janela estiver aberta. */
  | 'caiu'
  /** O servidor recusou o token (ou o mural não existe nele: sem token configurado). Não tenta de novo. */
  | 'token'
  /** Erros de token demais deste endereço. Não tenta de novo. */
  | 'bloqueado'
  | 'desligado';

export interface MuralEventos {
  estado(e: EstadoDoMural): void;
  quadro(salas: MuralSala[]): void;
}

/** O que o cliente precisa de uma conexão (o `WebSocket` do navegador, ou um falso nos testes). */
export interface SocketDoMural {
  binaryType: string;
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: { code: number }) => void) | null;
  onerror: (() => void) | null;
  send(data: Uint8Array): void;
  close(): void;
}

/** Sem quadro por tanto tempo, a conexão é dada como morta e refeita (o servidor manda quatro por segundo, mesmo sem sala nenhuma). */
const SEM_QUADRO_MS = 3500;
const TENTA_DE_NOVO_MS = [1500, 3000, 6000, 10_000];

/**
 * O cliente do mural de câmeras (P88, G3: módulo sem tela). Abre `/?mural=1` no servidor, prova o token do dono na primeira mensagem (nunca no
 * endereço: o endereço costuma ir para o log) e entrega cada quadro de salas a quem ouve. Nunca lança: toda falha vira um estado.
 * Refaz a conexão sozinho enquanto estiver aberto (rede, reinício do servidor); token recusado e IP bloqueado não são refeitos.
 */
export class MuralCliente {
  private readonly url: string | null;
  private readonly w = new Writer(256);
  private socket: SocketDoMural | null = null;
  private aberto = false;
  private atual: EstadoDoMural;
  private tentativas = 0;
  private recomeco: ReturnType<typeof setTimeout> | null = null;
  private vigia: ReturnType<typeof setTimeout> | null = null;

  constructor(
    gameServer: string | undefined | null,
    private readonly token: () => string | null,
    private readonly on: Partial<MuralEventos>,
    private readonly abrirSocket: (url: string) => SocketDoMural = (url) => new WebSocket(url) as unknown as SocketDoMural,
  ) {
    this.url = serverWsUrl(gameServer, '/', 'mural=1');
    this.atual = this.url ? 'parado' : 'sem-servidor';
  }

  get estado(): EstadoDoMural {
    return this.atual;
  }

  get temServidor(): boolean {
    return this.url !== null;
  }

  /** Liga o mural (a janela abriu). Repetir não faz nada. */
  abrir(): void {
    if (this.aberto) return;
    this.aberto = true;
    this.tentativas = 0;
    this.conectar();
  }

  /** Desliga (a janela fechou): a conexão cai e nada é refeito. */
  fechar(): void {
    this.aberto = false;
    this.limpar();
    if (this.url) this.atual = 'parado';
    const s = this.socket;
    this.socket = null;
    if (s) {
      s.onclose = null;
      s.onmessage = null;
      s.onerror = null;
      try {
        s.close();
      } catch {
        // já fechado
      }
    }
  }

  private mudar(e: EstadoDoMural): void {
    if (this.atual === e) return;
    this.atual = e;
    this.on.estado?.(e);
  }

  private limpar(): void {
    if (this.recomeco) clearTimeout(this.recomeco);
    if (this.vigia) clearTimeout(this.vigia);
    this.recomeco = null;
    this.vigia = null;
  }

  private conectar(): void {
    if (!this.aberto) return;
    if (!this.url) return this.mudar('sem-servidor');
    const token = this.token();
    if (!token) return this.mudar('sem-token');
    this.mudar('conectando');
    let s: SocketDoMural;
    try {
      s = this.abrirSocket(this.url);
    } catch {
      return this.refazer();
    }
    this.socket = s;
    s.binaryType = 'arraybuffer';
    s.onopen = () => s.send(new Uint8Array(encodeMuralPedido(this.w, token)));
    s.onmessage = (e) => {
      if (!(e.data instanceof ArrayBuffer)) return;
      const bytes = new Uint8Array(e.data);
      if (messageType(bytes) !== MSG.MURAL) return;
      const salas = decodeMural(bytes);
      if (!salas) return;
      this.tentativas = 0;
      this.mudar('ao-vivo');
      this.vigiar();
      this.on.quadro?.(salas);
    };
    s.onerror = () => {};
    s.onclose = (e) => {
      if (this.socket !== s) return;
      this.socket = null;
      if (this.vigia) clearTimeout(this.vigia);
      this.vigia = null;
      if (e.code === MURAL_FECHOU.token) return this.mudar('token');
      if (e.code === MURAL_FECHOU.bloqueado) return this.mudar('bloqueado');
      if (e.code === MURAL_FECHOU.desligado) return this.mudar('desligado');
      this.refazer();
    };
  }

  /** O watchdog: sem quadro por `SEM_QUADRO_MS`, derruba a conexão e refaz. */
  private vigiar(): void {
    if (this.vigia) clearTimeout(this.vigia);
    this.vigia = setTimeout(() => {
      const s = this.socket;
      if (!s) return;
      s.onclose = null;
      try {
        s.close();
      } catch {
        // já fechado
      }
      this.socket = null;
      this.refazer();
    }, SEM_QUADRO_MS);
  }

  private refazer(): void {
    if (!this.aberto) return;
    this.mudar('caiu');
    const espera = TENTA_DE_NOVO_MS[Math.min(this.tentativas, TENTA_DE_NOVO_MS.length - 1)]!;
    this.tentativas++;
    if (this.recomeco) clearTimeout(this.recomeco);
    this.recomeco = setTimeout(() => this.conectar(), espera);
  }
}
