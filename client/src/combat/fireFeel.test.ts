import { describe, expect, it } from 'vitest';
import { FIRE_KICK, fireKick } from './fireFeel';
import { weapon, WEAPON_IDS } from './weapons';

/** O trauma da câmera decai a esta taxa por segundo (`CameraRig.update`). */
const TRAUMA_DECAY = 1.6;

describe('o peso do tiro na câmera', () => {
  it('toda arma do arsenal declara o seu, dentro do que a câmera aguenta', () => {
    for (const id of WEAPON_IDS) {
      const k = FIRE_KICK[id];
      expect(k, id).toBeGreaterThanOrEqual(0);
      expect(k, id).toBeLessThanOrEqual(0.5);
    }
    expect(Object.keys(FIRE_KICK).sort()).toEqual([...WEAPON_IDS].sort()); // nem a mais, nem a menos
  });

  it('o peso segue o tamanho do tiro: trilho e chuva > escopeta e foguete > plasma > blaster; a serra não treme', () => {
    const k = (id: Parameters<typeof weapon>[0]) => fireKick(weapon(id));
    expect(k('railgun')).toBeGreaterThan(k('shotgun'));
    expect(k('barrage')).toBeGreaterThan(k('rockets'));
    expect(k('shotgun')).toBeGreaterThan(k('plasma'));
    expect(k('rockets')).toBeGreaterThan(k('plasma'));
    expect(k('plasma')).toBeGreaterThan(k('blaster'));
    expect(k('blaster')).toBeGreaterThan(0);
    expect(k('chainsaw')).toBe(0);
  });

  it('cada nível pesa um pouco mais que o anterior, sem passar do pouso mais forte', () => {
    for (const id of WEAPON_IDS) {
      if (FIRE_KICK[id] === 0) continue;
      const [one, two, three] = ([0, 1, 2] as const).map((t) => fireKick(weapon(id, t)));
      expect(two!, id).toBeGreaterThan(one!);
      expect(three!, id).toBeGreaterThan(two!);
      expect(three!, id).toBeLessThanOrEqual(0.6);
    }
  });

  it('segurando o gatilho, o tremor médio de uma arma de energia fica leve: nunca vira terremoto', () => {
    // Trauma em equilíbrio = tremor por tiro × tiros por segundo ÷ decaimento. Arma de munição se limita pelo carregador.
    for (const id of WEAPON_IDS) {
      for (const tier of [0, 1, 2] as const) {
        const w = weapon(id, tier);
        if (w.kind !== 'energy' || fireKick(w) === 0) continue;
        const steady = fireKick(w) / w.fireInterval / TRAUMA_DECAY;
        expect(steady, `${id} MK ${tier + 1}`).toBeLessThan(0.3);
      }
    }
  });
});
