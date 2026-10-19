import type { MapId } from '../environment/Bunker';

/** Os mapas que o seletor oferece, na ordem em que aparecem. */
export const MAPS: readonly { id: MapId; label: string; hint: string }[] = [
  { id: 'arena', label: 'ARENA', hint: 'A cidade neon' },
  { id: 'bunker', label: 'BUNKER', hint: 'Mapa de quatro andares, contra bots ou online' },
  { id: 'praia', label: 'PRAIA DOS CABOS', hint: 'A orla de Fortaleza: porto, Ponte Metálica e a estação de cabos' },
  { id: 'amazonia', label: 'AMAZÔNIA · TERRAS RARAS', hint: 'A missão do rio: derrube o Draga-01 antes que ele chegue à aldeia, em 2,4 km de floresta e rio (online: só o Deathmatch)' },
  { id: 'janeiro', label: '8 DE JANEIRO', hint: 'A Praça dos Três Poderes, em Brasília: a Esplanada, o Congresso, o Planalto e o Supremo (em construção)' },
];

/**
 * O endereço que leva ao mapa `destino`. **Online (com `sala`)** todo mapa vale (P218, etapa O1): o link troca só o `mapa` e fica na sala (o servidor tem uma sala por código e por mapa), no Deathmatch, que é o
 * modo online de hoje (`modo` sai). **Offline**, os mapas que não são a Arena tiram o `modo` do jogo atual: o Bunker e a Praia abrem no treino livre e a Amazônia (P180), na missão do rio.
 */
export function mapHref(href: string, destino: MapId): string {
  const url = new URL(href);
  const online = url.searchParams.has('sala');
  if (destino === 'arena') url.searchParams.delete('mapa');
  else url.searchParams.set('mapa', destino);
  if (online) url.searchParams.delete('modo');
  else if (destino !== 'arena') {
    url.searchParams.delete('modo');
    // A Amazônia (P180) é a missão do rio: o link leva direto a ela (o Deathmatch do mapa é escolha do seletor de modo).
    if (destino === 'amazonia') url.searchParams.set('modo', 'survival');
  }
  return url.href;
}
