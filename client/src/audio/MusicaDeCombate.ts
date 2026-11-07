import type { AudioSystem } from './AudioSystem';
import { EnergiaDeCombate, PESO_ABATE, PESO_ACERTO, type NivelDaMusica } from './energiaDeCombate';
import { BAIXO, BUMBO, CAIXA, CHIMBAL, PASSOS_POR_COMPASSO, acordeDoCompasso, frequenciaDaNota, padraoDoPasso, raizDoCompasso, segundosPorPasso } from './padraoDaMusica';

/**
 * A MÚSICA DE COMBATE (P315): uma trilha original, sintetizada no navegador (sem arquivo de terceiros), que acompanha a ação. Carrega na
 * primeira partida (o `Game` a baixa por `import()`, fora do pacote de partida). Lá menor a 108 BPM: o pad (o colchão, sempre), o baixo,
 * o bumbo, a caixa e o chimbal entram conforme a energia do combate (`EnergiaDeCombate`). Um agendador curto (a cada 40 ms, com 150 ms de
 * antecedência) põe os passos no relógio do áudio. Osciladores, ganhos e o buffer de ruído são criados uma vez; só as batidas criam uma
 * fonte curta.
 */

/** O volume da música no mix: abaixo dos efeitos (o Comandante ajusta o mix no Estúdio). */
const VOLUME = 0.5;
/** Quanto a música desce enquanto alguém fala (narrador, rádio de campo): 0,35 do volume, uns −9 dB (P316, a mixagem). */
export const FATOR_DA_FALA = 0.35;
const INTERVALO_MS = 40;
const ANTECEDENCIA_S = 0.15;
const VOZES_DO_PAD = 3;

export class MusicaDeCombate {
  private readonly energia = new EnergiaDeCombate(4);
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private analisador: AnalyserNode | null = null;
  private leitura: Float32Array<ArrayBuffer> | null = null;
  private pad: OscillatorNode[] = [];
  private baixo: OscillatorNode | null = null;
  private ganhoBaixo: GainNode | null = null;
  private ruido: AudioBuffer | null = null;
  private intervalo: ReturnType<typeof setInterval> | null = null;
  private tentativa: ReturnType<typeof setTimeout> | null = null;
  private parada: ReturnType<typeof setTimeout> | null = null;
  private ligada = false;
  private proximoPasso = 0;
  private passo = 0;
  private compasso = 0;
  private ultimoAgendamentoMs = 0;

  constructor(private readonly audio: AudioSystem) {}

  /** A música está ligada (pode ainda estar esperando o primeiro clique, que cria o contexto de áudio). */
  get tocando(): boolean {
    return this.ligada;
  }

  get nivel(): NivelDaMusica {
    return this.energia.nivel;
  }

  get energiaAtual(): number {
    return this.energia.valorAtual;
  }

  /** Um acerto que envolve o jogador (ele acertou ou foi acertado). */
  registrarAcerto(): void {
    this.energia.registrar(PESO_ACERTO);
  }

  /** O jogador abateu um inimigo. */
  registrarAbate(): void {
    this.energia.registrar(PESO_ABATE);
  }

  ligar(): void {
    if (this.ligada) return;
    this.ligada = true;
    if (this.parada !== null) {
      clearTimeout(this.parada);
      this.parada = null;
    }
    this.tentar();
  }

  /** Fade de 0,3 s; o agendador para depois, se a música não voltar. */
  desligar(): void {
    if (!this.ligada) return;
    this.ligada = false;
    if (this.tentativa !== null) {
      clearTimeout(this.tentativa);
      this.tentativa = null;
    }
    if (this.ctx && this.bus) {
      // Cancela antes a volta que uma fala possa ter agendado (`abaixar`): sem isto, pausar no meio de uma fala faria a música subir de novo com o jogo parado.
      this.bus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    }
    this.parada = setTimeout(() => this.parar(), 2500);
  }

  /**
   * A mixagem (P316): alguém começou a falar (o narrador, o rádio de campo) por `duracaoS` segundos. A música desce rápido (60 ms) para `FATOR_DA_FALA` do volume, segura
   * enquanto a fala dura e volta devagar (0,5 s). Tudo na linha do tempo do próprio áudio (sem timer); uma fala nova por cima recomeça o ciclo. Desligada, não faz nada.
   */
  abaixar(duracaoS: number): void {
    if (!this.ligada || !this.ctx || !this.bus || !(duracaoS > 0)) return;
    const t = this.ctx.currentTime;
    const ganho = this.bus.gain;
    ganho.cancelScheduledValues(t);
    ganho.setTargetAtTime(VOLUME * FATOR_DA_FALA, t, 0.06);
    ganho.setTargetAtTime(VOLUME, t + Math.max(0.3, duracaoS), 0.5);
  }

  /** O nível sonoro (RMS) do que a música manda agora, num pedaço curto. Só a bancada usa: a partida não lê isto. */
  nivelSonoro(): number {
    if (!this.analisador || !this.leitura) return 0;
    this.analisador.getFloatTimeDomainData(this.leitura);
    let soma = 0;
    for (let i = 0; i < this.leitura.length; i++) soma += this.leitura[i]! * this.leitura[i]!;
    return Math.sqrt(soma / this.leitura.length);
  }

  private tentar(): void {
    this.tentativa = null;
    if (!this.ligada || this.intervalo !== null) return;
    if (!this.ctx) {
      const out = this.audio.output;
      if (!out) {
        // O contexto de áudio só nasce no primeiro clique: tenta de novo até lá.
        this.tentativa = setTimeout(() => this.tentar(), 500);
        return;
      }
      this.montar(out.ctx, out.out);
    }
    const ctx = this.ctx;
    if (!ctx || !this.bus) return;
    this.bus.gain.setTargetAtTime(VOLUME, ctx.currentTime, 1.2);
    this.proximoPasso = ctx.currentTime + 0.05;
    this.ultimoAgendamentoMs = performance.now();
    this.intervalo = setInterval(() => this.agendar(), INTERVALO_MS);
  }

  private parar(): void {
    this.parada = null;
    if (this.ligada) return;
    if (this.intervalo !== null) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
  }

  /** Cria a cadeia de som uma vez: o pad, o baixo, o ruído (da caixa e do chimbal) e o analisador da bancada. */
  private montar(ctx: AudioContext, destino: AudioNode): void {
    this.ctx = ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    const analisador = ctx.createAnalyser();
    // Janela de ~90 ms: o analisador é só da bancada (a partida não lê o nível), e uma janela maior pega as batidas inteiras.
    analisador.fftSize = 4096;
    bus.connect(analisador);
    analisador.connect(destino);
    this.bus = bus;
    this.analisador = analisador;
    this.leitura = new Float32Array(analisador.fftSize);

    // O pad: três triângulos num filtro baixo. É o colchão, e fica em todos os níveis.
    const filtroPad = ctx.createBiquadFilter();
    filtroPad.type = 'lowpass';
    filtroPad.frequency.value = 1100;
    const ganhoPad = ctx.createGain();
    ganhoPad.gain.value = 0.09;
    filtroPad.connect(ganhoPad);
    ganhoPad.connect(bus);
    for (let i = 0; i < VOZES_DO_PAD; i++) {
      const voz = ctx.createOscillator();
      voz.type = 'triangle';
      voz.frequency.value = frequenciaDaNota(acordeDoCompasso(0)[i]!);
      voz.connect(filtroPad);
      voz.start();
      this.pad.push(voz);
    }

    // O baixo: uma dente-de-serra num filtro, com um envelope por nota (a frequência muda por nota, sem criar osciladores).
    const filtroBaixo = ctx.createBiquadFilter();
    filtroBaixo.type = 'lowpass';
    filtroBaixo.frequency.value = 380;
    const ganhoBaixo = ctx.createGain();
    ganhoBaixo.gain.value = 0;
    const baixo = ctx.createOscillator();
    baixo.type = 'sawtooth';
    baixo.frequency.value = frequenciaDaNota(raizDoCompasso(0));
    baixo.connect(filtroBaixo);
    filtroBaixo.connect(ganhoBaixo);
    ganhoBaixo.connect(bus);
    baixo.start();
    this.baixo = baixo;
    this.ganhoBaixo = ganhoBaixo;

    // O ruído: um buffer de meio segundo, com um gerador determinístico (LCG), reaproveitado pela caixa e pelo chimbal.
    const quadros = Math.floor(ctx.sampleRate * 0.5);
    const ruido = ctx.createBuffer(1, quadros, ctx.sampleRate);
    const dados = ruido.getChannelData(0);
    let semente = 0x2f6e2b1;
    for (let i = 0; i < quadros; i++) {
      semente = (Math.imul(semente, 1664525) + 1013904223) | 0;
      dados[i] = semente / 2147483648;
    }
    this.ruido = ruido;
  }

  /** Põe no relógio do áudio os passos que já cabem na antecedência. */
  private agendar(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const agoraMs = performance.now();
    this.energia.avancar((agoraMs - this.ultimoAgendamentoMs) / 1000);
    this.ultimoAgendamentoMs = agoraMs;
    const nivel = this.energia.nivel;
    const limite = ctx.currentTime + ANTECEDENCIA_S;
    while (this.proximoPasso < limite) {
      this.tocarPasso(ctx, this.proximoPasso, nivel);
      this.proximoPasso += segundosPorPasso();
      this.passo++;
      if (this.passo === PASSOS_POR_COMPASSO) {
        this.passo = 0;
        this.compasso++;
      }
    }
  }

  private tocarPasso(ctx: AudioContext, t: number, nivel: NivelDaMusica): void {
    const bus = this.bus;
    if (!bus) return;
    if (this.passo === 0) {
      // O acorde muda no tempo 1 de cada compasso.
      const acorde = acordeDoCompasso(this.compasso);
      for (let i = 0; i < this.pad.length; i++) this.pad[i]!.frequency.setValueAtTime(frequenciaDaNota(acorde[i]!), t);
    }
    const bits = padraoDoPasso(nivel, this.passo);
    if (bits & BAIXO && this.baixo && this.ganhoBaixo) {
      const duracao = segundosPorPasso();
      this.baixo.frequency.setValueAtTime(frequenciaDaNota(raizDoCompasso(this.compasso)), t);
      this.ganhoBaixo.gain.setValueAtTime(0.0001, t);
      this.ganhoBaixo.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      this.ganhoBaixo.gain.exponentialRampToValueAtTime(0.0001, t + duracao * 1.6);
    }
    if (bits & BUMBO) this.bumbo(ctx, t, bus);
    if (this.ruido) {
      if (bits & CAIXA) this.ruidoCurto(ctx, t, bus, this.ruido, 1800, 'bandpass', 0.22, 0.12);
      if (bits & CHIMBAL) this.ruidoCurto(ctx, t, bus, this.ruido, 7000, 'highpass', 0.08, 0.04);
    }
  }

  /** O bumbo: uma senoide que cai de 140 a 42 Hz em 0,12 s. */
  private bumbo(ctx: AudioContext, t: number, bus: GainNode): void {
    const oscilador = ctx.createOscillator();
    oscilador.type = 'sine';
    oscilador.frequency.setValueAtTime(140, t);
    oscilador.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(0.85, t);
    ganho.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    oscilador.connect(ganho);
    ganho.connect(bus);
    oscilador.start(t);
    oscilador.stop(t + 0.24);
  }

  /** Uma batida de ruído filtrada: a caixa (passa-banda) ou o chimbal (passa-alta). A fonte é curta e não fica viva depois. */
  private ruidoCurto(
    ctx: AudioContext,
    t: number,
    bus: GainNode,
    ruido: AudioBuffer,
    frequencia: number,
    tipo: BiquadFilterType,
    volume: number,
    duracao: number,
  ): void {
    const fonte = ctx.createBufferSource();
    fonte.buffer = ruido;
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.frequency.value = frequencia;
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(volume, t);
    ganho.gain.exponentialRampToValueAtTime(0.001, t + duracao);
    fonte.connect(filtro);
    filtro.connect(ganho);
    ganho.connect(bus);
    fonte.start(t);
    fonte.stop(t + duracao + 0.02);
  }
}
