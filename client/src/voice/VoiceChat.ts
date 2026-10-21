import { messageType } from '../../../shared/net/messages';
import { abrirMicrofone } from './abrirMicrofone';
import { type Canal, permite, proximoAlvo, type RegrasDoCanal } from './canais';
import { EnvioDeVoz } from './EnvioDeVoz';
import { type SaudeDoMic, VigiaDoMic } from './saudeDoMic';
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
  /** O contexto de áudio **só do envio da voz** (ganho, nível e portas por colega: `EnvioDeVoz`); `null` ou ausente = o chat manda a faixa crua do microfone, como antes. */
  novoContextoDeEnvio?(): AudioContext | null;
}

export const AMBIENTE_DO_NAVEGADOR: Ambiente = {
  novaConexao: (cfg) => new RTCPeerConnection(cfg),
  // O pedido único do jogo (o mesmo do teste do microfone): o aparelho escolhido é `exact`; cai no padrão só se ele sumiu (`abrirMicrofone.ts`).
  pedirMicrofone: (aparelho) => abrirMicrofone(aparelho),
  novoContextoDeEnvio: () => (typeof AudioContext === 'undefined' ? null : new AudioContext({ latencyHint: 'interactive' })),
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
  /** O time de cada jogador da sala (P237 PR 3): `null` = a sala não tem times (hoje o servidor ainda não os atribui). Sem ele o canal "time" fica fechado: nunca vira "todos" (falha fechada). */
  timeDe?(id: number): number | null;
}

/** Um retrato de uma ligação com um colega, para o diagnóstico (P237): se o áudio está indo e vindo e por qual rota de rede. */
export interface DiagnosticoDeLigacao {
  id: number;
  estado: LigacaoEstado;
  conexao: string;
  ice: string;
  /** A rota escolhida: candidato local/protocolo → candidato remoto (`host/udp → host`: mesma rede; `srflx`: pela internet; `relay`: por retransmissor). Vazio enquanto não há. */
  rota: string;
  /** Bytes de áudio enviados e recebidos, pacotes perdidos e o nível do áudio que chega (0 a 1; `null` se o navegador não diz). */
  enviados: number;
  recebidos: number;
  perdidos: number;
  nivel: number | null;
}

/** O que o diagnóstico (P237) pergunta ao chat: o estado do microfone e de cada ligação. */
export interface DiagnosticoDaVoz {
  ativa: boolean;
  meuId: number;
  token: boolean;
  estadoMic: EstadoMic;
  rotulo: string;
  taxa: number;
  eco: string;
  ruido: string;
  ganho: string;
  modo: ModoMic;
  mudo: boolean;
  transmitindo: boolean;
  /** Os ids que o servidor diz estarem na voz (a última `LISTA`), tirando o meu. */
  naLista: number[];
  ligacoes: DiagnosticoDeLigacao[];
  /** O ajuste de ganho do jogador (o `ganho` acima é o controle automático do navegador), se o envio passa pelo grafo de Web Audio (`false` = a faixa crua), a saúde do microfone, o nível que sai (RMS, 0 a 1), se o navegador diz a faixa parada, e quantas vezes o jogo reabriu o microfone sozinho. */
  ajusteDeGanho: number;
  viaWebAudio: boolean;
  saude: SaudeDoMic;
  nivel: number;
  faixaMuda: boolean;
  reaberturas: number;
  /** Os canais (P237 PR 3): em qual o microfone fala agora, o alvo do privado, se a sala tem times e se os canais funcionam (precisam do envio por Web Audio). */
  canal: Canal | null;
  alvoPrivado: number | null;
  temTimes: boolean;
  canaisDisponiveis: boolean;
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
  /** A última `LISTA` do servidor (quem está na voz), para o diagnóstico. */
  private naLista: number[] = [];
  /** O ajuste de ganho do jogador (1 = sem mexer) e o grafo de envio que o aplica (`null` = faixa crua). */
  private ganho = 1;
  private envio: EnvioDeVoz | null = null;
  /** O vigia da saúde, o último nível lido e se o navegador disse que a faixa parou de receber dado (`mute`). */
  private readonly vigia = new VigiaDoMic();
  private nivel = 0;
  private faixaMuda = false;
  /** A reabertura automática do microfone (o fone Bluetooth cai e volta): o relógio da próxima tentativa e quantas já foram. */
  private reabrirTimer: ReturnType<typeof setTimeout> | undefined;
  private tentativasDeReabrir = 0;
  /** O jogador que o canal privado escolheu (`null` = ninguém escolhido; com um só colega na voz, ele é o alvo: ver `alvo`). */
  private alvoPrivado: number | null = null;
  /** O alvo do sussurro EM CURSO, **congelado ao apertar a tecla** (revisão de segurança): se ele sai, ou chega outro colega, a voz não muda de destinatário; ninguém ouve até soltar e apertar de novo. */
  private alvoDaFala: number | null = null;
  private readonly aoMudarOsAparelhos = (): void => {
    // Plugou o fone ou o Bluetooth voltou: se estamos na voz sem microfone, tenta de novo agora (sem esperar o relógio).
    if (this.noServidor && !this.fluxo && this.estado === 'sem') {
      clearTimeout(this.reabrirTimer);
      this.tentativasDeReabrir = 0;
      void this.abrirMic();
    }
  };

  constructor(private readonly o: VozOpcoes) {
    this.spatial = new VoiceSpatial(o.saida);
    this.ambiente = o.ambiente ?? AMBIENTE_DO_NAVEGADOR;
    this.ice = o.ice ?? ICE_PADRAO;
    (globalThis as { navigator?: Navigator }).navigator?.mediaDevices?.addEventListener?.('devicechange', this.aoMudarOsAparelhos);
  }

  // ---------- o que o jogo diz ----------

  /** As configurações do jogador: voz ligada, modo do microfone, volume da voz dos outros, o aparelho do microfone (vazio = o padrão) e o ganho do microfone (1 = sem mexer, até 4). */
  configurar(ligada: boolean, modo: ModoMic, volume: number, aparelho = '', ganho = 1): void {
    this.mic.setModo(modo);
    this.spatial.setVolume(volume);
    this.ganho = ganho;
    this.envio?.setGanho(ganho);
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
    this.spatial.limparSilencios();
  }

  /** Silencia (ou volta a ouvir) a voz de um jogador da sala (P228): é o que o botão da lista da REDE chama. Vale até eu sair da sala. */
  silenciar(id: number, mudo: boolean): void {
    this.spatial.silenciar(id, mudo);
  }

  silenciado(id: number): boolean {
    return this.spatial.silenciado(id);
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

  /** Liga a tecla do chat (PTT, ou mudo no modo "sempre") e, se vierem, as dos canais (P237): segurar a do time, segurar a do jogador escolhido, e trocar o jogador escolhido. Devolve quem desliga. */
  ligarTeclas(tecla: () => string, canais?: () => { time: string; privado: string; alvo: string }): () => void {
    const noCampo = (alvo: EventTarget | null): boolean => {
      const t = alvo as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    const aperta = (e: KeyboardEvent) => {
      if (e.repeat || noCampo(e.target)) return;
      const k = normalizeKey(e.code);
      if (k === tecla()) {
        this.aoBotao(true);
        return;
      }
      const c = canais?.();
      if (!c) return;
      if (k === c.time) this.aoCanal('time', true);
      else if (k === c.privado) this.aoCanal('privado', true);
      else if (k === c.alvo) this.trocarAlvo();
    };
    const solta = (e: KeyboardEvent) => {
      const k = normalizeKey(e.code);
      if (k === tecla()) {
        this.aoBotao(false);
        return;
      }
      const c = canais?.();
      if (!c) return;
      if (k === c.time) this.aoCanal('time', false);
      else if (k === c.privado) this.aoCanal('privado', false);
    };
    const perdeuFoco = () => {
      this.mic.soltar();
      this.rotear();
    };
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
   * A tecla de um canal (P237 PR 3): enquanto apertada, o áudio vai **só** a quem o canal permite (o time, ou o jogador escolhido) e a todos os outros a porta fica fechada. **Sem o envio por Web Audio
   * não há porta por colega, então a tecla não faz nada** (nunca arrisca mandar a voz a todos). Sem microfone ou fora da voz, também não.
   */
  aoCanal(canal: 'time' | 'privado', down: boolean): void {
    if (!down) {
      // Soltar passa SEMPRE (mesmo sem o envio): a tecla de canal nunca pode ficar presa.
      this.mic.aoTeclaCanal(canal, false);
      if (canal === 'privado') this.alvoDaFala = null;
      this.rotear();
      return;
    }
    if (!this.noServidor || !this.mic.temMic || !this.envio) return;
    if (canal === 'privado') this.alvoDaFala = this.escolhido();
    this.mic.aoTeclaCanal(canal, true);
    this.rotear();
  }

  /** Troca o jogador do canal privado para o próximo colega na voz (volta ao primeiro depois do último). */
  trocarAlvo(): void {
    this.alvoPrivado = proximoAlvo(this.ids(), this.alvoPrivado);
    if (this.mic.privado) this.alvoDaFala = this.escolhido(); // trocar no meio do sussurro é uma escolha do jogador: a voz vai ao novo alvo
    this.rotear();
  }

  /** Escolhe o jogador do canal privado (ou `null` para nenhum). */
  definirAlvo(id: number | null): void {
    this.alvoPrivado = id;
    if (this.mic.privado) this.alvoDaFala = this.escolhido();
    this.rotear();
  }

  /** O jogador que o canal privado escolheu: o que o jogador escolheu, ou o único colega na voz. `null` = ninguém. */
  private escolhido(): number | null {
    return this.alvoPrivado ?? (this.lista.length === 1 ? this.lista[0]!.id : null);
  }

  /** O alvo do privado: com a tecla apertada, o alvo **congelado** no momento em que se apertou (`null` se ele saiu); solta, o escolhido. */
  get alvo(): number | null {
    return this.mic.privado ? this.alvoDaFala : this.escolhido();
  }

  /** Em qual canal o meu microfone fala agora (`null` = calado). */
  get canal(): Canal | null {
    return this.mic.canal;
  }

  /** A sala tem times para o canal "time" (eu estou num)? */
  get temTimes(): boolean {
    return this.o.timeDe?.(this.meuId) != null;
  }

  /** Os canais precisam do envio por Web Audio (uma porta por colega); sem ele só existe "todos". */
  get canaisDisponiveis(): boolean {
    return this.envio !== null;
  }

  /** Chamar quando os times da sala mudam: refaz quem ouve. */
  reavaliarCanais(): void {
    this.rotear();
  }

  private ids(): number[] {
    return this.lista.map((l) => l.id);
  }

  private regras(): RegrasDoCanal {
    const timeDe = this.o.timeDe ?? (() => null);
    return { timeDe, meuTime: timeDe(this.meuId), alvo: this.alvo };
  }

  /** Abre ou fecha a porta de cada colega conforme o canal em que falo agora. */
  private rotear(): void {
    if (!this.envio) return;
    const canal = this.mic.canal;
    const regras = this.regras();
    for (const l of this.lista) this.envio.abrirPara(l.id, permite(canal, l.id, regras));
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

  /**
   * O retrato da voz agora (P237): o microfone, o servidor e, de cada colega, o estado da ligação, a rota de rede e quanto áudio foi e voltou. Só roda quando o jogador pede o diagnóstico
   * (`getStats` por ligação, uma vez): nada por quadro.
   */
  async diagnostico(): Promise<DiagnosticoDaVoz> {
    const faixa = this.fluxo?.getAudioTracks()[0];
    const cfg = (faixa?.getSettings?.() ?? {}) as MediaTrackSettings;
    // o navegador diz `true`/`false` ou, nas versões novas, o nome do modo (`'all'`, `'none'`): qualquer coisa que não seja desligado vale "sim"
    const sn = (v: unknown): string => (v === undefined ? '?' : v === false || v === 'none' ? 'não' : 'sim');
    const ligacoes: DiagnosticoDeLigacao[] = [];
    for (const l of this.lista) ligacoes.push(await retratar(l));
    return {
      ativa: this.noServidor,
      meuId: this.meuId,
      token: (this.o.token?.() ?? null) !== null,
      estadoMic: this.estado,
      rotulo: faixa?.label ?? '',
      taxa: cfg.sampleRate ?? 0,
      eco: sn(cfg.echoCancellation),
      ruido: sn(cfg.noiseSuppression),
      ganho: sn(cfg.autoGainControl),
      modo: this.mic.mode,
      mudo: this.mic.mudo,
      transmitindo: this.mic.transmitindo,
      naLista: [...this.naLista],
      ligacoes,
      ajusteDeGanho: this.ganho,
      viaWebAudio: this.envio !== null,
      saude: this.vigia.estado,
      nivel: this.nivel,
      faixaMuda: this.faixaMuda,
      reaberturas: this.tentativasDeReabrir,
      canal: this.mic.canal,
      alvoPrivado: this.alvo,
      temTimes: this.temTimes,
      canaisDisponiveis: this.canaisDisponiveis,
    };
  }

  dispose(): void {
    this.ligada = false;
    this.sincronizar();
    this.fecharTodas();
    this.spatial.dispose();
    clearTimeout(this.reabrirTimer);
    (globalThis as { navigator?: Navigator }).navigator?.mediaDevices?.removeEventListener?.('devicechange', this.aoMudarOsAparelhos);
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
      this.tentativasDeReabrir = 0;
      this.faixaMuda = faixa.muted;
      // O navegador avisa quando o sistema para de entregar som ao microfone (o fone Bluetooth caiu, o aparelho foi desligado): o HUD diz, e voltando a entregar o aviso some.
      faixa.addEventListener('mute', () => {
        if (this.fluxo === fluxo) this.faixaMuda = true;
      });
      faixa.addEventListener('unmute', () => {
        if (this.fluxo === fluxo) this.faixaMuda = false;
      });
      // O microfone terminou sozinho (o fone caiu, foi desplugado): solta o que era dele e **tenta de novo** (o Bluetooth costuma voltar em segundos), em vez de deixar a pessoa muda até recarregar.
      faixa.addEventListener('ended', () => {
        if (this.fluxo !== fluxo) return;
        this.largarFluxo();
        this.agendarReabertura();
      });
      this.mic.usar(faixa);
      this.montarEnvio(faixa);
      for (const l of this.lista) void this.entregarMic(l);
    } catch (e) {
      if (geracao !== this.geracaoMic) return;
      const nome = (e as { name?: string } | null)?.name;
      this.estado = nome === 'NotAllowedError' || nome === 'SecurityError' ? 'negado' : 'sem';
      if (this.estado === 'sem') this.agendarReabertura();
    }
  }

  private soltarMic(): void {
    this.geracaoMic++;
    clearTimeout(this.reabrirTimer);
    this.tentativasDeReabrir = 0;
    if (this.fluxo) for (const t of this.fluxo.getTracks()) t.stop();
    this.largarFluxo();
  }

  /** Larga o microfone atual: o fluxo, o grafo de envio e a faixa de cada colega. Quem chama decide se tenta reabrir. */
  private largarFluxo(): void {
    this.fluxo = null;
    this.estado = 'sem';
    this.faixaMuda = false;
    this.nivel = 0;
    this.mic.usar(null);
    this.envio?.dispose();
    this.envio = null;
    this.vigia.reiniciar();
    for (const l of this.lista) void l.sender?.replaceTrack(null).catch(() => {});
  }

  /** Tenta reabrir o microfone depois de um tempo (1,5 s, 3 s, 6 s, 12 s, 24 s: cinco vezes). Recusa do jogador não se repete; a voz desligada também não. */
  private agendarReabertura(): void {
    clearTimeout(this.reabrirTimer);
    if (!this.noServidor || this.estado === 'negado' || this.tentativasDeReabrir >= 5) return;
    const espera = 1500 * 2 ** this.tentativasDeReabrir;
    this.reabrirTimer = setTimeout(() => {
      if (!this.noServidor || this.fluxo) return;
      this.tentativasDeReabrir++;
      void this.abrirMic().then(() => {
        if (!this.fluxo) this.agendarReabertura();
      });
    }, espera);
  }

  /** Monta o envio por Web Audio (ganho, nível e portas por colega). Se o navegador não deixa, fica a faixa crua. */
  private montarEnvio(faixa: MediaStreamTrack): void {
    this.envio?.dispose();
    this.envio = null;
    const ctx = this.ambiente.novoContextoDeEnvio?.() ?? null;
    if (!ctx) return;
    try {
      this.envio = new EnvioDeVoz(ctx, faixa, this.ganho);
    } catch {
      this.envio = null;
      try {
        void ctx.close();
      } catch {
        // sem o que fechar
      }
    }
  }

  /** O contexto do envio ficou suspenso (o navegador não deixou tocar áudio sem gesto): volta à faixa crua em vez de mandar silêncio. */
  private abandonarEnvio(): void {
    // Sem as portas por colega não há como falar só com o time ou com um jogador: solta as teclas de canal ANTES de a faixa crua voltar (senão ela iria a todos).
    this.mic.liberarCanais();
    this.alvoDaFala = null;
    this.envio?.dispose();
    this.envio = null;
    const faixa = this.fluxo?.getAudioTracks()[0] ?? null;
    for (const l of this.lista) void l.sender?.replaceTrack(faixa).catch(() => {});
  }

  /**
   * A saúde do microfone (P237): lê o nível (a ~10 Hz, pelo HUD) e diz se ele está bem, entrega só silêncio total há tempo demais, ou se o navegador diz que a faixa parou. Sem o grafo de envio só se
   * sabe o segundo caso (`mute` da faixa).
   */
  saudeDoMic(agora: number): SaudeDoMic {
    const faixa = this.fluxo?.getAudioTracks()[0];
    if (!faixa) return 'ok';
    if (this.envio && !this.envio.funcionando && performance.now() - this.envio.criadoEm > 2500) this.abandonarEnvio();
    const leitura = this.envio?.ler();
    this.nivel = leitura ? leitura.rms : 0;
    return this.vigia.ler(agora, leitura ? leitura.pico : 1, !this.faixaMuda, this.mic.transmitindo);
  }

  /** O nível do que sai do microfone agora (RMS, 0 a 1, já com o ganho): a barra do HUD. */
  get nivelDoMic(): number {
    return this.nivel;
  }

  // ---------- as ligações ----------

  private aoLista(ids: readonly number[]): void {
    if (!this.noServidor) return;
    const quer = new Set(ids);
    quer.delete(this.meuId);
    this.naLista = [...quer];
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
    const crua = this.fluxo?.getAudioTracks()[0];
    // A porta do colega nasce no estado do canal de agora: quem chega no meio de uma fala só para o time não ouve nada.
    const faixa = this.envio?.faixaPara(l.id, permite(this.mic.canal, l.id, this.regras())) ?? crua;
    if (faixa && l.sender) await l.sender.replaceTrack(faixa).catch(() => {});
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
    this.envio?.soltarPar(l.id);
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
    this.envio?.soltarPar(id);
    this.spatial.remover(id);
    if (this.alvoPrivado === id) this.alvoPrivado = null;
    if (this.alvoDaFala === id) this.alvoDaFala = null;
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

/** Lê as estatísticas de uma ligação (a rota escolhida e os bytes de áudio). Qualquer falha do navegador vira "sem dado": o diagnóstico nunca lança. */
async function retratar(l: Ligacao): Promise<DiagnosticoDeLigacao> {
  const d: DiagnosticoDeLigacao = { id: l.id, estado: l.estado, conexao: l.pc.connectionState ?? '', ice: l.pc.iceConnectionState ?? '', rota: '', enviados: 0, recebidos: 0, perdidos: 0, nivel: null };
  try {
    if (typeof l.pc.getStats !== 'function') return d;
    const stats = await l.pc.getStats();
    const porId = new Map<string, Record<string, unknown>>();
    stats.forEach((s: Record<string, unknown>) => porId.set(String(s.id), s));
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    stats.forEach((s: Record<string, unknown>) => {
      if (s.type === 'candidate-pair' && s.state === 'succeeded' && (s.nominated === true || s.selected === true)) {
        const a = porId.get(String(s.localCandidateId));
        const b = porId.get(String(s.remoteCandidateId));
        d.rota = `${String(a?.candidateType ?? '?')}/${String(a?.protocol ?? '?')} → ${String(b?.candidateType ?? '?')}`;
      } else if (s.type === 'outbound-rtp' && s.kind === 'audio') d.enviados += num(s.bytesSent);
      else if (s.type === 'inbound-rtp' && s.kind === 'audio') {
        d.recebidos += num(s.bytesReceived);
        d.perdidos += num(s.packetsLost);
        if (typeof s.audioLevel === 'number') d.nivel = s.audioLevel;
      }
    });
  } catch {
    // o navegador não deu as estatísticas: fica o que já se sabe
  }
  return d;
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
