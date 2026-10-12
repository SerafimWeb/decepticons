import { describe, expect, it } from 'vitest';
import { CHASSIS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { Armament, type ShotSink } from './Armament';
import { SHOULDER_TRIGGERS, SPLIT_SHOULDER_TRIGGERS, shoulderMounts, weaponAt, type MountId } from './mounts';
import { weapon, type Loadout, type WeaponStats } from './weapons';

interface Shot {
  t: number;
  kind: 'bolt' | 'rocket' | 'cut' | 'flame' | 'wave';
  mount: MountId;
  w: WeaponStats;
}

/**
 * Dono, 12/10 (P95): *"arma 1 as dos braços, arma 2 a dos ombros/costas/peitoral, **podendo ser configurado assim**"*. O Marauder ganha um segundo layout de gatilhos: só a mão direita no
 * Ataque 1; a **mão esquerda vai para o Ataque 2 junto com os dois ombros**, com a arma dela (armas diferentes no mesmo ataque).
 */
function bench(loadout: Loadout) {
  const mech = new Vector09({ stats: CHASSIS.marauder, loadout });
  const armament = new Armament(mech);
  const shots: Shot[] = [];
  let t = 0;
  const sink: ShotSink = {
    projectile: (mount, w) => shots.push({ t, kind: 'bolt', mount, w }),
    rocket: (mount, w) => shots.push({ t, kind: 'rocket', mount, w }),
    melee: (w) => shots.push({ t, kind: 'cut', mount: 'rightHand', w }),
    flame: (mount, w) => shots.push({ t, kind: 'flame', mount, w }),
    wave: (mount, w) => shots.push({ t, kind: 'wave', mount, w }),
  };
  const hold = (seconds: number, fire: boolean, secondary = false): void => {
    for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++, t += FIXED_DT) armament.fixedUpdate(FIXED_DT, fire, secondary, sink);
  };
  const from = (mount: MountId) => shots.filter((s) => s.mount === mount);
  return { mech, armament, shots, hold, from };
}

const COOL = (id: Parameters<typeof weapon>[0]): WeaponStats => Object.freeze({ ...weapon(id), heatPerShot: 0.001 });
const padrao = (extra: Partial<Loadout> = {}): Loadout => ({ primary: COOL('blaster'), offhand: COOL('plasma'), secondary: COOL('sonic'), ...extra });
const dividido = (extra: Partial<Loadout> = {}): Loadout => padrao({ layout: 1, ...extra });

describe('os dois layouts do Marauder: o padrão e o dividido', () => {
  it('o Marauder oferece dois layouts e o primeiro é o padrão de sempre (as duas mãos no Ataque 1, os ombros no 2)', () => {
    const l = CHASSIS.marauder.layouts!;
    expect(l).toHaveLength(2);
    expect(l[0]!.triggers).toBe(SHOULDER_TRIGGERS);
    expect(l[1]!.triggers).toBe(SPLIT_SHOULDER_TRIGGERS);
    expect(CHASSIS.marauder.triggers).toBe(SHOULDER_TRIGGERS);
  });

  it('o dividido: só a mão direita no Ataque 1; a esquerda e os dois ombros no Ataque 2', () => {
    expect(SPLIT_SHOULDER_TRIGGERS.primary).toEqual(['rightHand']);
    expect(SPLIT_SHOULDER_TRIGGERS.secondary).toEqual(['leftHand', 'rightShoulder', 'leftShoulder']);
    expect(shoulderMounts(SPLIT_SHOULDER_TRIGGERS)).toEqual(['rightShoulder', 'leftShoulder']); // a carga conta os ombros duas vezes, não a mão
    expect(shoulderMounts(SHOULDER_TRIGGERS)).toEqual(['rightShoulder', 'leftShoulder']);
  });

  it('o Mech usa o layout da montagem (Loadout.layout): sem ele, o padrão; com 1, o dividido; fora da lista, o padrão', () => {
    expect(bench(padrao()).mech.triggers).toBe(SHOULDER_TRIGGERS);
    expect(bench(dividido()).mech.triggers).toBe(SPLIT_SHOULDER_TRIGGERS);
    expect(bench(padrao({ layout: 7 })).mech.triggers).toBe(SHOULDER_TRIGGERS);
  });

  it('a arma de cada encaixe: mão direita = primary; esquerda = offhand (chassi de duas mãos); ombros = secondary; nos outros chassis a esquerda é a secondary', () => {
    const l = padrao();
    expect(weaponAt(l, 'rightHand')).toBe(l.primary);
    expect(weaponAt(l, 'leftHand')).toBe(l.offhand);
    expect(weaponAt(l, 'rightShoulder')).toBe(l.secondary);
    expect(weaponAt(l, 'leftShoulder')).toBe(l.secondary);
    const vector: Loadout = { primary: weapon('plasma'), secondary: weapon('rockets') };
    expect(weaponAt(vector, 'leftHand')).toBe(vector.secondary);
  });
});

describe('Armament no layout padrão: nada mudou (as duas mãos no Ataque 1, os ombros no 2)', () => {
  it('o Ataque 1 atira as duas mãos (a esquerda meio intervalo depois) e nenhuma onda; o Ataque 2 só os ombros', () => {
    const a = bench(padrao());
    a.hold(0.3, true, false);
    expect(a.from('rightHand').length).toBeGreaterThan(0);
    expect(a.from('leftHand').length).toBeGreaterThan(0);
    expect(a.shots.some((s) => s.kind === 'wave')).toBe(false);
    const b = bench(padrao());
    b.hold(0.1, false, true);
    expect(b.shots.map((s) => s.mount).sort()).toEqual(['leftShoulder', 'rightShoulder']);
  });
});

describe('Armament no layout dividido: armas diferentes no Ataque 2', () => {
  it('o Ataque 1 atira só a mão direita (o blaster); a esquerda e os ombros ficam quietos', () => {
    const { shots, hold } = bench(dividido());
    hold(0.5, true, false);
    expect(shots.length).toBeGreaterThan(0);
    for (const s of shots) {
      expect(s.mount).toBe('rightHand');
      expect(s.w.id).toBe('blaster');
    }
  });

  it('o Ataque 2 atira a mão esquerda (o plasma) e os DOIS ombros (a onda sônica), no mesmo tick: armas diferentes no mesmo botão', () => {
    const { shots, hold } = bench(dividido());
    hold(0.1, false, true);
    expect(shots.map((s) => `${s.mount}:${s.w.id}:${s.kind}`).sort()).toEqual([
      'leftHand:plasma:bolt',
      'leftShoulder:sonic:wave',
      'rightShoulder:sonic:wave',
    ]);
    expect(new Set(shots.map((s) => s.t)).size).toBe(1);
    // E nenhum tiro da mão direita: ela é do Ataque 1.
    expect(shots.some((s) => s.mount === 'rightHand')).toBe(false);
  });

  it('cada arma no seu ritmo: a mão esquerda (plasma) repete na cadência do plasma e os ombros na da onda, sem uma esperar a outra', () => {
    const { from, hold } = bench(dividido());
    hold(3, false, true);
    const plasma = weapon('plasma').fireInterval;
    const onda = weapon('sonic').fireInterval;
    const esq = from('leftHand');
    const omb = from('rightShoulder');
    expect(esq.length).toBeGreaterThanOrEqual(Math.floor(3 / plasma));
    expect(omb.length).toBe(Math.ceil(3 / onda));
    for (let i = 1; i < esq.length; i++) expect(esq[i]!.t - esq[i - 1]!.t).toBeCloseTo(plasma, 1);
    for (let i = 1; i < omb.length; i++) expect(omb[i]!.t - omb[i - 1]!.t).toBeCloseTo(onda, 1);
  });

  it('os dois botões juntos: a direita (Ataque 1) e a esquerda (Ataque 2) atiram no MESMO tick, sem a meio-intervalo de espera das mãos do mesmo botão', () => {
    const { shots, hold } = bench(dividido());
    hold(0.05, true, true);
    const d = shots.find((s) => s.mount === 'rightHand')!;
    const e = shots.find((s) => s.mount === 'leftHand')!;
    expect(d.t).toBe(0);
    expect(e.t).toBe(0);
  });

  it('no padrão, as duas mãos do mesmo botão se alternam (a esquerda entra meio intervalo depois): a regra antiga segue valendo', () => {
    const { shots, hold } = bench(padrao({ offhand: COOL('blaster') }));
    hold(0.05, true, false);
    expect(shots.find((s) => s.mount === 'rightHand')!.t).toBe(0);
    expect(shots.find((s) => s.mount === 'leftHand')).toBeUndefined(); // ainda esperando o meio intervalo
    hold(0.3, true, false);
    expect(shots.find((s) => s.mount === 'leftHand')).toBeDefined();
  });

  it('a mão esquerda segue o botão dela: apertar só o Ataque 1 nunca a dispara, e só o Ataque 2 nunca dispara a direita', () => {
    const a = bench(dividido());
    a.hold(1, true, false);
    expect(a.from('leftHand')).toHaveLength(0);
    const b = bench(dividido());
    b.hold(1, false, true);
    expect(b.from('rightHand')).toHaveLength(0);
  });

  it('o calor de cada arma soma no mesmo dissipador: plasma + duas ondas num aperto', () => {
    const p: WeaponStats = Object.freeze({ ...weapon('plasma'), heatPerShot: 0.1 });
    const s: WeaponStats = Object.freeze({ ...weapon('sonic'), heatPerShot: 0.05 });
    const { mech, hold } = bench(dividido({ offhand: p, secondary: s }));
    hold(0.02, false, true);
    expect(mech.heat).toBeCloseTo(0.1 + 2 * 0.05, 3);
  });

  it('a mão esquerda destruída não atira no Ataque 2, mas os ombros sim; o torso destruído tira os ombros mas não a mão', () => {
    const a = bench(dividido());
    a.mech.damagePart('leftArm', a.mech.stats.maxModuleHealth.leftArm);
    a.hold(0.1, false, true);
    expect(a.from('leftHand')).toHaveLength(0);
    expect(a.from('rightShoulder')).toHaveLength(1);
    const b = bench(dividido());
    b.mech.modules.torso = 0;
    b.hold(0.1, false, true);
    expect(b.shots).toHaveLength(0); // sem torso o Mech está morto
  });

  it('superaquecido, nada atira em nenhum dos dois ataques', () => {
    const quente: WeaponStats = Object.freeze({ ...weapon('plasma'), heatPerShot: 0.9 });
    const { shots, hold, mech } = bench(dividido({ offhand: quente }));
    hold(1, false, true);
    expect(mech.overheated).toBe(true);
    const n = shots.length;
    hold(0.5, true, true);
    expect(shots.length).toBe(n);
  });

  it('o lança-chamas na mão esquerda acende só com o Ataque 2 e a bandeira de chama no Mech segue o botão', () => {
    const f: WeaponStats = Object.freeze({ ...weapon('flamer'), heatPerShot: 0.001 });
    const a = bench(dividido({ offhand: f }));
    a.hold(0.6, true, false); // o Ataque 1 não acende a esquerda
    expect(a.from('leftHand')).toHaveLength(0);
    expect(a.mech.status.flaming).toBe(false);
    const b = bench(dividido({ offhand: f }));
    b.hold(0.6, false, true);
    expect(b.from('leftHand').every((s) => s.kind === 'flame')).toBe(true);
    expect(b.from('leftHand').length).toBeGreaterThan(0);
    expect(b.mech.status.flaming).toBe(true);
    b.hold(0.1, false, false); // solto: apaga
    expect(b.mech.status.flaming).toBe(false);
  });

  it('a rotatória na mão esquerda gira só com o Ataque 2 (o cano para quando solta)', () => {
    const rot: WeaponStats = Object.freeze({ ...weapon('rotary'), heatPerShot: 0.001 });
    const a = bench(dividido({ offhand: rot }));
    a.hold(1.2, true, false);
    expect(a.armament.spinLevel).toBe(0);
    const b = bench(dividido({ offhand: rot }));
    b.hold(1.2, false, true);
    expect(b.armament.spinLevel).toBeGreaterThan(0.5);
    expect(b.mech.status.spinning).toBe(true);
    b.hold(0.05, false, false);
    expect(b.mech.status.spinning).toBe(false);
  });

  it('o trilho na mão esquerda carrega só com o Ataque 2 e interromper exige recarga (a carga é por mão)', () => {
    const trilho: WeaponStats = Object.freeze({ ...weapon('railgun'), heatPerShot: 0.001 });
    const a = bench(dividido({ offhand: trilho }));
    a.hold(0.3, true, false);
    expect(a.armament.primaryCharge).toBe(0); // o Ataque 1 não carrega a esquerda
    const b = bench(dividido({ offhand: trilho }));
    b.hold(0.3, false, true);
    expect(b.armament.primaryCharge).toBeGreaterThan(0);
    expect(b.from('leftHand')).toHaveLength(0); // ainda carregando
    b.hold(0.1, false, false);
    expect(b.armament.primaryCharge).toBe(0); // soltou: a carga zera
  });

  it('sem a segunda arma (offhand vazio) o Ataque 2 solta só os ombros', () => {
    const { shots, hold } = bench(dividido({ offhand: null }));
    hold(0.1, false, true);
    expect(shots.map((s) => s.mount).sort()).toEqual(['leftShoulder', 'rightShoulder']);
  });

  it('com o míssil teleguiado nos ombros e o plasma na mão esquerda: o aperto gasta UM tiro do carregador e o plasma segue no ritmo dele', () => {
    const tele = COOL('seeker');
    const { armament, shots, hold } = bench(dividido({ secondary: tele }));
    hold(0.1, false, true);
    expect(shots.filter((s) => s.kind === 'rocket').map((s) => s.mount).sort()).toEqual(['leftShoulder', 'rightShoulder']);
    expect(shots.filter((s) => s.mount === 'leftHand')).toHaveLength(1);
    expect(armament.launcher.ammo).toBe(tele.magazine - 1);
  });

  it('a mão esquerda do Marauder nunca solta projétil de ombro nem o contrário: cada encaixe só atira a arma dele', () => {
    const { shots, hold } = bench(dividido());
    hold(2, true, true);
    for (const s of shots) {
      if (s.mount === 'rightHand') expect(s.w.id).toBe('blaster');
      else if (s.mount === 'leftHand') expect(s.w.id).toBe('plasma');
      else expect(s.w.id).toBe('sonic');
    }
  });
});
