/**
 * O TESTE DO MICROFONE (P212, 19/10): um painel nas Configurações para o jogador ver, **sem precisar de outra pessoa na sala**, se o microfone funciona: escolher o aparelho, a barra de
 * nível ao vivo, e "ouvir a minha voz" (a volta do próprio som, com o aviso dos fones). O chat de voz só toca para quem está do outro lado: sozinho na sala o jogador não ouve nada e não tem como
 * saber se o microfone presta. Pedaço sob demanda (a dieta de JS, P187): só baixa quem toca em TESTAR. Usa as mesmas restrições do jogo (eco, ruído e ganho automático): o teste é o que o chat vai ouvir.
 */

import type { VozEfeito } from '../core/Settings';
import { abrirMicrofone } from './abrirMicrofone';
import type { CadeiaDeVoz } from './EfeitosDeVoz';

/** Os textos do painel: cada um é uma chave do dicionário de idiomas (`public/locales`); o teste confere que os seis idiomas têm todas. */
export const TEXTO_DO_TESTE = Object.freeze({
  pedindo: 'Pedindo o microfone ao navegador…',
  fale: 'Fale agora: a barra tem de se mexer.',
  ok: 'Funcionando: o microfone está captando a sua voz.',
  semSinal: 'Sem sinal: fale mais perto, ou escolha outro aparelho.',
  silencioTotal: 'Silêncio total: este aparelho não entrega som (mudo ou desligado no Windows). Escolha outro da lista.',
  usando: 'Aparelho em uso: {0}',
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

/**
 * O volume da onda (amostras de -1 a 1): o RMS de 0 a 1 e o pico (a maior amostra, em módulo). **Em ponto flutuante, não em bytes:** um byte só enxerga passos de 0,0078, e um fone Bluetooth
 * (o do Comandante) entrega voz baixinha (RMS de 0,01) que em bytes quase não aparece.
 */
export function nivelDaOnda(onda: Float32Array): { rms: number; pico: number } {
  let soma = 0;
  let pico = 0;
  for (let i = 0; i < onda.length; i++) {
    const v = onda[i]!;
    soma += v * v;
    const a = v < 0 ? -v : v;
    if (a > pico) pico = a;
  }
  return { rms: onda.length === 0 ? 0 : Math.sqrt(soma / onda.length), pico };
}

/** O RMS na barra (0 a 100): em decibéis, de −60 dBFS (vazio) a 0 dBFS (cheio); a fala normal fica entre 50 e 80. */
export function barraDoNivel(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-5));
  return Math.round(Math.min(100, Math.max(0, ((db + 60) / 60) * 100)));
}

/** A partir deste RMS (~−42 dBFS) o microfone "está captando": voz comum num fone Bluetooth passa disso; o chiado do quarto (~0,001) fica bem abaixo. Era 0,02, que deixava de fora o fone do Comandante. */
export const RMS_CAPTANDO = 0.008;
/** Quanto esperar a voz antes de dizer "sem sinal" (ms). */
export const ESPERA_SEM_SINAL_MS = 4000;
/** O teste desliga sozinho depois disto (o microfone nunca fica aberto esquecido). */
export const DURACAO_MAXIMA_MS = 120_000;

export type EstadoDoTeste = 'ok' | 'fale' | 'semSinal' | 'silencioTotal';

/**
 * O que dizer ao jogador: já captou? ainda cedo? passou da espera sem voz? ou o aparelho entrega **zero absoluto** (`picoAmostra === 0` o teste inteiro)? Um microfone vivo sempre tem um chiado
 * acima de zero; zero exato é aparelho mudo ou desligado no Windows (foi o caso do "Microfone (Captain 300)" USB do Comandante), e merece uma frase própria.
 */
export function estadoDoTeste(msDesdeInicio: number, picoRms: number, picoAmostra = 1): EstadoDoTeste {
  if (picoRms >= RMS_CAPTANDO) return 'ok';
  if (msDesdeInicio < ESPERA_SEM_SINAL_MS) return 'fale';
  return picoAmostra === 0 ? 'silencioTotal' : 'semSinal';
}

// ---------- o painel (a parte com tela) ----------

export interface PecasDoTeste {
  painel: { hidden: boolean | string; dataset: Record<string, string | undefined>; scrollIntoView?(o: { block: 'nearest' }): void };
  barra: { style: { width: string } };
  status: { textContent: string | null };
  botao: { textContent: string | null };
  ouvir: { checked: boolean };
  /** Onde dizer qual aparelho abriu (o navegador diz o nome na faixa). Sem ele, procura `#voz-teste-aparelho` (a seção das Configurações). */
  aparelho?: { textContent: string | null };
}

/** O que o teste pede ao navegador: separado para o teste de unidade trocar por um falso (o microfone de verdade só se prova num Chrome, `medicoes/voz-teste-mic.mjs`). */
export interface AmbienteDoTeste {
  abrir(aparelho: string): Promise<MediaStream>;
  novoContexto(): AudioContext;
  quadro(f: () => void): number;
  cancelarQuadro(id: number): void;
  agora(): number;
  /** A cadeia do efeito na voz (P231) que a prévia "ouvir a minha voz" toca; sem ela (ou `normal`) a voz volta pura. Separado para o teste de unidade trocar por uma falsa. */
  cadeiaDeVoz?(ctx: AudioContext, efeito: VozEfeito): Promise<CadeiaDeVoz | null>;
}

export const AMBIENTE_DO_NAVEGADOR: AmbienteDoTeste = {
  // O mesmo pedido do chat de voz (o teste é o que o chat vai ouvir): o aparelho escolhido é `exact`, e só cai no padrão se ele sumiu.
  abrir: (aparelho) => abrirMicrofone(aparelho),
  novoContexto: () => new AudioContext(),
  quadro: (f) => requestAnimationFrame(f),
  cancelarQuadro: (id) => cancelAnimationFrame(id),
  agora: () => performance.now(),
  // Pedaço sob demanda: só baixa quem escolheu um efeito.
  cadeiaDeVoz: (ctx, efeito) => (efeito === 'normal' ? Promise.resolve(null) : import('./EfeitosDeVoz').then((m) => m.criarCadeiaDeVoz(ctx, efeito))),
};

/**
 * O teste: abre o microfone, mostra o nível ao vivo e diz se está captando. Não manda nada a ninguém. **Para sozinho** ao fechar as Configurações, ao trocar de aba, ao esconder a página, ou
 * depois de 2 minutos (`DURACAO_MAXIMA_MS`): o microfone nunca fica aberto esquecido. Por quadro só lê 1.024 amostras e mexe na barra (e só quando ela muda).
 */
export class MicTest {
  private fluxo: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private volta: GainNode | null = null;
  /** O microfone dentro do contexto e o efeito que ele atravessa até a volta (P231). */
  private fonteDoMic: MediaStreamAudioSourceNode | null = null;
  private cadeia: CadeiaDeVoz | null = null;
  /** Para onde a fonte está ligada (a entrada da cadeia ou a volta direta): é de onde ela é desligada ao trocar. */
  private destinoDaVoz: AudioNode | null = null;
  /** Cada religação da volta tem a sua versão: um pedido lento que termina depois de outro mais novo é descartado. */
  private versaoDaVolta = 0;
  private analyser: AnalyserNode | null = null;
  private onda = new Float32Array(1024);
  private quadroId = 0;
  private inicio = 0;
  private pico = 0;
  /** A maior amostra (em módulo) vista no teste: zero exato o tempo todo é aparelho mudo. */
  private picoAmostra = 0;
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
    /** O efeito que a prévia "ouvir a minha voz" aplica (P231); o nível da barra é sempre o do microfone puro. */
    private readonly efeito: () => VozEfeito = () => 'normal',
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
      volta.connect(ctx.destination);
      this.ctx = ctx;
      this.analyser = analyser;
      this.volta = volta;
      this.fonteDoMic = fonte;
      void this.ligarVolta();
      this.inicio = this.ambiente.agora();
      this.pico = 0;
      this.picoAmostra = 0;
      this.p.painel.dataset.estado = 'fale';
      this.dizer(TEXTO_DO_TESTE.fale);
      this.dizerAparelho(fluxo.getAudioTracks?.()[0]?.label ?? '');
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

  /**
   * Liga o microfone à volta da voz, pelo efeito escolhido (P231): fonte → [cadeia] → volta. Sem efeito é um fio direto, na hora; com efeito espera o pedaço sob demanda baixar (a volta fica
   * muda até lá, nunca toca a voz pura por engano). Chamar de novo troca o efeito com o teste ligado.
   */
  private async ligarVolta(): Promise<void> {
    const { ctx, fonteDoMic: fonte, volta } = this;
    if (!ctx || !fonte || !volta) return;
    const versao = ++this.versaoDaVolta;
    this.cadeia?.desligar();
    this.cadeia = null;
    if (this.destinoDaVoz) {
      try {
        fonte.disconnect(this.destinoDaVoz);
      } catch {
        // já solta
      }
      this.destinoDaVoz = null;
    }
    const efeito = this.efeito();
    let cadeia: CadeiaDeVoz | null = null;
    if (efeito !== 'normal' && this.ambiente.cadeiaDeVoz) {
      try {
        cadeia = await this.ambiente.cadeiaDeVoz(ctx, efeito);
      } catch {
        cadeia = null; // o efeito não baixou: a prévia segue com a voz pura
      }
      if (versao !== this.versaoDaVolta || this.ctx !== ctx) {
        cadeia?.desligar(); // chegou depois de outro pedido, ou de o teste parar
        return;
      }
    }
    if (cadeia) {
      fonte.connect(cadeia.entrada);
      cadeia.saida.connect(volta);
      this.cadeia = cadeia;
      this.destinoDaVoz = cadeia.entrada;
    } else {
      fonte.connect(volta);
      this.destinoDaVoz = volta;
    }
  }

  /** Trocou o efeito com o teste ligado: a prévia passa a tocar o novo. */
  async trocarEfeito(): Promise<void> {
    if (this.fluxo) await this.ligarVolta();
  }

  /** Desliga o teste e solta o microfone. */
  parar(): void {
    this.geracao++;
    this.versaoDaVolta++;
    this.cadeia?.desligar();
    this.cadeia = null;
    this.destinoDaVoz = null;
    this.fonteDoMic = null;
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
    this.dizerAparelho('');
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
    if (this.onda.length !== a.fftSize) this.onda = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(this.onda);
    const { rms, pico } = nivelDaOnda(this.onda);
    if (rms > this.pico) this.pico = rms;
    if (pico > this.picoAmostra) this.picoAmostra = pico;
    this.mexerBarra(barraDoNivel(rms));
    const estado = estadoDoTeste(agora - this.inicio, this.pico, this.picoAmostra);
    if (this.p.painel.dataset.estado !== estado) {
      this.p.painel.dataset.estado = estado;
      this.dizer(TEXTO_DO_TESTE[estado === 'ok' ? 'ok' : estado === 'semSinal' ? 'semSinal' : estado === 'silencioTotal' ? 'silencioTotal' : 'fale']);
    }
    this.quadroId = this.ambiente.quadro(this.ler);
  };

  private mexerBarra(percentual: number): void {
    if (percentual === this.barraAtual) return;
    this.barraAtual = percentual;
    this.p.barra.style.width = `${percentual}%`;
  }

  /** Diz qual aparelho o navegador abriu (o nome da faixa); vazio apaga. É o que mostra, por exemplo, que a escolha da lista valeu. */
  private dizerAparelho(nome: string): void {
    const el = this.p.aparelho ?? (typeof document !== 'undefined' ? document.getElementById('voz-teste-aparelho') : null);
    if (el) el.textContent = nome ? TEXTO_DO_TESTE.usando.replace('{0}', nome) : '';
  }

  private dizer(texto: string): void {
    if (texto !== this.textoAtual) this.p.status.textContent = this.textoAtual = texto;
  }
}
