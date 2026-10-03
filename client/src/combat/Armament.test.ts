import { describe, expect, it } from 'vitest';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { Armament, type ShotSink } from './Armament';
import { DEFAULT_TRIGGERS, SHOULDER_TRIGGERS, type MountId, type TriggerLayout } from './mounts';
import { weapon, type Loadout, type WeaponStats } from './weapons';

interface Shot {
  /** Segundo do tick em que saiu. */
  t: number;
  kind: 'bolt' | 'rocket' | 'cut';
  mount?: MountId;
  w: WeaponStats;
  volley?: number;
}

/** Um Mech de verdade (o corpo procedural, sem física) com o gatilho ligado nos encaixes pedidos e um sink que anota. */
function bench(loadout: Loadout, triggers: TriggerLayout = DEFAULT_TRIGGERS) {
  const mech = new Vector09({ stats: { ...VECTOR09_STATS, triggers, loadout }, loadout });
  const armament = new Armament(mech);
  const shots: Shot[] = [];
  let t = 0;
  const sink: ShotSink = {
    projectile: (mount, w) => shots.push({ t, kind: 'bolt', mount, w }),
    rocket: (mount, w, volley) => shots.push({ t, kind: 'rocket', mount, w, volley }),
    melee: (w) => shots.push({ t, kind: 'cut', w }),
  };
  /** Segura os botões por `seconds` (em ticks de 60 Hz). */
  const hold = (seconds: number, fire: boolean, secondary = false): void => {
    for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++, t += FIXED_DT) armament.fixedUpdate(FIXED_DT, fire, secondary, sink);
  };
  const from = (mount: MountId) => shots.filter((s) => s.mount === mount);
  return { mech, armament, shots, hold, from };
}

/** O foguete do Hangar, mas que quase não esquenta: deixa o teste olhar o carregador sem o calor travar o Mech antes. */
const COOL_ROCKETS: WeaponStats = Object.freeze({ ...weapon('rockets'), heatPerShot: 0.001 });

describe('Armament: o Mech de fábrica atira como sempre (mão direita no botão principal, esquerda no secundário)', () => {
  it('segurar o botão principal atira o plasma da mão direita no ritmo dele e esquenta o Mech', () => {
    const { mech, hold, shots } = bench({ primary: weapon('plasma'), secondary: weapon('rockets') });
    hold(1, true);
    expect(shots.length).toBeGreaterThanOrEqual(4);
    expect(shots.length).toBeLessThanOrEqual(5); // 0,22 s entre tiros
    expect(shots.every((s) => s.kind === 'bolt' && s.mount === 'rightHand' && s.w.id === 'plasma')).toBe(true);
    expect(mech.heat).toBeCloseTo(shots.length * weapon('plasma').heatPerShot, 5);
  });

  it('segurar o botão secundário lança um foguete por vez da mão esquerda; o carregador de 4 esvazia e não volta tão cedo', () => {
    const { armament, hold, shots, mech } = bench({ primary: weapon('plasma'), secondary: COOL_ROCKETS });
    hold(0.1, false, true);
    expect(shots).toHaveLength(1);
    expect(shots[0]).toMatchObject({ kind: 'rocket', mount: 'leftHand', volley: 0 });
    hold(1.5, false, true);
    expect(shots.filter((s) => s.kind === 'rocket')).toHaveLength(4);
    expect(armament.launcher.ammo).toBe(0);
    expect(mech.heat).toBeCloseTo(4 * COOL_ROCKETS.heatPerShot, 5);
  });

  it('o botão principal solto e o secundário solto não atiram nada', () => {
    const { hold, shots, mech } = bench({ primary: weapon('plasma'), secondary: weapon('rockets') });
    hold(1, false, false);
    expect(shots).toHaveLength(0);
    expect(mech.heat).toBe(0);
  });

  it('sem arma no secundário (o braço do escudo do Lancer), apertar o botão não faz nada e não esquenta', () => {
    const { hold, shots, mech } = bench({ primary: weapon('shotgun'), secondary: null });
    hold(1, false, true);
    expect(shots).toHaveLength(0);
    expect(mech.heat).toBe(0);
  });

  it('a motosserra no secundário (andróide) corta no ritmo dela, sem projétil nem foguete', () => {
    const { hold, shots } = bench({ primary: weapon('blaster'), secondary: weapon('chainsaw') });
    hold(1, false, true);
    expect(shots.every((s) => s.kind === 'cut' && s.w.id === 'chainsaw')).toBe(true);
    expect(shots.length).toBeGreaterThanOrEqual(5);
    expect(shots.length).toBeLessThanOrEqual(6); // 0,2 s entre cortes (o 1º tiro ganha o crédito de um tick)
  });

  it('uma arma de energia no braço esquerdo (blaster da Arara, plasma da Onça) atira de verdade: antes nunca disparava', () => {
    const { hold, shots } = bench({ primary: weapon('plasma'), secondary: weapon('blaster') });
    hold(1, false, true);
    expect(shots.length).toBeGreaterThanOrEqual(2);
    expect(shots.every((s) => s.kind === 'bolt' && s.mount === 'leftHand' && s.w.id === 'blaster')).toBe(true);
  });

  it('trocar de armas (rearm) refaz o carregador cheio com a arma nova', () => {
    const { armament, mech } = bench({ primary: weapon('plasma'), secondary: weapon('rockets') });
    mech.equip({ primary: weapon('plasma', 2), secondary: weapon('rockets', 1) });
    armament.rearm();
    expect(armament.launcher.weapon.tier).toBe(1);
    expect(armament.launcher.ammo).toBe(armament.launcher.weapon.magazine);
  });
});

describe('Armament: o Marauder (duas mãos no botão principal, dois lançadores nos ombros)', () => {
  const marauder = (): Loadout => ({ primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('rockets') });

  it('as duas mãos atiram o blaster, uma meio intervalo depois da outra (ritmo alternado), cada uma no ritmo dela', () => {
    const { hold, from, shots } = bench(marauder(), SHOULDER_TRIGGERS);
    hold(1, true);
    const right = from('rightHand');
    const left = from('leftHand');
    expect(right).toHaveLength(3);
    right.forEach((s, i) => expect(s.t).toBeCloseTo(0.4 * i, 1)); // um tick de folga: o 1º tiro ganha o crédito dele
    expect(left.length).toBeGreaterThanOrEqual(2);
    expect(left.length).toBeLessThanOrEqual(3);
    expect(left[0]!.t - right[0]!.t).toBeCloseTo(0.2, 1);
    expect(left[1]!.t - left[0]!.t).toBeCloseTo(0.4, 1);
    expect(shots.every((s) => s.kind === 'bolt' && s.w.id === 'blaster')).toBe(true);
  });

  it('cada tiro soma o calor da arma que atirou, das duas mãos, no mesmo dissipador', () => {
    const { hold, mech, shots } = bench(marauder(), SHOULDER_TRIGGERS);
    hold(1, true);
    expect(mech.heat).toBeCloseTo(shots.length * weapon('blaster').heatPerShot, 5);
  });

  it('braço esquerdo destruído: só a direita atira. Direito destruído: só a esquerda, já no primeiro tick. Os dois: nenhuma', () => {
    const a = bench(marauder(), SHOULDER_TRIGGERS);
    a.mech.damagePart('leftArm', a.mech.stats.maxModuleHealth.leftArm);
    a.hold(1, true);
    expect(a.from('rightHand').length).toBeGreaterThan(0);
    expect(a.from('leftHand')).toHaveLength(0);

    const b = bench(marauder(), SHOULDER_TRIGGERS);
    b.mech.damagePart('rightArm', b.mech.stats.maxModuleHealth.rightArm);
    b.hold(1, true);
    expect(b.from('rightHand')).toHaveLength(0);
    expect(b.from('leftHand')[0]!.t).toBe(0); // a mão que sobrou não espera meio intervalo por uma que não atira

    const c = bench(marauder(), SHOULDER_TRIGGERS);
    c.mech.damagePart('leftArm', c.mech.stats.maxModuleHealth.leftArm);
    c.mech.damagePart('rightArm', c.mech.stats.maxModuleHealth.rightArm);
    c.hold(1, true);
    expect(c.shots).toHaveLength(0);
  });

  it('superaquecido, nenhuma das duas mãos atira', () => {
    const hot: WeaponStats = Object.freeze({ ...weapon('blaster'), heatPerShot: 0.6 });
    const { hold, shots, mech } = bench({ primary: hot, offhand: hot, secondary: null }, SHOULDER_TRIGGERS);
    hold(2, true);
    expect(shots).toHaveLength(2); // 60% + 60%: a direita, depois a esquerda, e trava
    expect(mech.overheated).toBe(true);
  });

  it('o botão secundário solta uma salva de dois foguetes, um de cada ombro, gastando UM tiro do carregador', () => {
    const { armament, hold, shots } = bench({ ...marauder(), secondary: COOL_ROCKETS }, SHOULDER_TRIGGERS);
    hold(0.05, false, true);
    expect(shots.map((s) => [s.kind, s.mount, s.volley])).toEqual([
      ['rocket', 'rightShoulder', 0],
      ['rocket', 'leftShoulder', 1],
    ]);
    expect(armament.launcher.ammo).toBe(COOL_ROCKETS.magazine - 1);
  });

  it('o carregador de 4 vira 8 foguetes em 4 apertos; depois só a recarga devolve', () => {
    const { armament, hold, shots } = bench({ ...marauder(), secondary: COOL_ROCKETS }, SHOULDER_TRIGGERS);
    hold(2, false, true);
    expect(shots.filter((s) => s.kind === 'rocket')).toHaveLength(8);
    expect(armament.launcher.ammo).toBe(0);
  });

  it('a salva dobra o calor do aperto: dois lançamentos de 18%', () => {
    const { hold, mech } = bench(marauder(), SHOULDER_TRIGGERS);
    hold(0.05, false, true);
    expect(mech.heat).toBeCloseTo(2 * weapon('rockets').heatPerShot, 5);
  });

  it('os ombros são do torso: sem os dois braços os foguetes saem; sem o torso (morto), não', () => {
    const a = bench({ ...marauder(), secondary: COOL_ROCKETS }, SHOULDER_TRIGGERS);
    a.mech.damagePart('leftArm', a.mech.stats.maxModuleHealth.leftArm);
    a.mech.damagePart('rightArm', a.mech.stats.maxModuleHealth.rightArm);
    a.hold(0.05, false, true);
    expect(a.shots).toHaveLength(2);

    const b = bench({ ...marauder(), secondary: COOL_ROCKETS }, SHOULDER_TRIGGERS);
    b.mech.modules.torso = 0; // morto (sem física no teste: damagePart('torso') desligaria o colisor)
    b.hold(0.5, false, true);
    expect(b.shots).toHaveLength(0);
  });

  it('o botão principal e o secundário não se atrapalham: blasters e foguetes juntos', () => {
    const { hold, shots } = bench({ ...marauder(), secondary: COOL_ROCKETS }, SHOULDER_TRIGGERS);
    hold(0.5, true, true);
    expect(shots.filter((s) => s.kind === 'bolt').length).toBeGreaterThanOrEqual(2);
    expect(shots.filter((s) => s.kind === 'rocket').length).toBeGreaterThanOrEqual(2);
  });

  it('sem a segunda arma (offhand vazio) a mão esquerda não atira; o Marauder segue com a direita', () => {
    const { hold, from } = bench({ primary: weapon('blaster'), offhand: null, secondary: weapon('rockets') }, SHOULDER_TRIGGERS);
    hold(1, true);
    expect(from('rightHand').length).toBeGreaterThan(0);
    expect(from('leftHand')).toHaveLength(0);
  });
});
