/** O que o jogo oferece de saída de áudio: o `AudioContext` dele e o nó mestre (o `AudioSystem.output`). `null` até o primeiro gesto do jogador. */
export interface SaidaDeAudio {
  ctx: AudioContext;
  out: AudioNode;
}

/**
 * O alcance da voz (m): volume cheio até `perto`, cai em linha reta e some em `longe` (a Arena tem ±100 m; a praia é maior). Quem está longe é ouvido baixo e do lado em que está,
 * quem está do outro lado do mapa não é ouvido: é a conversa de quem está por perto.
 */
export const ALCANCE_DA_VOZ = Object.freeze({ perto: 12, longe: 160 });

/** Desvio da onda (0 a 128) acima do qual o colega "está falando"; o ruído que sobra da supressão do navegador fica abaixo. */
const LIMIAR_FALA = 10;
/** A fala "segura" o indicador por este tempo (ms): sem isso ele piscaria entre as sílabas. */
const SEGURA_MS = 350;

interface Par {
  source: MediaStreamAudioSourceNode;
  panner: PannerNode;
  analyser: AnalyserNode;
  onda: Uint8Array<ArrayBuffer>;
  ultimoSom: number;
  x: number;
  y: number;
  z: number;
  /** O mesmo fluxo num `<audio>` mudo: o Chrome só entrega o áudio de um fluxo remoto ao Web Audio se ele também estiver num elemento de mídia (bug aberto do Chromium). */
  muda: HTMLAudioElement | null;
}

/**
 * A voz dos colegas no espaço (P205): cada um passa por um `PannerNode` (`equalpower`: pesa o lado esquerdo e o direito pela direção dele; o HRTF custa bem mais na GPU e na CPU
 * integradas e o ganho para voz é pequeno) e por um barramento de voz com volume próprio, no `AudioContext` do jogo (um contexto só). O Web Audio roda numa thread à parte: o jogo
 * só diz onde cada um está, uma vez por quadro, sem alocar (G4). Nada aqui toca a simulação (G1/G2).
 */
export class VoiceSpatial {
  private readonly pares = new Map<number, Par>();
  private readonly esperando = new Map<number, MediaStream>();
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private volume = 0.8;

  constructor(private readonly saida: () => SaidaDeAudio | null) {}

  get quantos(): number {
    return this.pares.size;
  }

  /** Põe a voz de um colega para tocar (se o áudio do jogo ainda não começou, espera o primeiro gesto e monta no próximo `atualizar`). */
  adicionar(id: number, stream: MediaStream): void {
    this.remover(id);
    this.esperando.set(id, stream);
    this.montar();
  }

  remover(id: number): void {
    this.esperando.delete(id);
    const p = this.pares.get(id);
    if (!p) return;
    this.pares.delete(id);
    p.source.disconnect();
    p.panner.disconnect();
    p.analyser.disconnect();
    if (p.muda) p.muda.srcObject = null;
  }

  /** Volume da voz dos outros (0 a 1), separado do volume do jogo. */
  setVolume(v: number): void {
    this.volume = v;
    if (this.bus) this.bus.gain.value = v;
  }

  /** Onde estou e para onde olho (`yaw`: 0 olha para -Z). Uma vez por quadro. */
  ouvinte(x: number, y: number, z: number, yaw: number): void {
    this.montar();
    const l = this.ctx?.listener;
    if (!l) return;
    l.positionX.value = x;
    l.positionY.value = y;
    l.positionZ.value = z;
    l.forwardX.value = -Math.sin(yaw);
    l.forwardY.value = 0;
    l.forwardZ.value = -Math.cos(yaw);
    l.upX.value = 0;
    l.upY.value = 1;
    l.upZ.value = 0;
  }

  /** Onde um colega está. Só mexe no nó se ele andou mais de 10 cm. */
  posicionar(id: number, x: number, y: number, z: number): void {
    const p = this.pares.get(id);
    if (!p) return;
    const dx = x - p.x, dy = y - p.y, dz = z - p.z;
    if (dx * dx + dy * dy + dz * dz < 0.01) return;
    p.x = x;
    p.y = y;
    p.z = z;
    p.panner.positionX.value = x;
    p.panner.positionY.value = y;
    p.panner.positionZ.value = z;
  }

  /** Quem está falando agora: preenche `out` (limpa antes). Chamar a ~10 Hz, não por quadro. */
  falando(agora: number, out: Set<number>): void {
    out.clear();
    for (const [id, p] of this.pares) {
      p.analyser.getByteTimeDomainData(p.onda);
      let desvio = 0;
      for (let i = 0; i < p.onda.length; i++) {
        const d = Math.abs(p.onda[i]! - 128);
        if (d > desvio) desvio = d;
      }
      if (desvio > LIMIAR_FALA) p.ultimoSom = agora;
      if (agora - p.ultimoSom < SEGURA_MS) out.add(id);
    }
  }

  dispose(): void {
    for (const id of [...this.pares.keys()]) this.remover(id);
    this.esperando.clear();
    this.bus?.disconnect();
    this.bus = null;
    this.ctx = null;
  }

  /** Monta os que estavam esperando o áudio do jogo começar. */
  private montar(): void {
    if (this.esperando.size === 0) return;
    const s = this.saida();
    if (!s) return;
    if (!this.ctx) {
      // O `AudioSystem` cria o contexto uma vez só: o barramento de voz nasce junto com o primeiro colega.
      this.ctx = s.ctx;
      this.bus = s.ctx.createGain();
      this.bus.gain.value = this.volume;
      this.bus.connect(s.out);
    }
    void s.ctx.resume();
    for (const [id, stream] of this.esperando) this.ligar(s.ctx, id, stream);
    this.esperando.clear();
  }

  private ligar(ctx: AudioContext, id: number, stream: MediaStream): void {
    const source = ctx.createMediaStreamSource(stream);
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'linear';
    panner.refDistance = ALCANCE_DA_VOZ.perto;
    panner.maxDistance = ALCANCE_DA_VOZ.longe;
    panner.rolloffFactor = 1;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(panner);
    panner.connect(this.bus!);
    source.connect(analyser);
    let muda: HTMLAudioElement | null = null;
    if (typeof Audio !== 'undefined') {
      muda = new Audio();
      muda.srcObject = stream;
      muda.muted = true;
      void muda.play().catch(() => {});
    }
    this.pares.set(id, { source, panner, analyser, onda: new Uint8Array(analyser.fftSize), ultimoSom: -Infinity, x: Number.NaN, y: 0, z: 0, muda });
  }
}
