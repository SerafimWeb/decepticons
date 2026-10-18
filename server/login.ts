import { createHash } from 'node:crypto';
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

/** Falhas de senha por conta: 10 em 15 min, de onde vierem. */
export const FALHAS_POR_CONTA_DEFAULTS = { teto: 10, janelaMs: 15 * 60 * 1000 };

/**
 * O limite de falhas **por conta** (P196, autenticação): o `LimiteLogin` conta por IP, e quem tenta adivinhar a senha de UMA conta com muitos IPs passa por ele. Aqui a conta, e não o IP, é o que se
 * protege: depois de `teto` senhas erradas na janela, a conta recusa tentativas (429, mesmo com a senha certa) até a janela passar; a senha certa antes disso zera a conta. A chave é o resumo do
 * e-mail, e vale para e-mail que não existe também (senão o limite viraria um jeito de descobrir quais e-mails têm conta).
 *
 * **O preço:** quem erra a senha de outra pessoa de propósito pode trancá-la por 15 minutos. É o troco de sempre dessa defesa; com o teto por IP do `LimiteLogin` (8 em 10 min) isso custa vários IPs.
 */
export class FalhasPorConta {
  private readonly contas = new Map<string, Balde>();
  private readonly cfg: typeof FALHAS_POR_CONTA_DEFAULTS;

  constructor(cfg: Partial<typeof FALHAS_POR_CONTA_DEFAULTS> = {}) {
    this.cfg = { ...FALHAS_POR_CONTA_DEFAULTS, ...cfg };
  }

  private chave(email: string): string {
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 24);
  }

  /** A conta está trancada agora? */
  bloqueada(email: string, now = Date.now()): boolean {
    const b = this.contas.get(this.chave(email));
    return !!b && now - b.desde <= this.cfg.janelaMs && b.usadas >= this.cfg.teto;
  }

  /** Uma senha errada nesta conta. */
  falhou(email: string, now = Date.now()): void {
    if (this.contas.size > 5000) for (const [k, b] of this.contas) if (now - b.desde > this.cfg.janelaMs) this.contas.delete(k);
    const k = this.chave(email);
    let b = this.contas.get(k);
    if (!b || now - b.desde > this.cfg.janelaMs) {
      b = { usadas: 0, desde: now };
      this.contas.set(k, b);
    }
    b.usadas++;
  }

  /** A senha certa: zera a conta. */
  acertou(email: string): void {
    this.contas.delete(this.chave(email));
  }
}
