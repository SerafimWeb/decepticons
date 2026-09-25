/**
 * Calor da arma principal: cada tiro esquenta; parado de atirar, esfria. Chegou a 100%, superaquece e
 * a arma trava até esfriar abaixo de `heatRecover`. É o "respiro" do tiro (pedido do dono: "não dá
 * pra ficar direto assim"): atirar em rajadas rende mais que segurar o gatilho.
 * Regra de simulação (G1/G2): roda no tick fixo, sem relógio nem sorteio. Vale para jogador e bots.
 */
export interface HeatStats {
  /** Calor por tiro (fração de 0 a 1). */
  heatPerShot: number;
  /** Quanto esfria por segundo, depois do atraso. */
  heatCooling: number;
  /** Segundos sem atirar antes de começar a esfriar. */
  heatCoolDelay: number;
  /** Superaquecido, a arma volta abaixo deste calor. */
  heatRecover: number;
}

/** Fração do resfriamento enquanto superaquecida. */
export const OVERHEAT_COOLING = 0.5;

export class HeatSink {
  heat = 0;
  overheated = false;
  private sinceShot = 0;

  constructor(private readonly stats: HeatStats) {}

  shot(): void {
    this.heat = Math.min(1, this.heat + this.stats.heatPerShot);
    this.sinceShot = 0;
    if (this.heat >= 1) this.overheated = true;
  }

  fixedUpdate(dt: number): void {
    this.sinceShot += dt;
    // Superaquecida, a arma esfria na metade da velocidade: segurar o gatilho até travar rende menos
    // que atirar em rajadas (sem esse castigo, dava quase no mesmo).
    const rate = this.overheated ? this.stats.heatCooling * OVERHEAT_COOLING : this.stats.heatCooling;
    if (this.sinceShot >= this.stats.heatCoolDelay) this.heat = Math.max(0, this.heat - rate * dt);
    if (this.overheated && this.heat <= this.stats.heatRecover) this.overheated = false;
  }

  reset(): void {
    this.heat = 0;
    this.overheated = false;
    this.sinceShot = 0;
  }
}
