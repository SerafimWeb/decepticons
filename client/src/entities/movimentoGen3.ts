import type { Geracao3 } from './geracao3';

/**
 * O interruptor da geração 3 do movimento dos Mechs (P321, catálogo `mech:gen3`; nasceu restrito e foi liberado em 07/11, P330) e o carregador do código dela.
 *
 * O código (`geracao3.ts`: a passada com o pé plantado, as molas e os ajustes) é um pedaço **sob demanda** (2,4 KB gzip): baixa logo depois
 * da partida, fora dos 500 KB do pacote de partida (que está no teto; o `smoke` conta só o de partida). Desligada (o painel de visibilidade a restringe), ou enquanto o pedaço ainda não chegou, cada Mech anda como
 * antes, byte a byte. O `Game` liga e desliga pelo painel de visibilidade; o `MechBase` pergunta `geracao3()` a cada quadro.
 */
let ligado = false;
let modulo: Geracao3 | null = null;
let carregando: Promise<Geracao3> | null = null;

/** Carrega o código da geração 3 (uma vez) e o devolve. A bancada, o Estúdio e os testes esperam por ele. */
export function carregarGeracao3(): Promise<Geracao3> {
  return (carregando ??= import('./geracao3').then((m) => (modulo = m.GERACAO3)));
}

/** O código da geração 3, ou `null` quando ela está desligada ou ainda não chegou (aí o Mech anda como antes). Não aloca. */
export const geracao3 = (): Geracao3 | null => (ligado ? modulo : null);

/** Liga ou desliga a geração 3. Ligar começa a baixar o pedaço sob demanda (falha de rede: segue na geração 2, sem barulho). */
export function setMovimentoGen3(valor: boolean): void {
  ligado = valor;
  if (valor) carregarGeracao3().catch(() => (carregando = null)); // falha de rede: a próxima tentativa recarrega
}
