import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * O envio de e-mail do servidor (P205, "esqueci a senha"). Hoje só uma mensagem sai daqui: o link para redefinir a senha, quando a pessoa pede.
 *
 * **Provedor trocável.** O servidor fala com uma interface (`Mailer`); o provedor de verdade é o Resend (uma chamada HTTPS com chave, sem biblioteca nova), e outro
 * entra escrevendo outra classe. **A chave nunca fica no repositório:** vem da variável `CYBERMECH_EMAIL_CHAVE` ou do arquivo `email.json` na pasta de dados do
 * servidor (`.tmp/servidor/`, fora do git). Sem chave, `carregarMailer` devolve `null` e o servidor responde "recuperação por e-mail indisponível" em vez de fingir que enviou.
 *
 * **Tetos.** O Resend grátis dá 100 e-mails por dia e 3.000 por mês; `TetoDiario` impede que um script esgote a cota (e pague a conta) em nome do dono. Os limites por IP e
 * por conta estão no `Server.ts`. O log diz só o código HTTP do provedor, nunca o e-mail da pessoa nem a chave.
 */
export interface Email {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}

export interface Mailer {
  /** `true` = o provedor aceitou a mensagem. Nunca lança. */
  enviar(e: Email): Promise<boolean>;
}

export const EMAIL_ARQUIVO = 'email.json';
/** Quantos e-mails o servidor manda por dia, no máximo (metade da cota grátis do Resend: sobra margem para o dono usar o painel do provedor). */
export const EMAILS_POR_DIA = 50;

interface ConfigEmail {
  provedor: 'resend';
  chave: string;
  /** O remetente: `CYBERMECH <nao-responda@cybermech.online>` (o domínio precisa estar verificado no provedor). */
  de: string;
}

const RE_DE = /^[^<>\r\n]{1,80}<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$|^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export class MailerResend implements Mailer {
  constructor(
    private readonly chave: string,
    private readonly de: string,
    private readonly http: typeof fetch = fetch,
    private readonly anotar: (linha: string) => void = () => {},
    private readonly timeoutMs = 8000,
  ) {}

  async enviar(e: Email): Promise<boolean> {
    try {
      const res = await this.http('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.chave}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: this.de, to: [e.para], subject: e.assunto, text: e.texto, ...(e.html ? { html: e.html } : {}) }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) this.anotar(`e-mail: o provedor respondeu ${res.status}`);
      return res.ok;
    } catch {
      this.anotar('e-mail: o provedor não respondeu');
      return false;
    }
  }
}

/** Lê a configuração do e-mail: variáveis de ambiente primeiro, depois `email.json` na pasta de dados. `null` = sem e-mail configurado (ou configuração torta, dita no `anotar`). */
export function carregarMailer(
  dirDados: string | null,
  env: NodeJS.ProcessEnv = process.env,
  anotar: (linha: string) => void = () => {},
  http: typeof fetch = fetch,
): Mailer | null {
  let cfg: Partial<ConfigEmail> = {};
  if (env.CYBERMECH_EMAIL_CHAVE) cfg = { provedor: 'resend', chave: env.CYBERMECH_EMAIL_CHAVE, de: env.CYBERMECH_EMAIL_DE ?? 'CYBERMECH <nao-responda@cybermech.online>' };
  else if (dirDados && existsSync(join(dirDados, EMAIL_ARQUIVO))) {
    try {
      cfg = JSON.parse(readFileSync(join(dirDados, EMAIL_ARQUIVO), 'utf8')) as Partial<ConfigEmail>;
    } catch {
      anotar(`e-mail: ${EMAIL_ARQUIVO} não é JSON válido; recuperação de senha por e-mail desligada`);
      return null;
    }
  }
  if (!cfg.chave) return null;
  if (cfg.provedor !== 'resend' || typeof cfg.chave !== 'string' || typeof cfg.de !== 'string' || !RE_DE.test(cfg.de)) {
    anotar(`e-mail: configuração incompleta (precisa de provedor "resend", chave e de); recuperação de senha por e-mail desligada`);
    return null;
  }
  return new MailerResend(cfg.chave, cfg.de, http, anotar);
}

/** O teto de e-mails por dia (dia de Brasília, UTC-3, como os outros contadores do servidor). Em memória: reiniciar o servidor zera, e o provedor tem a cota dele. */
export class TetoDiario {
  private dia = '';
  private usados = 0;

  constructor(private readonly teto = EMAILS_POR_DIA) {}

  /** `true` = pode enviar (e conta). */
  tentar(agora = Date.now()): boolean {
    const dia = new Date(agora - 3 * 3600_000).toISOString().slice(0, 10);
    if (dia !== this.dia) {
      this.dia = dia;
      this.usados = 0;
    }
    if (this.usados >= this.teto) return false;
    this.usados++;
    return true;
  }
}
