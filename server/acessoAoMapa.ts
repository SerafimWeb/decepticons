import { padraoDe } from '../client/src/core/funcionalidades';
import type { MapaOnline } from '../shared/net/mapa';
import type { EstadoDeVisibilidade } from '../shared/visibilidade';

/**
 * O MAPA ESTÁ RESTRITO? (P226, pacote A0): o que decide é o mesmo que decide a vitrine do jogo: **a exceção que o Comandante gravou no painel, senão o padrão do catálogo** (`core/funcionalidades.ts`,
 * `mapa:*`). Mapa restrito só abre para a conta de administrador, que prova isso ao servidor com a `CREDENCIAL` (`shared/net/credencial.ts`). Pura: o servidor a chama a cada conexão (um acesso a
 * objeto; custo desprezível).
 */
export function mapaRestrito(mapa: MapaOnline, itens: Readonly<Record<string, EstadoDeVisibilidade>>): boolean {
  const id = `mapa:${mapa}`;
  return (itens[id] ?? padraoDe(id)) === 'restrito';
}
