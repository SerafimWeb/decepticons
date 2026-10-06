/** Energia independente do calor. Só o tick fixo consome/regenera. */
export const FRONTAL_SHIELD = Object.freeze({
  mass: 2,
  capacity: 100,
  drain: 20,
  regen: 12,
  recovery: 2,
  damageCost: 1,
  minStart: 15,
  coneCos: 0.5,
});
export class EnergyShield {
  equipped = false;
  energy = 0;
  active = false;
  private delay = 0;
  private releaseRequired = false;
  equip(enabled: boolean, preserve = false): void {
    const same = this.equipped === enabled;
    this.equipped = enabled;
    if (!preserve) this.reset();
    else if (!same) this.stop();
  }
  reset(): void {
    this.energy = this.equipped ? FRONTAL_SHIELD.capacity : 0;
    this.active = false;
    this.delay = 0;
    this.releaseRequired = false;
  }
  stop(): void {
    this.active = false;
    this.releaseRequired = true;
  }
  step(dt: number, held: boolean): void {
    if (!this.equipped) {
      this.active = false;
      return;
    }
    if (!held) this.releaseRequired = false;
    this.delay = Math.max(0, this.delay - dt);
    const canStart = this.active || this.energy >= FRONTAL_SHIELD.minStart;
    this.active = held && !this.releaseRequired && canStart && this.energy > 0;
    if (this.active) {
      this.energy = Math.max(0, this.energy - FRONTAL_SHIELD.drain * dt);
      this.delay = FRONTAL_SHIELD.recovery;
      if (this.energy <= 1e-8) {
        this.energy = 0;
        this.stop();
      }
    } else if (this.delay === 0)
      this.energy = Math.min(
        FRONTAL_SHIELD.capacity,
        this.energy + FRONTAL_SHIELD.regen * dt,
      );
  }
  /** Vetor do centro do robô para a fonte do impacto, em mundo. Tiros usam -direção do projétil. */
  absorb(
    damage: number,
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
  ): number {
    if (!this.active || damage <= 0) return damage;
    const length = Math.hypot(x, y, z);
    const cp = Math.cos(pitch);
    const dot =
      (-Math.sin(yaw) * cp * x + Math.sin(pitch) * y - Math.cos(yaw) * cp * z) /
      length;
    if (!Number.isFinite(dot) || dot < FRONTAL_SHIELD.coneCos) return damage;
    const absorbed = Math.min(damage, this.energy / FRONTAL_SHIELD.damageCost);
    this.energy = Math.max(
      0,
      this.energy - absorbed * FRONTAL_SHIELD.damageCost,
    );
    this.delay = FRONTAL_SHIELD.recovery;
    if (this.energy <= 1e-8) this.stop();
    return damage - absorbed;
  }
  get fraction(): number {
    return this.energy / FRONTAL_SHIELD.capacity;
  }
  applyNet(fraction: number, active: boolean): void {
    this.energy = Math.max(0, Math.min(1, fraction)) * FRONTAL_SHIELD.capacity;
    this.active = active && this.equipped;
  }
}
