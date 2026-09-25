/**
 * Calor do Mech: cada tiro, de qualquer arma, esquenta o mesmo dissipador; parado de atirar, esfria.
 * Chegou a 100%, superaquece e as armas travam até esfriar abaixo de `heatRecover`. É o "respiro" do
 * tiro (pedido do dono: "não dá pra ficar direto assim"): rajadas rendem mais que segurar o gatilho, e
 * disparar tudo junto (plasma + foguetes) esquenta tanto que nenhum combo derruba um Mech de uma vez.
 * O dissipador é do chassi (`ChassisHeat`); o calor por tiro é da arma (`weapons.ts`).
 * Regra de simulação (G1/G2): roda no tick fixo, sem relógio nem sorteio. Vale para jogador e bots.
 */
export interface ChassisHeat {
  /** Quanto esfria por segundo, depois do atraso. */
  heatCooling: number;
  /** Segundos sem atirar antes de começar a esfriar. */
  heatCoolDelay: number;
  /** Superaquecido, as armas voltam abaixo deste calor. */
  heatRecover: number;
}

/** Fração do resfriamento enquanto superaquecida. */
export const OVERHEAT_COOLING = 0.5;

export class HeatSink {
  heat = 0;
  overheated = false;
  private sinceShot = 0;

  constructor(private readonly stats: ChassisHeat) {}

  /** Saiu um tiro que gera `heat` de calor (o `heatPerShot` da arma). */
  shot(heat: number): void {
    this.heat = Math.min(1, this.heat + heat);
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
