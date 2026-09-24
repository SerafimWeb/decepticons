/**
 * Monitora a performance (FPS) e rebaixa a qualidade gráfica 
 * se o jogo não conseguir manter 50 FPS por alguns segundos (G12).
 * Não faz upgrade de volta para evitar instabilidade.
 */
export class Quality {
  private frameCount = 0;
  private timeAccumulator = 0;
  private tier = 0;
  /** Desligado quando o jogador fixa a qualidade nas configurações. */
  private adaptive = true;
  private readonly maxTiers = 2;

  // Em segundos
  private readonly checkInterval = 2.0;

  constructor(
    private readonly setPixelRatio: (ratio: number) => void,
    private readonly setBloom: (enabled: boolean) => void
  ) {}

  /**
   * Chamado a cada frame do render com o tempo (dt) daquele frame.
   */
  /** Liga/desliga o rebaixamento automático; ligar recomeça do degrau mais alto. */
  setAdaptive(on: boolean): void {
    this.adaptive = on;
    this.tier = 0;
    this.frameCount = 0;
    this.timeAccumulator = 0;
  }

  update(dt: number): void {
    if (!this.adaptive || this.tier >= this.maxTiers) return;
    
    // dt máximo contabilizado para não quebrar a lógica se a aba ficar inativa
    const clampedDt = Math.min(dt, 0.1); 
    
    this.frameCount++;
    this.timeAccumulator += clampedDt;

    if (this.timeAccumulator >= this.checkInterval) {
      const fps = this.frameCount / this.timeAccumulator;
      
      if (fps < 50) {
        this.degrade();
      }

      this.frameCount = 0;
      this.timeAccumulator = 0;
    }
  }

  private degrade(): void {
    this.tier++;
    if (this.tier === 1) {
      // Degrau 1: Reduzir pixelRatio (tipicamente de 1.5 para 1.0)
      this.setPixelRatio(1.0);
    } else if (this.tier === 2) {
      // Degrau 2: Desligar Bloom
      this.setBloom(false);
    }
  }

  get currentTier(): number {
    return this.tier;
  }
}
