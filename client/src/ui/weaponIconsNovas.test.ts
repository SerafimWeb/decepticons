import { describe, expect, it } from 'vitest';
import { WEAPON_ICON_NOVAS, WEAPON_HINT_NOVAS, type NewWeaponId } from './weaponIconsNovas';

describe('weaponIconsNovas', () => {
  const ids: NewWeaponId[] = ['rotary', 'arc', 'flamer', 'cryo'];

  it('contains icons for all new weapons', () => {
    for (const id of ids) {
      expect(WEAPON_ICON_NOVAS[id]).toBeDefined();
      expect(typeof WEAPON_ICON_NOVAS[id]).toBe('string');
      expect(WEAPON_ICON_NOVAS[id].length).toBeGreaterThan(0);
    }
  });

  it('contains hints in Portuguese for all new weapons', () => {
    for (const id of ids) {
      expect(WEAPON_HINT_NOVAS[id]).toBeDefined();
      expect(typeof WEAPON_HINT_NOVAS[id]).toBe('string');
      expect(WEAPON_HINT_NOVAS[id].length).toBeGreaterThan(10);
    }
  });
});
