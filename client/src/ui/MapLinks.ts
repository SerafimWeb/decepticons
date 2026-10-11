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

/**
 * A linha "MAPA  [ARENA] [BUNKER]" da pausa, logo abaixo do modo (em 10/10 o dono não achava o link azul do Bunker; depois o botão extra repetia a função
 * do seletor). O mapa atual é o botão aceso; o outro é um link que recarrega a partida sem manter duas cenas na memória.
 * `visible` = false (Sobrevivência, CTF) não desenha nada: o Bunker é só do Deathmatch.
 */
export function attachMapLinks(parent: HTMLElement | null, atual: MapId, visible = true): void {
  if (!parent || !visible || parent.querySelector('#map-row')) return;
  const row = document.createElement('div');
  row.id = 'map-row';
  row.className = 'menu-row';
  const label = document.createElement('span');
  label.className = 'menu-row-label';
  label.textContent = 'MAPA';
  const group = document.createElement('div');
  group.className = 'mode-selector-buttons';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Mapa');
  for (const m of MAPS) {
    const ativo = m.id === atual;
    const chip = document.createElement(ativo ? 'span' : 'a');
    chip.className = `btn-mode${ativo ? ' active' : ''}`;
    chip.textContent = m.label;
    chip.title = m.hint;
    if (!ativo) (chip as HTMLAnchorElement).href = mapHref(location.href, m.id);
    else chip.setAttribute('aria-current', 'true');
    group.append(chip);
  }
  row.append(label, group);
  const slot = parent.querySelector('#map-slot');
  if (slot) slot.replaceWith(row);
  else parent.append(row);
}
