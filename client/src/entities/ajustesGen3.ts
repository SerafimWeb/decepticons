import dados from './movimentoGen3.json';
import { PASSADA_PADRAO, type AjustesDaPassada } from './passadaGen3';

/**
 * Os ajustes de gosto da geração 3 do movimento (P321), num dado (`movimentoGen3.json`): o Comandante os mexe ao olho no Estúdio (aba
 * MECHS 3D) e o jogo os lê no build. Cada valor é preso numa faixa segura (`FAIXAS`): nenhum número do arquivo, por errado que seja,
 * quebra o jogo. O teste cobra a estrutura (as chaves existem e estão em faixa), nunca o gosto.
 *
 * Este módulo faz parte do pedaço **sob demanda** da geração 3 (`geracao3.ts`): fora do pacote de partida.
 */
export interface AjustesDoMovimento extends AjustesDaPassada {
  /** Quanto o tronco inclina ao arrancar e frear, no máximo (graus). */
  readonly inclinacaoDoTronco: number;
  /** Quanto a pelve afunda ao pousar, por m/s de velocidade de queda (a mola da pelve recebe esse tranco). */
  readonly amortecimentoDoPouso: number;
  /** Rigidez das molas do corpo (1 = a do projeto): mais = mais seco, menos = mais mole. */
  readonly rigidez: number;
  /** Amortecimento das molas (1 = o do projeto): menos = balança mais depois do tranco, mais = assenta sem passar do ponto. */
  readonly amortecimento: number;
}

/** A faixa segura de cada ajuste: [mínimo, máximo]. */
export const FAIXAS: Readonly<Record<keyof AjustesDoMovimento, readonly [number, number]>> = {
  ciclosMax: [0.6, 3],
  agachamento: [0, 0.25],
  molejoDoPasso: [0, 0.12],
  inclinacaoDoTronco: [0, 8],
  amortecimentoDoPouso: [0, 0.3],
  rigidez: [0.5, 2],
  amortecimento: [0.3, 2],
};

/** Os valores de projeto: o que vale quando o arquivo não diz (e o ponto de partida do Estúdio). */
export const PADRAO_GEN3: Readonly<AjustesDoMovimento> = {
  ...PASSADA_PADRAO,
  inclinacaoDoTronco: 4,
  amortecimentoDoPouso: 0.12,
  rigidez: 1,
  amortecimento: 1,
};

const CHAVES = Object.keys(FAIXAS) as (keyof AjustesDoMovimento)[];

/** Prende cada valor na faixa e troca o que não é número pelo padrão. Devolve sempre um objeto completo e novo. */
export function validarAjustes(entrada: unknown): AjustesDoMovimento {
  const lido = (typeof entrada === 'object' && entrada !== null ? entrada : {}) as Record<string, unknown>;
  const saida = { ...PADRAO_GEN3 } as Record<keyof AjustesDoMovimento, number>;
  for (const k of CHAVES) {
    const v = lido[k];
    if (typeof v === 'number' && Number.isFinite(v)) saida[k] = Math.min(FAIXAS[k][1], Math.max(FAIXAS[k][0], v));
  }
  return saida;
}

let ajustes: AjustesDoMovimento = validarAjustes(dados);

/** Os ajustes de agora (o arquivo validado, ou o que o Estúdio mexeu na prévia). Não aloca. */
export const ajustesGen3 = (): AjustesDoMovimento => ajustes;

/** Troca ajustes (a prévia do Estúdio; o jogo usa o arquivo). Valores fora da faixa são presos. */
export function definirAjustesGen3(parcial: Partial<AjustesDoMovimento>): void {
  ajustes = validarAjustes({ ...ajustes, ...parcial });
}
