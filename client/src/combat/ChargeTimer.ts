/** Carga pura no tick fixo. Não guarda carga entre apertos, trocas ou bloqueios. */
export class ChargeTimer {
  progress = 0;
  private elapsed = 0;

  step(dt: number, held: boolean, available: boolean, duration = 0): boolean {
    if (!held || !available) { this.reset(); return false; }
    if (duration <= 0) return true;
    this.elapsed += dt;
    this.progress = Math.min(1, this.elapsed / duration);
    if (this.elapsed + 1e-6 < duration) return false;
    this.reset();
    return true;
  }

  reset(): void { this.elapsed = 0; this.progress = 0; }
}
