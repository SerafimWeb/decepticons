import { describe, expect, it } from 'vitest';
import { CHASSIS, MARAUDER_STATS, VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { Armament, type ShotSink } from './Armament';
import type { MountId, TriggerLayout } from './mounts';
import { weapon, type Loadout } from './weapons';

/**
 * O botão de cada arma (P300, fase 1): o disparo segue o layout de cada encaixe, não uma regra fixa do chassi. Com o padrão do chassi nada muda
 * (os testes de combate passam sem mexer). Aqui o layout é outro, e cada arma tem que sair do encaixe e do botão certos.
 */

function bench(stats: typeof VECTOR09_STATS, loadout: Loadout) {
  const mech = new Vector09({ stats: { ...stats, loadout }, loadout });
  const armament = new Armament(mech);
  const tiros: { mount: MountId; id: string; via: 'projectile' | 'rocket' }[] = [];
  const sink: ShotSink = {
    projectile: (mount, w) => tiros.push({ mount, id: w.id, via: 'projectile' }),
    rocket: (mount, w) => tiros.push({ mount, id: w.id, via: 'rocket' }),
    melee: () => {},
    flame: () => {},
    wave: () => {},
  };
  const hold = (seconds: number, fire: boolean, secondary: boolean) => {
    for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++) armament.fixedUpdate(FIXED_DT, fire, secondary, sink);
  };
  return { hold, tiros };
}

const comLayout = (layout: TriggerLayout) => ({ ...VECTOR09_STATS, triggers: layout });
const PLASMA_E_FOGUETES: Loadout = { primary: weapon('plasma'), secondary: weapon('rockets'), back: null, rightShoulder: null, leftShoulder: null };

describe('o botão de cada arma (P300): o layout manda, o encaixe e a arma acompanham', () => {
  it('a mão esquerda no botão 1 e a direita no botão 2: o botão 1 dispara os foguetes da esquerda, e o plasma da direita não sai nele', () => {
    const b = bench(comLayout({ primary: ['leftHand'], secondary: ['rightHand'] }), PLASMA_E_FOGUETES);
    b.hold(0.3, true, false);
    expect(new Set(b.tiros.filter((t) => t.id === 'rockets').map((t) => t.mount))).toEqual(new Set(['leftHand']));
    expect(b.tiros.some((t) => t.mount === 'rightHand')).toBe(false);
  });

  it('o mesmo layout, botão 2 apertado: o plasma sai da mão direita, e o foguete da esquerda não', () => {
    const b = bench(comLayout({ primary: ['leftHand'], secondary: ['rightHand'] }), PLASMA_E_FOGUETES);
    b.hold(0.3, false, true);
    expect(new Set(b.tiros.filter((t) => t.id === 'plasma').map((t) => t.mount))).toEqual(new Set(['rightHand']));
    expect(b.tiros.some((t) => t.id === 'rockets')).toBe(false);
  });

  it('os dois ombros da secundária no botão 1, com as mãos: os foguetes dos ombros saem juntos no botão 1, num volley só', () => {
    const b = bench(comLayout({ primary: ['rightHand', 'leftHand', 'rightShoulder', 'leftShoulder'], secondary: [] }), {
      ...MARAUDER_STATS.loadout,
      primary: weapon('blaster'),
      offhand: weapon('blaster'),
      secondary: weapon('rockets'),
    } as Loadout);
    b.hold(0.2, true, false);
    const foguetes = b.tiros.filter((t) => t.via === 'rocket');
    expect(foguetes.map((t) => t.mount)).toEqual(['rightShoulder', 'leftShoulder']);
  });

  it('o padrão do chassi não mudou: o Vector-09 de fábrica dispara o plasma no botão 1 e os foguetes da esquerda no 2', () => {
    const b = bench(CHASSIS.vector09, PLASMA_E_FOGUETES);
    b.hold(0.3, true, false);
    expect(b.tiros.filter((t) => t.id === 'plasma').length).toBeGreaterThan(0);
    expect(b.tiros.some((t) => t.id === 'rockets')).toBe(false);
    b.tiros.length = 0;
    b.hold(0.3, false, true);
    expect(new Set(b.tiros.filter((t) => t.id === 'rockets').map((t) => t.mount))).toEqual(new Set(['leftHand']));
  });

  it('o Marauder de fábrica (padrão) segue igual: as mãos no botão 1 e os ombros no 2', () => {
    const b = bench(MARAUDER_STATS, MARAUDER_STATS.loadout as Loadout);
    b.hold(0.2, false, true);
    expect(b.tiros.filter((t) => t.via === 'rocket').map((t) => t.mount)).toEqual(['rightShoulder', 'leftShoulder']);
  });
});
