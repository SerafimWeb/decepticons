import type { MapId } from '../environment/Bunker';

/** Escolha fria de mapa; recarrega a partida sem manter duas cenas na memória. */
export function attachMapLinks(parent: HTMLElement | null, map: MapId, enabled: boolean): void {
  if (!parent || !enabled) return;
  const link = document.createElement('a');
  const url = new URL(location.href);
  url.searchParams.delete('sala'); url.searchParams.delete('servidor');
  if (map === 'arena') url.searchParams.set('mapa', 'bunker');
  else url.searchParams.delete('mapa');
  link.href = url.href;
  link.textContent = map === 'arena' ? '[ EXPLORAR BUNKER // 3 ANDARES ]' : '[ VOLTAR À ARENA ]';
  link.style.cssText = 'display:block;padding:10px;color:#7de2ed;font:14px monospace;text-align:center';
  parent.appendChild(link);
}
