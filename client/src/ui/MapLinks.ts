import type { MapId } from '../environment/Bunker';

/**
 * O endereço que leva ao outro mapa. O Bunker só existe offline e no Deathmatch (`mapFromSearch`), então o link tira `sala`, `servidor` e `modo`:
 * quem clica sai da sala online / do modo atual para o treino no Bunker. De volta, só some o `mapa`.
 */
export function mapHref(href: string, map: MapId): string {
  const url = new URL(href);
  url.searchParams.delete('sala');
  url.searchParams.delete('servidor');
  url.searchParams.delete('modo');
  if (map === 'arena') url.searchParams.set('mapa', 'bunker');
  else url.searchParams.delete('mapa');
  return url.href;
}

/**
 * Escolha fria de mapa; recarrega a partida sem manter duas cenas na memória.
 * É um botão do mesmo estilo do "ABRIR HANGAR", logo abaixo dele (em 10/10 o dono não achou o link azul pequeno no fim da tela).
 * Aparece em qualquer modo, inclusive online: clicar leva ao treino offline no Bunker (o `title` avisa).
 */
export function attachMapLinks(parent: HTMLElement | null, map: MapId): void {
  if (!parent || parent.querySelector('#btn-map')) return;
  const link = document.createElement('a');
  link.id = 'btn-map';
  link.className = 'btn-terminal';
  link.href = mapHref(location.href, map);
  link.textContent = map === 'arena' ? '[ EXPLORAR O BUNKER ]' : '[ VOLTAR À ARENA ]';
  link.title = map === 'arena' ? 'Mapa de 3 andares, treino offline contra bots (sai da sala online)' : 'Volta à arena';
  const depoisDe = parent.querySelector('#btn-hangar');
  if (depoisDe) depoisDe.after(link);
  else parent.appendChild(link);
}
