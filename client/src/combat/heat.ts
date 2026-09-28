/**
 * Calor do Mech (dono, 25/09: "tudo pode aumentar o calor: dano, correr sem parar, usar armas, pular,
 * dash; eventualmente os mechs precisam PARAR pra resfriar; cada arma com seu coeficiente de calor").
 *
 * Um dissipador só para o Mech inteiro. O que esquenta:
 * - **tiro** de qualquer arma (o `heatPerShot` de cada uma: o coeficiente da arma);
 * - **pulo** e **dash** (picos de calor, como o tiro);
 * - **correr:** calor contínuo proporcional à velocidade. Sozinho não ferve o Mech, mas come metade do
 *   resfriamento: quem corre atirando, pulando e dando dash ferve;
 * - **dano recebido:** cada ponto de dano esquenta a blindagem (sem atrasar o resfriamento).
 * O que esfria: o chassi, depois de um atraso sem picos. **Parado, esfria em dobro.**
 *
 * Criticidade: a partir de 70% o Mech está QUENTE (aviso). Em 100% SUPERAQUECE: armas travadas, sem pulo
 * nem dash, 3/4 da velocidade (dá para fugir), e esfria na metade do ritmo, até voltar abaixo de
 * `heatRecover`. Parado, isso leva ~2 s; andando, um pouco mais. E quem para antes de ferver esfria em
 * dobro: no fim, todo Mech precisa parar para esfriar.
 *
 * Calibragem de 25/09 (dono: "o calor está muito rigoroso; pouco desempenho para fugir e combater contra
 * 3"): ~15 tiros de plasma segurando (eram ~12), trava de ~2 s (era ~2,4), correr quase não esquenta,
 * superaquecido anda a 75% (era 50%). Os foguetes esquentam um pouco mais (18%): o combo dos dois braços
 * continua sem derrubar um Mech em menos de 2,5 s.
 *
 * Regra de simulação (G1/G2): tick fixo, sem relógio nem sorteio. Vale para jogador e bots.
 */
export interface ChassisHeat {
  /** Quanto esfria por segundo, depois do atraso. */
  heatCooling: number;
  /** Segundos sem pico de calor (tiro, pulo, dash) antes de começar a esfriar. */
  heatCoolDelay: number;
  /** Superaquecido, o Mech volta a funcionar abaixo deste calor. */
  heatRecover: number;
  /** Parado, o resfriamento rende este tanto a mais (multiplicador). */
  heatIdleCooling: number;
  /** Calor por segundo correndo na velocidade máxima (proporcional à velocidade). */
  heatRun: number;
  /** Calor de cada pulo. */
  heatJump: number;
  /** Calor de cada dash. */
  heatDash: number;
  /** Calor por ponto de dano recebido. */
  heatPerDamage: number;
}

/** Fração do resfriamento enquanto superaquecido. */
export const OVERHEAT_COOLING = 0.5;
/** Fração da velocidade enquanto superaquecido. */
export const OVERHEAT_SPEED = 0.75;
/** A partir daqui o Mech está QUENTE (aviso no HUD e no som). */
export const HOT = 0.7;
/** Abaixo desta fração da velocidade máxima, o Mech conta como parado (esfria em dobro). */
export const IDLE_SPEED = 0.1;

export type HeatState = 'normal' | 'hot' | 'overheated';

export class HeatSink {
  heat = 0;
  overheated = false;
  /** Parado no último tick (o resfriamento rende mais). */
  idle = true;
  private sinceSpike = 0;

  constructor(private readonly stats: ChassisHeat) {}

  /**
   * Soma calor. `spike` = pico de uma ação do próprio Mech (tiro, pulo, dash): zera o atraso e o
   * resfriamento espera. Dano recebido esquenta sem segurar o resfriamento.
   */
  add(amount: number, spike = true): void {
    this.heat = Math.min(1, this.heat + amount);
    if (spike) this.sinceSpike = 0;
    if (this.heat >= 1) this.overheated = true;
  }

  /** Um tick. `speed` = velocidade no chão como fração da máxima do chassi (0 = parado, 1 = correndo). */
  fixedUpdate(dt: number, speed = 0): void {
    const s = this.stats;
    this.sinceSpike += dt;
    this.idle = speed < IDLE_SPEED;
    this.heat = Math.min(1, this.heat + s.heatRun * Math.min(1, speed) * dt);
    if (this.heat >= 1) this.overheated = true;
    if (this.sinceSpike >= s.heatCoolDelay) {
      // Superaquecido, o resfriamento de emergência vai na metade, parado ou não (segurar o gatilho até
      // travar rende menos que atirar em rajadas); andando, o calor da corrida ainda soma por cima.
      // Fora disso, parado esfria em dobro.
      let rate = s.heatCooling;
      if (this.overheated) rate *= OVERHEAT_COOLING;
      else if (this.idle) rate *= s.heatIdleCooling;
      this.heat = Math.max(0, this.heat - rate * dt);
    }
    if (this.overheated && this.heat <= s.heatRecover) this.overheated = false;
  }

  get state(): HeatState {
    return this.overheated ? 'overheated' : this.heat >= HOT ? 'hot' : 'normal';
  }

  /** Esfriando mais rápido por estar parado (para o HUD dizer "RESFRIANDO"). */
  get coolingBoost(): boolean {
    return this.idle && this.heat > 0 && this.sinceSpike >= this.stats.heatCoolDelay;
  }

  reset(): void {
    this.heat = 0;
    this.overheated = false;
    this.idle = true;
    this.sinceSpike = 0;
  }

  /**
   * Ventilação externa (zona de resfriamento, `combat/Zone.ts`): tira calor direto, sem esperar o
   * atraso do tiro nem exigir estar parado. Não some com o superaquecimento sozinha (`fixedUpdate`
   * ainda decide isso pelo `heatRecover`), só reduz o calor mais rápido enquanto o Mech está na zona.
   */
  ventExternal(amount: number): void {
    this.heat = Math.max(0, this.heat - amount);
    if (this.overheated && this.heat <= this.stats.heatRecover) this.overheated = false;
  }
}
