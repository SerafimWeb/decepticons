/**
 * O TESTE DO MICROFONE (P212, 19/10): um painel nas Configurações para o jogador ver, **sem precisar de outra pessoa na sala**, se o microfone funciona: escolher o aparelho, a barra de
 * nível ao vivo, e "ouvir a minha voz" (a volta do próprio som, com o aviso dos fones). O chat de voz só toca para quem está do outro lado: sozinho na sala o jogador não ouve nada e não tem como
 * saber se o microfone presta. Pedaço sob demanda (a dieta de JS, P187): só baixa quem toca em TESTAR. Usa as mesmas restrições do jogo (eco, ruído e ganho automático): o teste é o que o chat vai ouvir.
 */

/** Os textos do painel: cada um é uma chave do dicionário de idiomas (`public/locales`); o teste confere que os seis idiomas têm todas. */
export const TEXTO_DO_TESTE = Object.freeze({
  pedindo: 'Pedindo o microfone ao navegador…',
  fale: 'Fale agora: a barra tem de se mexer.',
  ok: 'Funcionando: o microfone está captando a sua voz.',
  semSinal: 'Sem sinal: fale mais perto, ou escolha outro aparelho.',
  negado: 'O navegador bloqueou o microfone neste site. Clique no cadeado ao lado do endereço, permita o microfone e teste de novo.',
  semAparelho: 'Nenhum microfone encontrado. Conecte um e teste de novo.',
  emUso: 'O microfone está em uso por outro programa. Feche-o e teste de novo.',
  outra: 'Não foi possível abrir o microfone. Escolha outro aparelho e teste de novo.',
  testar: '[ TESTAR ]',
  parar: '[ PARAR O TESTE ]',
  padrao: 'Padrão do sistema',
  desconectado: 'Aparelho salvo (desconectado)',
  aparelho: 'Microfone {0}',
});

export type FalhaDoMic = 'negado' | 'semAparelho' | 'emUso' | 'outra';

/** Por que o navegador não abriu o microfone (o `name` do erro do `getUserMedia`). */
export function classificarFalha(e: unknown): FalhaDoMic {
  const nome = (e as { name?: string } | null)?.name ?? '';
  if (nome === 'NotAllowedError' || nome === 'SecurityError' || nome === 'PermissionDeniedError') return 'negado';
  if (nome === 'NotFoundError' || nome === 'DevicesNotFoundError') return 'semAparelho';
  if (nome === 'NotReadableError' || nome === 'TrackStartError' || nome === 'AbortError') return 'emUso';
  return 'outra';
}

/** O volume da onda (bytes de 0 a 255, o silêncio em 128): o RMS de 0 a 1. */
export function nivelRms(onda: Uint8Array): number {
  if (onda.length === 0) return 0;
  let soma = 0;
  for (let i = 0; i < onda.length; i++) {
    const v = (onda[i]! - 128) / 128;
    soma += v * v;
  }
  return Math.sqrt(soma / onda.length);
}

/** O RMS na barra (0 a 100): em decibéis, de −60 dBFS (vazio) a 0 dBFS (cheio); a fala normal fica entre 50 e 80. */
export function barraDoNivel(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-5));
  return Math.round(Math.min(100, Math.max(0, ((db + 60) / 60) * 100)));
}

/** A partir deste RMS (~−34 dBFS) o microfone "está captando". */
export const RMS_CAPTANDO = 0.02;
/** Quanto esperar a voz antes de dizer "sem sinal" (ms). */
export const ESPERA_SEM_SINAL_MS = 4000;
/** O teste desliga sozinho depois disto (o microfone nunca fica aberto esquecido). */
export const DURACAO_MAXIMA_MS = 120_000;

export type EstadoDoTeste = 'ok' | 'fale' | 'semSinal';

/** O que dizer ao jogador: já captou? ainda cedo? ou passou da espera sem sinal? */
export function estadoDoTeste(msDesdeInicio: number, picoRms: number): EstadoDoTeste {
  if (picoRms >= RMS_CAPTANDO) return 'ok';
  return msDesdeInicio < ESPERA_SEM_SINAL_MS ? 'fale' : 'semSinal';
}

// ---------- o painel (a parte com tela) ----------

export interface PecasDoTeste {
  painel: { hidden: boolean | string; dataset: Record<string, string | undefined>; scrollIntoView?(o: { block: 'nearest' }): void };
  barra: { style: { width: string } };
  status: { textContent: string | null };
  botao: { textContent: string | null };
  ouvir: { checked: boolean };
}

/** O que o teste pede ao navegador: separado para o teste de unidade trocar por um falso (o microfone de verdade só se prova num Chrome, `medicoes/voz-teste-mic.mjs`). */
export interface AmbienteDoTeste {
  abrir(aparelho: string): Promise<MediaStream>;
  novoContexto(): AudioContext;
  quadro(f: () => void): number;
  cancelarQuadro(id: number): void;
  agora(): number;
}

export const AMBIENTE_DO_NAVEGADOR: AmbienteDoTeste = {
  abrir: (aparelho) => {
    if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(new DOMException('sem microfone', 'NotFoundError'));
    // As mesmas restrições do chat de voz: o teste é o que o chat vai ouvir. `ideal` (não `exact`): o aparelho salvo que foi desligado cai no padrão em vez de falhar.
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, ...(aparelho ? { deviceId: { ideal: aparelho } } : {}) },
      video: false,
    });
  },
  novoContexto: () => new AudioContext(),
  quadro: (f) => requestAnimationFrame(f),
  cancelarQuadro: (id) => cancelAnimationFrame(id),
  agora: () => performance.now(),
};

/**
 * O teste: abre o microfone, mostra o nível ao vivo e diz se está captando. Não manda nada a ninguém. **Para sozinho** ao fechar as Configurações, ao trocar de aba, ao esconder a página, ou
 * depois de 2 minutos (`DURACAO_MAXIMA_MS`): o microfone nunca fica aberto esquecido. Por quadro só lê 1.024 amostras e mexe na barra (e só quando ela muda).
 */
export class MicTest {
  private fluxo: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private volta: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private onda = new Uint8Array(1024);
  private quadroId = 0;
  private inicio = 0;
  private pico = 0;
  private barraAtual = -1;
  private textoAtual = '';
  private geracao = 0;
  private abrindo = false;
  private readonly aoEsconder = () => {
    if (typeof document !== 'undefined' && document.hidden) this.parar();
  };

  constructor(
    private readonly p: PecasDoTeste,
    private readonly aparelho: () => string,
    private readonly ambiente: AmbienteDoTeste = AMBIENTE_DO_NAVEGADOR,
    /** Chamado depois que o microfone abriu (a permissão saiu): com ele os aparelhos ganham nome. */
    private readonly aoAbrir: () => void = () => {},
  ) {}

  get rodando(): boolean {
    return this.fluxo !== null || this.abrindo;
  }

  async iniciar(): Promise<void> {
    if (this.rodando) return;
    this.abrindo = true;
    const geracao = ++this.geracao;
    this.p.painel.hidden = false;
    // A janela das Configurações rola: o painel abre embaixo e a barra ficava cortada.
    this.p.painel.scrollIntoView?.({ block: 'nearest' });
    this.p.painel.dataset.estado = 'pedindo';
    this.dizer(TEXTO_DO_TESTE.pedindo);
    this.p.botao.textContent = TEXTO_DO_TESTE.parar;
    this.mexerBarra(0);
    try {
      const fluxo = await this.ambiente.abrir(this.aparelho());
      if (geracao !== this.geracao) {
        // Parou (fechou as Configurações, trocou de aba) enquanto o navegador perguntava: solta o microfone na hora.
        for (const t of fluxo.getTracks()) t.stop();
        return;
      }
      this.fluxo = fluxo;
      const ctx = this.ambiente.novoContexto();
      void ctx.resume();
      const fonte = ctx.createMediaStreamSource(fluxo);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      fonte.connect(analyser);
      const volta = ctx.createGain();
      volta.gain.value = this.p.ouvir.checked ? 1 : 0;
      fonte.connect(volta);
      volta.connect(ctx.destination);
      this.ctx = ctx;
      this.analyser = analyser;
      this.volta = volta;
      this.inicio = this.ambiente.agora();
      this.pico = 0;
      this.p.painel.dataset.estado = 'fale';
      this.dizer(TEXTO_DO_TESTE.fale);
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.aoEsconder);
      this.aoAbrir();
      this.quadroId = this.ambiente.quadro(this.ler);
    } catch (e) {
      if (geracao !== this.geracao) return;
      const falha = classificarFalha(e);
      this.p.painel.dataset.estado = falha;
      this.dizer(TEXTO_DO_TESTE[falha]);
      this.p.botao.textContent = TEXTO_DO_TESTE.testar;
    } finally {
      this.abrindo = false;
    }
  }

  /** "Ouvir a minha voz": liga ou desliga a volta do som (o jogador avisado dos fones). */
  ouvirAMinhaVoz(on: boolean): void {
    if (this.volta) this.volta.gain.value = on ? 1 : 0;
  }

  /** Desliga o teste e solta o microfone. */
  parar(): void {
    this.geracao++;
    this.abrindo = false;
    if (this.quadroId) this.ambiente.cancelarQuadro(this.quadroId);
    this.quadroId = 0;
    if (this.fluxo) for (const t of this.fluxo.getTracks()) t.stop();
    this.fluxo = null;
    this.analyser = null;
    this.volta = null;
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.aoEsconder);
    this.p.painel.hidden = true;
    delete this.p.painel.dataset.estado;
    this.p.ouvir.checked = false;
    this.p.botao.textContent = TEXTO_DO_TESTE.testar;
    this.mexerBarra(0);
  }

  /** Trocou o aparelho com o teste ligado: recomeça com o novo. */
  async reiniciar(): Promise<void> {
    if (!this.rodando) return;
    this.parar();
    await this.iniciar();
  }

  /** Um quadro: lê a onda, mexe a barra e escolhe o texto. */
  private readonly ler = (): void => {
    const a = this.analyser;
    if (!a) return;
    const agora = this.ambiente.agora();
    if (agora - this.inicio > DURACAO_MAXIMA_MS) {
      this.parar();
      return;
    }
    if (this.onda.length !== a.fftSize) this.onda = new Uint8Array(a.fftSize);
    a.getByteTimeDomainData(this.onda);
    const rms = nivelRms(this.onda);
    if (rms > this.pico) this.pico = rms;
    this.mexerBarra(barraDoNivel(rms));
    const estado = estadoDoTeste(agora - this.inicio, this.pico);
    if (this.p.painel.dataset.estado !== estado) {
      this.p.painel.dataset.estado = estado;
      this.dizer(estado === 'ok' ? TEXTO_DO_TESTE.ok : estado === 'semSinal' ? TEXTO_DO_TESTE.semSinal : TEXTO_DO_TESTE.fale);
    }
    this.quadroId = this.ambiente.quadro(this.ler);
  };

  private mexerBarra(percentual: number): void {
    if (percentual === this.barraAtual) return;
    this.barraAtual = percentual;
    this.p.barra.style.width = `${percentual}%`;
  }

  private dizer(texto: string): void {
    if (texto !== this.textoAtual) this.p.status.textContent = this.textoAtual = texto;
  }
}
