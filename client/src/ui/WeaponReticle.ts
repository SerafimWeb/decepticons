import type { Loadout, WeaponId } from '../combat/weapons';

/** Traços periféricos: todos preservam um centro livre de pelo menos 12 px. */
const SHAPES: Record<WeaponId, string> = {
  railgun: 'M7 19H16 M7 29H16 M32 19H41 M32 29H41 M24 5V13 M24 35V43',
  emp: 'M17 8L8 17 M31 8L40 17 M40 31L31 40 M17 40L8 31 M5 22V26 M43 22V26',
  plasma: 'M16 9H9V16 M32 9H39V16 M9 32V39H16 M39 32V39H32',
  blaster: 'M24 7V15 M7 24H15 M33 24H41 M24 33V41',
  shotgun: 'M15 8L7 16V32L15 40 M33 8L41 16V32L33 40',
  rockets: 'M8 17V8H17 M31 8H40V17 M40 31V40H31 M17 40H8V31 M24 5V9 M24 39V43',
  barrage: 'M7 16V7H16 M32 7H41V16 M41 32V41H32 M16 41H7V32 M17 11H21 M27 11H31 M17 37H21 M27 37H31',
  chainsaw: 'M8 15L15 22L8 29 M40 15L33 22L40 29 M18 37L24 33L30 37',
  arc: 'M6 24H10L12 18L15 30L17 24 M31 24L33 18L36 30L38 24H42 M24 6V12 M24 36V42',
  cryo: 'M5 24L11 19 M5 24L11 29 M43 24L37 19 M43 24L37 29 M24 5L19 11 M24 5L29 11 M24 43L19 37 M24 43L29 37',
  rotary: 'M6 24H12 M36 24H42 M24 6V12 M24 36V42 M11 11L15 15 M37 11L33 15 M11 37L15 33 M37 37L33 33',
};

/** O secundário aparece enquanto acionado; disparo conjunto mantém a referência principal. */
export function reticleWeapon(loadout: Loadout, primaryHeld: boolean, secondaryHeld: boolean): WeaponId {
  return secondaryHeld && !primaryHeld && loadout.secondary ? loadout.secondary.id : loadout.primary.id;
}

export class WeaponReticle {
  private readonly path: SVGPathElement;
  private shown: WeaponId | undefined;
  private chargeStep = -1;
  private readonly chargeBar: HTMLElement;

  constructor(root: HTMLElement) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('weapon-reticle');
    this.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.append(this.path);
    root.prepend(svg);
    this.chargeBar = document.createElement('div');
    this.chargeBar.className = 'reticle-charge';
    this.chargeBar.hidden = true;
    root.append(this.chargeBar);
  }

  setCharge(progress: number): void {
    const step = Math.floor(Math.max(0, Math.min(1, progress)) * 20);
    if (step === this.chargeStep) return;
    this.chargeStep = step;
    this.chargeBar.hidden = step === 0;
    this.chargeBar.style.transform = 'scaleX(' + step / 20 + ')';
  }

  setWeapon(id: WeaponId): void {
    if (id === this.shown) return;
    this.shown = id;
    this.path.setAttribute('d', SHAPES[id]);
  }
}
