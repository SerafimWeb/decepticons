import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { type Duplex } from 'node:stream';
import { connect as tlsConnect } from 'node:tls';
import { join } from 'node:path';

/**
 * O envio de e-mail do servidor (P206, "esqueci a senha"). Hoje só uma mensagem sai daqui: o link para redefinir a senha, quando a pessoa pede.
 *
 * **Dois provedores, o mesmo contrato (`Mailer`).** O caminho recomendado é o **SMTP da própria Hostinger** (`MailerSmtp`): o `cybermech.online` já tem o e-mail dela (MX e SPF
 * apontam para lá), então basta uma caixa (`nao-responda@cybermech.online`) e a senha dela: **sem serviço novo, sem cartão, sem conta de terceiros**. O Resend (`MailerResend`,
 * uma chamada HTTPS com chave) fica como alternativa. **Nada de biblioteca nova:** o cliente SMTP é de ~100 linhas com `node:tls` (uma dependência nova pesaria no `npm ci` do
 * atualizador, que já tropeçou em binários presos pelo servidor no ar).
 *
 * **Segredos nunca no repositório:** a configuração vem de `CYBERMECH_EMAIL_CHAVE` (Resend) ou do arquivo `email.json` na pasta de dados do servidor (`.tmp/servidor/`, fora do git).
 * Sem configuração (ou com o valor de exemplo), o servidor responde "recuperação por e-mail indisponível" em vez de fingir que enviou. **O arquivo é relido quando muda**
 * (`MailerDaPasta`): ligar o e-mail não exige reiniciar o servidor nem derrubar quem joga.
 *
 * **Tetos.** `TetoDiario` impede que um script esgote a cota do provedor em nome do dono (a Hostinger também limita o que uma caixa envia por hora). Os limites por IP e por
 * conta estão no `Server.ts`. O log diz só o passo e o código da resposta, nunca o e-mail da pessoa, a senha nem a chave.
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
  /** Só o que olha a pasta de dados (`MailerDaPasta`): há configuração válida agora? Sem este método, vale como configurado. */
  configurado?(): boolean;
}

export const EMAIL_ARQUIVO = 'email.json';
/** Quantos e-mails o servidor manda por dia, no máximo (a metade da cota grátis do Resend; a Hostinger limita por hora, e 50 por dia sobra para o "esqueci a senha"). */
export const EMAILS_POR_DIA = 50;
/** O que o `npm run email -- iniciar` grava: a senha de exemplo nunca vale (o servidor a trata como "ainda não configurado"). */
export const SENHA_DE_EXEMPLO = 'COLE_A_SENHA_AQUI';
export const CONFIG_SMTP_EXEMPLO = {
  provedor: 'smtp',
  host: 'smtp.hostinger.com',
  porta: 465,
  usuario: 'nao-responda@cybermech.online',
  senha: SENHA_DE_EXEMPLO,
  de: 'CYBERMECH <nao-responda@cybermech.online>',
} as const;

const RE_ENDERECO = /^[^\s@<>",;:\\()[\]]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;
const RE_DE = /^[^<>\r\n]{1,80}<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$|^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const RE_HOST = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,250}[A-Za-z0-9])?$/;

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

// ─────────────────────────── SMTP ───────────────────────────

class ErroSmtp extends Error {
  constructor(
    readonly passo: string,
    readonly codigo: number,
  ) {
    super(`smtp falhou em ${passo}${codigo ? ` (código ${codigo})` : ''}`);
  }
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
/** Base64 em linhas de 76 caracteres (o limite do e-mail). */
const b64Linhas = (s: string) => (b64(s).match(/.{1,76}/g) ?? ['']).join('\r\n');
/** Só o endereço de um remetente `Nome <a@b.c>` ou `a@b.c`. */
export const enderecoDe = (de: string): string => /<([^>]+)>/.exec(de)?.[1] ?? de;

/**
 * A mensagem pronta para o `DATA` do SMTP: cabeçalhos, texto e (se houver) HTML em base64 (qualquer letra acentuada, em qualquer língua, chega inteira). Assunto sempre codificado
 * (RFC 2047) e nenhum campo de fora entra num cabeçalho sem passar por aqui: quem chama já recusou destinatário com quebra de linha. Pura (testável sem rede).
 */
export function montarMensagem(o: { de: string; para: string; assunto: string; texto: string; html?: string; agora: number; id: string; fronteira: string }): string {
  const limpo = (s: string) => s.replace(/[\r\n]+/g, ' ');
  const dominio = enderecoDe(o.de).split('@')[1] ?? 'localhost';
  const cab = [
    `From: ${limpo(o.de)}`,
    `To: <${limpo(o.para)}>`,
    `Subject: =?UTF-8?B?${b64(limpo(o.assunto))}?=`,
    `Date: ${new Date(o.agora).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${o.id}@${dominio}>`,
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-generated',
  ];
  const parte = (tipo: string, corpo: string) => [`--${o.fronteira}`, `Content-Type: ${tipo}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', b64Linhas(corpo)].join('\r\n');
  const corpo = o.html
    ? [`Content-Type: multipart/alternative; boundary="${o.fronteira}"`, '', parte('text/plain', o.texto), parte('text/html', o.html), `--${o.fronteira}--`, ''].join('\r\n')
    : ['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64Linhas(o.texto), ''].join('\r\n');
  // Dot-stuffing: uma linha que comece com "." num DATA seria lida como o fim da mensagem. Base64 e cabeçalhos nunca começam assim; a regra fica por segurança.
  return `${cab.join('\r\n')}\r\n${corpo}`.replace(/^\./gm, '..');
}

/** Lê as respostas do servidor SMTP linha a linha; uma resposta termina na linha `NNN texto` (as anteriores são `NNN-texto`). */
class LeitorSmtp {
  private buffer = '';
  private fila: { ok: (r: { codigo: number; texto: string }) => void; erro: (e: Error) => void }[] = [];
  private acumulado: string[] = [];
  private encerrado: Error | null = null;
  private prontas: { codigo: number; texto: string }[] = [];

  constructor(sock: Duplex) {
    sock.setEncoding('utf8');
    sock.on('data', (d: string) => {
      this.buffer += d;
      let i: number;
      while ((i = this.buffer.indexOf('\r\n')) >= 0) {
        const linha = this.buffer.slice(0, i);
        this.buffer = this.buffer.slice(i + 2);
        this.acumulado.push(linha);
        if (/^\d{3} |^\d{3}$/.test(linha)) {
          const r = { codigo: Number(linha.slice(0, 3)), texto: this.acumulado.join('\n') };
          this.acumulado = [];
          const w = this.fila.shift();
          if (w) w.ok(r);
          else this.prontas.push(r);
        }
      }
    });
    const fim = (e?: Error) => {
      this.encerrado = e ?? new Error('conexão fechada');
      for (const w of this.fila.splice(0)) w.erro(this.encerrado);
    };
    sock.on('error', fim);
    sock.on('close', () => fim());
  }

  resposta(): Promise<{ codigo: number; texto: string }> {
    const pronta = this.prontas.shift();
    if (pronta) return Promise.resolve(pronta);
    if (this.encerrado) return Promise.reject(this.encerrado);
    return new Promise((ok, erro) => this.fila.push({ ok, erro }));
  }
}

/** O cliente SMTP mínimo: TLS direto (porta 465), `AUTH PLAIN` (ou `LOGIN`), uma mensagem, `QUIT`. Nunca lança em `enviar`; o log diz o passo e o código, sem o endereço nem a senha. */
export class MailerSmtp implements Mailer {
  constructor(
    private readonly cfg: { host: string; porta: number; usuario: string; senha: string; de: string },
    private readonly anotar: (linha: string) => void = () => {},
    /** Abre a conexão (TLS direto por padrão); os testes passam um socket comum para um servidor SMTP de mentira. */
    private readonly conectar: (host: string, porta: number) => Duplex = (host, porta) => tlsConnect({ host, port: porta, servername: host }),
    private readonly timeoutMs = 15_000,
    private readonly agora: () => number = Date.now,
  ) {}

  async enviar(e: Email): Promise<boolean> {
    // Um destinatário com quebra de linha ou vírgula viraria cabeçalho ou outro destinatário: recusa antes de abrir conexão.
    if (!RE_ENDERECO.test(e.para)) {
      this.anotar('e-mail: destinatário inválido; não enviei');
      return false;
    }
    const sock = this.conectar(this.cfg.host, this.cfg.porta);
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const estouro = new Promise<never>((_, rej) => {
      relogio = setTimeout(() => {
        sock.destroy();
        rej(new ErroSmtp('tempo', 0));
      }, this.timeoutMs);
    });
    try {
      await Promise.race([this.sessao(sock, e), estouro]);
      return true;
    } catch (err) {
      this.anotar(`e-mail: ${err instanceof ErroSmtp ? err.message : 'smtp falhou em conexão'}`);
      return false;
    } finally {
      clearTimeout(relogio);
      sock.destroy();
    }
  }

  private async sessao(sock: Duplex, e: Email): Promise<void> {
    const leitor = new LeitorSmtp(sock);
    const esperar = async (passo: string, ...aceitos: number[]) => {
      let r: { codigo: number; texto: string };
      try {
        r = await leitor.resposta();
      } catch {
        throw new ErroSmtp('conexão', 0);
      }
      if (!aceitos.includes(r.codigo)) throw new ErroSmtp(passo, r.codigo);
      return r;
    };
    const dizer = (linha: string) => sock.write(`${linha}\r\n`);
    await esperar('saudação', 220);
    dizer(`EHLO ${enderecoDe(this.cfg.de).split('@')[1] ?? 'localhost'}`);
    const ehlo = await esperar('EHLO', 250);
    if (/AUTH[ =].*PLAIN/i.test(ehlo.texto) || !/AUTH/i.test(ehlo.texto)) {
      dizer(`AUTH PLAIN ${b64(`\0${this.cfg.usuario}\0${this.cfg.senha}`)}`);
      await esperar('autenticação', 235);
    } else {
      dizer('AUTH LOGIN');
      await esperar('autenticação', 334);
      dizer(b64(this.cfg.usuario));
      await esperar('autenticação', 334);
      dizer(b64(this.cfg.senha));
      await esperar('autenticação', 235);
    }
    dizer(`MAIL FROM:<${enderecoDe(this.cfg.de)}>`);
    await esperar('remetente', 250);
    dizer(`RCPT TO:<${e.para}>`);
    await esperar('destinatário', 250, 251);
    dizer('DATA');
    await esperar('dados', 354);
    const msg = montarMensagem({ de: this.cfg.de, para: e.para, assunto: e.assunto, texto: e.texto, ...(e.html ? { html: e.html } : {}), agora: this.agora(), id: randomBytes(12).toString('hex'), fronteira: `=_cm_${randomBytes(9).toString('hex')}` });
    sock.write(`${msg.replace(/\r?\n/g, '\r\n').replace(/\r\n$/, '')}\r\n.\r\n`);
    await esperar('envio', 250);
    // A mensagem já foi aceita: o fim educado da conversa não pode transformar um envio feito em falha.
    dizer('QUIT');
    await esperar('encerramento', 221).catch(() => {});
  }
}

// ─────────────────────────── configuração ───────────────────────────

/** Lê a configuração do e-mail: variável de ambiente (Resend) primeiro, depois `email.json` na pasta de dados. `null` = sem e-mail configurado (ou configuração torta, dita no `anotar`). */
export function carregarMailer(
  dirDados: string | null,
  env: NodeJS.ProcessEnv = process.env,
  anotar: (linha: string) => void = () => {},
  http: typeof fetch = fetch,
  conectar?: (host: string, porta: number) => Duplex,
): Mailer | null {
  let cfg: { provedor?: string; chave?: string; de?: string; host?: string; porta?: number; usuario?: string; senha?: string } = {};
  if (env.CYBERMECH_EMAIL_CHAVE) cfg = { provedor: 'resend', chave: env.CYBERMECH_EMAIL_CHAVE, de: env.CYBERMECH_EMAIL_DE ?? 'CYBERMECH <nao-responda@cybermech.online>' };
  else if (dirDados && existsSync(join(dirDados, EMAIL_ARQUIVO))) {
    try {
      cfg = JSON.parse(readFileSync(join(dirDados, EMAIL_ARQUIVO), 'utf8')) as typeof cfg;
    } catch {
      anotar(`e-mail: ${EMAIL_ARQUIVO} não é JSON válido; recuperação de senha por e-mail desligada`);
      return null;
    }
  } else return null;
  if (cfg.senha === SENHA_DE_EXEMPLO || cfg.chave === 're_COLE_AQUI') {
    anotar(`e-mail: ${EMAIL_ARQUIVO} ainda tem o valor de exemplo; recuperação de senha por e-mail desligada até a senha entrar`);
    return null;
  }
  if (cfg.provedor === 'smtp') {
    const porta = cfg.porta ?? 465;
    if (typeof cfg.host !== 'string' || !RE_HOST.test(cfg.host) || !Number.isInteger(porta) || porta < 1 || porta > 65535 || typeof cfg.usuario !== 'string' || !cfg.usuario || typeof cfg.senha !== 'string' || !cfg.senha || typeof cfg.de !== 'string' || !RE_DE.test(cfg.de)) {
      anotar('e-mail: configuração SMTP incompleta (precisa de host, usuario, senha e de); recuperação de senha por e-mail desligada');
      return null;
    }
    return new MailerSmtp({ host: cfg.host, porta, usuario: cfg.usuario, senha: cfg.senha, de: cfg.de }, anotar, conectar);
  }
  if (!cfg.chave) return null;
  if (cfg.provedor !== 'resend' || typeof cfg.chave !== 'string' || typeof cfg.de !== 'string' || !RE_DE.test(cfg.de)) {
    anotar('e-mail: configuração incompleta (precisa de provedor "smtp" ou "resend", com as chaves dele); recuperação de senha por e-mail desligada');
    return null;
  }
  return new MailerResend(cfg.chave, cfg.de, http, anotar);
}

/**
 * O envio do servidor de verdade: lê `email.json` e **relê quando o arquivo muda** (o conteúdo), então o Comandante liga o e-mail salvando o arquivo, sem reiniciar o servidor
 * (reiniciar derruba quem joga). Custo: um `statSync` por pedido de "esqueci a senha", que é raro e já limitado por IP, conta e dia.
 */
export class MailerDaPasta implements Mailer {
  private atual: Mailer | null = null;
  private marca = '';

  constructor(
    private readonly dirDados: string | null,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly anotar: (linha: string) => void = () => {},
    private readonly http: typeof fetch = fetch,
    private readonly conectar?: (host: string, porta: number) => Duplex,
  ) {}

  private recarregar(): void {
    let marca = this.env.CYBERMECH_EMAIL_CHAVE ? 'env' : 'sem-arquivo';
    try {
      if (this.dirDados && existsSync(join(this.dirDados, EMAIL_ARQUIVO))) {
        // O conteúdo, não a data e o tamanho: trocar COLE_A_SENHA_AQUI por uma senha de 17 caracteres não muda o tamanho, e dois salvamentos no mesmo tique do relógio têm a mesma data.
        marca += `:${createHash('sha1').update(readFileSync(join(this.dirDados, EMAIL_ARQUIVO))).digest('hex')}`;
      }
    } catch {
      // sem acesso: trata como sem arquivo
    }
    if (marca === this.marca) return;
    this.marca = marca;
    this.atual = carregarMailer(this.dirDados, this.env, this.anotar, this.http, this.conectar);
    if (this.atual) this.anotar('e-mail: configuração lida; a recuperação de senha por e-mail está ligada');
  }

  configurado(): boolean {
    this.recarregar();
    return this.atual !== null;
  }

  async enviar(e: Email): Promise<boolean> {
    this.recarregar();
    return this.atual ? this.atual.enviar(e) : false;
  }
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
