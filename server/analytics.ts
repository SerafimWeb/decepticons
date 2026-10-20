import { createPrivateKey, createSign, type KeyObject } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * O Google Analytics dentro do `/metricas/` (P207; ordem do Comandante, 18/10: *"ligue o metricas, quero tudo devidamente configurado na melhor e mais técnica estrutura"*).
 *
 * **Como fala com o Google.** Uma conta de serviço (a chave JSON que o dono criou, `ga-chave.json` na pasta de dados, fora do git) assina um JWT RS256 com `node:crypto` e troca por
 * um token de acesso de 1 hora (`analytics.readonly`); com ele chama a Google Analytics Data API (`batchRunReports` e `runRealtimeReport`). Nenhuma biblioteca nova, nada de SDK do Google.
 * A propriedade vem de `CYBERMECH_GA_PROPRIEDADE` ou de `ga-propriedade.txt` (só números); sem ela, tenta descobrir pela Admin API **se houver uma só**.
 *
 * **O que ele nunca faz:** pedir dado de pessoa (só somas por categoria), guardar o token em disco, escrever a chave ou o token no log ou na resposta, ou deixar o Google travar o
 * `/metricas`: o resultado fica em cache (10 min; 2 min depois de um erro), pedidos simultâneos viram um só, e a primeira resposta espera no máximo `ESPERA_MAX_MS`
 * (passou disso, a página mostra "carregando" e a próxima vez já tem os números). **Só enxerga quem aceitou os cookies do site** (é do Google, não nosso): o que o servidor mede por conta
 * própria continua nas outras seções.
 */
export const GA_CHAVE_ARQUIVO = 'ga-chave.json';
export const GA_PROPRIEDADE_ARQUIVO = 'ga-propriedade.txt';
/** O código de medição do jogo e do site (o mesmo do `client/index.html` e de `scripts/site/tema.mjs`; um teste confere que não se separam). A descoberta só aceita a propriedade que tem um fluxo com ele. */
export const GA_MEDICAO_ID = 'G-2CCHDCEC7X';
export const GA_DIAS = 28;
export const GA_TTL_MS = 10 * 60_000;
export const GA_ERRO_TTL_MS = 2 * 60_000;
export const ESPERA_MAX_MS = 4000;
const PEDIDO_TIMEOUT_MS = 8000;
const ESCOPO = 'https://www.googleapis.com/auth/analytics.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DATA_URL = 'https://analyticsdata.googleapis.com/v1beta';
const ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';
const ADMIN_URL = `${ADMIN_BASE}/accountSummaries`;
const RE_PROPRIEDADE = /^\d{5,15}$/;

export interface GaRelatorio {
  /** Instante (ISO) em que o servidor pediu estes números ao Google. */
  geradoEm: string;
  propriedade: string;
  dias: number;
  /** Usuários ativos agora (tempo real), ou `null` se o Google não respondeu essa parte. */
  agora: number | null;
  resumo: { usuarios: number; novos: number; sessoes: number; sessoesEngajadas: number; duracaoMediaS: number; paginasVistas: number };
  porDia: { dia: string; usuarios: number; sessoes: number }[];
  canais: { nome: string; sessoes: number; usuarios: number }[];
  paises: { codigo: string; usuarios: number }[];
  aparelhos: { nome: string; usuarios: number }[];
}

/** `sem-chave`: não há `ga-chave.json`; `chave-ruim`: há, mas não é uma chave de conta de serviço legível; `sem-propriedade`: falta o ID numérico da propriedade (e não deu para descobrir). */
export type GaEstado =
  | { estado: 'desligado'; motivo: 'sem-chave' | 'chave-ruim' | 'sem-propriedade' }
  /** A conta de serviço enxerga propriedades (`vistas`: os nomes), mas nenhuma tem o fluxo do CYBERMECH: foi dado acesso na propriedade errada. */
  | { estado: 'desligado'; motivo: 'propriedade-errada'; vistas: string[] }
  | { estado: 'carregando' }
  | { estado: 'erro'; motivo: 'token' | 'api' | 'cota' | 'rede'; detalhe: string; desde: string }
  | { estado: 'ok'; relatorio: GaRelatorio };

export interface GaOpcoes {
  dirDados: string | null;
  env?: NodeJS.ProcessEnv;
  http?: typeof fetch;
  agora?: () => number;
  anotar?: (linha: string) => void;
}

interface Chave {
  email: string;
  privada: KeyObject;
}

class GaErro extends Error {
  constructor(
    readonly motivo: 'token' | 'api' | 'cota' | 'rede',
    detalhe: string,
  ) {
    super(detalhe);
  }
}

/** O que o Google disse, sem nada que pareça segredo (sequências longas viram "…") e com tamanho curto: vai para o `/metricas` e para o log. */
export function detalheSeguro(bruto: unknown): string {
  return String(bruto ?? '')
    .replace(/[A-Za-z0-9_\-+/=.]{40,}/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export class GoogleAnalytics {
  private readonly http: typeof fetch;
  private readonly agora: () => number;
  private readonly anotar: (linha: string) => void;
  private readonly env: NodeJS.ProcessEnv;
  private readonly dir: string | null;
  private token: { valor: string; expiraEm: number } | null = null;
  private descoberta: string | null = null;
  /** Os nomes das propriedades que a conta enxerga e não são a do CYBERMECH (para dizer ao dono onde deu acesso por engano). */
  private vistas: string[] = [];
  private cache: { estado: GaEstado; ate: number } | null = null;
  private voo: Promise<GaEstado> | null = null;

  constructor(o: GaOpcoes) {
    this.dir = o.dirDados;
    this.env = o.env ?? process.env;
    this.http = o.http ?? fetch;
    this.agora = o.agora ?? Date.now;
    this.anotar = o.anotar ?? (() => {});
  }

  /** O estado atual do Analytics para o `/metricas`. Nunca lança e nunca demora mais que `ESPERA_MAX_MS`. */
  async obter(): Promise<GaEstado> {
    const agora = this.agora();
    if (this.cache && agora < this.cache.ate) return this.cache.estado;
    this.voo ??= this.atualizar().finally(() => {
      this.voo = null;
    });
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const demorou = new Promise<GaEstado>((ok) => {
      relogio = setTimeout(() => ok(this.cache?.estado ?? { estado: 'carregando' }), ESPERA_MAX_MS);
    });
    return Promise.race([this.voo, demorou]).finally(() => clearTimeout(relogio));
  }

  private guardar(estado: GaEstado): GaEstado {
    const ttl = estado.estado === 'ok' ? GA_TTL_MS : estado.estado === 'erro' ? GA_ERRO_TTL_MS : 30_000;
    this.cache = { estado, ate: this.agora() + ttl };
    return estado;
  }

  private async atualizar(): Promise<GaEstado> {
    try {
      const chave = this.lerChave();
      if ('motivo' in chave) return this.guardar({ estado: 'desligado', motivo: chave.motivo });
      const token = await this.tokenDeAcesso(chave);
      const propriedade = this.propriedadeConfigurada() ?? (await this.descobrirPropriedade(token));
      if (!propriedade) return this.guardar(this.vistas.length ? { estado: 'desligado', motivo: 'propriedade-errada', vistas: this.vistas } : { estado: 'desligado', motivo: 'sem-propriedade' });
      return this.guardar({ estado: 'ok', relatorio: await this.relatorio(token, propriedade) });
    } catch (e) {
      const erro = e instanceof GaErro ? e : new GaErro('rede', 'erro inesperado');
      if (!(this.cache?.estado.estado === 'erro' && this.cache.estado.motivo === erro.motivo)) this.anotar(`analytics: ${erro.motivo}: ${erro.message}`);
      return this.guardar({ estado: 'erro', motivo: erro.motivo, detalhe: erro.message, desde: new Date(this.agora()).toISOString() });
    }
  }

  private lerChave(): Chave | { motivo: 'sem-chave' | 'chave-ruim' } {
    if (!this.dir || !existsSync(join(this.dir, GA_CHAVE_ARQUIVO))) return { motivo: 'sem-chave' };
    try {
      const k = JSON.parse(readFileSync(join(this.dir, GA_CHAVE_ARQUIVO), 'utf8')) as { type?: string; client_email?: string; private_key?: string };
      if (k.type !== 'service_account' || typeof k.client_email !== 'string' || typeof k.private_key !== 'string') return { motivo: 'chave-ruim' };
      return { email: k.client_email, privada: createPrivateKey(k.private_key) };
    } catch {
      return { motivo: 'chave-ruim' };
    }
  }

  private propriedadeConfigurada(): string | null {
    const daVariavel = this.env.CYBERMECH_GA_PROPRIEDADE?.trim();
    if (daVariavel) return RE_PROPRIEDADE.test(daVariavel) ? daVariavel : null;
    if (this.dir && existsSync(join(this.dir, GA_PROPRIEDADE_ARQUIVO))) {
      const linha = (readFileSync(join(this.dir, GA_PROPRIEDADE_ARQUIVO), 'utf8').split(/\r?\n/)[0] ?? '').trim().replace(/^properties\//, '');
      return RE_PROPRIEDADE.test(linha) ? linha : null;
    }
    return null;
  }

  private async pedir(url: string, init: RequestInit, rotulo: 'token' | 'api'): Promise<unknown> {
    let res: Response;
    try {
      res = await this.http(url, { ...init, signal: AbortSignal.timeout(PEDIDO_TIMEOUT_MS) });
    } catch {
      throw new GaErro('rede', 'o Google não respondeu');
    }
    const corpo: unknown = await res.json().catch(() => null);
    if (res.ok) return corpo;
    const e = (corpo as { error?: { status?: string; message?: string } | string; error_description?: string } | null) ?? {};
    const texto = typeof e.error === 'string' ? `${e.error} ${e.error_description ?? ''}` : `${e.error?.status ?? ''} ${e.error?.message ?? ''}`;
    throw new GaErro(res.status === 429 ? 'cota' : rotulo, `${res.status} ${detalheSeguro(texto)}`);
  }

  private async tokenDeAcesso(chave: Chave): Promise<string> {
    const agora = this.agora();
    if (this.token && agora < this.token.expiraEm - 60_000) return this.token.valor;
    const iat = Math.floor(agora / 1000);
    const corpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: chave.email, scope: ESCOPO, aud: TOKEN_URL, iat, exp: iat + 3600 })}`;
    const assinatura = createSign('RSA-SHA256').update(corpo).sign(chave.privada).toString('base64url');
    const r = (await this.pedir(
      TOKEN_URL,
      { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${corpo}.${assinatura}` }) },
      'token',
    )) as { access_token?: string; expires_in?: number } | null;
    if (!r || typeof r.access_token !== 'string') throw new GaErro('token', 'resposta do Google sem token');
    this.token = { valor: r.access_token, expiraEm: agora + num(r.expires_in || 3600) * 1000 };
    return r.access_token;
  }

  /**
   * Sem o ID configurado: pergunta ao Google a quais propriedades a conta tem acesso e **só usa a que tem um fluxo com o código de medição do CYBERMECH** (`GA_MEDICAO_ID`).
   * Antes pegava "a única propriedade", e uma conta com acesso só ao app Android de outro projeto mostraria números do app como se fossem do jogo (18/10). Se enxerga
   * propriedades mas nenhuma é a do CYBERMECH, guarda os nomes em `vistas` para a página dizer onde o acesso foi dado por engano. Precisa da Admin API ligada no projeto
   * (senão, "falta o ID"). Quem quiser outra propriedade escreve o ID em `ga-propriedade.txt`: o que está escrito vale, sem checar.
   */
  private async descobrirPropriedade(token: string): Promise<string | null> {
    if (this.descoberta) return this.descoberta;
    this.vistas = [];
    const medicao = this.env.CYBERMECH_GA_MEDICAO?.trim() || GA_MEDICAO_ID;
    const cab = { authorization: `Bearer ${token}` };
    try {
      const r = (await this.pedir(ADMIN_URL, { headers: cab }, 'api')) as { accountSummaries?: { propertySummaries?: { property?: string; displayName?: string }[] }[] } | null;
      const props = (r?.accountSummaries ?? [])
        .flatMap((c) => c.propertySummaries ?? [])
        .map((p) => ({ id: String(p.property ?? '').replace('properties/', ''), nome: detalheSeguro(p.displayName) }))
        .filter((p) => RE_PROPRIEDADE.test(p.id))
        .slice(0, 12);
      const achadas: string[] = [];
      for (const p of props) {
        try {
          const s = (await this.pedir(`${ADMIN_BASE}/properties/${p.id}/dataStreams`, { headers: cab }, 'api')) as { dataStreams?: { webStreamData?: { measurementId?: string } }[] } | null;
          if ((s?.dataStreams ?? []).some((d) => d.webStreamData?.measurementId === medicao)) achadas.push(p.id);
        } catch (e) {
          if (e instanceof GaErro && e.motivo === 'rede') throw e;
          // sem permissão para listar os fluxos desta propriedade: ela não é a nossa
        }
      }
      if (achadas.length === 1) this.descoberta = achadas[0]!;
      else if (achadas.length === 0) this.vistas = props.map((p) => p.nome || p.id);
      return this.descoberta;
    } catch (e) {
      if (e instanceof GaErro && e.motivo === 'rede') throw e;
      return null; // a Admin API desligada (403) é o caso comum: não é erro, é "falta o ID"
    }
  }

  private async relatorio(token: string, propriedade: string): Promise<GaRelatorio> {
    const cab = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const periodo = [{ startDate: `${GA_DIAS}daysAgo`, endDate: 'today' }];
    const [lote, tempoReal] = await Promise.all([
      this.pedir(
        `${DATA_URL}/properties/${propriedade}:batchRunReports`,
        {
          method: 'POST',
          headers: cab,
          body: JSON.stringify({
            requests: [
              { dateRanges: periodo, metrics: ['activeUsers', 'newUsers', 'sessions', 'engagedSessions', 'averageSessionDuration', 'screenPageViews'].map((name) => ({ name })) },
              { dateRanges: periodo, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }], orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 40 },
              { dateRanges: periodo, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 12 },
              { dateRanges: periodo, dimensions: [{ name: 'countryId' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 15 },
              { dateRanges: periodo, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 6 },
            ],
          }),
        },
        'api',
      ),
      // O tempo real é um extra: se falhar sozinho, o resto aparece sem ele.
      this.pedir(`${DATA_URL}/properties/${propriedade}:runRealtimeReport`, { method: 'POST', headers: cab, body: JSON.stringify({ metrics: [{ name: 'activeUsers' }] }) }, 'api').catch(() => null),
    ]);
    const relatorios = (lote as { reports?: Linhas[] } | null)?.reports;
    if (!Array.isArray(relatorios) || relatorios.length < 5) throw new GaErro('api', 'resposta do Google sem os relatórios esperados');
    const [resumo, dias, canais, paises, aparelhos] = relatorios as [Linhas, Linhas, Linhas, Linhas, Linhas];
    const t = linhas(resumo)[0]?.m ?? [];
    return {
      geradoEm: new Date(this.agora()).toISOString(),
      propriedade,
      dias: GA_DIAS,
      agora: tempoReal ? (linhas(tempoReal as Linhas)[0]?.m[0] ?? 0) : null,
      resumo: { usuarios: t[0] ?? 0, novos: t[1] ?? 0, sessoes: t[2] ?? 0, sessoesEngajadas: t[3] ?? 0, duracaoMediaS: Math.round(t[4] ?? 0), paginasVistas: t[5] ?? 0 },
      porDia: linhas(dias)
        .map((l) => ({ dia: /^\d{8}$/.test(l.d[0] ?? '') ? `${l.d[0]!.slice(0, 4)}-${l.d[0]!.slice(4, 6)}-${l.d[0]!.slice(6, 8)}` : '', usuarios: l.m[0] ?? 0, sessoes: l.m[1] ?? 0 }))
        .filter((d) => d.dia)
        .slice(-40),
      canais: linhas(canais).map((l) => ({ nome: detalheSeguro(l.d[0]) || '(sem canal)', sessoes: l.m[0] ?? 0, usuarios: l.m[1] ?? 0 })).slice(0, 12),
      paises: linhas(paises).map((l) => ({ codigo: /^[A-Za-z]{2}$/.test(l.d[0] ?? '') ? l.d[0]!.toUpperCase() : '??', usuarios: l.m[0] ?? 0 })).slice(0, 15),
      aparelhos: linhas(aparelhos).map((l) => ({ nome: detalheSeguro(l.d[0]) || '(desconhecido)', usuarios: l.m[0] ?? 0 })).slice(0, 6),
    };
  }
}

interface Linhas {
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
}
/** As linhas de um relatório do Google como `{ d: dimensões (texto), m: métricas (número) }`. Formato estranho vira lista vazia, nunca erro. */
function linhas(r: Linhas): { d: string[]; m: number[] }[] {
  if (!r || !Array.isArray(r.rows)) return [];
  return r.rows.map((l) => ({ d: (l.dimensionValues ?? []).map((v) => String(v.value ?? '')), m: (l.metricValues ?? []).map((v) => num(v.value)) }));
}
