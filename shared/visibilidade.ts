/**
 * O CONTRATO DA VISIBILIDADE (P191, `PAINEL_ADMIN.md` § 6): o que os jogadores normais veem no jogo (fases, modos, robôs, armas, botões e telas) e o que fica **restrito ao admin**, em teste, até o
 * Comandante liberar. O servidor guarda só as **exceções ao padrão do código** (id → estado) e entrega a todo cliente (`GET /visibilidade`, sem token: é o que o jogo pergunta ao abrir); só o dono
 * grava (`POST /admin/visibilidade`, com a chave dele). **Não é segurança:** esconde a interface de quem joga, não protege o recurso (quem ligar o modo Comandante vê tudo).
 */
export type EstadoDeVisibilidade = 'publico' | 'restrito';

export const VISIBILIDADE_PATH = '/visibilidade';
export const ADMIN_VISIBILIDADE_PATH = '/admin/visibilidade';

/** O id de uma funcionalidade: `grupo:nome` em minúsculas (ex.: `mapa:amazonia`, `chassi:marauder`, `tela:arquivo`). */
export const ID_DE_FUNCIONALIDADE = /^[a-z0-9][a-z0-9:._-]{0,47}$/;
/** Quantas exceções o servidor aceita (o jogo tem algumas dezenas de funcionalidades). */
export const MAX_FUNCIONALIDADES = 400;

export interface ConfigDeVisibilidade {
  /** Sobe a cada gravação (o cliente guarda a última que viu). */
  versao: number;
  /** Só as exceções ao padrão do código. */
  itens: Record<string, EstadoDeVisibilidade>;
}

export const configVazia = (): ConfigDeVisibilidade => ({ versao: 0, itens: {} });

/** Lê um objeto `id → estado` de fora (corpo de requisição, arquivo, cache): só passam ids válidos com um estado conhecido. `null` se o formato inteiro é inválido ou excede o teto. */
export function normalizarItens(x: unknown): Record<string, EstadoDeVisibilidade> | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const entradas = Object.entries(x as Record<string, unknown>);
  if (entradas.length > MAX_FUNCIONALIDADES) return null;
  const itens: Record<string, EstadoDeVisibilidade> = {};
  for (const [id, estado] of entradas) {
    if (!ID_DE_FUNCIONALIDADE.test(id) || (estado !== 'publico' && estado !== 'restrito')) continue;
    itens[id] = estado;
  }
  return itens;
}

/** Lê a configuração inteira de fora, com tolerância: o que não presta vira a configuração vazia (o jogo cai nos padrões do código). */
export function lerConfig(x: unknown): ConfigDeVisibilidade {
  const c = x as { versao?: unknown; itens?: unknown } | null;
  const itens = normalizarItens(c?.itens);
  if (!itens) return configVazia();
  return { versao: Number.isInteger(c?.versao) && (c!.versao as number) >= 0 ? (c!.versao as number) : 0, itens };
}
