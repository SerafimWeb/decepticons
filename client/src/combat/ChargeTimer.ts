/**
 * Carga pura no tick fixo. Duas mecânicas, escolhidas pela arma:
 *
 * - **Sem espera** (o trilho): completa a carga e **dispara na hora**; soltar, perder o braço ou superaquecer cancela.
 * - **Com espera** (`chargeHold` — o canhão de cerco, ordem P124 do Comandante: *"carregada E NÃO DISPARAR... pronta pra
 *   atirar"*): completar a carga **não dispara**. A arma fica **pronta** (`charged`) e o tiro sai **ao soltar o gatilho**,
 *   no momento que o piloto escolher. Enquanto segura, espera; soltar antes de completar perde a carga parcial.
 *
 * Regra de simulação (G1/G2): só o `dt` do tick; sem relógio, sem sorteio.
 */
export class ChargeTimer {
  progress = 0;
  private elapsed = 0;
  /** Com espera: a carga está completa e aguardando o disparo (só o tiro limpa). */
  private ready = false;

  /** A carga está completa e esperando o disparo (a mira mostra o anel cheio). */
  get charged(): boolean {
    return this.ready;
  }

  /**
   * Um tick. `held`: o gatilho está apertado. `available`: a arma pode atirar (cadência + braço de pé). `hold`: a arma
   * segura a carga. Devolve `true` **no tick do disparo** (a carga sem espera completa; a com espera, ao soltar).
   */
  step(dt: number, held: boolean, available: boolean, duration = 0, hold = false): boolean {
    if (duration <= 0) return held && available;
    if (!hold) {
      if (!held || !available) {
        this.reset();
        return false;
      }
      this.elapsed += dt;
      this.progress = Math.min(1, this.elapsed / duration);
      if (this.elapsed + 1e-6 < duration) return false;
      this.reset();
      return true;
    }
    // Com espera: completa e fica pronta; o tiro sai ao soltar o gatilho, se a arma puder atirar.
    if (this.ready) {
      if (held) return false; // segurando a carga pronta: espera o momento
      this.reset();
      return available;
    }
    if (!held) {
      this.reset();
      return false; // soltou antes de completar: perde a carga parcial
    }
    if (!available) return false; // travada (recarregando, superaquecida): a carga espera onde está
    this.elapsed += dt;
    this.progress = Math.min(1, this.elapsed / duration);
    if (this.elapsed + 1e-6 < duration) return false;
    this.progress = 1; // completa: a mira mostra o anel cheio, sem a poeira do ponto flutuante
    this.ready = true;
    return false; // NÃO dispara ao completar
  }

  reset(): void {
    this.elapsed = 0;
    this.progress = 0;
    this.ready = false;
  }
}
