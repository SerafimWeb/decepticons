import type { MapId } from '../environment/Bunker';
import { padraoDe } from './funcionalidades';
import { funcionalidadeVisivel } from './Visibilidade';

/**
 * Os mapas do lançamento (ordem P197, 18/10): **só a CIDADE NEON (a Arena) e a ESTAÇÃO DOS CABOS (a Praia dos Cabos) ficam livres ao público.** O Bunker e a TERRAS RARAS (a Amazônia) ficam "EM BREVE".
 * **Quem decide agora é o painel de visibilidade (P191, `PAINEL_ADMIN.md` § 6):** o padrão de cada mapa mora no catálogo (`funcionalidades.ts`, `mapa:*`) e o Comandante libera ou segura um mapa no painel,
 * **sem mexer no código** (o servidor guarda a exceção e todo jogador a recebe ao abrir). O modo Comandante (`?comandante=1`) abre todos, para o dono continuar testando.
 *
 * **Isto é produto, não segurança:** o jogo roda no navegador de quem joga, então quem sabe mexer na barra de endereço (`?comandante=1`) abre tudo. O que o bloqueio garante é que **ninguém esbarra** num mapa
 * que ainda não foi anunciado: o seletor, os links e as campanhas só levam aos liberados, e um link para um mapa fechado cai na Cidade Neon. Sem a visibilidade criada (os testes e as bancadas), tudo está aberto.
 */
export const TODOS_OS_MAPAS: readonly MapId[] = ['arena', 'bunker', 'praia', 'amazonia'];
/** Os mapas abertos ao público **por padrão** (o catálogo): o que o painel não mudou. */
export const MAPAS_DO_LANCAMENTO: readonly MapId[] = TODOS_OS_MAPAS.filter((id) => padraoDe(`mapa:${id}`) === 'publico');

/** Este mapa está aberto agora (o catálogo e o que o Comandante mexeu no painel)? */
export function mapaLiberado(id: MapId): boolean {
  return funcionalidadeVisivel(`mapa:${id}`);
}
