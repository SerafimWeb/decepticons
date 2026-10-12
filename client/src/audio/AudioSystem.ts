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

import { playBrandSting } from '../brand/sting';
import type { StatusKind } from '../ui/status';

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

  /** Samples de áudio carregados via fetch (.mp3, .wav) */
  private samples: Map<string, AudioBuffer> = new Map();
  private pendingBuffers: Map<string, ArrayBuffer> = new Map();

  // Nodes para loops persistentes das novas armas e estados (T5 — zero nó novo por chamada repetida)
  private rotaryOsc: OscillatorNode | null = null;
  private rotaryGain: GainNode | null = null;

  private flameSource: AudioBufferSourceNode | null = null;
  private flameGain: GainNode | null = null;

  private currentStatusLoopKind: StatusKind | null = null;
  private statusLoopSource: AudioBufferSourceNode | OscillatorNode | null = null;
  private statusLoopGain: GainNode | null = null;


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

    for (const [name, data] of this.pendingBuffers) {
      this.ctx.decodeAudioData(data)
        .then(buf => this.samples.set(name, buf))
        .catch(err => console.warn(`[AudioSystem] Erro ao decodificar ${name}:`, err));
    }
    this.pendingBuffers.clear();
  }

  /**
   * Ponto de saída pro gravador nativo (`core/GameRecorder.ts`, dono: gravações próprias, alta qualidade,
   * sem OBS). Mudança pequena e aditiva neste arquivo (território do Gemini, `AGENTS.md` regra 4): só
   * conecta/desconecta um `AudioNode` extra no mesmo `masterGain` que já toca no alto-falante — nenhum som
   * existente muda. `null` quando o áudio ainda não iniciou (antes do primeiro gesto do jogador).
   */
  get context(): AudioContext | null {
    return this.ctx;
  }
  connectRecorder(dest: AudioNode): void {
    this.masterGain?.connect(dest);
  }
  disconnectRecorder(dest: AudioNode): void {
    try {
      this.masterGain?.disconnect(dest);
    } catch {
      // já desconectado; nada a fazer.
    }
  }

  /**
   * Inicia o carregamento de um sample de áudio.
   * Não bloqueia a thread.
   */
  loadSample(name: string, url: string): void {
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(data => {
        if (this.ctx) {
          this.ctx.decodeAudioData(data)
            .then(buf => this.samples.set(name, buf))
            .catch(err => console.warn(`[AudioSystem] Erro ao decodificar ${name}:`, err));
        } else {
          this.pendingBuffers.set(name, data);
        }
      })
      .catch(err => console.warn(`[AudioSystem] Erro ao baixar sample ${name}:`, err));
  }

  /**
   * Toca um sample carregado, se existir. 
   * Retorna true se tocou (evitando a síntese procedural).
   * `maxDuration`: se > 0, limita a duração do sample com fade-out nos últimos 30 ms,
   *                evitando tails de reverb embutidos nos arquivos.
   */
  private playSample(name: string, gain = 1, pitch = 1, maxDuration = 0): boolean {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled) return false;
    
    const buffer = this.samples.get(name);
    if (!buffer) return false;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = pitch;
    
    const ng = ctx.createGain();
    ng.gain.value = gain;
    
    src.connect(ng);
    ng.connect(masterGain);

    const now = ctx.currentTime;
    src.start(now);

    if (maxDuration > 0 && buffer.duration > maxDuration) {
      // Fade-out nos últimos 30 ms para cortar a cauda do sample sem clique
      const fadeStart = now + maxDuration - 0.03;
      ng.gain.setValueAtTime(gain, fadeStart);
      ng.gain.linearRampToValueAtTime(0, now + maxDuration);
      src.stop(now + maxDuration + 0.001);
    }

    src.onended = () => ng.disconnect();
    return true;
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

  // ── Sons de Interface / Transição ──────────────────────────────────────────

  playLogoSerafim(): void {
    if (this.playSample('logo_serafim')) return;
    if (this.ctx && this.masterGain && this.enabled) {
      playBrandSting(this.ctx, this.masterGain);
    }
  }

  playUiTransition(): void {
    if (this.playSample('ui_transition')) return;
    this.playCountdownBeep(false); // Fallback
  }

  playAmbientBram(): void {
    this.playSample('ambient_bram', 0.5);
  }

  // ── Sons de jogabilidade ───────────────────────────────────────────────────

  /**
   * TIRO DE PLASMA — canhão do Vector-09.
   * Oscilador curto que cai em frequência (bipe grave-agudo invertido) +
   * ruído com decay ultrarrápido (\"crack\" metálico) + squelch de rádio.
   */
  playShot(): void {
    if (this.playSample('shot_plasma', 0.8, 1, 0.3)) return;
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
    if (this.playSample('hit', 0.6, 1, 0.15)) return;
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
    if (this.playSample('shot_futuristic', gain * 0.5)) return;

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
    if (gain < 0.03) return;
    // maxDuration 0,12 s: passo de andróide é bem mais rápido que o do Mech
    if (this.playSample('step_heavy', gain * 0.7, 1, 0.12)) return;
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer) return;

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
    if (gain < 0.02) return;
    // maxDuration 0,25 s: impede sobreposição de tails quando o Mech anda (eco)
    if (this.playSample('step_mech', gain * 0.8, 1, 0.25)) return;
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled || !this.noiseBuffer) return;

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

  // ── Sons do Modo Sobrevivência ─────────────────────────────────────────────

  /**
   * SIRENE DE ONDA — Alarme tático pulsante (2 impulsos grave-agudo alternados).
   */
  playWaveSiren(): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.linearRampToValueAtTime(700, now + 0.25);
    osc.frequency.linearRampToValueAtTime(350, now + 0.5);
    osc.frequency.linearRampToValueAtTime(750, now + 0.75);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.setValueAtTime(0.3, now + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.86);
    osc.onended = () => gain.disconnect();
  }

  /**
   * BIPE DE CONTAGEM REGRESSIVA — tático curto.
   * `isFinal`: true para a última contagem (tom agudo e mais marcante).
   */
  playCountdownBeep(isFinal = false): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled) return;

    const now = ctx.currentTime;
    const freq = isFinal ? 1600 : 900;
    const duration = isFinal ? 0.25 : 0.08;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isFinal ? 0.35 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
    osc.onended = () => gain.disconnect();
  }

  /**
   * ONDA LIMPA — Acorde ascendente sintetizado (C-E-G vitorioso).
   */
  playWaveClearSound(): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled) return;

    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    freqs.forEach((freq, idx) => {
      if (!ctx || !masterGain) return;
      const startTime = now + idx * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.42);
      osc.onended = () => gain.disconnect();
    });
  }

  // ── T5 — Novas Armas Elementais e Estados (Rotatória, Arc, Flamer, Cryo, Status) ──

  /**
   * ROTATÓRIA (metralhadora) — zumbido que sobe de tom com a rotação (0 a 1).
   * 0 = silêncio. Nenhum nó novo por chamada repetida com a rotação ativa.
   */
  setRotarySpin(level: number): void {
    const { ctx, masterGain } = this;
    const clampedLevel = Math.max(0, Math.min(1, level));

    if (!ctx || !masterGain || !this.enabled || clampedLevel <= 0.001) {
      if (this.rotaryGain && this.rotaryOsc) {
        const now = ctx?.currentTime ?? 0;
        this.rotaryGain.gain.cancelScheduledValues(now);
        this.rotaryGain.gain.setValueAtTime(this.rotaryGain.gain.value, now);
        this.rotaryGain.gain.linearRampToValueAtTime(0, now + 0.05);
        const osc = this.rotaryOsc;
        const gain = this.rotaryGain;
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
          } catch {
            // áudio encerrado
          }
        }, 60);
        this.rotaryOsc = null;
        this.rotaryGain = null;
      }
      return;
    }

    const now = ctx.currentTime;
    const freq = 120 + clampedLevel * 380;
    const vol = 0.04 + clampedLevel * 0.22;

    if (!this.rotaryOsc || !this.rotaryGain) {
      this.rotaryOsc = ctx.createOscillator();
      this.rotaryOsc.type = 'sawtooth';
      this.rotaryGain = ctx.createGain();
      this.rotaryGain.gain.setValueAtTime(0, now);

      this.rotaryOsc.connect(this.rotaryGain);
      this.rotaryGain.connect(masterGain);
      this.rotaryOsc.start(now);
    }

    this.rotaryOsc.frequency.setValueAtTime(freq, now);
    this.rotaryGain.gain.cancelScheduledValues(now);
    this.rotaryGain.gain.setValueAtTime(vol, now);
  }

  /**
   * ARMA ELÉTRICA (arc) — estalo elétrico curto.
   */
  playArcShot(): void {
    if (this.playSample('shot_arc', 0.8, 1, 0.2)) return;
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.07);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
    osc.onended = () => gain.disconnect();
  }

  /**
   * LANÇA-CHAMAS (flamer) — laço de sopro e chama com rampa de entrada e saída.
   * Chamadas repetidas com `on = true` reusam o mesmo laço ativo.
   */
  setFlame(on: boolean): void {
    const { ctx, masterGain } = this;

    if (!on || !ctx || !masterGain || !this.enabled || !this.noiseBuffer) {
      if (this.flameGain && this.flameSource) {
        const now = ctx?.currentTime ?? 0;
        this.flameGain.gain.cancelScheduledValues(now);
        this.flameGain.gain.setValueAtTime(this.flameGain.gain.value, now);
        this.flameGain.gain.linearRampToValueAtTime(0, now + 0.08);
        const src = this.flameSource;
        const gain = this.flameGain;
        setTimeout(() => {
          try {
            src.stop();
            src.disconnect();
            gain.disconnect();
          } catch {
            // áudio encerrado
          }
        }, 90);
        this.flameSource = null;
        this.flameGain = null;
      }
      return;
    }

    if (this.flameSource && this.flameGain) {
      // Laço já ativo: nenhum nó novo
      return;
    }

    const now = ctx.currentTime;
    this.flameSource = ctx.createBufferSource();
    this.flameSource.buffer = this.noiseBuffer;
    this.flameSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 850;
    filter.Q.value = 1.2;

    this.flameGain = ctx.createGain();
    this.flameGain.gain.setValueAtTime(0, now);
    this.flameGain.gain.linearRampToValueAtTime(0.25, now + 0.08);

    this.flameSource.connect(filter);
    filter.connect(this.flameGain);
    this.flameGain.connect(masterGain);
    this.flameSource.start(now);
  }

  /**
   * ARMA DE GELO (cryo) — tiro cristalino com ressonância alta.
   */
  playCryoShot(): void {
    if (this.playSample('shot_cryo', 0.8, 1, 0.2)) return;
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(2800, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
    osc.onended = () => gain.disconnect();
  }

  /**
   * CANHÃO PESADO — o estouro de um obus de aço: um baque grave que despenca (130→36 Hz) com o ruído da explosão da pólvora, escuro e longo.
   * Nada de bipe de energia: é o som mais grave do arsenal (dono, 11/10: tiro de aço, não de luz).
   */
  playCannonShot(): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.32);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
    osc.onended = () => gain.disconnect();

    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.45);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.55, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(masterGain);
    src.start(now);
    src.stop(now + 0.52);
    src.onended = () => { ng.disconnect(); filter.disconnect(); };
  }

  /**
   * CANHÃO SÔNICO — um baque de pressão: um tom grave que sobe e cai (60→150→45 Hz, onda quadrada filtrada) com um sopro de ruído passa-baixa e um "uuuum" de onda
   * (senoide de 90 Hz com vibrato) por cima, longo e sem o estalo de energia nem o estampido de pólvora: o som de um pulso de ar, não de um tiro.
   */
  playSonicShot(): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.57);
    osc.onended = () => { gain.disconnect(); lp.disconnect(); };

    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(90, now);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 22;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 14;
    lfo.connect(lfoGain);
    lfoGain.connect(hum.frequency);
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.0001, now);
    hg.gain.exponentialRampToValueAtTime(0.22, now + 0.06);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    hum.connect(hg);
    hg.connect(masterGain);
    hum.start(now);
    lfo.start(now);
    hum.stop(now + 0.72);
    lfo.stop(now + 0.72);
    hum.onended = () => { hg.disconnect(); lfoGain.disconnect(); };

    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.setValueAtTime(900, now);
    nf.frequency.exponentialRampToValueAtTime(180, now + 0.45);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.3, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    src.connect(nf);
    nf.connect(ng);
    ng.connect(masterGain);
    src.start(now);
    src.stop(now + 0.5);
    src.onended = () => { ng.disconnect(); nf.disconnect(); };
  }

  /**
   * CANHÃO AUTOMÁTICO — uma pancada seca de aço, cinco por segundo: um tom de triângulo curto (230→95 Hz) com um estalo de ruído médio, e o
   * tilintar do estojo vazio caindo logo depois.
   */
  playAutocannonShot(): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(230, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.07);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
    osc.onended = () => gain.disconnect();

    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1700;
      filter.Q.value = 0.9;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.32, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      src.connect(filter);
      filter.connect(ng);
      ng.connect(masterGain);
      src.start(now);
      src.stop(now + 0.07);
      src.onended = () => { ng.disconnect(); filter.disconnect(); };
    }

    // O estojo vazio tilinta no chão um instante depois.
    const tink = ctx.createOscillator();
    tink.type = 'sine';
    tink.frequency.setValueAtTime(3300, now + 0.13);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, now);
    tg.gain.setValueAtTime(0.06, now + 0.13);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    tink.connect(tg);
    tg.connect(masterGain);
    tink.start(now + 0.13);
    tink.stop(now + 0.19);
    tink.onended = () => tg.disconnect();
  }

  /**
   * ENTRADA EM ESTADO — um som característico por efeito:
   * chama, faíscas, zumbido seco (atordoado), estalo de gelo, trinco (congelado).
   */
  playStatusEnter(kind: StatusKind): void {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain || !this.enabled) return;

    const now = ctx.currentTime;

    if (kind === 'queimando') {
      // Chama repentina
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(250, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.23);
      osc.onended = () => gain.disconnect();
    } else if (kind === 'chocado') {
      // Faíscas elétricas rápidas
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.setValueAtTime(1200, now + 0.04);
      osc.frequency.setValueAtTime(2400, now + 0.08);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.13);
      osc.onended = () => gain.disconnect();
    } else if (kind === 'atordoado') {
      // Zumbido seco grave descendente
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.33);
      osc.onended = () => gain.disconnect();
    } else if (kind === 'gelado') {
      // Estalo de gelo
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2100, now);
      osc.frequency.exponentialRampToValueAtTime(3500, now + 0.05);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.09);
      osc.onended = () => gain.disconnect();
    } else if (kind === 'congelado') {
      // Trinco do congelamento (crunch metálico/cristalino)
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.18);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.21);
      osc.onended = () => gain.disconnect();
    }
  }

  /**
   * LAÇO DE ESTADO — som ambiente baixo enquanto o jogador está no estado.
   * `kind = null` encerra o laço. NENHUM nó novo quando chamado repetidamente para o mesmo estado.
   */
  setStatusLoop(kind: StatusKind | null): void {
    const { ctx, masterGain } = this;

    if (!kind || !ctx || !masterGain || !this.enabled) {
      if (this.statusLoopGain && this.statusLoopSource) {
        const now = ctx?.currentTime ?? 0;
        this.statusLoopGain.gain.cancelScheduledValues(now);
        this.statusLoopGain.gain.setValueAtTime(this.statusLoopGain.gain.value, now);
        this.statusLoopGain.gain.linearRampToValueAtTime(0, now + 0.1);
        const src = this.statusLoopSource;
        const gain = this.statusLoopGain;
        setTimeout(() => {
          try {
            src.stop();
            src.disconnect();
            gain.disconnect();
          } catch {
            // áudio encerrado
          }
        }, 120);
        this.statusLoopSource = null;
        this.statusLoopGain = null;
      }
      this.currentStatusLoopKind = null;
      return;
    }

    if (this.currentStatusLoopKind === kind && this.statusLoopSource) {
      // Já no mesmo estado: não cria nós novos
      return;
    }

    // Limpa o laço anterior se houver
    this.setStatusLoop(null);

    this.currentStatusLoopKind = kind;
    const now = ctx.currentTime;
    this.statusLoopGain = ctx.createGain();
    this.statusLoopGain.gain.setValueAtTime(0, now);
    this.statusLoopGain.gain.linearRampToValueAtTime(0.08, now + 0.15);

    if (kind === 'queimando' || kind === 'gelado' || kind === 'congelado') {
      if (!this.noiseBuffer) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = kind === 'queimando' ? 'lowpass' : 'bandpass';
      filter.frequency.value = kind === 'queimando' ? 500 : kind === 'gelado' ? 1800 : 2500;
      src.connect(filter);
      filter.connect(this.statusLoopGain);
      this.statusLoopGain.connect(masterGain);
      src.start(now);
      this.statusLoopSource = src;
    } else {
      const osc = ctx.createOscillator();
      osc.type = kind === 'chocado' ? 'sawtooth' : 'sine';
      osc.frequency.value = kind === 'chocado' ? 120 : 75;
      osc.connect(this.statusLoopGain);
      this.statusLoopGain.connect(masterGain);
      osc.start(now);
      this.statusLoopSource = osc;
    }
  }
}


