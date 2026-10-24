/**
 * O CONTRATO DOS TELÕES (P246, `GAME_DESIGN.md` § HORIZONTE): os painéis de vídeo nos prédios da Cidade Neon. O servidor guarda só **qual arquivo de uma lista permitida** toca em cada tela (ou
 * nenhum: desligada/sem sinal). `GET /telao` é público (o jogo pergunta ao montar a Cidade Neon); só o dono grava (`POST /admin/telao`). **Nunca uma URL livre**: o Comandante escolhe de uma lista
 * (`ARQUIVOS_DE_TELAO`), nunca digita um endereço — assim nenhuma gravação aponta para fora do site por engano.
 */
export type IdDeTelao = string;

/**
 * O que toca numa tela (P254): um **vídeo** (um nome de `ARQUIVOS_DE_TELAO`, nunca uma URL livre) ou a **câmera ao
 * vivo** daquela tela (a própria partida, redesenhada numa câmera de segurança fixa — sem arquivo nenhum, mas com
 * custo de GPU por quadro redesenhado, diferente do vídeo, que só decodifica: `ArenaTelao.ts` explica o porquê).
 */
export type TelaoItem = { tipo: 'video'; readonly arquivo: string; readonly titulo?: string } | { tipo: 'camera' };

export interface ConfigDeTelao {
  /** Sobe a cada gravação (o cliente guarda a última que viu, mesma ideia de `shared/visibilidade.ts`). */
  versao: number;
  /** Por tela: o item, ou `null` (desligada/sem sinal). Uma tela ausente daqui também é "sem sinal". */
  itens: Record<IdDeTelao, TelaoItem | null>;
}

export const TELAO_PATH = '/telao';
export const ADMIN_TELAO_PATH = '/admin/telao';

/** As telas da Cidade Neon (v1: só esta fase, só estas duas — crescer aqui é crescer o layout em `ArenaLayout.ts` junto). */
export const TELOES_DA_ARENA: readonly IdDeTelao[] = ['arena:telao-1', 'arena:telao-2'];

/**
 * Os vídeos que o painel pode escolher: cresce por PR, quando um arquivo novo entra em `client/public/telao/`. **Vazio por ora** — ainda não há
 * nenhum vídeo no site; o painel mostra "sem vídeo disponível" até o primeiro PR trazer um arquivo e uma linha aqui.
 */
export const ARQUIVOS_DE_TELAO: readonly string[] = [];

/** Quantas telas o servidor aceita por gravação (hoje só 2; a folga é para crescer sem precisar mudar o validador). */
export const MAX_TELOES = 20;

export const configVaziaDeTelao = (): ConfigDeTelao => ({ versao: 0, itens: {} });

function normalizarItem(x: unknown, arquivosPermitidos: readonly string[]): TelaoItem | null | undefined {
  if (x === null) return null; // desligada: válida
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined; // formato inválido: a tela inteira é recusada
  const o = x as { tipo?: unknown; arquivo?: unknown; titulo?: unknown };
  if (o.tipo === 'camera') return { tipo: 'camera' };
  if (o.tipo !== 'video') return undefined;
  if (typeof o.arquivo !== 'string' || !arquivosPermitidos.includes(o.arquivo)) return undefined;
  const titulo = typeof o.titulo === 'string' && o.titulo.trim() ? o.titulo.trim().slice(0, 80) : undefined;
  return titulo ? { tipo: 'video', arquivo: o.arquivo, titulo } : { tipo: 'video', arquivo: o.arquivo };
}

/**
 * Lê um objeto `id → item|null` de fora: só passam ids de `TELOES_DA_ARENA` com um item válido (um `arquivo` de `arquivosPermitidos`, ou `null` para desligar). `null` se o formato inteiro é
 * inválido ou excede o teto. `arquivosPermitidos` tem o padrão de produção (`ARQUIVOS_DE_TELAO`); os testes passam a própria lista, sem depender do que está em produção.
 */
export function normalizarItensDeTelao(x: unknown, arquivosPermitidos: readonly string[] = ARQUIVOS_DE_TELAO): Record<IdDeTelao, TelaoItem | null> | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const entradas = Object.entries(x as Record<string, unknown>);
  if (entradas.length > MAX_TELOES) return null;
  const itens: Record<IdDeTelao, TelaoItem | null> = {};
  for (const [id, valor] of entradas) {
    if (!TELOES_DA_ARENA.includes(id)) continue;
    const item = normalizarItem(valor, arquivosPermitidos);
    if (item !== undefined) itens[id] = item;
  }
  return itens;
}

/** Lê a configuração inteira de fora, com tolerância: o que não presta vira a configuração vazia (todas as telas sem sinal). */
export function lerConfigDeTelao(x: unknown, arquivosPermitidos: readonly string[] = ARQUIVOS_DE_TELAO): ConfigDeTelao {
  const c = x as { versao?: unknown; itens?: unknown } | null;
  const itens = normalizarItensDeTelao(c?.itens, arquivosPermitidos);
  if (!itens) return configVaziaDeTelao();
  return { versao: Number.isInteger(c?.versao) && (c!.versao as number) >= 0 ? (c!.versao as number) : 0, itens };
}
