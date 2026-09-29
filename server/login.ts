/**
 * Limitador de tentativas de login — separado do `Guard` do WebSocket e do balde da `Telemetria`: aqui o
 * risco é diferente (alguém testando senhas), então a régua é mais apertada. Padrão: 8 tentativas a cada
 * 10 min por IP, para `/conta/entrar` e `/conta/criar` juntos (os dois batem senha contra o banco).
 */
export const LIMITE_LOGIN_DEFAULTS = { teto: 8, janelaMs: 10 * 60 * 1000 };

type Balde = { usadas: number; desde: number };

export class LimiteLogin {
  private readonly baldes = new Map<string, Balde>();
  private readonly cfg: typeof LIMITE_LOGIN_DEFAULTS;

  constructor(cfg: Partial<typeof LIMITE_LOGIN_DEFAULTS> = {}) {
    this.cfg = { ...LIMITE_LOGIN_DEFAULTS, ...cfg };
  }

  /** `true` = pode tentar. `false` = já tentou demais nesta janela. */
  permitir(ip: string, now = Date.now()): boolean {
    if (this.baldes.size > 500 && this.baldes.size % 100 === 0) {
      for (const [k, b] of this.baldes) if (now - b.desde > this.cfg.janelaMs) this.baldes.delete(k);
    }
    let b = this.baldes.get(ip);
    if (!b || now - b.desde > this.cfg.janelaMs) {
      b = { usadas: 0, desde: now };
      this.baldes.set(ip, b);
    }
    if (b.usadas >= this.cfg.teto) return false;
    b.usadas++;
    return true;
  }
}
