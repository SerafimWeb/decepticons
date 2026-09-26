/**
 * AudioSystem — sons sintetizados com Web Audio API.
 *
 * Design (G1/G2/G4):
 *  - Zero arquivos externos: tudo sintetizado via osciladores e ruído.
 *  - Zero chamadas por frame: sons são agendados pelo scheduler da API e
 *    se auto-destroem ao terminar (onended). O Game.ts apenas chama os
 *    métodos de evento (playShot, playHit, …); o áudio roda na thread de
 *    áudio do navegador sem custo no loop de 60 Hz.
 *  - O AudioContext é criado na primeira interação do usuário (exigência
 *    dos navegadores modernos). Antes disso, todas as chamadas são no-op.
 *  - Volume global controlável; ativo/inativo sem custar CPU (gain = 0
 *    ou desconectado).
 */

/** Frequência de corte do filtro passa-baixa do ruído (ms padrão). */
const NOISE_CUTOFF = 2200;

/**
 * Gera um buffer de ruído branco de comprimento `samples` no contexto dado.
 * Reutilizável: passe sempre o mesmo buffer para sons de impacto/explosão.
 */
function makeNoiseBuffer(ctx: AudioContext, samples = 4096): AudioBuffer {
  const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export class AudioSystem {
  /** Ativo = false desabilita todos os sons sem custar CPU. */
  enabled = true;
  /** Volume global: 0..1. */
  masterVolume = 0.6;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  /** Buffer de ruído branco pré-gerado (reutilizado em impacto e explosão). */
  private noiseBuffer: AudioBuffer | null = null;

  // ── Inicialização (preguiçosa, na primeira interação) ──────────────────────

  /**
   * Deve ser chamado dentro de um gesto do usuário (click, keydown) para
   * satisfazer a política de autoplay dos navegadores.
   */
  resume(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);
    this.noiseBuffer = makeNoiseBuffer(this.ctx);
  }

  /** Contexto e saída com o volume mestre, para sons fora da partida (vinheta da marca). Null antes do primeiro gesto. */
  get output(): { ctx: AudioContext; out: AudioNode } | null {
    return this.ctx && this.masterGain && this.enabled ? { ctx: this.ctx, out: this.masterGain } : null;
  }

  /** Atualiza o volume global em tempo real. */
  setVolume(v: number): void {
    this.masterVolume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  // ── Sons de jogabilidade ───────────────────────────────────────────────────

  /**
   * TIRO DE PLASMA — canhão do Vector-09.
   * Oscilador curto que cai em frequência (bipe grave-agudo invertido) +
   * ruído com decay ultrarrápido (\"crack\" metálico) + squelch de rádio.
   */
  playShot(): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled) return;

    const now = ctx.currentTime;

    // Sweep de frequência descendente (700→120 Hz em 0,12 s)
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
    osc.onended = () => { oscGain.disconnect(); };

    // Transiente de ruído (\"crack\") + Squelch de Rádio (radiofonia)
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3500; // Bem agudo, \"chiado de rádio\"
      filter.Q.value = 1.0;

      const ng = ctx.createGain();
      // Ataque do tiro (0.0 a 0.05)
      ng.gain.setValueAtTime(0.25, now);
      ng.gain.exponentialRampToValueAtTime(0.05, now + 0.05);
      // Squelch final de rádio (0.05 a 0.15)
      ng.gain.setValueAtTime(0.05, now + 0.12);
      ng.gain.linearRampToValueAtTime(0.15, now + 0.13);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      src.connect(filter);
      filter.connect(ng);
      ng.connect(masterGain);
      src.start(now);
      src.stop(now + 0.19);
      src.onended = () => { ng.disconnect(); filter.disconnect(); };
    }
  }

  /**
   * IMPACTO / HIT — quando o projétil acerta um Mech.
   * Ruído filtrado com decay curto + pequeno bipe de confirmação.
   */
  playHit(): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 1.5;

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.4, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    src.connect(filter);
    filter.connect(ng);
    ng.connect(masterGain);
    src.start(now);
    src.stop(now + 0.09);
    src.onended = () => { ng.disconnect(); filter.disconnect(); };

    // Bipe de confirmação (ping ciano)
    const ping = ctx.createOscillator();
    ping.type = 'sine';
    ping.frequency.value = 1800;
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.12, now);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    ping.connect(pg);
    pg.connect(masterGain);
    ping.start(now);
    ping.stop(now + 0.06);
    ping.onended = () => { pg.disconnect(); };
  }

  /**
   * EXPLOSÃO / MORTE — quando um Mech é abatido.
   * Ruído com decay lento + sub-boom grave.
   * `distance` normaliza o volume por distância (0..1).
   */
  playExplosion(distance = 0): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer) return;

    const vol = Math.max(0.05, 1 - distance);
    const now = ctx.currentTime;

    // Sub-boom (80 Hz → 20 Hz em 0,4 s)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(80, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + 0.4);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(vol * 0.7, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    sub.connect(sg);
    sg.connect(masterGain);
    sub.start(now);
    sub.stop(now + 0.46);
    sub.onended = () => { sg.disconnect(); };

    // Ruído de explosão (grave filtrado)
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(NOISE_CUTOFF, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.5);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.6, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(masterGain);
    src.start(now);
    src.stop(now + 0.65);
    src.onended = () => { ng.disconnect(); filter.disconnect(); };
  }

  /**
   * DASH — propulsores do Mech.
   * Whoosh ascendente + ruído filtrado curto.
   */
  playDash(): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.3, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(og);
    og.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.21);
    osc.onended = () => { og.disconnect(); };

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.2, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(masterGain);
    src.start(now);
    src.stop(now + 0.19);
    src.onended = () => { ng.disconnect(); filter.disconnect(); };
  }

  /**
   * POUSO / ATERRISSAGEM — impacto dos pés no chão.
   * Pancada grave curta com componente de ruído.
   * `intensity` 0..1: suave (pulo baixo) a forte (queda longa).
   */
  playLand(intensity = 0.5): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer) return;

    const vol = 0.15 + intensity * 0.5;
    const now = ctx.currentTime;

    // Pancada baixa
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(og);
    og.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
    osc.onended = () => { og.disconnect(); };

    // Ruído de impacto
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.6, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(masterGain);
    src.start(now);
    src.stop(now + 0.11);
    src.onended = () => { ng.disconnect(); filter.disconnect(); };
  }

  /**
   * TIRO DO ANDRÓIDE — blaster agudo (escala 1).
   * Oscilador de onda quadrada alto/curto + envelope rápido, sem muito rastro.
   */
  playAndroidShot(gain = 1): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || gain < 0.03) return;

    const now = ctx.currentTime;
    
    // Oscilador de onda quadrada (timbre mais retro/sintético)
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, now); // bem agudo
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.2 * gain, now); // volume menor (é fraco)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
    osc.onended = () => { oscGain.disconnect(); };
  }

  /**
   * PASSO DO ANDRÓIDE — passos leves e metálicos rápidos.
   */
  playAndroidStep(gain = 1): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer || gain < 0.03) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.08 * gain, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(og);
    og.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
    osc.onended = () => { og.disconnect(); };

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05 * gain, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(masterGain);
    src.start(now);
    src.stop(now + 0.05);
    src.onended = () => { ng.disconnect(); filter.disconnect(); };
  }

  /**
   * CHIADO DE BLIND MODE — estática quando a cabeça do Mech é destruída.
   * Ruído branco filtrado em loop; chame `stopBlind()` para parar.
   * Retorna o nó de controle para que o chamador possa parar.
   */
  playBlindLoop(): GainNode | null {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer) return null;

    const now = ctx.currentTime;

    // Buffer de ruído maior para o loop (2 s)
    const loopBuf = makeNoiseBuffer(ctx, ctx.sampleRate * 2);
    const src = ctx.createBufferSource();
    src.buffer = loopBuf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, now);
    // Fade-in suave (0 → 0,18 em 0,3 s)
    ng.gain.linearRampToValueAtTime(0.18, now + 0.3);

    src.connect(filter);
    filter.connect(ng);
    ng.connect(masterGain);
    src.start(now);

    // Guarda a referência do source no gain para poder parar depois.
    (ng as GainNode & { _src?: AudioBufferSourceNode })._src = src;

    return ng;
  }

  /**
   * Para o loop de chiado do Blind Mode com fade-out.
   * `gainNode` = valor retornado por `playBlindLoop()`.
   */
  stopBlindLoop(gainNode: GainNode): void {
    const { ctx } = this;
    if (!ctx) return;
    const now = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
    const src = (gainNode as GainNode & { _src?: AudioBufferSourceNode })._src;
    if (src) src.stop(now + 0.31);
    gainNode.disconnect();
  }

  /**
   * PASSO DO MECH — batida pesada rítmica.
   * Chamado no evento de passo (`MechBase.onFootstep`). `gain` 0..1: força do passo × distância até o jogador.
   */
  playStep(gain = 1): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer || gain < 0.02) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.25 * gain, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(og);
    og.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
    osc.onended = () => { og.disconnect(); };

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.15 * gain, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(masterGain);
    src.start(now);
    src.stop(now + 0.08);
    src.onended = () => { ng.disconnect(); filter.disconnect(); };
  }

  /**
   * PARTE DESTRUÍDA — pedaço arrancado do Mech.
   * Estalo metálico agudo + microfonia estridente (estádio/rádio danificado).
   */
  /**
   * MOTOSSERRA — um corte (5 por segundo): serra grave com o motor tremendo e o chiado do metal.
   * `gain` 0..1 pela distância até o jogador; longe demais, nem toca.
   */
  playChainsaw(gain = 1): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer || gain < 0.03) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.08);
    osc.frequency.linearRampToValueAtTime(100, now + 0.17);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.14 * gain, now + 0.02);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(og);
    og.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.19);
    osc.onended = () => og.disconnect();

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2400;
    band.Q.value = 2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.1 * gain, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    src.connect(band);
    band.connect(ng);
    ng.connect(masterGain);
    src.start(now);
    src.stop(now + 0.17);
    src.onended = () => { ng.disconnect(); band.disconnect(); };
  }

  playPartDestroyed(): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.12);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(masterGain);
    src.start(now);
    src.stop(now + 0.16);
    src.onended = () => { ng.disconnect(); filter.disconnect(); };

    // Harmônico metálico
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, now);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.1, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(og);
    og.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
    osc.onended = () => { og.disconnect(); };
    
    // Efeito de Microfonia (Feedback agudo de equipamento danificado)
    const feedback = ctx.createOscillator();
    feedback.type = 'sine';
    feedback.frequency.setValueAtTime(2400, now); // Agudo estridente
    feedback.frequency.linearRampToValueAtTime(3200, now + 0.3);
    
    const fg = ctx.createGain();
    fg.gain.setValueAtTime(0.0, now);
    fg.gain.linearRampToValueAtTime(0.12, now + 0.05); // Aumenta rápido
    fg.gain.exponentialRampToValueAtTime(0.001, now + 0.4); // Fade out
    
    feedback.connect(fg);
    fg.connect(masterGain);
    feedback.start(now);
    feedback.stop(now + 0.45);
    feedback.onended = () => { fg.disconnect(); };
  }

  /**
   * FOGUETES — lançamento.
   * Sopro/whoosh sintetizado curto.
   */
  playRocketLaunch(): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    
    // Filtro passa-banda subindo
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(1500, now + 0.3);
    filter.Q.value = 0.5;

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, now);
    ng.gain.linearRampToValueAtTime(0.4, now + 0.05);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    src.connect(filter);
    filter.connect(ng);
    ng.connect(masterGain);
    src.start(now);
    src.stop(now + 0.45);
    src.onended = () => { ng.disconnect(); filter.disconnect(); };
  }
}
