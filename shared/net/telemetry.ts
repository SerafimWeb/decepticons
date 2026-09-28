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
] as const;
export type EventoNome = (typeof EVENTOS)[number];
const EVENTOS_SET = new Set<string>(EVENTOS);

/** Caminho do evento no servidor de jogo (mesmo processo do `/status`). */
export const EVENTO_PATH = '/evento';
/** Caminho do resumo público (contagens agregadas, sem eventos crus). */
export const RESUMO_PATH = '/eventos/resumo';
/** Payload maior que isto é recusado antes de tentar decodificar (G7: nunca confiar no tamanho anunciado). */
export const EVENTO_MAX_BYTES = 256;

export interface EventoEnviado {
  nome: EventoNome;
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
  return { nome: r.nome as EventoNome, aba: r.aba };
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
