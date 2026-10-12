/**
 * O painel do servidor (P93, 12/10: "resetar, testar, avaliar e analisar o servidor e as infos dele"): o contrato das rotas privadas
 * `/admin/*` que o monitor SERVIDOR do console de comando usa. Único do servidor, do cliente e dos testes (G14), sem dependência do
 * cliente do jogo: o servidor importa direto, como faz com `status.ts`.
 *
 * **Quem pode.** Só o dono: o mesmo token das métricas (`metricas-token.txt`, `METRICAS_HEADER`), que vive só na pasta de dados do PC do
 * servidor. Nenhuma rota daqui responde sem ele; erro de token três vezes seguidas por IP não ajuda ninguém (régua de tentativas, 429).
 *
 * **O que há.** `GET /admin/estado` (o agora), `GET /admin/historico` (a última hora, uma amostra a cada 5 s), `GET /admin/log` (o fim do
 * log), `POST /admin/avaliar` (o veredito sobre a última hora e a capacidade), `POST /admin/testar` (a bateria com clientes de mentira,
 * só com a sala vazia), `POST /admin/sala/fechar` e `POST /admin/reiniciar` (só com a sala vazia, ou com `confirmar`).
 *
 * **Só o que o dono precisa ver.** Nenhum IP, nenhum e-mail: as salas mostram os apelidos que os jogadores escolheram (os mesmos que os
 * outros jogadores já veem) e o resto são números.
 */
import { METRICAS_HEADER } from './telemetry';

/** O token do dono viaja neste cabeçalho (o mesmo de `GET /metricas`). */
export const ADMIN_HEADER = METRICAS_HEADER;
export const ADMIN_PREFIXO = '/admin/';
export const ADMIN_ESTADO_PATH = '/admin/estado';
export const ADMIN_HISTORICO_PATH = '/admin/historico';
export const ADMIN_LOG_PATH = '/admin/log';
export const ADMIN_AVALIAR_PATH = '/admin/avaliar';
export const ADMIN_TESTAR_PATH = '/admin/testar';
export const ADMIN_FECHAR_SALA_PATH = '/admin/sala/fechar';
export const ADMIN_REINICIAR_PATH = '/admin/reiniciar';

/** De quanto em quanto tempo o servidor tira uma amostra (s), e quantas guarda (uma hora). */
export const AMOSTRA_CADA_S = 5;
export const HISTORICO_AMOSTRAS = 720;

export interface AdminSala {
  codigo: string;
  jogadores: number;
  bots: number;
  tick: number;
  /** Tempo médio de um tick desta sala (ms): a meta do G14 é 2. */
  tickMs: number;
  rodada: number;
  restanteS: number;
  jogando: boolean;
  /** Os apelidos dos jogadores (os que os outros já veem), no máximo `ROOM_SIZE`. */
  nomes: string[];
}

export interface AdminEstado {
  protocolo: number;
  /** A versão do código em que o servidor roda (hash curto do git) ou `desconhecida`. */
  release: string;
  iniciadoEm: string;
  uptimeS: number;
  node: string;
  plataforma: string;
  porta: number;
  /** Roda sob a tarefa do Windows (que o religa se ele cair)? Sem isso, REINICIAR só desliga. */
  supervisionado: boolean;
  memoria: { rssMB: number; heapMB: number };
  /** Uso de CPU do processo, em % de **um** núcleo, média da última amostra. */
  cpuPct: number;
  /** Atraso do laço de eventos (ms) desde a última amostra: o que o Node percebe de "travadinha". */
  lacoMs: { medio: number; p99: number; maximo: number };
  conexoes: number;
  jogadores: number;
  salas: AdminSala[];
  recusas: { total: number; ip: number; taxa: number };
  /** Tráfego do servidor na última amostra (KB/s, somando todos). */
  redeKBs: { saida: number; entrada: number };
  /** Contas de piloto cadastradas (`null` = o banco não respondeu). */
  contas: number | null;
  reiniciando: boolean;
}

export interface AdminAmostra {
  /** Segundos desde 1970. */
  t: number;
  jogadores: number;
  salas: number;
  /** O pior tick médio entre as salas (ms). */
  tickMs: number;
  rssMB: number;
  cpuPct: number;
  saidaKBs: number;
  /** O p99 do atraso do laço nesta amostra (ms). */
  lacoMs: number;
}

export interface AdminHistorico {
  passoS: number;
  amostras: AdminAmostra[];
}

export interface AdminLog {
  /** `arquivo`: o `servidor.log` da tarefa (tudo o que o servidor escreveu); `memoria`: só o que o servidor guardou desde que subiu. */
  fonte: 'arquivo' | 'memoria';
  linhas: string[];
}

export type Resultado = 'ok' | 'atencao' | 'falha';
export type Veredito = 'apto' | 'atencao' | 'problema';

/** Uma conferência: o que foi medido, contra o quê, e se passou. */
export interface Checagem {
  nome: string;
  valor: string;
  limite: string;
  resultado: Resultado;
  /** Uma frase, quando não passou: o que fazer. */
  dica?: string;
}

export interface AdminAvaliacao {
  veredito: Veredito;
  /** Uma frase para o topo do cartão. */
  resumo: string;
  /** A janela olhada (s): menos que a hora cheia logo depois de o servidor subir. */
  janelaS: number;
  checagens: Checagem[];
  /** O que o servidor de casa aguenta, pelo que foi medido (estimativa, não promessa: `CAPACIDADE.md`). */
  capacidade: { salasPorTick: number; jogadoresPorSala: number; jogadoresSimultaneos: number };
}

export interface AdminTeste {
  ok: boolean;
  duracaoS: number;
  /** Clientes de mentira que entraram de verdade pela porta do jogo. */
  clientes: number;
  checagens: Checagem[];
}

export interface AdminReiniciar {
  ok: true;
  /** Em quantos segundos o servidor sai (dá tempo de a resposta chegar). */
  emS: number;
  /** `supervisionado`: a tarefa do Windows o religa; `sozinho`: ele só desliga (rodando à mão, ninguém o religa). */
  religa: 'supervisionado' | 'sozinho';
}

export interface AdminErro {
  erro: string;
  /** Quando a recusa é por haver gente jogando. */
  jogadores?: number;
}

// ─── Leitura: o cliente só aceita o que está no contrato ─────────────────────────────────────────────────────────────

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const texto = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const objeto = (v: unknown): Record<string, unknown> | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Lê o estado. Qualquer coisa fora do contrato vira `null`: para a tela, "sem resposta", nunca um número inventado. */
export function lerEstado(raw: unknown): AdminEstado | null {
  const r = objeto(raw);
  if (!r) return null;
  const mem = objeto(r.memoria);
  const laco = objeto(r.lacoMs);
  const rec = objeto(r.recusas);
  const rede = objeto(r.redeKBs);
  const salas = Array.isArray(r.salas) ? r.salas.map(lerSala) : null;
  const campos = [num(r.protocolo), num(r.uptimeS), num(r.porta), num(r.cpuPct), num(r.conexoes), num(r.jogadores), num(mem?.rssMB), num(mem?.heapMB), num(laco?.medio), num(laco?.p99), num(laco?.maximo), num(rec?.total), num(rec?.ip), num(rec?.taxa), num(rede?.saida), num(rede?.entrada)];
  if (campos.some((c) => c === null) || !salas || salas.some((s) => s === null)) return null;
  const [protocolo, uptimeS, porta, cpuPct, conexoes, jogadores, rssMB, heapMB, medio, p99, maximo, total, ip, taxa, saida, entrada] = campos as number[];
  const release = texto(r.release);
  const iniciadoEm = texto(r.iniciadoEm);
  const node = texto(r.node);
  const plataforma = texto(r.plataforma);
  if (release === null || iniciadoEm === null || node === null || plataforma === null) return null;
  return {
    protocolo: protocolo!, release, iniciadoEm, uptimeS: uptimeS!, node, plataforma, porta: porta!,
    supervisionado: r.supervisionado === true,
    memoria: { rssMB: rssMB!, heapMB: heapMB! },
    cpuPct: cpuPct!,
    lacoMs: { medio: medio!, p99: p99!, maximo: maximo! },
    conexoes: conexoes!, jogadores: jogadores!,
    salas: salas as AdminSala[],
    recusas: { total: total!, ip: ip!, taxa: taxa! },
    redeKBs: { saida: saida!, entrada: entrada! },
    contas: num(r.contas),
    reiniciando: r.reiniciando === true,
  };
}

function lerSala(raw: unknown): AdminSala | null {
  const r = objeto(raw);
  if (!r) return null;
  const codigo = texto(r.codigo);
  const n = [num(r.jogadores), num(r.bots), num(r.tick), num(r.tickMs), num(r.rodada), num(r.restanteS)];
  if (codigo === null || n.some((x) => x === null) || !Array.isArray(r.nomes) || r.nomes.some((x) => typeof x !== 'string')) return null;
  const [jogadores, bots, tick, tickMs, rodada, restanteS] = n as number[];
  return { codigo, jogadores: jogadores!, bots: bots!, tick: tick!, tickMs: tickMs!, rodada: rodada!, restanteS: restanteS!, jogando: r.jogando === true, nomes: r.nomes as string[] };
}

export function lerHistorico(raw: unknown): AdminHistorico | null {
  const r = objeto(raw);
  const passoS = num(r?.passoS);
  if (!r || passoS === null || !Array.isArray(r.amostras)) return null;
  const amostras: AdminAmostra[] = [];
  for (const a of r.amostras) {
    const o = objeto(a);
    const n = [num(o?.t), num(o?.jogadores), num(o?.salas), num(o?.tickMs), num(o?.rssMB), num(o?.cpuPct), num(o?.saidaKBs), num(o?.lacoMs)];
    if (!o || n.some((x) => x === null)) return null;
    const [t, jogadores, salas, tickMs, rssMB, cpuPct, saidaKBs, lacoMs] = n as number[];
    amostras.push({ t: t!, jogadores: jogadores!, salas: salas!, tickMs: tickMs!, rssMB: rssMB!, cpuPct: cpuPct!, saidaKBs: saidaKBs!, lacoMs: lacoMs! });
  }
  return { passoS, amostras };
}

export function lerLog(raw: unknown): AdminLog | null {
  const r = objeto(raw);
  if (!r || (r.fonte !== 'arquivo' && r.fonte !== 'memoria') || !Array.isArray(r.linhas) || r.linhas.some((l) => typeof l !== 'string')) return null;
  return { fonte: r.fonte, linhas: r.linhas as string[] };
}

function lerChecagens(raw: unknown): Checagem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Checagem[] = [];
  for (const c of raw) {
    const o = objeto(c);
    const nome = texto(o?.nome);
    const valor = texto(o?.valor);
    const limite = texto(o?.limite);
    if (!o || nome === null || valor === null || limite === null || (o.resultado !== 'ok' && o.resultado !== 'atencao' && o.resultado !== 'falha')) return null;
    out.push({ nome, valor, limite, resultado: o.resultado, ...(typeof o.dica === 'string' ? { dica: o.dica } : {}) });
  }
  return out;
}

export function lerAvaliacao(raw: unknown): AdminAvaliacao | null {
  const r = objeto(raw);
  const cap = objeto(r?.capacidade);
  const checagens = lerChecagens(r?.checagens);
  const resumo = texto(r?.resumo);
  const n = [num(r?.janelaS), num(cap?.salasPorTick), num(cap?.jogadoresPorSala), num(cap?.jogadoresSimultaneos)];
  if (!r || !checagens || resumo === null || n.some((x) => x === null) || (r.veredito !== 'apto' && r.veredito !== 'atencao' && r.veredito !== 'problema')) return null;
  const [janelaS, salasPorTick, jogadoresPorSala, jogadoresSimultaneos] = n as number[];
  return { veredito: r.veredito, resumo, janelaS: janelaS!, checagens, capacidade: { salasPorTick: salasPorTick!, jogadoresPorSala: jogadoresPorSala!, jogadoresSimultaneos: jogadoresSimultaneos! } };
}

export function lerTeste(raw: unknown): AdminTeste | null {
  const r = objeto(raw);
  const checagens = lerChecagens(r?.checagens);
  const n = [num(r?.duracaoS), num(r?.clientes)];
  if (!r || !checagens || n.some((x) => x === null) || typeof r.ok !== 'boolean') return null;
  return { ok: r.ok, duracaoS: n[0]!, clientes: n[1]!, checagens };
}

export function lerErro(raw: unknown): AdminErro | null {
  const r = objeto(raw);
  const erro = texto(r?.erro);
  if (!r || erro === null) return null;
  const jogadores = num(r.jogadores);
  return jogadores === null ? { erro } : { erro, jogadores };
}
