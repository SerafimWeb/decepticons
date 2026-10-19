import { messageType } from '../../../shared/net/messages';
import { codificarPronto, codificarSinal, lerLista, lerSinal, VOZ, type Sinal } from '../../../shared/net/voz';
import { normalizeKey } from '../core/Settings';
import { MicController, type EstadoMic, type ModoMic } from './MicController';
import { ajustarOpus } from './opus';
import { VoiceSpatial, type SaidaDeAudio } from './VoiceSpatial';

/** STUN público do Google: de graça, só diz ao navegador qual é o endereço dele na internet. Sem TURN (relé pago): quem está atrás de uma rede que bloqueia a conexão direta fica sem voz (`VOICE_CHAT.md`). */
export const ICE_PADRAO: readonly RTCIceServer[] = Object.freeze([{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]);
/** Quanto esperar o navegador achar os endereços antes de mandar a oferta/resposta com o que já tem (a coleta com STUN leva ~0,2 s). */
const ESPERA_ENDERECOS_MS = 2500;

/** Estado de uma ligação com um colega: `conectando`, `conectada` ou `falhou` (a rede dele ou a nossa não deixou a conexão direta). */
export type LigacaoEstado = 'conectando' | 'conectada' | 'falhou';

/** O que o chat de voz pede ao navegador: separado para o teste trocar por um falso (o áudio de verdade só se prova num Chrome, `medicoes/voz.mjs`). */
export interface Ambiente {
  novaConexao(cfg: RTCConfiguration): RTCPeerConnection;
  /** O microfone (`aparelho`: o `deviceId` escolhido, vazio = o padrão); rejeita com `NotAllowedError` se o jogador recusar e `NotFoundError` se não houver. */
  pedirMicrofone(aparelho: string): Promise<MediaStream>;
}

export const AMBIENTE_DO_NAVEGADOR: Ambiente = {
  novaConexao: (cfg) => new RTCPeerConnection(cfg),
  pedirMicrofone: (aparelho) => {
    if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(new DOMException('sem microfone', 'NotFoundError'));
    // Mono (metade da banda, basta para voz); o resto é o tratamento do navegador contra eco, ruído e volume desigual. `ideal`, não `exact`: o aparelho salvo que foi desligado cai no padrão.
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, ...(aparelho ? { deviceId: { ideal: aparelho } } : {}) },
      video: false,
    });
  },
};

export interface VozOpcoes {
  /** Manda uma mensagem de voz ao servidor da sala. */
  enviar(bytes: Uint8Array): void;
  /** A saída de áudio do jogo (`AudioSystem.output`); `null` até o primeiro gesto. */
  saida(): SaidaDeAudio | null;
  /**
   * O token da sessão de uma conta de maior de idade (P211), ou `null` sem ela. `PRONTO` o leva e o servidor confere. **Sem token não há voz nem microfone:** o chat nem pede o microfone ao navegador.
   * Sem esta função (os testes), o chat não exige token (o servidor exige de qualquer jeito).
   */
  token?(): string | null;
  ambiente?: Ambiente;
  ice?: readonly RTCIceServer[];
}

interface Ligacao {
  id: number;
  pc: RTCPeerConnection;
  sender: RTCRtpSender | null;
  estado: LigacaoEstado;
}

/**
 * O chat de voz (P205): cada jogador da sala que entrou na voz abre uma conexão WebRTC direta com cada um dos outros (malha: serve para uma sala de 8; o áudio não passa pelo
 * servidor). O servidor só repassa a oferta e a resposta (`server/voz.ts`). Quem tem o **id menor** oferece. Cada ligação tem **um transceptor** de áudio de ida e volta: o microfone
 * entra e sai por `replaceTrack` (PTT, mudo, microfone que chega depois do aceite) sem renegociar. Módulo independente (G3): o jogo liga por callbacks e o chat nunca toca na simulação.
 *
 * Custo: nada por tick. Por quadro, sem colegas na voz, nada; com eles, a posição de cada um no Web Audio (sem alocar). O Opus codifica uma vez e decodifica uma vez por colega, e em
 * silêncio quase não manda pacote (`opus.ts`).
 */
export class VoiceChat {
  readonly mic = new MicController();
  readonly spatial: VoiceSpatial;
  private readonly ambiente: Ambiente;
  private readonly ice: readonly RTCIceServer[];
  private readonly ligacoes = new Map<number, Ligacao>();
  /** As mesmas ligações, em lista: o laço do quadro anda nela sem criar iterador (G4). */
  private readonly lista: Ligacao[] = [];
  private readonly setFalando = new Set<number>();
  private meuId = -1;
  private naSala = false;
  private ligada = false;
  /** Já avisei o servidor que estou na voz. */
  private noServidor = false;
  private fluxo: MediaStream | null = null;
  private geracaoMic = 0;
  private estado: EstadoMic = 'sem';
  private aparelho = '';

  constructor(private readonly o: VozOpcoes) {
    this.spatial = new VoiceSpatial(o.saida);
    this.ambiente = o.ambiente ?? AMBIENTE_DO_NAVEGADOR;
    this.ice = o.ice ?? ICE_PADRAO;
  }

  // ---------- o que o jogo diz ----------

  /** As configurações do jogador: voz ligada, modo do microfone, volume da voz dos outros e o aparelho do microfone (vazio = o padrão). */
  configurar(ligada: boolean, modo: ModoMic, volume: number, aparelho = ''): void {
    this.mic.setModo(modo);
    this.spatial.setVolume(volume);
    const trocou = aparelho !== this.aparelho;
    this.aparelho = aparelho;
    if (ligada !== this.ligada) {
      this.ligada = ligada;
      this.sincronizar();
    } else if (trocou && this.noServidor) {
      // Trocou de microfone no meio da voz: solta o velho e pede o novo (as ligações recebem a faixa nova por `replaceTrack`, sem renegociar).
      this.soltarMic();
      void this.abrirMic();
    } else {
      // Nada de voz mudou, mas o token pode ter chegado (a idade informada na sala) ou ido embora (saiu da conta): acerta com o servidor.
      this.sincronizar();
    }
  }

  /** Entrei na sala (o `WELCOME`, também a cada reconexão): se a voz está ligada, entro nela. */
  entrouNaSala(meuId: number): void {
    this.meuId = meuId;
    this.naSala = true;
    this.sincronizar();
  }

  /** A conexão com a sala caiu: as ligações com os colegas não valem mais (o microfone fica). */
  saiuDaSala(): void {
    this.naSala = false;
    this.meuId = -1;
    this.noServidor = false;
    this.fecharTodas();
  }

  /** Uma mensagem de voz do servidor (`LISTA` ou `SINAL`). */
  receber(bytes: Uint8Array): void {
    switch (messageType(bytes)) {
      case VOZ.LISTA: {
        const ids = lerLista(bytes);
        if (ids) this.aoLista(ids);
        return;
      }
      case VOZ.SINAL: {
        const s = lerSinal(bytes);
        if (s) void this.aoSinal(s);
        return;
      }
    }
  }

  /** Liga a tecla do chat (PTT, ou mudo no modo "sempre"). Devolve quem desliga. */
  ligarTeclas(tecla: () => string): () => void {
    const noCampo = (alvo: EventTarget | null): boolean => {
      const t = alvo as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    const aperta = (e: KeyboardEvent) => {
      if (e.repeat || normalizeKey(e.code) !== tecla() || noCampo(e.target)) return;
      this.aoBotao(true);
    };
    const solta = (e: KeyboardEvent) => {
      if (normalizeKey(e.code) === tecla()) this.aoBotao(false);
    };
    const perdeuFoco = () => this.mic.soltar();
    window.addEventListener('keydown', aperta);
    window.addEventListener('keyup', solta);
    window.addEventListener('blur', perdeuFoco);
    return () => {
      window.removeEventListener('keydown', aperta);
      window.removeEventListener('keyup', solta);
      window.removeEventListener('blur', perdeuFoco);
    };
  }

  /**
   * O botão de microfone (a tecla do chat, ou o botão da tela de toque, P209: o celular não tem tecla). `down` ao apertar, `false` ao soltar. No modo "sempre aberto" apertar alterna o mudo
   * (soltar não faz nada); no "segurar", vale enquanto apertado. **Sem microfone (recusado ou ausente) apertar só tenta pedi-lo de novo**: no celular quem negou sem querer corrige em um
   * toque, sem recarregar o jogo, e o microfone já nasce aberto. Fora da voz, não faz nada.
   */
  aoBotao(down: boolean): void {
    if (!this.noServidor) return;
    if (!this.mic.temMic) {
      // Sem microfone o toque só o pede (não alterna o mudo: quem toca quer ligar o microfone, e ele nasce aberto quando o navegador aceitar). O `abrirMic` já ignora o toque enquanto o navegador ainda pergunta.
      if (down) void this.abrirMic();
      return;
    }
    this.mic.aoTecla(down);
  }

  /**
   * Por quadro: onde eu estou e para onde olho, e onde cada colega está (`posDe`, que o jogo responde com a posição do robô dele). Sem ligação nenhuma, não faz nada.
   * `posDe` devolve `undefined` para quem o jogo não vê (ainda não chegou o estado dele): a voz dele fica onde estava.
   */
  atualizar(x: number, y: number, z: number, yaw: number, posDe: (id: number) => Readonly<{ x: number; y: number; z: number }> | undefined): void {
    if (this.lista.length === 0) return;
    this.spatial.ouvinte(x, y, z, yaw);
    for (let i = 0; i < this.lista.length; i++) {
      const id = this.lista[i]!.id;
      const p = posDe(id);
      if (p) this.spatial.posicionar(id, p.x, p.y, p.z);
    }
  }

  /** Quem está falando agora (a ~10 Hz, para o indicador da tela). */
  falando(agora: number): ReadonlySet<number> {
    this.spatial.falando(agora, this.setFalando);
    return this.setFalando;
  }

  // ---------- o que a tela lê ----------

  /** Estou na voz (liguei e estou na sala). */
  get ativa(): boolean {
    return this.noServidor;
  }

  get estadoMic(): EstadoMic {
    return this.estado;
  }

  /** Quantos colegas estão ligados comigo, e quantos a rede não deixou ligar. */
  get ligados(): number {
    return this.contar('conectada');
  }

  get semConexao(): number {
    return this.contar('falhou');
  }

  /** Quantos colegas estão na voz comigo (ligados, ligando ou sem conexão): zero é "sozinho na voz". */
  get colegas(): number {
    return this.lista.length;
  }

  private contar(estado: LigacaoEstado): number {
    let n = 0;
    for (let i = 0; i < this.lista.length; i++) if (this.lista[i]!.estado === estado) n++;
    return n;
  }

  dispose(): void {
    this.ligada = false;
    this.sincronizar();
    this.fecharTodas();
    this.spatial.dispose();
  }

  // ---------- entrar e sair da voz ----------

  /** Acerta o que o jogador quer (voz ligada e na sala) com o que o servidor sabe. */
  private sincronizar(): void {
    const quer = this.ligada && this.naSala && (this.o.token === undefined || this.o.token() !== null);
    if (quer && !this.noServidor) {
      this.noServidor = true;
      void this.abrirMic();
      this.o.enviar(codificarPronto(true, this.o.token?.() ?? ''));
    } else if (!quer && this.noServidor) {
      this.noServidor = false;
      this.fecharTodas();
      if (this.naSala) this.o.enviar(codificarPronto(false));
    }
    if (!this.ligada) this.soltarMic();
  }

  private async abrirMic(): Promise<void> {
    if (this.fluxo || this.estado === 'pedindo') return;
    this.estado = 'pedindo';
    const geracao = this.geracaoMic;
    try {
      const fluxo = await this.ambiente.pedirMicrofone(this.aparelho);
      if (geracao !== this.geracaoMic) {
        // O jogador desligou a voz enquanto o navegador perguntava: solta o microfone na hora.
        for (const t of fluxo.getTracks()) t.stop();
        return;
      }
      const faixa = fluxo.getAudioTracks()[0];
      if (!faixa) {
        this.estado = 'sem';
        return;
      }
      this.fluxo = fluxo;
      this.estado = 'ativo';
      faixa.addEventListener('ended', () => {
        if (this.fluxo !== fluxo) return;
        this.fluxo = null;
        this.estado = 'sem';
        this.mic.usar(null);
        for (const l of this.lista) void l.sender?.replaceTrack(null).catch(() => {});
      });
      this.mic.usar(faixa);
      for (const l of this.lista) void l.sender?.replaceTrack(faixa).catch(() => {});
    } catch (e) {
      if (geracao !== this.geracaoMic) return;
      const nome = (e as { name?: string } | null)?.name;
      this.estado = nome === 'NotAllowedError' || nome === 'SecurityError' ? 'negado' : 'sem';
    }
  }

  private soltarMic(): void {
    this.geracaoMic++;
    if (this.fluxo) for (const t of this.fluxo.getTracks()) t.stop();
    this.fluxo = null;
    this.estado = 'sem';
    this.mic.usar(null);
    for (const l of this.lista) void l.sender?.replaceTrack(null).catch(() => {});
  }

  // ---------- as ligações ----------

  private aoLista(ids: readonly number[]): void {
    if (!this.noServidor) return;
    const quer = new Set(ids);
    quer.delete(this.meuId);
    for (const id of [...this.ligacoes.keys()]) if (!quer.has(id)) this.fechar(id);
    // Quem tem o id menor oferece: nunca os dois ao mesmo tempo.
    for (const id of quer) if (!this.ligacoes.has(id) && this.meuId < id) void this.ofertar(id);
  }

  private async aoSinal(s: Sinal): Promise<void> {
    if (!this.noServidor) return;
    if (s.tipo === 'oferta') {
      this.fechar(s.id);
      const l = this.nova(s.id);
      try {
        await l.pc.setRemoteDescription({ type: 'offer', sdp: s.sdp });
        const t = l.pc.getTransceivers()[0];
        if (!t) throw new Error('oferta sem áudio');
        t.direction = 'sendrecv';
        l.sender = t.sender;
        await this.entregarMic(l);
        const resposta = await l.pc.createAnswer();
        await l.pc.setLocalDescription({ type: 'answer', sdp: ajustarOpus(resposta.sdp ?? '') });
        await esperarEnderecos(l.pc);
        if (this.ligacoes.get(s.id) !== l) return;
        this.o.enviar(codificarSinal({ id: s.id, tipo: 'resposta', sdp: l.pc.localDescription!.sdp }));
      } catch {
        this.falhou(l);
      }
      return;
    }
    const l = this.ligacoes.get(s.id);
    if (!l) return;
    try {
      await l.pc.setRemoteDescription({ type: 'answer', sdp: s.sdp });
    } catch {
      this.falhou(l);
    }
  }

  private async ofertar(id: number): Promise<void> {
    const l = this.nova(id);
    try {
      const t = l.pc.addTransceiver('audio', { direction: 'sendrecv' });
      l.sender = t.sender;
      await this.entregarMic(l);
      const oferta = await l.pc.createOffer();
      await l.pc.setLocalDescription({ type: 'offer', sdp: ajustarOpus(oferta.sdp ?? '') });
      await esperarEnderecos(l.pc);
      if (this.ligacoes.get(id) !== l) return;
      this.o.enviar(codificarSinal({ id, tipo: 'oferta', sdp: l.pc.localDescription!.sdp }));
    } catch {
      this.falhou(l);
    }
  }

  /** Põe o microfone (se já temos) na ligação. */
  private async entregarMic(l: Ligacao): Promise<void> {
    const faixa = this.fluxo?.getAudioTracks()[0];
    if (faixa && l.sender) await l.sender.replaceTrack(faixa);
  }

  private nova(id: number): Ligacao {
    const pc = this.ambiente.novaConexao({ iceServers: [...this.ice] });
    const l: Ligacao = { id, pc, sender: null, estado: 'conectando' };
    pc.addEventListener('track', (e) => {
      if (this.ligacoes.get(id) !== l) return;
      // Sem microfone do outro lado o fluxo chega vazio de `streams`: monta o nosso com a faixa.
      this.spatial.adicionar(id, e.streams[0] ?? new MediaStream([e.track]));
    });
    pc.addEventListener('connectionstatechange', () => {
      if (this.ligacoes.get(id) !== l) return;
      if (pc.connectionState === 'connected') l.estado = 'conectada';
      else if (pc.connectionState === 'failed') this.falhou(l);
    });
    this.ligacoes.set(id, l);
    this.lista.push(l);
    return l;
  }

  /** A ligação não deu: fecha a conexão e a deixa marcada (a tela diz; o servidor manda outra `LISTA` quando o colega sair e entrar). */
  private falhou(l: Ligacao): void {
    if (this.ligacoes.get(l.id) !== l) return;
    l.estado = 'falhou';
    this.spatial.remover(l.id);
    try {
      l.pc.close();
    } catch {
      // já fechada
    }
  }

  private fechar(id: number): void {
    const l = this.ligacoes.get(id);
    if (!l) return;
    this.ligacoes.delete(id);
    this.lista.splice(this.lista.indexOf(l), 1);
    this.spatial.remover(id);
    try {
      l.pc.close();
    } catch {
      // já fechada
    }
  }

  private fecharTodas(): void {
    for (const id of [...this.ligacoes.keys()]) this.fechar(id);
  }
}

/** Espera o navegador terminar de achar os endereços (ou `ESPERA_ENDERECOS_MS`): o SDP já sai com eles, sem mandar um candidato por vez pelo servidor. */
function esperarEnderecos(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const fim = () => {
      clearTimeout(prazo);
      pc.removeEventListener('icegatheringstatechange', mudou);
      resolve();
    };
    const mudou = () => {
      if (pc.iceGatheringState === 'complete') fim();
    };
    const prazo = setTimeout(fim, ESPERA_ENDERECOS_MS);
    pc.addEventListener('icegatheringstatechange', mudou);
  });
}
