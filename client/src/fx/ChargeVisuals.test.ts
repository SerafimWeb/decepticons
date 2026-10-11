import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TRIGGERS, SHOULDER_TRIGGERS, type MountId, type TriggerLayout } from '../combat/mounts';
import { weapon, type WeaponStats } from '../combat/weapons';
import type { MechBase } from '../entities/MechBase';
import { ChargeVisuals } from './ChargeVisuals';

const BOCAS: Record<MountId, [number, number, number]> = { rightHand: [1, 3, 2], leftHand: [-1, 3, 2], rightShoulder: [1.5, 5, 0], leftShoulder: [-1.5, 5, 0] };

function palco() {
  const pontos: THREE.Vector3[] = [];
  const visuals = new ChargeVisuals({ burst: (at: THREE.Vector3) => pontos.push(at.clone()) });
  const mech = (o: { charging?: boolean; primary?: WeaponStats; offhand?: WeaponStats | null; secondary?: WeaponStats | null; triggers?: TriggerLayout; alive?: boolean } = {}) =>
    ({
      alive: o.alive ?? true,
      root: { visible: true },
      weaponCharging: o.charging ?? true,
      triggers: o.triggers ?? DEFAULT_TRIGGERS,
      loadout: { primary: o.primary ?? weapon('railgun'), offhand: o.offhand ?? null, secondary: o.secondary ?? null },
      mountWorldPosition: (m: MountId, t: THREE.Vector3) => t.set(...BOCAS[m]),
    }) as unknown as MechBase;
  return { pontos, visuals, mech, pulso: () => visuals.beginFrame(0.11, true) };
}

/** Dono, 11/10: no Marauder "os tiros estavam saindo só pela mão direita". O aviso da carga do trilho também só acendia a direita. */
describe('o aviso da carga acende a boca de cada mão que carrega', () => {
  it('um trilho na mão direita acende só a direita', () => {
    const { pontos, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech());
    expect(pontos.map((p) => p.x)).toEqual([1]);
  });

  it('trilho nas duas mãos (Marauder): acende as duas bocas', () => {
    const { pontos, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech({ primary: weapon('railgun'), offhand: weapon('railgun'), triggers: SHOULDER_TRIGGERS }));
    expect(pontos.map((p) => p.x).sort()).toEqual([-1, 1]);
  });

  it('trilho só na esquerda (a direita com plasma): acende só a esquerda; arma sem carga não acende nada', () => {
    const a = palco();
    a.pulso();
    a.visuals.update(a.mech({ primary: weapon('plasma'), offhand: weapon('railgun'), triggers: SHOULDER_TRIGGERS }));
    expect(a.pontos.map((p) => p.x)).toEqual([-1]);
    const b = palco();
    b.pulso();
    b.visuals.update(b.mech({ primary: weapon('plasma'), offhand: weapon('blaster'), triggers: SHOULDER_TRIGGERS }));
    expect(b.pontos).toHaveLength(0);
  });

  it('o trilho no botão 2 (os dois ombros do Marauder) acende os dois ombros', () => {
    const { pontos, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech({ primary: weapon('plasma'), secondary: weapon('railgun'), triggers: SHOULDER_TRIGGERS }));
    expect(pontos.map((p) => p.x).sort()).toEqual([-1.5, 1.5]);
  });

  it('o orçamento é por pulso (8 unidades): nenhuma mão passa disso, e fora da carga ou morto nada sai', () => {
    const { pontos, visuals, mech, pulso } = palco();
    pulso();
    for (let i = 0; i < 20; i++) visuals.update(mech({ primary: weapon('railgun'), offhand: weapon('railgun'), triggers: SHOULDER_TRIGGERS }));
    expect(pontos).toHaveLength(8);
    const parado = palco();
    parado.pulso();
    parado.visuals.update(parado.mech({ charging: false }));
    parado.visuals.update(parado.mech({ alive: false }));
    expect(parado.pontos).toHaveLength(0);
  });
});
