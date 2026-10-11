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
export type ShieldId = 'frontal' | 'sphere' | 'fire';
export const SPHERE_SHIELD = Object.freeze({
  mass: 4, capacity: 150, drain: 40, regen: 15, recovery: 3,
  damageCost: 1, minStart: 30, coneCos: -1,
});
/**
 * Anel de fogo (dono, 11/10: *"o fogo também pode ser um tipo de escudo, que solta um círculo de fogo ao redor do Mech, queimando tudo ao redor durante
 * alguns segundos, e aumentando o calor geral de tudo, inclusive do próprio robô"*). **Não segura tiro**: usa o mesmo gerador, a mesma tecla, a mesma energia e o
 * mesmo HUD do escudo, mas em vez de absorver dano solta um círculo de fogo em volta do Mech. Ligado (100 de energia, 20 por segundo: **5 s**), a cada
 * `pulse` segundos: todo inimigo a até `radius` m (medido até a superfície do corpo) leva `damage` e fica **queimando**; **todo Mech dentro do anel esquenta
 * `heat`, inclusive quem o solta e os aliados** (o calor geral de tudo); e um inimigo **congelado** que o anel pega **derrete**: leva `melt` de dano extra de uma
 * vez (o combo do gelo com o fogo: segurar o inimigo dentro do anel, e o anel o derrete). A recarga é lenta (8 por segundo, depois de 4 s desligado, e só liga
 * com 40 de energia): o anel é um golpe de equipe, não um escudo para andar ligado.
 */
export const FIRE_RING = Object.freeze({
  mass: 3, capacity: 100, drain: 20, regen: 8, recovery: 4, damageCost: 1, minStart: 40, coneCos: -1,
  /** Raio do anel (m), do centro do Mech até a superfície do alvo. */
  radius: 7,
  /** Quanto o anel alcança acima e abaixo do Mech (m): quem está noutro andar ou numa vala não é pego. */
  reach: 4,
  /** Segundos entre dois pulsos. */
  pulse: 0.25,
  /** Dano de cada pulso em cada inimigo (12 por segundo), além do queimando (6 por segundo). */
  damage: 3,
  /** Calor (fração do dissipador) que cada pulso põe em TODO Mech dentro do anel, inclusive o dono (0,16 por segundo: ferve em ~6 s). */
  heat: 0.04,
  /** Dano extra, uma vez, num inimigo congelado que o anel pega: o gelo derrete e vira vapor. */
  melt: 40,
});
export const SHIELDS = { frontal: FRONTAL_SHIELD, sphere: SPHERE_SHIELD, fire: FIRE_RING } as const;
export class EnergyShield {
  kind: ShieldId | null = null;
  get equipped(): boolean { return this.kind !== null; }
  get stats(): typeof FRONTAL_SHIELD | typeof SPHERE_SHIELD | typeof FIRE_RING { return SHIELDS[this.kind ?? 'frontal']; }
  energy = 0;
  active = false;
  private delay = 0;
  private releaseRequired = false;
  /** Só no anel de fogo: segundos até o próximo pulso, e se um pulso está devido (a partida o consome: `consumePulse`). */
  private clock = 0;
  private pulseDue = false;
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
    this.clock = 0;
    this.pulseDue = false;
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
    if (this.active && this.kind === 'fire') {
      // O anel pulsa enquanto está ligado: o primeiro pulso sai ao ligar, os outros a cada `pulse` s.
      this.clock -= dt;
      if (this.clock <= 0) {
        this.pulseDue = true;
        this.clock += FIRE_RING.pulse;
      }
    } else {
      this.clock = 0;
    }
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
    if (!this.active || damage <= 0 || this.kind === 'fire') return damage; // o anel de fogo não segura tiro
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
  /** O anel de fogo tem um pulso devido? Devolve e limpa (a partida chama uma vez por tick, depois do passo do Mech). */
  consumePulse(): boolean {
    const due = this.pulseDue;
    this.pulseDue = false;
    return due;
  }
  get fraction(): number {
    return this.energy / this.stats.capacity;
  }
  applyNet(fraction: number, active: boolean): void {
    this.energy = Math.max(0, Math.min(1, fraction)) * this.stats.capacity;
    this.active = active && this.equipped;
  }
}
