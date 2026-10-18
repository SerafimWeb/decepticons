/**
 * Agregador da audiência (P193): de onde vêm as visitas e que tipo de aparelho joga, **só em soma e sem identificar ninguém** (contrato em `shared/net/audiencia.ts`). Fica fora do `Server.ts`
 * pelo mesmo motivo da `Telemetria`: o teste bate direto no algoritmo.
 *
 * Duas tabelas por dia (horário de Brasília):
 * - **perfil**, por página (`landing` ou `jogo`): quantas visitas cada categoria teve (canal, site de origem, campanha, aparelho, navegador, sistema, idioma, novo ou recorrente, estado do Brasil);
 * - **funil por canal**: quantos eventos de cada passo (visita, clique, jogo aberto, partida iniciada e terminada) cada canal teve. É o que diz qual origem **converte**.
 * Mais a contagem das partidas iniciadas com e sem conta.
 *
 * **Memória limitada de propósito:** 120 dias; por dia e por dimensão, no máximo 40 valores (os sites de origem e as campanhas, 60): o excedente soma em `(outros)`. As categorias fechadas
 * (navegador, aparelho…) já são poucas por construção. Nada guarda IP, identificador de aba nem texto livre: só as categorias que `parseVisita` aceita.
 */
import type { ContextoDeEvento, ContextoDoFunil, Visita } from '../shared/net/audiencia';
import { diaDe } from './telemetria';

export const PAGINAS = ['landing', 'jogo'] as const;
export type Pagina = (typeof PAGINAS)[number];
export const DIMENSOES = ['canal', 'host', 'utm_source', 'utm_medium', 'utm_campaign', 'disp', 'nav', 'so', 'lang', 'ret', 'uf'] as const;
export type Dimensao = (typeof DIMENSOES)[number];
/** Os passos do funil que levam o canal. */
export const PASSOS = ['landing_view', 'click_cockpit', 'click_online', 'boot_ok', 'partida_iniciada', 'partida_terminada'] as const;
export const OUTROS = '(outros)';

const DIAS_TETO = 120;
const VALORES_TETO = 40;
const VALORES_TETO_ABERTOS = 60;
const ABERTAS: ReadonlySet<string> = new Set(['host', 'utm_source', 'utm_medium', 'utm_campaign']);
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RE_VALOR = /^[a-z0-9()][a-z0-9_.+()-]{0,59}$/i;
const PAGINAS_SET: ReadonlySet<string> = new Set(PAGINAS);
const DIMENSOES_SET: ReadonlySet<string> = new Set(DIMENSOES);
const PASSOS_SET: ReadonlySet<string> = new Set(PASSOS);

type Contagem = Record<string, number>;
export interface AudienciaDia {
  dia: string;
  /** pagina → dimensão → valor → visitas. */
  perfil: Record<string, Record<string, Contagem>>;
  /** canal → passo → eventos. */
  funil: Record<string, Contagem>;
  /** `logado` e `convidado`: as partidas iniciadas. */
  conta: Contagem;
}
export interface AudienciaPersistida {
  v: 1;
  dias: AudienciaDia[];
}

const diaVazio = (dia: string): AudienciaDia => ({ dia, perfil: {}, funil: {}, conta: {} });
const soma = (c: Contagem, chave: string, teto: number): void => {
  // hasOwn e não `in`: um site chamado `constructor` é um nome de host válido e `in` o acharia no protótipo do objeto.
  if (Object.hasOwn(c, chave)) c[chave]!++;
  else if (Object.keys(c).length >= teto) c[OUTROS] = (c[OUTROS] ?? 0) + 1;
  else c[chave] = 1;
};

export class Audiencia {
  private readonly dias = new Map<string, AudienciaDia>();
  private readonly vistos = new Map<string, number>();
  /** Há contagem nova desde o último `exportar` (o servidor só grava o arquivo quando precisa). */
  sujo = false;

  /**
   * Um evento do cliente chegou com contexto. `landing_view` e `boot_ok` levam a visita (perfil + funil); os outros passos levam o canal (funil) e, na partida, a conta.
   * `eventId` (aba + sequência) evita contar duas vezes o reenvio do navegador. Sem contexto, ou com o tipo errado para o evento, não conta nada.
   */
  registrar(nome: string, ctx: ContextoDeEvento | undefined, uf: string | null, now = Date.now(), eventId?: string): void {
    if (!ctx) return;
    // O tipo do contexto tem de ser o do evento: a visita só em landing_view e boot_ok; o do funil nos outros passos. Antes de qualquer coisa: o que não vale não cria o dia nem gasta o id.
    const daVisita = nome === 'landing_view' || nome === 'boot_ok';
    if (ctx.tipo === 'visita' ? !daVisita : daVisita || !PASSOS_SET.has(nome)) return;
    if (eventId) {
      for (const [id, t] of this.vistos) if (now - t > 600_000) this.vistos.delete(id);
      if (this.vistos.has(eventId)) return;
      if (this.vistos.size >= 4096) this.vistos.delete(this.vistos.keys().next().value!);
      this.vistos.set(eventId, now);
    }
    const dia = this.dia(now);
    if (ctx.tipo === 'visita') {
      this.visita(dia, nome === 'landing_view' ? 'landing' : 'jogo', ctx.visita, uf);
      this.passo(dia, ctx.visita.canal, nome);
    } else {
      this.passo(dia, ctx.funil.canal, nome);
      this.contaDaPartida(dia, nome, ctx.funil);
    }
    this.sujo = true;
  }

  private dia(now: number): AudienciaDia {
    const chave = diaDe(now);
    let d = this.dias.get(chave);
    if (!d) {
      d = diaVazio(chave);
      this.dias.set(chave, d);
      if (this.dias.size > DIAS_TETO) this.dias.delete([...this.dias.keys()].sort()[0]!);
    }
    return d;
  }

  private visita(d: AudienciaDia, pagina: Pagina, v: Visita, uf: string | null): void {
    const valores: [Dimensao, string | undefined][] = [
      ['canal', v.canal], ['host', v.host], ['utm_source', v.us], ['utm_medium', v.um], ['utm_campaign', v.uc],
      ['disp', v.disp], ['nav', v.nav], ['so', v.so], ['lang', v.lang], ['ret', v.ret], ['uf', uf ?? undefined],
    ];
    const porDim = (d.perfil[pagina] ??= {});
    for (const [dim, valor] of valores) {
      if (valor === undefined) continue;
      soma((porDim[dim] ??= {}), valor, ABERTAS.has(dim) ? VALORES_TETO_ABERTOS : VALORES_TETO);
    }
  }

  private passo(d: AudienciaDia, canal: string, passo: string): void {
    soma((d.funil[canal] ??= {}), passo, PASSOS.length);
  }

  private contaDaPartida(d: AudienciaDia, nome: string, f: ContextoDoFunil): void {
    if (nome === 'partida_iniciada' && f.conta) soma(d.conta, f.conta, 2);
  }

  /** O que o `/metricas` do dono leva: os dias, do mais velho ao de hoje. */
  resumo(): { dias: AudienciaDia[] } {
    return { dias: [...this.dias.values()].sort((a, b) => (a.dia < b.dia ? -1 : 1)).map((d) => structuredClone(d)) };
  }

  exportar(): AudienciaPersistida {
    this.sujo = false;
    return { v: 1, ...this.resumo() };
  }

  /** Carrega o arquivo salvo, conferindo tudo: um arquivo estragado (ou de outra versão) não derruba o servidor nem põe categoria inventada no painel. */
  carregar(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return;
    const dias = (raw as { dias?: unknown }).dias;
    if (!Array.isArray(dias)) return;
    const contagem = (v: unknown, teto: number): Contagem | null => {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
      const out: Contagem = {};
      for (const [k, n] of Object.entries(v)) {
        if (!RE_VALOR.test(k) || typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
        out[k] = Math.trunc(n);
      }
      return Object.keys(out).length <= teto + 1 ? out : null;
    };
    for (const x of dias.slice(-DIAS_TETO)) {
      if (typeof x !== 'object' || x === null) continue;
      const r = x as Record<string, unknown>;
      if (typeof r.dia !== 'string' || !RE_DIA.test(r.dia)) continue;
      const d = diaVazio(r.dia);
      let ok = true;
      const perfil = r.perfil;
      if (typeof perfil !== 'object' || perfil === null) continue;
      for (const [pagina, dims] of Object.entries(perfil)) {
        if (!PAGINAS_SET.has(pagina) || typeof dims !== 'object' || dims === null) { ok = false; break; }
        const porDim: Record<string, Contagem> = {};
        for (const [dim, valores] of Object.entries(dims)) {
          const c = DIMENSOES_SET.has(dim) ? contagem(valores, ABERTAS.has(dim) ? VALORES_TETO_ABERTOS : VALORES_TETO) : null;
          if (!c) { ok = false; break; }
          porDim[dim] = c;
        }
        if (!ok) break;
        d.perfil[pagina] = porDim;
      }
      if (!ok) continue;
      const funil = r.funil;
      if (typeof funil !== 'object' || funil === null) continue;
      for (const [canal, passos] of Object.entries(funil)) {
        const c = contagem(passos, PASSOS.length);
        if (!c || !RE_VALOR.test(canal) || Object.keys(c).some((p) => !PASSOS_SET.has(p) && p !== OUTROS)) { ok = false; break; }
        d.funil[canal] = c;
      }
      if (!ok) continue;
      const conta = contagem(r.conta, 2);
      if (!conta || Object.keys(conta).some((k) => k !== 'logado' && k !== 'convidado' && k !== OUTROS)) continue;
      d.conta = conta;
      this.dias.set(d.dia, d);
    }
  }
}
