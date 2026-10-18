/**
 * Defesas do servidor de jogo (DEPLOY.md, "Servidor no mesmo domínio"): teto por IP, taxa por conexão e teto geral.
 * Fica fora do `Server.ts` para o teste bater direto no algoritmo, sem subir WebSocket.
 *
 * O que segura:
 * - **Teto por IP:** um endereço não abre mais que `perIp` conexões ao mesmo tempo. Muitos clientes de casa podem
 *   sair pelo mesmo IP; o teto (padrão 4) cobre uma família inteira e ainda barra um script que abre em cascata.
 * - **Taxa por conexão:** um cliente manda até `msgs` mensagens por segundo, com folga (`burst`) para picos legítimos.
 *   Acima disso o servidor **descarta** a mensagem (nada é decodificado: o custo é uma conta); só **corta** a conexão quando o descarte
 *   vira abuso de verdade (`dropCut`: descartes acumulados, com a queda de `msgs` por segundo). A nossa própria conta é 30 INPUT + eventuais PING/LEAVE
 *   (bem abaixo do limite). **Por que não cortar no primeiro excesso (18/10):** o PC do servidor é o mesmo em que se trabalha, e quando o laço do
 *   Node congela por segundos (memória cheia, build, teste) as mensagens de todo mundo chegam juntas na volta: um jogador bem-comportado era derrubado
 *   (`corte de <ip>: taxa alta demais`, os dois IPs de VPN de uma sessão de teste). Um pico de quem só estava esperando o servidor agora se perde sem derrubar ninguém.
 * - **Teto geral:** o servidor aceita no máximo `total` conexões abertas. Protege a memória e o socket do Node.
 *
 * A alocação é toda por conexão (uma vez na entrada, uma vez na saída). Nada por mensagem: o `allow()` só mexe em
 * contadores da própria conexão.
 */
import { PAIS_DESCONHECIDO, parsePais } from '../shared/net/telemetry';

export interface GuardConfig {
  /** Conexões abertas ao mesmo tempo do mesmo IP. */
  perIp: number;
  /** Conexões abertas ao mesmo tempo, todas somadas. */
  total: number;
  /** Mensagens por segundo por conexão (nominal: 30 INPUT + 1 PING/s, com sobra). */
  msgs: number;
  /** Folga para picos legítimos (o cliente pode acumular na saída de um freeze). */
  burst: number;
  /**
   * Descartes que o balde vazio pode acumular antes de a conexão ser cortada. O contador cai `msgs` por segundo: quem passa da taxa por pouco e por pouco tempo
   * (um servidor travado por segundos, uma rede que entregou tudo junto) só perde o excesso; quem inunda é cortado em instantes.
   */
  dropCut: number;
}

/** Padrões do servidor de casa (DEPLOY.md). Mudar aqui aparece no `.tmp/servidor/servidor.log` e no site. */
export const GUARD_DEFAULTS: GuardConfig = { perIp: 4, total: 400, msgs: 60, burst: 120, dropCut: 600 };

/** Estado por conexão (o `Guard` guarda uma dessas por peer aberto). */
export interface Peer {
  /** IP normalizado (v4 em `1.2.3.4`, v6 em `::1`). */
  ip: string;
  /** Fichas do balde: cada mensagem consome 1; recarrega `msgs` por segundo, teto `msgs + burst`. */
  tokens: number;
  /** Última recarga (ms), para o balde saber quanto tempo passou. */
  refilled: number;
  /** Descartes acumulados (caem `msgs` por segundo) e o instante do último: o que decide o corte. */
  drops: number;
  dropsAt: number;
}

/**
 * A porteira. `admit()` no início da conexão, `allow()` a cada mensagem, `remove()` no fim. A implementação é um
 * `Map` de IP → contador (não cresce sem parar: entrada zera o contador quando a última conexão dele fecha).
 */
export class Guard {
  private readonly perIp: Map<string, number> = new Map();
  private total = 0;
  constructor(readonly cfg: GuardConfig = GUARD_DEFAULTS) {}

  /** Aberto: o total e o IP cabem? Se sim, marca; senão, devolve o motivo (o Server responde e fecha). */
  admit(ip: string): 'ok' | 'total' | 'ip' {
    if (this.total >= this.cfg.total) return 'total';
    const n = this.perIp.get(ip) ?? 0;
    if (n >= this.cfg.perIp) return 'ip';
    this.perIp.set(ip, n + 1);
    this.total++;
    return 'ok';
  }

  /** Fechado: libera a vaga desse IP. */
  remove(ip: string): void {
    const n = this.perIp.get(ip);
    if (!n) return;
    if (n === 1) this.perIp.delete(ip);
    else this.perIp.set(ip, n - 1);
    this.total--;
  }

  /** Uma mensagem chegou: retira uma ficha do balde. Sem ficha: o Server fecha a conexão. */
  allow(p: Peer, now: number): boolean {
    const cap = this.cfg.msgs + this.cfg.burst;
    const dt = Math.max(0, now - p.refilled) / 1000;
    p.tokens = Math.min(cap, p.tokens + dt * this.cfg.msgs);
    p.refilled = now;
    if (p.tokens < 1) return false;
    p.tokens--;
    return true;
  }

  /**
   * A mensagem chegou: `'ok'` (passa), `'drop'` (o balde está vazio: descarta, a conexão segue) ou `'cut'` (o descarte acumulado passou de `dropCut`: abuso, o Server fecha).
   * O contador de descartes cai `msgs` por segundo, então só o excesso que dura (ou que é enorme) corta.
   */
  judge(p: Peer, now: number): 'ok' | 'drop' | 'cut' {
    if (this.allow(p, now)) return 'ok';
    const dt = Math.max(0, now - p.dropsAt) / 1000;
    p.drops = Math.max(0, p.drops - dt * this.cfg.msgs) + 1;
    p.dropsAt = now;
    return p.drops > this.cfg.dropCut ? 'cut' : 'drop';
  }

  /** Peer novo com o balde cheio (a folga toda) e nenhum descarte. */
  peer(ip: string, now: number): Peer {
    return { ip, tokens: this.cfg.msgs + this.cfg.burst, refilled: now, drops: 0, dropsAt: now };
  }
}

/**
 * O IP do cliente do jeito que a conexão chegou: se o outro lado é local (túnel da Cloudflare no mesmo PC), aceita
 * o cabeçalho `cf-connecting-ip` (o IP real do jogador que a Cloudflare passa). Fora disso, o IP direto vale: um
 * cabeçalho vindo de outra máquina não engana o teto (G7).
 */
export function clientIp(remote: string | undefined, header: string | string[] | undefined): string {
  const raw = (Array.isArray(header) ? header[0] : header)?.trim();
  if (raw && isLoopback(remote)) return normalizeIp(raw);
  return normalizeIp(remote ?? '');
}

/**
 * O país de quem chegou, do cabeçalho `cf-ipcountry` da Cloudflare, com a mesma regra de confiança do `clientIp`: só vale se o
 * outro lado da conexão for local (o túnel). De qualquer outra máquina o cabeçalho é ignorado, e o país fica `??`: ninguém
 * inventa país para encher a sua tabela. Só o país; o IP não é guardado em lugar nenhum.
 */
export function clientCountry(remote: string | undefined, header: string | string[] | undefined): string {
  return isLoopback(remote) ? parsePais(header) : PAIS_DESCONHECIDO;
}

/** IPv6 mapeado (`::ffff:1.2.3.4`) vira `1.2.3.4`; o resto passa igual. */
export function normalizeIp(ip: string): string {
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  return m ? m[1]! : ip || '?';
}

function isLoopback(ip: string | undefined): boolean {
  const n = normalizeIp(ip ?? '');
  return n === '127.0.0.1' || n === '::1' || n.startsWith('127.');
}
