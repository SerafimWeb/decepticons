/**
 * A trilha de auditoria interna (ordem P196, 18/10): **quem fez o quê de sensível**, num arquivo que só acrescenta. É a resposta a "quem apagou essa conta?", "quem mudou essa configuração?", "alguém tentou
 * entrar no painel?". Fica fora do `Server.ts` para o teste bater direto no algoritmo.
 *
 * **O que entra:** conta criada e apagada (e a tentativa de apagar com a senha errada), dados baixados, escolha da medição alterada, configuração global mudada, acesso (e tentativa recusada) às portas do dono
 * (`/metricas`, `/admin/*`), promoção e rebaixamento de administrador, reinício do servidor. **O que NÃO entra:** e-mail, IP, senha, token, conteúdo de rodada. O ator é `conta:<número>`, `dono` (quem tem a
 * chave do servidor), `sistema` ou `anonimo`; o alvo é do mesmo jeito (`conta:12`, `config:chassis_status`). Quem precisa saber de quem é o número consulta o banco de contas, que tem dono e acesso controlado.
 *
 * **Guarda:** um arquivo por mês (`auditoria/auditoria-AAAA-MM.jsonl`), uma linha por evento, apagado depois de 400 dias (a LGPD pede que se saiba quem tratou o dado; não pede guardar para sempre).
 * **Nunca lança:** disco cheio ou sem permissão perde a linha, não derruba o servidor; as últimas 200 ficam também em memória para o painel do dono ler sem tocar o disco.
 */
import { appendFileSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { diaDe } from './telemetria';

export const AUDITORIA_PASTA = 'auditoria';
export const AUDITORIA_DIAS = 400;
const ANEL = 200;

export const ACOES = ['conta_criada', 'conta_apagada', 'dados_baixados', 'medicao_alterada', 'admin_config', 'admin_acesso', 'admin_promovido', 'admin_rebaixado', 'servidor_reiniciado', 'senha_recuperacao_pedida', 'senha_redefinida', 'link_senha_gerado'] as const;
export type Acao = (typeof ACOES)[number];
const ACOES_SET: ReadonlySet<string> = new Set(ACOES);

export interface EventoDeAuditoria {
  /** Instante ISO (UTC). */
  quando: string;
  ator: string;
  acao: Acao;
  alvo: string;
  ok: boolean;
}

const RE_ATOR = /^(conta:\d{1,12}|dono|sistema|anonimo)$/;
const RE_ALVO = /^([a-z_]{1,20}:[A-Za-z0-9_.:+-]{0,60})?$/;
const NOME = /^auditoria-(\d{4}-\d{2})\.jsonl$/;

/** Os arquivos da trilha em `pasta`, do mais velho ao mais novo. */
export function arquivosDaAuditoria(pasta: string): string[] {
  try {
    return readdirSync(pasta)
      .filter((n) => NOME.test(n))
      .sort();
  } catch {
    return [];
  }
}

/** Lê uma linha de arquivo de volta (o que estiver torto é ignorado, nunca lança). */
function lerLinha(linha: string): EventoDeAuditoria | null {
  try {
    const e = JSON.parse(linha) as Record<string, unknown>;
    if (typeof e.quando !== 'string' || typeof e.ator !== 'string' || typeof e.alvo !== 'string' || typeof e.ok !== 'boolean' || typeof e.acao !== 'string' || !ACOES_SET.has(e.acao)) return null;
    if (!RE_ATOR.test(e.ator) || !RE_ALVO.test(e.alvo)) return null;
    return { quando: e.quando, ator: e.ator, acao: e.acao as Acao, alvo: e.alvo, ok: e.ok };
  } catch {
    return null;
  }
}

export class Auditoria {
  private readonly anel: EventoDeAuditoria[] = [];
  private pronta = false;

  /** `pasta` nula: só em memória (os testes em memória, as ferramentas sem pasta de dados). */
  constructor(
    readonly pasta: string | null,
    private readonly agora: () => number = Date.now,
  ) {
    if (pasta) this.anel.push(...this.lerDoDisco(ANEL));
  }

  /**
   * Registra um evento. Ator e alvo fora do formato viram `invalido` (nada de texto livre na trilha: nem e-mail nem quebra de linha forjada). Devolve o evento gravado.
   */
  registrar(e: { ator: string; acao: Acao; alvo?: string; ok?: boolean }): EventoDeAuditoria {
    const ev: EventoDeAuditoria = {
      quando: new Date(this.agora()).toISOString(),
      ator: RE_ATOR.test(e.ator) ? e.ator : 'anonimo',
      acao: e.acao,
      alvo: RE_ALVO.test(e.alvo ?? '') ? (e.alvo ?? '') : 'invalido:',
      ok: e.ok ?? true,
    };
    this.anel.push(ev);
    if (this.anel.length > ANEL) this.anel.shift();
    if (this.pasta) {
      try {
        if (!this.pronta) {
          mkdirSync(this.pasta, { recursive: true });
          this.pronta = true;
        }
        appendFileSync(join(this.pasta, `auditoria-${diaDe(this.agora()).slice(0, 7)}.jsonl`), `${JSON.stringify(ev)}\n`);
      } catch {
        this.pronta = false; // sem disco: a linha fica só na memória
      }
    }
    return ev;
  }

  /** Os últimos `n` eventos, do mais novo para o mais velho. */
  recentes(n = 50): EventoDeAuditoria[] {
    return this.anel.slice(-n).reverse();
  }

  /** Apaga os meses inteiros com mais de `AUDITORIA_DIAS` (pelo mês do nome). Devolve o que apagou. Nunca lança. */
  podar(): string[] {
    if (!this.pasta) return [];
    const corte = new Date(this.agora() - AUDITORIA_DIAS * 86_400_000).toISOString().slice(0, 7);
    const apagados: string[] = [];
    for (const nome of arquivosDaAuditoria(this.pasta)) {
      if (NOME.exec(nome)![1]! >= corte) continue;
      try {
        unlinkSync(join(this.pasta, nome));
        apagados.push(nome);
      } catch {
        // em uso ou sem permissão: fica para a próxima poda
      }
    }
    return apagados;
  }

  private lerDoDisco(n: number): EventoDeAuditoria[] {
    if (!this.pasta) return [];
    const out: EventoDeAuditoria[] = [];
    for (const nome of arquivosDaAuditoria(this.pasta).reverse()) {
      try {
        const linhas = readFileSync(join(this.pasta, nome), 'utf8').split('\n').filter(Boolean);
        for (let i = linhas.length - 1; i >= 0 && out.length < n; i--) {
          const e = lerLinha(linhas[i]!);
          if (e) out.push(e);
        }
      } catch {
        // arquivo ilegível: pula
      }
      if (out.length >= n) break;
    }
    return out.reverse();
  }
}
