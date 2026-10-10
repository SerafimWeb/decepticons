import type { Spin, WeaponStats } from './weapons';

/**
 * Cadência no tick fixo sem arredondar para o tick: a sobra do tick passa para o próximo tiro. Um
 * intervalo de 0,22 s dá 4,5 tiros/s de verdade, e não os 4,3 de esperar 14 ticks inteiros. Parado,
 * não guarda crédito (no máximo um tick), então soltar o gatilho não vira rajada depois.
 * Regra de simulação (G1/G2): sem relógio, só o dt do tick.
 */
export class FireTimer {
  private wait = 0;

  fixedUpdate(dt: number): void {
    this.wait = Math.max(this.wait - dt, -dt);
  }

  get ready(): boolean {
    return this.wait <= 1e-6;
  }

  /** Saiu um tiro: o próximo fica pronto `interval` segundos depois deste. */
  shot(interval: number): void {
    this.wait += interval;
  }

  /** Espera extra antes do próximo tiro (pausa entre rajadas dos bots). */
  hold(seconds: number): void {
    this.wait = Math.max(this.wait, 0) + seconds;
  }

  reset(): void {
    this.wait = 0;
  }
}

/**
 * A rotação do cano da metralhadora rotatória (`Spin` da arma): sobe de 0 a 1 em `up` s com o gatilho apertado e cai em `down` s ao soltar.
 * A cadência segue a rotação: de `minRate` × o máximo (parado) até o máximo (cano em plena rotação). Regra de simulação (G1/G2): só o dt do tick.
 */
export class SpinUp {
  /** 0 = parado, 1 = plena rotação. */
  level = 0;

  step(dt: number, held: boolean, spin: Spin): number {
    this.level = held ? Math.min(1, this.level + dt / spin.up) : Math.max(0, this.level - dt / spin.down);
    return this.level;
  }

  /** Segundos até o próximo tiro com a rotação de agora (`w.fireInterval` é o intervalo em plena rotação). */
  interval(w: WeaponStats): number {
    const spin = w.spin;
    return spin ? w.fireInterval / (spin.minRate + (1 - spin.minRate) * this.level) : w.fireInterval;
  }

  reset(): void {
    this.level = 0;
  }
}

/**
 * Carregador de uma arma de munição (foguetes, no braço esquerdo). Regra de jogo pura (G14): roda no
 * tick fixo, sem física nem render. Recarrega um tiro por vez, continuamente, enquanto não estiver cheio.
 */
export class RocketLauncher {
  ammo: number;
  private readonly timer = new FireTimer();
  private reload = 0;

  constructor(readonly weapon: WeaponStats) {
    this.ammo = weapon.magazine;
  }

  fixedUpdate(dt: number): void {
    this.timer.fixedUpdate(dt);
    if (this.ammo >= this.weapon.magazine) {
      this.reload = 0;
      return;
    }
    this.reload += dt;
    if (this.reload >= this.weapon.reload) {
      this.reload -= this.weapon.reload;
      this.ammo++;
    }
  }

  /** Gasta um tiro se houver e o intervalo tiver passado. */
  tryFire(): boolean {
    if (this.ammo <= 0 || !this.timer.ready) return false;
    this.ammo--;
    this.timer.shot(this.weapon.fireInterval);
    return true;
  }

  /** 0..1 do próximo tiro (para o HUD); 1 com o carregador cheio. */
  get reloadProgress(): number {
    return this.ammo >= this.weapon.magazine ? 1 : this.reload / this.weapon.reload;
  }

  /** Rodada nova ou renascimento: carregador cheio. */
  refill(): void {
    this.ammo = this.weapon.magazine;
    this.timer.reset();
    this.reload = 0;
  }
}
