import type { MapId } from '../environment/Bunker';

/** Os mapas que o seletor oferece, na ordem em que aparecem. */
export const MAPS: readonly { id: MapId; label: string; hint: string }[] = [
  { id: 'arena', label: 'ARENA', hint: 'A cidade neon' },
  { id: 'bunker', label: 'BUNKER', hint: 'Mapa de quatro andares, treino offline contra bots (sai da sala online)' },
  { id: 'praia', label: 'PRAIA DOS CABOS', hint: 'A orla de Fortaleza: porto, Ponte Metálica e a estação de cabos (offline, sai da sala online)' },
];

/**
 * Os mapas que só existem offline, no Deathmatch (`mapFromSearch`): o Bunker e a Praia. Quem escolhe um deles sai da sala online e do modo
 * atual para o treino livre do mapa.
 */
const MAPAS_SO_OFFLINE: ReadonlySet<MapId> = new Set<MapId>(['bunker', 'praia']);

/**
 * O endereço que leva ao mapa `destino`. O Bunker e a Praia só existem offline e no Deathmatch, então o link tira `sala`, `servidor` e `modo`:
 * quem escolhe um deles sai da sala online / do modo atual para o treino. Para a Arena, só some o `mapa`.
 */
export function mapHref(href: string, destino: MapId): string {
  const url = new URL(href);
  if (MAPAS_SO_OFFLINE.has(destino)) {
    url.searchParams.delete('sala');
    url.searchParams.delete('servidor');
    url.searchParams.delete('modo');
    url.searchParams.set('mapa', destino);
  } else url.searchParams.delete('mapa');
  return url.href;
}
