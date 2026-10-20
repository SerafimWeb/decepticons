import {
  ADMIN_AVALIAR_PATH,
  ADMIN_ESTADO_PATH,
  ADMIN_FECHAR_SALA_PATH,
  ADMIN_HEADER,
  ADMIN_HISTORICO_PATH,
  ADMIN_LOG_PATH,
  ADMIN_REINICIAR_PATH,
  ADMIN_TESTAR_PATH,
  type AdminAvaliacao,
  type AdminErro,
  type AdminEstado,
  type AdminHistorico,
  type AdminLog,
  type AdminReiniciar,
  type AdminTeste,
  lerAvaliacao,
  lerErro,
  lerEstado,
  lerHistorico,
  lerLog,
  lerTeste,
} from '../../../shared/net/admin';
import { serverHttpUrl } from '../../../shared/net/serverUrl';
import { chaveDoToken as chaveDaConta } from './sessao';
import { ADMIN_REGRAS_GRAVAR_PATH, ADMIN_REGRAS_PATH, lerRegrasDaResposta, type RegrasOnline } from '../../../shared/regras';
import { ADMIN_VISIBILIDADE_PATH, lerConfig, type ConfigDeVisibilidade, type EstadoDeVisibilidade } from '../../../shared/visibilidade';
import { parseStatus, STATUS_PATH, type ServerStatus } from '../../../shared/net/status';

/** Por que uma chamada não deu certo, em palavras que a tela traduz. */
export type MotivoDeFalha =
  /** O jogo não sabe onde está o servidor (build offline). */
  | 'sem-servidor'
  /** Falta o token do dono (ou o servidor não tem token: 404). */
  | 'sem-token'
  /** O servidor recusou o token (401). */
  | 'token'
  /** Erros demais de token deste IP (429): espere. */
  | 'bloqueado'
  /** Não respondeu (rede, túnel, servidor parado). */
  | 'fora-do-ar'
  /** Respondeu, mas não é o painel (um servidor de versão antiga, sem as rotas, responde texto) ou está fora do contrato. */
  | 'resposta'
  /** O servidor entendeu e disse não (409: há gente jogando; 501: não sabe se reiniciar). */
  | 'recusado';

export type Resposta<T> = { ok: true; dados: T } | { ok: false; motivo: MotivoDeFalha; erro?: AdminErro };

const falha = <T>(motivo: MotivoDeFalha, erro?: AdminErro): Resposta<T> => ({ ok: false, motivo, ...(erro ? { erro } : {}) });

/** Quanto esperar uma consulta comum e o teste (que roda uns 8 s no servidor). */
const ESPERA_MS = 6000;
const ESPERA_TESTE_MS = 30_000;

/**
 * O cliente do painel do servidor (P93, G3: módulo sem tela). Fala com `/admin/*` com o token do dono, que a tela guarda no aparelho
 * (`localStorage`, só aqui: nunca no link nem no site). Nunca lança: toda falha vira `{ ok: false, motivo }` para a tela explicar.
 * O `status` público (`/status`) não precisa de token: é por ele que a tela sabe que o servidor voltou de um reinício.
 */
export class AdminCliente {
  private readonly base: string | null;

  constructor(
    gameServer: string | undefined | null,
    private readonly token: () => string | null,
    private readonly buscar: typeof fetch = (...a) => fetch(...a),
  ) {
    const url = serverHttpUrl(gameServer, '/');
    this.base = url ? url.replace(/\/$/, '') : null;
  }

  get temServidor(): boolean {
    return this.base !== null;
  }

  estado = (): Promise<Resposta<AdminEstado>> => this.chamar(ADMIN_ESTADO_PATH, lerEstado);
  historico = (): Promise<Resposta<AdminHistorico>> => this.chamar(ADMIN_HISTORICO_PATH, lerHistorico);
  log = (): Promise<Resposta<AdminLog>> => this.chamar(ADMIN_LOG_PATH, lerLog);
  avaliar = (): Promise<Resposta<AdminAvaliacao>> => this.chamar(ADMIN_AVALIAR_PATH, lerAvaliacao);
  testar = (): Promise<Resposta<AdminTeste>> => this.chamar(ADMIN_TESTAR_PATH, lerTeste, { metodo: 'POST', esperaMs: ESPERA_TESTE_MS });
  fecharSala = (sala: string): Promise<Resposta<true>> => this.chamar(ADMIN_FECHAR_SALA_PATH, (r) => ((r as { ok?: unknown } | null)?.ok === true ? true : null), { metodo: 'POST', corpo: { sala } });
  /** As regras dos bots das salas online (P199): o que o servidor usa agora. */
  regras = (): Promise<Resposta<RegrasOnline>> => this.chamar(ADMIN_REGRAS_PATH, lerRegrasDaResposta);
  /** Grava as regras (o servidor puxa o que passar dos limites) e devolve as que valem. Salas de pé recebem na hora. */
  gravarRegras = (r: RegrasOnline): Promise<Resposta<RegrasOnline>> => this.chamar(ADMIN_REGRAS_GRAVAR_PATH, lerRegrasDaResposta, { metodo: 'POST', corpo: r });
  /** Grava o que os jogadores veem (P191): só as exceções ao padrão do código. Devolve a configuração nova do servidor. */
  gravarVisibilidade = (itens: Record<string, EstadoDeVisibilidade>): Promise<Resposta<ConfigDeVisibilidade>> =>
    this.chamar(ADMIN_VISIBILIDADE_PATH, (r) => ((r as { itens?: unknown } | null)?.itens ? lerConfig(r) : null), { metodo: 'POST', corpo: { itens } });
  reiniciar = (confirmar: boolean): Promise<Resposta<AdminReiniciar>> =>
    this.chamar(ADMIN_REINICIAR_PATH, lerReinicio, { metodo: 'POST', corpo: { confirmar } });

  /** O status público: quantos jogam e há quanto tempo o servidor está de pé (`null` = não respondeu). */
  async statusPublico(): Promise<ServerStatus | null> {
    const url = this.base ? `${this.base}${STATUS_PATH}` : null;
    if (!url) return null;
    try {
      const res = await this.buscar(url, { cache: 'no-store', mode: 'cors', signal: AbortSignal.timeout(4000) });
      return res.ok ? parseStatus(await res.json()) : null;
    } catch {
      return null;
    }
  }

  private async chamar<T>(caminho: string, ler: (raw: unknown) => T | null, o: { metodo?: 'GET' | 'POST'; corpo?: unknown; esperaMs?: number } = {}): Promise<Resposta<T>> {
    if (!this.base) return falha('sem-servidor');
    const token = this.token();
    if (!token) return falha('sem-token');
    let res: Response;
    try {
      res = await this.buscar(`${this.base}${caminho}`, {
        method: o.metodo ?? 'GET',
        headers: { [ADMIN_HEADER]: token, ...(o.corpo !== undefined ? { 'content-type': 'application/json' } : {}) },
        ...(o.corpo !== undefined ? { body: JSON.stringify(o.corpo) } : {}),
        cache: 'no-store',
        mode: 'cors',
        signal: AbortSignal.timeout(o.esperaMs ?? ESPERA_MS),
      });
    } catch {
      return falha('fora-do-ar');
    }
    if (res.status === 401) return falha('token');
    if (res.status === 429) return falha('bloqueado');
    if (res.status === 404) return falha('sem-token');
    let corpo: unknown = null;
    try {
      corpo = await res.json();
    } catch {
      // Um servidor sem as rotas responde texto: vira "resposta".
    }
    if (res.status === 409 || res.status === 501 || res.status === 400) return falha('recusado', lerErro(corpo) ?? undefined);
    if (!res.ok) return falha('resposta', lerErro(corpo) ?? undefined);
    const dados = ler(corpo);
    return dados === null ? falha('resposta') : { ok: true, dados };
  }
}

function lerReinicio(raw: unknown): AdminReiniciar | null {
  const r = raw as { ok?: unknown; emS?: unknown; religa?: unknown } | null;
  if (!r || r.ok !== true || typeof r.emS !== 'number' || (r.religa !== 'supervisionado' && r.religa !== 'sozinho')) return null;
  return { ok: true, emS: r.emS, religa: r.religa };
}

// ─── O token do dono, guardado só neste aparelho ──────────────────────────────────────────────────────────────────────

export const ADMIN_TOKEN_KEY = 'cybermech.admin.token';

/**
 * A chave do token no armazenamento: **uma por servidor** (`cybermech.admin.token|https://jogo…`, ws e http dão a mesma). O token é de UM servidor:
 * um link com `?servidor=` apontando para outro lugar nunca recebe o token guardado dos demais (a página de métricas faz o mesmo).
 */
export function chaveDoToken(gameServer: string | undefined | null): string {
  const url = serverHttpUrl(gameServer, '/');
  return `${ADMIN_TOKEN_KEY}|${url ? url.replace(/\/$/, '') : ''}`;
}

/**
 * P106 ("unifique as contas"): a sessão de uma conta admin, guardada no lugar da chave do dono, ainda vale? Devolve a sessão se o servidor a
 * confirma como `is_admin`; `null` se não há nada guardado, se é a chave do dono (não é sessão: o servidor não a reconhece em `/conta/eu`),
 * se expirou ou se o servidor não responde. Nunca lança.
 */
export async function sessaoDeAdminGuardada(guarda: { ler: () => string | null }, conta: { eu: (token: string) => Promise<{ is_admin: boolean } | null> }): Promise<string | null> {
  const guardado = guarda.ler();
  if (!guardado) return null;
  try {
    return (await conta.eu(guardado))?.is_admin === true ? guardado : null;
  } catch {
    return null;
  }
}

/**
 * Lê e grava o token do dono, deste servidor, no armazenamento do aparelho; sem armazenamento (aba anônima), vale só até recarregar. **Sem o token do dono, `ler` devolve a sessão da conta deste
 * aparelho** (P106: o servidor aceita, no mesmo cabeçalho, a sessão de uma conta de administrador): quem entrou na conta de administrador uma vez não digita token nenhum, nem no painel do
 * servidor, nem no de visibilidade, nem no mural. Se a conta não é de administrador, o servidor recusa e a tela pede o token, como antes. `gravar` e `apagar` só mexem no token do dono.
 */
export class TokenDoDono {
  private memoria: string | null = null;
  private readonly chave: string;
  private readonly chaveDaSessao: string;
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
    gameServer: string | undefined | null,
  ) {
    this.chave = chaveDoToken(gameServer);
    this.chaveDaSessao = chaveDaConta(gameServer);
  }

  ler = (): string | null => {
    try {
      return this.storage?.getItem(this.chave) || this.memoria || this.storage?.getItem(this.chaveDaSessao) || null;
    } catch {
      return this.memoria;
    }
  };

  gravar(token: string): void {
    this.memoria = token;
    try {
      this.storage?.setItem(this.chave, token);
    } catch {
      // só em memória
    }
  }

  apagar(): void {
    this.memoria = null;
    try {
      this.storage?.removeItem(this.chave);
    } catch {
      // nada a apagar
    }
  }
}
