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
 * O tanque do lança-chamas (`Flame` da arma): gasta `fuel` segundos enquanto o gatilho queima; seco, **trava por `reload` s** e volta cheio;
 * com o gatilho solto, enche no ritmo `fuel / reload` (cheio em `reload` s). Regra de simulação (G1/G2): só o dt do tick.
 */
export class FuelTank {
  /** Segundos de chama que restam. */
  fuel: number;
  /** Segundos que faltam para sair da trava de tanque seco (0 = destravado). */
  private lock = 0;

  constructor(
    readonly capacity: number,
    readonly reload: number,
  ) {
    this.fuel = capacity;
  }

  /** Um tick. `held`: o gatilho está apertado e a arma pode atirar. Devolve se a chama acende neste tick. */
  step(dt: number, held: boolean): boolean {
    if (this.lock > 0) {
      this.lock -= dt;
      if (this.lock <= 1e-9) {
        this.lock = 0;
        this.fuel = this.capacity;
      }
      return false;
    }
    if (held && this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - dt);
      if (this.fuel <= 1e-9) {
        this.fuel = 0;
        this.lock = this.reload;
      }
      return true;
    }
    if (!held) this.fuel = Math.min(this.capacity, this.fuel + (dt * this.capacity) / this.reload);
    return false;
  }

  /** Seco e esperando a recarga. */
  get locked(): boolean {
    return this.lock > 0;
  }

  /** 0..1 para o medidor: o tanque, ou o quanto da recarga já passou enquanto está seco. */
  get level(): number {
    return this.lock > 0 ? 1 - this.lock / this.reload : this.fuel / this.capacity;
  }

  /** Rodada nova, renascimento ou troca de armas: tanque cheio e destravado. */
  refill(): void {
    this.fuel = this.capacity;
    this.lock = 0;
  }
}

/**
 * Carregador de uma arma de munição (foguetes, no braço esquerdo). Regra de jogo pura (G14): roda no
 * tick fixo, sem física nem render. Recarrega um tiro por vez, continuamente, enquanto não estiver cheio.
 *
 * **Arma de salva** (`Salvo`, o lançador de mísseis leve): a salva só começa com **todos os tubos carregados** e, começada, vai até esvaziar, **sem precisar do gatilho** (`committed`:
 * o `Armament` continua pedindo o tiro enquanto a salva não acaba); os tubos só voltam a recarregar depois que o último míssil saiu.
 */
export class RocketLauncher {
  ammo: number;
  private readonly timer = new FireTimer();
  private reload = 0;
  /** Uma salva está saindo (só nas armas com `Salvo`): ela não se cancela soltando o gatilho nem recarrega no meio. */
  private salvoOn = false;

  constructor(readonly weapon: WeaponStats) {
    this.ammo = weapon.magazine;
  }

  /** A salva começou e ainda não acabou: quem aciona a arma deve seguir pedindo o tiro, com o gatilho apertado ou não. */
  get committed(): boolean {
    return this.salvoOn;
  }

  fixedUpdate(dt: number): void {
    this.timer.fixedUpdate(dt);
    if (this.salvoOn) return; // os tubos só recarregam depois do último míssil da salva
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

  /** Gasta um tiro se houver e o intervalo tiver passado. A arma de salva só começa cheia, e começada, esvazia. */
  tryFire(): boolean {
    if (this.ammo <= 0 || !this.timer.ready) return false;
    if (this.weapon.salvo && !this.salvoOn) {
      if (this.ammo < this.weapon.magazine) return false; // ainda recarregando os tubos: o lançador só dispara cheio
      this.salvoOn = true;
    }
    this.ammo--;
    this.timer.shot(this.weapon.fireInterval);
    if (this.salvoOn && this.ammo <= 0) this.salvoOn = false; // o último míssil saiu: a salva acabou e os tubos começam a voltar
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
    this.salvoOn = false;
  }
}
