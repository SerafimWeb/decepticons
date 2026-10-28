/**
 * O CONTRATO DOS OUTDOORS DA MARCA (P267, `.decepticons/MARCA_E_ANUNCIOS.md`): o que o Comandante ajusta nos outdoors da Cidade Neon — **quantos aparecem**, **de quanto em quanto tempo cada um troca de
 * imagem** e **quais anúncios entram na troca**. O servidor guarda só esses três números/listas (nunca uma imagem nem um endereço); `GET /outdoors` é público (o jogo pergunta ao montar a cidade) e só o dono
 * grava (`POST /admin/outdoors`, com a chave dele). Mesmo molde de `shared/telao.ts` e `shared/visibilidade.ts`. Sem dependência do cliente: o servidor valida com o mesmo código que o jogo usa para ler.
 */

export const OUTDOORS_PATH = '/outdoors';
export const ADMIN_OUTDOORS_PATH = '/admin/outdoors';

/**
 * Os anúncios que **alternam** nos outdoors e que o painel liga e desliga. A logo plana não entra: ela é fixa (a marca, sem troca). São os mesmos ids de `client/src/brand/anuncios.ts`
 * (`brand/anuncios.test.ts` confere que as duas listas andam juntas).
 */
export const ANUNCIOS_QUE_ALTERNAM = ['odp-olho', 'odp-gps', 'odp-ping', 'odp-sos', 'odp-familia', 'swb'] as const;
export type AnuncioQueAlterna = (typeof ANUNCIOS_QUE_ALTERNAM)[number];

/** Quantos outdoors o servidor aceita pedir (o layout de hoje tem 40; a folga é para crescer sem mudar o validador). */
export const OUTDOORS_MAXIMO = 64;
/** De quanto em quanto tempo cada outdoor troca de imagem (s): o Comandante pediu "a cada 10 ou 15 segundos". */
export const PERIODO_MINIMO = 5;
export const PERIODO_MAXIMO = 30;

export interface ParametrosDeOutdoors {
  /** Quantos outdoors aparecem (as logos planas contam; os maiores ficam por último a sair). */
  quantidade: number;
  /** O tempo de cada imagem (s). */
  periodo: number;
  /** Os anúncios de `ANUNCIOS_QUE_ALTERNAM` que ficam **fora** da troca (só as exceções: um anúncio novo entra ligado). */
  desligados: readonly string[];
}

export interface ConfigDeOutdoors extends ParametrosDeOutdoors {
  /** Sobe a cada gravação (o cliente guarda a última que viu, mesma ideia de `shared/visibilidade.ts`). */
  versao: number;
}

/** O que vale enquanto o Comandante não gravou nada: menos de dois terços dos outdoors (ele achou a cidade "meio poluída" com os 40) e a troca a cada 12 s. */
export const PARAMETROS_PADRAO: ParametrosDeOutdoors = Object.freeze({ quantidade: 26, periodo: 12, desligados: Object.freeze([] as string[]) });

export const configPadraoDeOutdoors = (): ConfigDeOutdoors => ({ versao: 0, quantidade: PARAMETROS_PADRAO.quantidade, periodo: PARAMETROS_PADRAO.periodo, desligados: [] });

/**
 * Lê os parâmetros de fora (corpo de requisição, arquivo): `null` se algum número está fora do que o painel oferece ou se a lista de desligados deixaria **nenhum** anúncio na troca (o outdoor ficaria
 * sem o que mostrar). Ids que não existem são ignorados (um painel antigo não derruba a gravação); o período vai para o meio segundo mais próximo.
 */
export function normalizarParametros(x: unknown): ParametrosDeOutdoors | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as { quantidade?: unknown; periodo?: unknown; desligados?: unknown };
  if (typeof o.quantidade !== 'number' || !Number.isInteger(o.quantidade) || o.quantidade < 0 || o.quantidade > OUTDOORS_MAXIMO) return null;
  if (typeof o.periodo !== 'number' || !Number.isFinite(o.periodo) || o.periodo < PERIODO_MINIMO || o.periodo > PERIODO_MAXIMO) return null;
  if (!Array.isArray(o.desligados) || o.desligados.length > 32) return null;
  const desligados = [...new Set(o.desligados.filter((d): d is string => typeof d === 'string' && (ANUNCIOS_QUE_ALTERNAM as readonly string[]).includes(d)))];
  if (desligados.length >= ANUNCIOS_QUE_ALTERNAM.length) return null;
  return { quantidade: o.quantidade, periodo: Math.round(o.periodo * 2) / 2, desligados };
}

/** Lê a configuração inteira de fora, com tolerância: o que não presta vira a configuração padrão (o jogo cai nos valores do código). */
export function lerConfigDeOutdoors(x: unknown): ConfigDeOutdoors {
  const p = normalizarParametros(x);
  if (!p) return configPadraoDeOutdoors();
  const versao = (x as { versao?: unknown }).versao;
  return { versao: Number.isInteger(versao) && (versao as number) >= 0 ? (versao as number) : 0, ...p };
}
