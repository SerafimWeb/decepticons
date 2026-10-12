import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SHOULDER_TRIGGERS } from '../combat/mounts';
import { weapon } from '../combat/weapons';
import { MARAUDER_STATS, VECTOR09_STATS } from './chassis';
import { Vector09 } from './Vector09';

/** Encaixes de arma do Mech: de onde sai o tiro (G14: o servidor e o cliente leem o mesmo número) e o que cada um precisa de pé. */
describe('MechBase: a boca de cada encaixe', () => {
  it('no corpo procedural, a boca da simulação é a boca do desenho em repouso (sem dado no chassi, vale a medida do rig)', () => {
    const mech = new Vector09();
    mech.root.updateMatrixWorld(true);
    const sim = new THREE.Vector3();
    const draw = new THREE.Vector3();
    expect(mech.simMuzzle(sim).distanceTo(mech.muzzleWorldPosition(draw))).toBeLessThan(1e-6); // mão direita, o padrão
    expect(mech.simMuzzle(sim, 'leftHand').distanceTo(mech.leftMuzzleWorldPosition(draw))).toBeLessThan(1e-6);
    expect(mech.simMuzzle(sim, 'rightHand').x).toBeGreaterThan(0); // a direita do Mech é +X
    expect(mech.simMuzzle(sim, 'leftHand').x).toBeLessThan(0);
  });

  it('o dado do chassi manda na boca (o servidor não tem o desenho importado), e gira com o yaw do Mech', () => {
    const stats = { ...VECTOR09_STATS, muzzles: { leftShoulder: [-1, 4, -0.5] as const } };
    const mech = new Vector09({ stats });
    const out = new THREE.Vector3();
    mech.simMuzzle(out, 'leftShoulder');
    expect(out.toArray()).toEqual([-1, 4, -0.5]);
    mech.yaw = Math.PI / 2; // quem estava à esquerda e à frente passa a estar à frente e à direita do mundo
    mech.simMuzzle(out, 'leftShoulder');
    expect(out.x).toBeCloseTo(-0.5, 5);
    expect(out.y).toBeCloseTo(4, 5);
    expect(out.z).toBeCloseTo(1, 5);
    // O encaixe sem dado cai na medida do rig: o dado de um não vira o de outro.
    expect(mech.simMuzzle(out, 'rightHand').y).toBeGreaterThan(0);
  });

  it('os dados do Marauder têm as quatro bocas, espelhadas, com os ombros acima das mãos', () => {
    const m = MARAUDER_STATS.muzzles!;
    expect(m.rightHand![0]).toBeCloseTo(-m.leftHand![0], 1);
    expect(m.rightShoulder![0]).toBeCloseTo(-m.leftShoulder![0], 5);
    expect(m.rightShoulder![1]).toBeGreaterThan(m.rightHand![1]);
    expect(m.rightHand![2]).toBeLessThan(0); // a mão está à frente do corpo (-Z)
  });
});

describe('MechBase: o que cada encaixe precisa para atirar', () => {
  const marauder = () => new Vector09({ stats: { ...VECTOR09_STATS, triggers: SHOULDER_TRIGGERS }, loadout: MARAUDER_STATS.loadout });

  it('a mão depende do braço dela e o ombro, do torso', () => {
    const mech = marauder();
    const max = mech.stats.maxModuleHealth;
    expect(mech.canFireMount('rightHand') && mech.canFireMount('leftHand') && mech.canFireMount('rightShoulder')).toBe(true);
    mech.damagePart('leftArm', max.leftArm);
    expect(mech.canFireMount('leftHand')).toBe(false);
    expect(mech.canFireMount('rightHand')).toBe(true);
    expect(mech.canFireMount('leftShoulder')).toBe(true); // o ombro é do torso
  });

  it('o gatilho secundário: no padrão é do braço esquerdo; com lançadores de ombro, o braço esquerdo não importa', () => {
    const padrao = new Vector09();
    padrao.damagePart('leftArm', padrao.stats.maxModuleHealth.leftArm);
    expect(padrao.canFireSecondary).toBe(false);

    const mech = marauder();
    mech.damagePart('leftArm', mech.stats.maxModuleHealth.leftArm);
    mech.damagePart('rightArm', mech.stats.maxModuleHealth.rightArm);
    expect(mech.canFireSecondary).toBe(true);
    // Sem arma no secundário, não atira por mais encaixes que haja.
    const vazio = new Vector09({ stats: { ...VECTOR09_STATS, triggers: SHOULDER_TRIGGERS }, loadout: { primary: weapon('blaster'), secondary: null } });
    expect(vazio.canFireSecondary).toBe(false);
  });

  it('superaquecido, nenhum encaixe atira, de mão ou de ombro', () => {
    const mech = marauder();
    mech.onFireMount('rightHand', { ...weapon('blaster'), heatPerShot: 1 });
    expect(mech.overheated).toBe(true);
    for (const mount of ['rightHand', 'leftHand', 'rightShoulder', 'leftShoulder'] as const) expect(mech.canFireMount(mount), mount).toBe(false);
    expect(mech.canFireSecondary).toBe(false);
  });

  it('cada tiro soma o calor da arma que atirou, de qualquer encaixe; onFire() é o tiro da mão direita com a arma principal', () => {
    const mech = marauder();
    mech.onFireMount('leftHand', weapon('blaster'));
    expect(mech.heat).toBeCloseTo(weapon('blaster').heatPerShot, 6);
    mech.onFireMount('rightShoulder', weapon('rockets'));
    expect(mech.heat).toBeCloseTo(weapon('blaster').heatPerShot + weapon('rockets').heatPerShot, 6);
    const outro = marauder();
    outro.onFire();
    expect(outro.heat).toBeCloseTo(MARAUDER_STATS.loadout.primary.heatPerShot, 6);
  });
});
