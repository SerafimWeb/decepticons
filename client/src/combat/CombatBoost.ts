/** Bônus temporário de dano. Relógio determinístico; novo resgate renova sem acumular multiplicadores. */
export class CombatBoost {
  secondsLeft = 0;
  private multiplier = 1;
  get damageMultiplier(): number { return this.secondsLeft > 0 ? this.multiplier : 1; }
  activate(multiplier: number, seconds: number): void {
    if (!Number.isFinite(multiplier) || !Number.isFinite(seconds) || multiplier < 1 || seconds <= 0) return;
    this.multiplier = Math.min(2, multiplier);
    this.secondsLeft = Math.min(60, seconds);
  }
  fixedUpdate(dt: number): void {
    if (this.secondsLeft <= 0) return;
    this.secondsLeft = Math.max(0, this.secondsLeft - dt);
    if (this.secondsLeft < 1e-6) this.reset();
  }
  reset(): void { this.secondsLeft = 0; this.multiplier = 1; }
}
