import { describe, expect, it } from 'vitest';
import { ANDROID_STATS } from '../entities/Android';
import { VECTOR09_STATS } from '../entities/Vector09';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { sustainedDps, timeToKill } from './balance';
import { FireTimer } from './trigger';
import { hitDamage, rangeFactor, splashDamage, TIERS, weapon, WEAPON_IDS, type Tier } from './weapons';

const V = VECTOR09_STATS;
const TORSO = V.maxModuleHealth.torso;
const LEVELS: readonly Tier[] = [0, 1, 2];
const MECH_WEAPONS = ['plasma', 'rockets'] as const;

describe('arsenal: três níveis com a mesma regra', () => {
  it('toda arma tem MK I, MK II e MK III; cada nível bate mais forte, esquenta mais e pesa mais', () => {
    expect(TIERS.map((t) => t.label)).toEqual(['MK I', 'MK II', 'MK III']);
    for (const id of WEAPON_IDS) {
      const [a, b, c] = LEVELS.map((t) => weapon(id, t));
      expect(b!.damage).toBeGreaterThan(a!.damage);
      expect(c!.damage).toBeGreaterThan(b!.damage);
      expect(c!.heatPerShot).toBeGreaterThan(a!.heatPerShot);
      expect(c!.mass).toBeGreaterThan(b!.mass);
      expect(b!.mass).toBeGreaterThan(a!.mass);
      // A cadência e o alcance são da arma, não do nível: salvo a que declara `tierRange` / `tierRate` (o lança-chamas: mais longe e mais pressão a cada nível).
      if (!a!.tierRate) expect(c!.fireInterval).toBe(a!.fireInterval);
      else expect(c!.fireInterval).toBeLessThan(a!.fireInterval);
      if (!a!.tierRange) expect(c!.maxRange).toBe(a!.maxRange);
      else expect(c!.maxRange).toBeGreaterThan(a!.maxRange);
    }
  });

  it('pedir a mesma arma duas vezes devolve o mesmo objeto (nada é criado no tick)', () => {
    expect(weapon('plasma', 1)).toBe(weapon('plasma', 1));
    expect(Object.isFrozen(weapon('rockets', 2))).toBe(true);
  });
});

describe('equilíbrio: sem apelação (Vector-09, torso de 300, todos os tiros no alvo)', () => {
  it('o plasma MK I derruba um Mech em 5 a 7,5 s de gatilho apertado: dá tempo de reagir', () => {
    const t = timeToKill([weapon('plasma')], V, TORSO);
    expect(t).toBeGreaterThan(5);
    expect(t).toBeLessThan(7.5);
  });

  it('nenhuma arma, em nenhum nível, derruba um Mech sozinha em menos de 4,5 s', () => {
    for (const id of MECH_WEAPONS) for (const t of LEVELS) expect(timeToKill([weapon(id, t)], V, TORSO)).toBeGreaterThan(4.5);
  });

  it('nenhum combo dos dois braços, em nenhum nível, derruba em menos de 2,5 s: o calor do Mech segura', () => {
    for (const p of LEVELS) for (const r of LEVELS) expect(timeToKill([weapon('plasma', p), weapon('rockets', r)], V, TORSO)).toBeGreaterThan(2.5);
  });

  it('combinar os braços rende: o combo derruba mais rápido que o plasma sozinho', () => {
    expect(timeToKill([weapon('plasma'), weapon('rockets')], V, TORSO)).toBeLessThan(timeToKill([weapon('plasma')], V, TORSO) * 0.75);
  });

  it('subir de nível se sente, mas não decide sozinho: o MK III derruba de 10% a 40% mais rápido que o MK I', () => {
    for (const id of MECH_WEAPONS) {
      const ratio = timeToKill([weapon(id, 2)], V, TORSO) / timeToKill([weapon(id, 0)], V, TORSO);
      expect(ratio).toBeGreaterThan(0.6);
      expect(ratio).toBeLessThan(0.9);
    }
  });

  it('poder custa carga: o dano por tonelada cai do MK I ao MK III (quem monta escolhe onde gastar)', () => {
    for (const id of WEAPON_IDS) {
      const perTon = LEVELS.map((t) => sustainedDps(weapon(id, t), V) / weapon(id, t).mass);
      expect(perTon[1]).toBeLessThan(perTon[0]!);
      expect(perTon[2]).toBeLessThan(perTon[1]!);
    }
  });

  it('mirar na perna rende: a perna cai em menos da metade do tempo do torso', () => {
    const leg = timeToKill([weapon('plasma')], V, V.maxModuleHealth.leftLeg);
    expect(leg).toBeLessThan(timeToKill([weapon('plasma')], V, TORSO) / 2);
  });

  it('arma leve não ameaça blindagem pesada: o blaster leva mais de 25 s para o torso', () => {
    expect(timeToKill([weapon('blaster')], ANDROID_STATS, TORSO)).toBeGreaterThan(25);
  });

  it('motosserra do andróide: chata, não mortal: sozinha leva mais de 6 s para arrancar uma perna', () => {
    expect(ANDROID_STATS.loadout.primary.id).toBe('chainsaw');
    expect(timeToKill([weapon('chainsaw')], ANDROID_STATS, V.maxModuleHealth.leftLeg)).toBeGreaterThan(6);
  });

  it('o andróide segue frágil: 2 tiros de plasma MK I no peito derrubam', () => {
    const p = weapon('plasma').damage;
    expect(p).toBeLessThan(ANDROID_STATS.maxModuleHealth.torso);
    expect(2 * p).toBeGreaterThanOrEqual(ANDROID_STATS.maxModuleHealth.torso);
  });
});

describe('dano e distância', () => {
  it('plasma: dano cheio até o alcance ótimo, cai em linha reta até 40% no máximo', () => {
    const w = weapon('plasma');
    expect(rangeFactor(w, 0)).toBe(1);
    expect(rangeFactor(w, w.optimalRange)).toBe(1);
    expect(rangeFactor(w, (w.optimalRange + w.maxRange) / 2)).toBeCloseTo((1 + w.minFactor) / 2, 5);
    expect(rangeFactor(w, w.maxRange)).toBe(w.minFactor);
    expect(rangeFactor(w, w.maxRange * 3)).toBe(w.minFactor);
    expect(hitDamage(w, 10)).toBe(w.damage);
    expect(hitDamage(w, w.maxRange)).toBe(Math.round(w.damage * w.minFactor));
  });

  it('explosão: máximo no centro, metade no meio do raio, zero na borda (em todo nível)', () => {
    for (const t of LEVELS) {
      const r = weapon('rockets', t);
      expect(splashDamage(r, 0)).toBe(r.damage);
      expect(splashDamage(r, r.blastRadius / 2)).toBe(Math.round(r.damage / 2));
      expect(splashDamage(r, r.blastRadius)).toBe(0);
    }
  });
});

describe('cadência no tick fixo', () => {
  it('a média de tiros bate com o intervalo da arma, sem arredondar para o tick', () => {
    const timer = new FireTimer();
    const interval = weapon('plasma').fireInterval; // 0,22 s = 13,2 ticks
    let shots = 0;
    for (let i = 0; i < 60 * 22; i++) {
      timer.fixedUpdate(FIXED_DT);
      if (timer.ready) {
        shots++;
        timer.shot(interval);
      }
    }
    // 22 s / 0,22 s = 100 tiros (esperar ticks inteiros daria ~94).
    expect(shots).toBeGreaterThanOrEqual(99);
    expect(shots).toBeLessThanOrEqual(101);
  });

  it('soltar o gatilho não guarda crédito: depois de parado, um tiro e o intervalo inteiro de novo', () => {
    const timer = new FireTimer();
    for (let i = 0; i < 300; i++) timer.fixedUpdate(FIXED_DT);
    expect(timer.ready).toBe(true);
    timer.shot(0.22);
    let ticks = 0;
    do {
      timer.fixedUpdate(FIXED_DT);
      ticks++;
    } while (!timer.ready);
    expect(ticks).toBeGreaterThanOrEqual(12);
  });
});

describe('escopeta (Lancer): dano alto de perto, alcance menor que o do blaster', () => {
  const S = weapon('shotgun');
  const P = weapon('plasma');
  const B = weapon('blaster');

  it('o alcance é mais curto que o do blaster, no ótimo e no máximo', () => {
    expect(S.optimalRange).toBeLessThan(B.optimalRange);
    expect(S.maxRange).toBeLessThan(B.maxRange);
  });

  it('de perto bate mais que o plasma e que o blaster; longe, quase nada', () => {
    expect(hitDamage(S, 3)).toBeGreaterThan(hitDamage(P, 3) * 2);
    expect(hitDamage(S, 3)).toBeGreaterThan(hitDamage(B, 3) * 10);
    expect(hitDamage(S, S.maxRange)).toBeLessThanOrEqual(Math.round(S.damage * 0.1));
    expect(hitDamage(S, 60)).toBe(hitDamage(S, S.maxRange)); // passou do alcance: não piora nem melhora
    expect(hitDamage(S, 40)).toBeLessThan(hitDamage(P, 40));
  });

  it('sozinha, de perto, derruba o torso de um Mech mais rápido que o plasma, sem passar de 2,5 s no MK III', () => {
    expect(timeToKill([S], V, TORSO)).toBeLessThan(timeToKill([P], V, TORSO));
    expect(timeToKill([S], V, TORSO)).toBeGreaterThan(3.5);
    expect(timeToKill([weapon('shotgun', 2)], V, TORSO)).toBeGreaterThan(2.5);
  });

  it('é de energia: sem carregador, só o calor segura', () => {
    expect(S.kind).toBe('energy');
    expect(S.magazine).toBe(0);
  });
});

describe('chuva de mísseis: arma de área que cobre terreno, não derruba sozinha', () => {
  const R = weapon('barrage');
  const P = weapon('plasma');

  it('é munição com carregador e desenho de chuva; todo nível tem o mesmo desenho e o dano por bomba cresce', () => {
    expect(R.kind).toBe('ammo');
    expect(R.magazine).toBeGreaterThan(0);
    expect(R.barrage).toBeDefined();
    const b = R.barrage!;
    expect(b.bombs).toBeGreaterThanOrEqual(4);
    expect(b.onTarget).toBeGreaterThan(0);
    expect(b.onTarget).toBeLessThanOrEqual(b.bombs);
    expect(b.ascent).toBeGreaterThan(0);
    expect(b.fall).toBeGreaterThan(0);
    // O aviso no chão dura do lançamento até a primeira bomba: tempo de sair da frente.
    expect(b.ascent + b.fall).toBeGreaterThanOrEqual(1.5);
    for (const t of LEVELS) expect(weapon('barrage', t).barrage).toEqual(b);
    expect(weapon('barrage', 2).damage).toBeGreaterThan(R.damage);
  });

  it('sozinha leva muito mais de 10 s para derrubar um torso (é apoio): em nenhum nível passa a meta de 4,5 s dos outros', () => {
    for (const t of LEVELS) expect(timeToKill([weapon('barrage', t)], V, TORSO)).toBeGreaterThan(10);
  });

  it('rende menos dano sustentado que o plasma e esquenta muito por disparo', () => {
    for (const t of LEVELS) expect(sustainedDps(weapon('barrage', t), V)).toBeLessThan(sustainedDps(P, V));
    expect(R.heatPerShot).toBeGreaterThanOrEqual(weapon('rockets').heatPerShot);
  });

  it('com o plasma, nenhum nível dos dois derruba o torso em menos de 2,5 s (a meta dos dois braços juntos)', () => {
    for (const p of LEVELS) for (const r of LEVELS) expect(timeToKill([weapon('plasma', p), weapon('barrage', r)], V, TORSO), `plasma ${p} + chuva ${r}`).toBeGreaterThan(2.5);
  });

  it('a bancada conta só as bombas que pegam um alvo parado (onTarget): contar todas faria a arma derrubar um torso em ~1 s', () => {
    const com = (onTarget: number) => timeToKill([{ ...R, barrage: { ...R.barrage!, onTarget } }], V, TORSO);
    expect(com(R.barrage!.onTarget)).toBeGreaterThan(10);
    expect(com(1)).toBeGreaterThan(com(R.barrage!.onTarget));
    expect(com(R.barrage!.bombs)).toBeLessThan(2.5);
  });
});

describe('trilho e EMP: papéis diferentes sem morte instantânea', () => {
  it('todo nível do trilho leva mais de 4,5 s sozinho, e com EMP mais de 2,5 s', () => {
    for(const t of LEVELS){
      expect(timeToKill([weapon('railgun',t)],V,TORSO)).toBeGreaterThan(4.5);
      for(const e of LEVELS) expect(timeToKill([weapon('railgun',t),weapon('emp',e)],V,TORSO)).toBeGreaterThan(2.5);
    }
  });
  it('EMP é apoio: lento, pouco dano e mais de 20 s para derrubar sozinho', () => {
    expect(weapon('emp').speed).toBeLessThan(weapon('plasma').speed);
    for(const t of LEVELS) expect(timeToKill([weapon('emp',t)],V,TORSO)).toBeGreaterThan(20);
    expect(weapon('railgun').speed).toBeGreaterThan(weapon('plasma').speed*5);
  });
});
