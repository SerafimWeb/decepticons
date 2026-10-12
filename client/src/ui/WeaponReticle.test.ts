import { describe, expect, it } from 'vitest';
import { weapon, type Loadout } from '../combat/weapons';
import { reticleWeapon } from './WeaponReticle';
describe('gatilhos da mira', () => {
  const loadout: Loadout = { primary: weapon('blaster'), secondary: weapon('barrage'), offhand: weapon('plasma') };
  it('acompanha o grupo secundário sem confundir a segunda mão com os ombros', () => {
    expect(reticleWeapon(loadout, false, true)).toBe('barrage');
    expect(reticleWeapon(loadout, true, true)).toBe('blaster');
    expect(reticleWeapon(loadout, false, false)).toBe('blaster');
  });
  it('suporta o braço secundário vazio e a troca de montagem', () => {
    expect(reticleWeapon({ primary: weapon('shotgun'), secondary: null }, false, true)).toBe('shotgun');
    expect(reticleWeapon({ primary: weapon('plasma'), secondary: weapon('rockets') }, false, true)).toBe('rockets');
  });
});
