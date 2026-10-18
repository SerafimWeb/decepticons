/**
 * Métricas de produto (dono, 28/09: "quero trackear o consumo, quantas pessoas clicaram, onde clicam, onde
 * saem, se jogaram tantas partidas"). Contrato único do que o site, o jogo e o servidor de jogo concordam
 * em contar — do mesmo jeito que `status.ts` é o contrato do "quem está jogando agora".
 *
 * **Decisão de privacidade (antes de existir login/LGPD, ROADMAP #negocio):** só contagens agregadas por
 * evento e por dia, nunca por pessoa. Nenhum evento carrega IP, nome, sala ou qualquer identificador que
 * sobreviva à sessão — o servidor não grava "quem", só "quantos". Sem cookie, sem localStorage com id
 * persistente entre sessões: cada aba sorteia um id efêmero só para não contar dois cliques do mesmo carregamento
 * como duas visitas, e ele nunca é escrito em disco nem devolvido pela leitura pública.
 */
import { parseContextoDeEvento, type ContextoDeEvento } from './audiencia';

/** Cada nome é um evento que o produto quer contar. Lista fechada: o servidor recusa qualquer outro (evita
 * que alguém injete contagem arbitrária no seu painel só mandando POST com nome inventado). */
export const EVENTOS = [
  // Funil da landing (site estático, sem servidor de jogo por padrão — só conta quando há GAME_SERVER_URL).
  'landing_view',
  'click_cockpit',
  'click_online',
  'click_como_e_feito',
  // Funil do jogo.
  'boot_ok',
  'partida_iniciada',
  'partida_terminada',
  'modo_trocado',
  'hangar_aberto',
  'partida_resumo',
] as const;
export type EventoNome = (typeof EVENTOS)[number];
const EVENTOS_SET = new Set<string>(EVENTOS);

/** Caminho do evento no servidor de jogo (mesmo processo do `/status`). */
export const EVENTO_PATH = '/evento';
/** Caminho do resumo público (contagens agregadas, sem eventos crus). */
export const RESUMO_PATH = '/eventos/resumo';
/** Payload maior que isto é recusado antes de tentar decodificar (G7: nunca confiar no tamanho anunciado). 1 KB cobre a visita da audiência (P193) com folga: o pior caso (site de origem e as três marcas de campanha) tem ~400 bytes. */
export const EVENTO_MAX_BYTES = 1024;

export interface EventoEnviado {
  seq?: number;
  nome: EventoNome;
  /** A audiência do evento (P193): a visita em `landing_view`/`boot_ok`, o canal nos passos do funil. Só categorias (`shared/net/audiencia.ts`). Contexto torto é descartado; o evento continua valendo. */
  ctx?: ContextoDeEvento;
  /** Id efêmero da aba (sorteado no cliente a cada carregamento, nunca persistido). Serve só para o
   * servidor não contar o mesmo evento duas vezes se o navegador reenviar (`sendBeacon` às vezes duplica). */
  aba: string;
}

/** Valida o corpo cru de um POST /evento. Só aceita os nomes da lista fechada e um id de aba plausível. */
export function parseEvento(raw: unknown): EventoEnviado | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.nome !== 'string' || !EVENTOS_SET.has(r.nome)) return null;
  if (typeof r.aba !== 'string' || r.aba.length < 4 || r.aba.length > 40 || !/^[a-z0-9]+$/i.test(r.aba)) return null;
  if (r.seq !== undefined && (typeof r.seq !== 'number' || !Number.isInteger(r.seq) || r.seq < 0 || r.seq > 2147483647)) return null;
  const ctx = parseContextoDeEvento(r.nome, r.o);
  return { nome: r.nome as EventoNome, aba: r.aba, ...(r.seq === undefined ? {} : { seq: r.seq as number }), ...(ctx ? { ctx } : {}) };
}

/** Resumo público: contagem por evento nas últimas 24h e desde que o servidor subiu. Só números — o que
 * `GET /eventos/resumo` devolve e o que `scripts/site/dados.mjs` lê para a sala de controle. */
export type ResumoEventos = { desde: string; janela24h: Record<string, number>; total: Record<string, number> };

export function resumoVazio(desdeIso: string): ResumoEventos {
  const zeros = Object.fromEntries(EVENTOS.map((e) => [e, 0])) as Record<string, number>;
  return { desde: desdeIso, janela24h: { ...zeros }, total: { ...zeros } };
}

export function parseResumo(raw: unknown): ResumoEventos | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.desde !== 'string') return null;
  const nums = (v: unknown): Record<string, number> | null => {
    if (typeof v !== 'object' || v === null) return null;
    const out: Record<string, number> = {};
    for (const nome of EVENTOS) {
      const n = (v as Record<string, unknown>)[nome];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
      out[nome] = Math.trunc(n);
    }
    return out;
  };
  const janela24h = nums(r.janela24h);
  const total = nums(r.total);
  if (!janela24h || !total) return null;
  return { desde: r.desde, janela24h, total };
}

// ---------- origem das conexões e métricas detalhadas (dono, 04/10) ----------

/**
 * Eventos que SÓ o servidor conta (o cliente não pode mandá-los por `POST /evento`: a lista fechada de cima é a do que ele
 * pode mandar). Servem para saber quem chegou ao jogo online, de onde, e por que alguém foi recusado.
 */
export const EVENTOS_SERVIDOR = [
  /** Uma conexão de WebSocket foi aceita (ainda não escolheu a montagem). */
  'conexao_online',
  /** Entrou numa sala: montagem aceita, partida em curso. */
  'entrou_na_sala',
  /** Recusada na sala: protocolo diferente (cliente e servidor em versões diferentes). */
  'recusa_versao',
  'recusa_cheia',
  'recusa_montagem',
  'recusa_mensagem',
  /** Recusada na porta, pelas defesas (teto de conexões por IP ou total). */
  'recusa_limite',
  /** A vida das contas (P192): quantas nasceram, quantas entraram, quantas falharam na senha, quantas foram apagadas e quantas baixaram os dados. Só a contagem. */
  'conta_criada',
  'login_ok',
  'login_falhou',
  'conta_apagada',
  'dados_baixados',
] as const;
export type EventoServidor = (typeof EVENTOS_SERVIDOR)[number];
export type EventoQualquer = EventoNome | EventoServidor;
export const TODOS_EVENTOS: readonly EventoQualquer[] = [...EVENTOS, ...EVENTOS_SERVIDOR];

/** Detalhe privado das métricas (por dia e por país): exige o token do dono. */
export const METRICAS_PATH = '/metricas';
/** Cabeçalho com o token; o servidor gera um na primeira subida (`.tmp/servidor/metricas-token.txt`). */
export const METRICAS_HEADER = 'x-cybermech-metricas';
/** País que não deu para saber (conexão direta, cabeçalho ausente ou "XX" da Cloudflare). */
export const PAIS_DESCONHECIDO = '??';

/**
 * O país de quem chegou, a partir do cabeçalho `CF-IPCountry` da Cloudflare (código ISO de 2 letras; `XX` = sem informação;
 * `T1` = rede Tor). Qualquer outra coisa vira `??`. **Só o país: nunca o IP, nem cidade.**
 */
export function parsePais(raw: unknown): string {
  const v = (Array.isArray(raw) ? raw[0] : raw) as unknown;
  if (typeof v !== 'string') return PAIS_DESCONHECIDO;
  const s = v.trim().toUpperCase();
  return /^[A-Z][A-Z0-9]$/.test(s) && s !== 'XX' ? s : PAIS_DESCONHECIDO;
}

export interface DiaMetricas {
  /** Dia no horário de Brasília (`2026-10-04`). */
  dia: string;
  /** Por evento, quantos vieram de cada país. */
  eventos: Record<string, Record<string, number>>;
  /** Maior número de jogadores ao mesmo tempo nesse dia (todas as salas). */
  pico: number;
}

export interface Metricas {
  /** Desde quando há dados (a primeira subida do servidor com esta contagem). */
  desde: string;
  geradoEm: string;
  /** Os dias são no fuso do dono. */
  fuso: string;
  /** Total desde o começo, por evento (cliente e servidor). */
  total: Record<string, number>;
  /** Do dia mais antigo guardado ao de hoje. */
  dias: DiaMetricas[];
}

/** Confere o JSON recebido do servidor (o painel não confia no que lê). */
export function parseMetricas(raw: unknown): Metricas | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.desde !== 'string' || typeof r.geradoEm !== 'string' || typeof r.fuso !== 'string') return null;
  const contagens = (v: unknown): Record<string, number> | null => {
    if (typeof v !== 'object' || v === null) return null;
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(v)) {
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
      out[k] = Math.trunc(n);
    }
    return out;
  };
  const total = contagens(r.total);
  if (!total || !Array.isArray(r.dias)) return null;
  const dias: DiaMetricas[] = [];
  for (const d of r.dias as unknown[]) {
    if (typeof d !== 'object' || d === null) return null;
    const x = d as Record<string, unknown>;
    if (typeof x.dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.dia) || typeof x.pico !== 'number' || typeof x.eventos !== 'object' || x.eventos === null) return null;
    const eventos: Record<string, Record<string, number>> = {};
    for (const [nome, porPais] of Object.entries(x.eventos)) {
      const c = contagens(porPais);
      if (!c) return null;
      eventos[nome] = c;
    }
    dias.push({ dia: x.dia, eventos, pico: Math.max(0, Math.trunc(x.pico)) });
  }
  return { desde: r.desde, geradoEm: r.geradoEm, fuso: r.fuso, total, dias };
}
