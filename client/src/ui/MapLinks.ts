import type { MapId } from '../environment/Bunker';

/** Os mapas que o seletor oferece, na ordem em que aparecem. */
export const MAPS: readonly { id: MapId; label: string; hint: string }[] = [
  { id: 'arena', label: 'ARENA', hint: 'A cidade neon' },
  { id: 'bunker', label: 'BUNKER', hint: 'Mapa de 3 andares, treino offline contra bots (sai da sala online)' },
];

/**
 * O endereço que leva ao mapa `destino`. O Bunker só existe offline e no Deathmatch (`mapFromSearch`), então o link tira `sala`, `servidor` e `modo`:
 * quem escolhe o Bunker sai da sala online / do modo atual para o treino. Para a Arena, só some o `mapa`.
 */
export function mapHref(href: string, destino: MapId): string {
  const url = new URL(href);
  if (destino === 'bunker') {
    url.searchParams.delete('sala');
    url.searchParams.delete('servidor');
    url.searchParams.delete('modo');
    url.searchParams.set('mapa', 'bunker');
  } else url.searchParams.delete('mapa');
  return url.href;
}
