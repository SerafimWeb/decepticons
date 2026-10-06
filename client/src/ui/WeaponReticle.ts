import type { Loadout, WeaponId } from '../combat/weapons';

/** Traços periféricos: todos preservam um centro livre de pelo menos 12 px. */
const SHAPES: Record<WeaponId, string> = {
  plasma: 'M16 9H9V16 M32 9H39V16 M9 32V39H16 M39 32V39H32',
  blaster: 'M24 7V15 M7 24H15 M33 24H41 M24 33V41',
  shotgun: 'M15 8L7 16V32L15 40 M33 8L41 16V32L33 40',
  rockets: 'M8 17V8H17 M31 8H40V17 M40 31V40H31 M17 40H8V31 M24 5V9 M24 39V43',
  barrage: 'M7 16V7H16 M32 7H41V16 M41 32V41H32 M16 41H7V32 M17 11H21 M27 11H31 M17 37H21 M27 37H31',
  chainsaw: 'M8 15L15 22L8 29 M40 15L33 22L40 29 M18 37L24 33L30 37',
};

/** O secundário aparece enquanto acionado; disparo conjunto mantém a referência principal. */
export function reticleWeapon(loadout: Loadout, primaryHeld: boolean, secondaryHeld: boolean): WeaponId {
  return secondaryHeld && !primaryHeld && loadout.secondary ? loadout.secondary.id : loadout.primary.id;
}

export class WeaponReticle {
  private readonly path: SVGPathElement;
  private shown: WeaponId | undefined;

  constructor(root: HTMLElement) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('weapon-reticle');
    this.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.append(this.path);
    root.prepend(svg);
  }

  setWeapon(id: WeaponId): void {
    if (id === this.shown) return;
    this.shown = id;
    this.path.setAttribute('d', SHAPES[id]);
  }
}
