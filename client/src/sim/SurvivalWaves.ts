/** Preparação antes da primeira horda e intervalo depois de limpar cada onda. */
export const WAVE_BRIEFING_S = 3;
/**
 * Intervalo entre ondas: **6 s** (era 4). O dono jogou e achou a missão dura demais — este é o único respiro
 * para atravessar a arena até a **zona de cura** (20 vida/s) antes da horda seguinte.
 */
export const WAVE_CLEAR_S = 6;
export const WAVE_PROGRESS_INTERVAL_S = 0.1;

export interface WavePlan {
  readonly wave: number;
  readonly mechs: number;
  readonly androids: number;
  /** A onda fecha a missão com o Colossus (escala 3), que ocupa uma vaga própria no pool de bots. */
  readonly boss?: boolean;
  /** Orçamento do diretor: Mech custa 1, andróide custa 0,5. */
  readonly maxAttackers: number;
  readonly title: string;
}

/**
 * Primeira missão vertical: **seis ondas**, fechada pelo **Colossus-01 (escala 3)**, que ocupa uma vaga
 * própria no pool. O teto de vivos é deliberado (respeita os oito character controllers de uma sala), mas o
 * que manda no ritmo é o **orçamento do diretor**: quantos atacam ao mesmo tempo. Ele baixou em 29/09 — o
 * dono jogou e não passou da quarta onda, e a causa era cair em cima dele com três atacantes por vez.
 */
export const SURVIVAL_WAVE_PLANS: readonly WavePlan[] = Object.freeze([
  Object.freeze({ wave: 1, mechs: 0, androids: 2, maxAttackers: 1, title: 'Contato inicial' }),
  Object.freeze({ wave: 2, mechs: 1, androids: 2, maxAttackers: 1, title: 'Blindagem rebelde' }),
  Object.freeze({ wave: 3, mechs: 1, androids: 2, maxAttackers: 1.5, title: 'Cerco tático' }),
  Object.freeze({ wave: 4, mechs: 2, androids: 2, maxAttackers: 2, title: 'Linha de ruptura' }),
  Object.freeze({ wave: 5, mechs: 2, androids: 3, maxAttackers: 2.5, title: 'Última resistência' }),
  Object.freeze({ wave: 6, mechs: 0, androids: 2, boss: true, maxAttackers: 2, title: 'COLOSSUS-01 · CERCO' }),
]);

export const SURVIVAL_MAX_MECHS = 3;
export const SURVIVAL_MAX_ANDROIDS = 3;

export type WavePhase = 'briefing' | 'active' | 'clear' | 'completed' | 'failed';

export interface MissionStats {
  readonly wavesCleared: number;
  readonly kills: number;
  readonly damageDealt: number;
  readonly survivalSeconds: number;
}

export interface SurvivalWaveCallbacks {
  /** Match usa isto para ativar o pool já criado; nunca cria robôs durante o tick. */
  onRoster(plan: WavePlan | null): void;
  onWaveStart?(plan: WavePlan): void;
  onWaveProgress?(wave: number, killed: number, total: number, elapsedS: number): void;
  onWaveClear?(wave: number, elapsedS: number): void;
  onMissionEnd?(survived: boolean, stats: MissionStats): void;
}

/**
 * Máquina pura do modo Sobrevivência. Só avança por `fixedUpdate`, não lê relógio, DOM ou aleatoriedade.
 * O pool e o combate ficam no Match; este módulo decide fases, progressão e término da missão.
 */
export class SurvivalWaves {
  phase: WavePhase = 'briefing';
  wave: number;
  killed = 0;
  total = 0;
  waveElapsed = 0;
  missionElapsed = 0;
  damageDealt = 0;
  private planIndex: number;
  private phaseLeft = WAVE_BRIEFING_S;
  private progressLeft = 0;
  private completedWaves = 0;
  private totalKills = 0;

  /**
   * `firstWave` (1 a 6) é o atalho de bancada `?onda=`: começa a missão naquela onda, para ver o encontro
   * com o Colossus sem vencer as cinco anteriores. Fora do intervalo, a missão começa na 1.
   */
  constructor(
    private readonly callbacks: SurvivalWaveCallbacks,
    private readonly firstWave = 1,
  ) {
    this.wave = this.firstWave;
    this.planIndex = this.firstWave - 1;
  }

  get ended(): boolean {
    return this.phase === 'completed' || this.phase === 'failed';
  }

  get currentPlan(): WavePlan {
    return SURVIVAL_WAVE_PLANS[this.planIndex]!;
  }

  reset(): void {
    this.phase = 'briefing';
    this.wave = this.firstWave;
    this.killed = 0;
    this.total = 0;
    this.waveElapsed = 0;
    this.missionElapsed = 0;
    this.damageDealt = 0;
    this.planIndex = this.firstWave - 1;
    this.phaseLeft = WAVE_BRIEFING_S;
    this.progressLeft = 0;
    this.completedWaves = 0;
    this.totalKills = 0;
    this.callbacks.onRoster(null);
  }

  fixedUpdate(dt: number, playerAlive: boolean): void {
    if (this.ended) return;
    this.missionElapsed += dt;
    if (!playerAlive) {
      this.finish(false);
      return;
    }
    if (this.phase === 'briefing' || this.phase === 'clear') {
      this.phaseLeft -= dt;
      if (this.phaseLeft <= 0) this.beginWave();
      return;
    }
    if (this.phase !== 'active') return;
    this.waveElapsed += dt;
    this.progressLeft -= dt;
    if (this.progressLeft > 0) return;
    this.progressLeft = WAVE_PROGRESS_INTERVAL_S;
    this.callbacks.onWaveProgress?.(this.wave, this.killed, this.total, this.waveElapsed);
  }

  recordDamage(amount: number): void {
    if (this.phase === 'active' && amount > 0) this.damageDealt += amount;
  }

  /** Falha explícita quando o último piloto cai; útil para integrações que já detectaram a morte. */
  fail(): void {
    this.finish(false);
  }

  /** Devolve true quando a morte limpou a onda, para o Match remover projéteis residuais. */
  recordEnemyKilled(): boolean {
    if (this.phase !== 'active' || this.killed >= this.total) return false;
    this.killed++;
    this.totalKills++;
    this.callbacks.onWaveProgress?.(this.wave, this.killed, this.total, this.waveElapsed);
    if (this.killed < this.total) return false;
    this.completedWaves++;
    this.callbacks.onWaveClear?.(this.wave, this.waveElapsed);
    this.callbacks.onRoster(null);
    if (this.planIndex === SURVIVAL_WAVE_PLANS.length - 1) this.finish(true);
    else {
      this.planIndex++;
      this.wave = this.planIndex + 1;
      this.phase = 'clear';
      this.phaseLeft = WAVE_CLEAR_S;
    }
    return true;
  }

  private beginWave(): void {
    const plan = this.currentPlan;
    this.phase = 'active';
    this.wave = plan.wave;
    this.killed = 0;
    this.total = plan.mechs + plan.androids + (plan.boss ? 1 : 0);
    this.waveElapsed = 0;
    this.progressLeft = WAVE_PROGRESS_INTERVAL_S;
    this.callbacks.onRoster(plan);
    this.callbacks.onWaveStart?.(plan);
    this.callbacks.onWaveProgress?.(this.wave, 0, this.total, 0);
  }

  private finish(survived: boolean): void {
    if (this.ended) return;
    this.phase = survived ? 'completed' : 'failed';
    this.callbacks.onRoster(null);
    this.callbacks.onMissionEnd?.(survived, {
      wavesCleared: this.completedWaves,
      kills: this.totalKills,
      damageDealt: this.damageDealt,
      survivalSeconds: this.missionElapsed,
    });
  }
}
