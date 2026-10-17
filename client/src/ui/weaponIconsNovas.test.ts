import { describe, expect, it } from 'vitest';
import { WEAPON_ICON_NOVAS, type NewWeaponId } from './weaponIconsNovas';

describe('weaponIconsNovas', () => {
  const ids: NewWeaponId[] = ['rotary', 'arc', 'flamer', 'cryo'];

  it('contains icons for all new weapons', () => {
    for (const id of ids) {
      expect(WEAPON_ICON_NOVAS[id]).toBeDefined();
      expect(typeof WEAPON_ICON_NOVAS[id]).toBe('string');
      expect(WEAPON_ICON_NOVAS[id].length).toBeGreaterThan(0);
    }
  });
});
