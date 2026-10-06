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
export type ShieldId = 'frontal' | 'sphere';
export const SPHERE_SHIELD = Object.freeze({
  mass: 4, capacity: 150, drain: 40, regen: 15, recovery: 3,
  damageCost: 1, minStart: 30, coneCos: -1,
});
export const SHIELDS = { frontal: FRONTAL_SHIELD, sphere: SPHERE_SHIELD } as const;
export class EnergyShield {
  kind: ShieldId | null = null;
  get equipped(): boolean { return this.kind !== null; }
  get stats(): typeof FRONTAL_SHIELD | typeof SPHERE_SHIELD { return SHIELDS[this.kind ?? 'frontal']; }
  energy = 0;
  active = false;
  private delay = 0;
  private releaseRequired = false;
  equip(module: ShieldId | boolean | null | undefined, preserve = false): void {
    const kind = module === true ? 'frontal' : module || null;
    const same = this.kind === kind;
    this.kind = kind;
    if (!preserve) this.reset();
    else {
      // Trocar o gerador nunca concede energia grátis; reserva absoluta limitada ao novo teto.
      this.energy = this.equipped ? Math.min(this.energy, this.stats.capacity) : 0;
      if (!same) this.stop();
    }
  }
  reset(): void {
    this.energy = this.equipped ? this.stats.capacity : 0;
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
    const canStart = this.active || this.energy >= this.stats.minStart;
    this.active = held && !this.releaseRequired && canStart && this.energy > 0;
    if (this.active) {
      this.energy = Math.max(0, this.energy - this.stats.drain * dt);
      this.delay = this.stats.recovery;
      if (this.energy <= 1e-8) {
        this.energy = 0;
        this.stop();
      }
    } else if (this.delay === 0)
      this.energy = Math.min(
        this.stats.capacity,
        this.energy + this.stats.regen * dt,
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
    if (this.kind !== 'sphere' && (!Number.isFinite(dot) || dot < this.stats.coneCos)) return damage;
    const absorbed = Math.min(damage, this.energy / this.stats.damageCost);
    this.energy = Math.max(
      0,
      this.energy - absorbed * this.stats.damageCost,
    );
    this.delay = this.stats.recovery;
    if (this.energy <= 1e-8) this.stop();
    return damage - absorbed;
  }
  get fraction(): number {
    return this.energy / this.stats.capacity;
  }
  applyNet(fraction: number, active: boolean): void {
    this.energy = Math.max(0, Math.min(1, fraction)) * this.stats.capacity;
    this.active = active && this.equipped;
  }
}
