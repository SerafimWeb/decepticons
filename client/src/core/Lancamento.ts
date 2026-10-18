import type { MapId } from '../environment/Bunker';

/**
 * Os mapas do lançamento (ordem P197, 18/10): **só a CIDADE NEON (a Arena) e a ESTAÇÃO DOS CABOS (a Praia dos Cabos) ficam livres ao público.** O Bunker e a TERRAS RARAS (a Amazônia) ficam
 * "EM BREVE" e se liberam depois **acrescentando o id a `MAPAS_DO_LANCAMENTO`** (uma linha; nada mais muda). O modo Comandante (`?comandante=1`) abre todos, para o dono continuar testando.
 *
 * **Isto é produto, não segurança:** o jogo roda no navegador de quem joga, então quem sabe mexer na barra de endereço (`?comandante=1`) abre tudo. O que o bloqueio garante é que **ninguém
 * esbarra** num mapa que ainda não foi anunciado: o seletor, os links e as campanhas só levam aos liberados, e um link para um mapa fechado cai na Cidade Neon.
 *
 * O estado é um só e fica neste módulo: **padrão tudo aberto** (os testes e as ferramentas de bancada não precisam saber de lançamento), e o jogo chama `aplicarLancamento` uma vez, na largada.
 */
export const TODOS_OS_MAPAS: readonly MapId[] = ['arena', 'bunker', 'praia', 'amazonia'];
export const MAPAS_DO_LANCAMENTO: readonly MapId[] = ['arena', 'praia'];

let liberados: readonly MapId[] = TODOS_OS_MAPAS;

/** O jogo liga o lançamento na largada: o público vê `MAPAS_DO_LANCAMENTO`; o Comandante vê todos. */
export function aplicarLancamento(comandante: boolean): void {
  liberados = comandante ? TODOS_OS_MAPAS : MAPAS_DO_LANCAMENTO;
}

/** Este mapa está aberto agora? */
export function mapaLiberado(id: MapId): boolean {
  return liberados.includes(id);
}
