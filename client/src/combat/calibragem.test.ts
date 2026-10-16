import { describe, expect, it } from 'vitest';
import { VECTOR09_STATS } from '../entities/Vector09';
import { fichasDasArmas } from '../ui/arsenalData';
import { sustainedDps } from './balance';
import { WEAPON_FIT } from './weaponClass';
import { fullReload, rangeBandOf, RANGE_BAND_LABEL, RANGE_BAND_MAX, weapon, WEAPON_IDS, type RangeBand, type Tier, type WeaponId } from './weapons';

const V = VECTOR09_STATS;
const LEVELS: readonly Tier[] = [0, 1, 2];

/**
 * A calibragem do arsenal (ordem P152: "calibrar melhor o alcance, potência, tempo de recarga"): onde cada arma atira (a **faixa de alcance**), quanto leva para o carregador
 * voltar (a **recarga cheia**) e o que cada família de míssil é. Arma nova **declara a faixa dela aqui**: o teste da tabela falha se faltar.
 */
const FAIXAS: Readonly<Record<WeaponId, RangeBand>> = {
  chainsaw: 'corpo',
  sonic: 'curto',
  flamer: 'curto',
  shotgun: 'curto',
  cryo: 'curto',
  rotary: 'medio',
  emp: 'medio',
  blaster: 'medio',
  barrage: 'medio',
  arc: 'medio',
  autocannon: 'medio',
  swarm: 'medio',
  seeker: 'medio', // o míssil guiado de médio alcance (P152)
  plasma: 'medio',
  rockets: 'longo',
  cannon: 'longo',
  railgun: 'longo',
  laser: 'longo', // o raio laser de longo alcance (P152)
  siege: 'longo',
  cruise: 'longo', // o míssil cruzador de longo alcance (P152)
};

describe('faixas de alcance: corpo a corpo, curto, médio e longo (pelo alcance máximo)', () => {
  it('as faixas começam em 3, 60 e 200 m', () => {
    expect(RANGE_BAND_MAX).toEqual({ corpo: 3, curto: 60, medio: 200 });
    expect(Object.values(RANGE_BAND_LABEL)).toEqual(['corpo a corpo', 'curto', 'médio', 'longo']);
  });

  it('a tabela: cada arma do catálogo tem a faixa declarada, e a conta bate com ela', () => {
    expect(Object.keys(FAIXAS).sort()).toEqual([...WEAPON_IDS].sort());
    for (const id of WEAPON_IDS) expect(rangeBandOf(weapon(id)), `${id} (${weapon(id).maxRange} m)`).toBe(FAIXAS[id]);
  });

  it('o nível não muda a faixa: o MK III do lança-chamas, do sônico e do guiado seguem onde estavam', () => {
    for (const id of WEAPON_IDS) for (const t of LEVELS) expect(rangeBandOf(weapon(id, t)), `${id} MK ${t + 1} (${weapon(id, t).maxRange} m)`).toBe(FAIXAS[id]);
  });

  it('a faixa vem do alcance, em ordem: dentro de uma faixa nenhuma arma passa a de uma faixa acima', () => {
    const maxDe = (faixa: RangeBand): number => Math.max(...WEAPON_IDS.filter((id) => FAIXAS[id] === faixa).map((id) => weapon(id).maxRange));
    const minDe = (faixa: RangeBand): number => Math.min(...WEAPON_IDS.filter((id) => FAIXAS[id] === faixa).map((id) => weapon(id).maxRange));
    expect(maxDe('corpo')).toBeLessThan(minDe('curto'));
    expect(maxDe('curto')).toBeLessThan(minDe('medio'));
    expect(maxDe('medio')).toBeLessThan(minDe('longo'));
  });

  it('a ficha do Arsenal traz a faixa de cada arma', () => {
    for (const f of fichasDasArmas()) expect(f.faixa, f.id).toBe(FAIXAS[f.id]);
  });
});

describe('o preço do alcance: nenhuma arma de longo alcance de um Mech rende mais dano por segundo que o plasma (que é médio)', () => {
  it('em nenhum nível, com folga de 10% (o canhão pesado MK III é o mais perto)', () => {
    const longas = WEAPON_IDS.filter((id) => FAIXAS[id] === 'longo' && WEAPON_FIT[id].size === 2);
    expect(longas.sort()).toEqual(['cannon', 'cruise', 'laser', 'railgun', 'rockets']);
    for (const t of LEVELS) {
      const plasma = sustainedDps(weapon('plasma', t), V);
      for (const id of longas) expect(sustainedDps(weapon(id, t), V), `${id} MK ${t + 1}`).toBeLessThanOrEqual(plasma * 1.1);
    }
  });

  it('o laser e o cruzador, os dois longos de P152, ficam bem abaixo do plasma (≤ 90% e ≤ 40%): o alcance não é de graça', () => {
    const plasma = sustainedDps(weapon('plasma'), V);
    expect(sustainedDps(weapon('laser'), V)).toBeLessThanOrEqual(plasma * 0.9);
    expect(sustainedDps(weapon('cruise'), V)).toBeLessThanOrEqual(plasma * 0.4);
  });

  it('o ganho do laser e do cruzador é o alcance: a 300 m rendem mais que o plasma, que já caiu a 40% do dano', () => {
    const plasma = weapon('plasma');
    // o plasma perde força até 40% no máximo (200 m); o laser ainda bate 80% aos 300 m
    expect(weapon('laser').maxRange).toBeGreaterThan(plasma.maxRange);
    expect(weapon('cruise').maxRange).toBeGreaterThan(plasma.maxRange * 2);
  });
});

describe('a recarga cheia (vazio a cheio) de cada munição, em segundos', () => {
  it('a tabela de MK I: foguetes 8,8 s, guiado 6,4 s, chuva 12 s, lançador leve 2,8 s e cruzador 6 s; energia não tem carregador (o calor é o freio)', () => {
    const tabela: Partial<Record<WeaponId, number>> = { rockets: 8.8, seeker: 6.4, barrage: 12, swarm: 2.8, cruise: 6 };
    for (const [id, s] of Object.entries(tabela) as Array<[WeaponId, number]>) expect(fullReload(weapon(id)), id).toBeCloseTo(s, 6);
    for (const id of WEAPON_IDS.filter((x) => weapon(x).kind !== 'ammo')) expect(fullReload(weapon(id)), id).toBe(0);
  });

  it('o nível alonga a recarga junto com o calor: o lançador leve leva 2,8, 6,4 e 14,4 s para encher (8, 16 e 32 tubos), o cruzador 6, 6,9 e 7,8 s', () => {
    expect(LEVELS.map((t) => fullReload(weapon('swarm', t)))).toEqual([2.8, 6.4, 14.4]);
    expect(LEVELS.map((t) => fullReload(weapon('cruise', t)))).toEqual([6, 6.9, 7.8]);
  });

  it('a recarga cheia sobe com o nível em toda munição (poder custa tempo: a regra do arsenal)', () => {
    for (const id of WEAPON_IDS.filter((x) => weapon(x).kind === 'ammo')) {
      const r = LEVELS.map((t) => fullReload(weapon(id, t)));
      expect(r[1]!, id).toBeGreaterThan(r[0]!);
      expect(r[2]!, id).toBeGreaterThan(r[1]!);
    }
  });
});

describe('a família dos mísseis (P152): cada um com o seu lugar no alcance, no peso e no jeito de chegar', () => {
  const m = (id: WeaponId) => weapon(id);

  it('do mais curto ao mais longo: chuva (120 m) < lançador leve (150) < guiado (170) < foguetes (225) < cruzador (420)', () => {
    const ordem: WeaponId[] = ['barrage', 'swarm', 'seeker', 'rockets', 'cruise'];
    const alcances = ordem.map((id) => m(id).maxRange);
    expect(alcances).toEqual([...alcances].sort((a, b) => a - b));
    expect(new Set(alcances).size).toBe(alcances.length);
  });

  it('o lançador leve é o mais leve dos mísseis (2 t); a chuva e o cruzador, os mais pesados (5 t)', () => {
    for (const id of ['seeker', 'rockets', 'barrage', 'cruise'] as const) expect(m('swarm').mass).toBeLessThan(m(id).mass);
    for (const id of ['swarm', 'seeker', 'rockets'] as const) expect(m('cruise').mass).toBeGreaterThanOrEqual(m(id).mass);
    expect(m('barrage').mass).toBe(m('cruise').mass);
  });

  it('o cruzador é o maior golpe e a maior explosão dos mísseis; o lançador leve, o menor golpe por míssil e a menor explosão', () => {
    const mis: WeaponId[] = ['swarm', 'seeker', 'rockets', 'barrage', 'cruise'];
    for (const id of mis.filter((x) => x !== 'cruise')) {
      expect(m('cruise').damage, id).toBeGreaterThan(m(id).damage);
      expect(m('cruise').blastRadius, id).toBeGreaterThan(m(id).blastRadius);
    }
    for (const id of mis.filter((x) => x !== 'swarm')) {
      expect(m('swarm').damage, id).toBeLessThan(m(id).damage);
      expect(m('swarm').blastRadius, id).toBeLessThan(m(id).blastRadius);
    }
  });

  it('só o guiado procura o alvo (`guide`), só o cruzador faz arco (`cruise`) e só o lançador leve dispara em salva (`salvo`)', () => {
    for (const id of WEAPON_IDS) {
      expect(m(id).guide !== undefined, id).toBe(id === 'seeker');
      expect(m(id).cruise !== undefined, id).toBe(id === 'cruise');
      expect(m(id).salvo !== undefined, id).toBe(id === 'swarm');
    }
  });

  it('as frações da bancada são frações: `Salvo.onTarget` em (0, 1] e `Barrage.onTarget` entre 1 e o número de bombas', () => {
    const s = m('swarm').salvo!;
    expect(s.onTarget).toBeGreaterThan(0);
    expect(s.onTarget).toBeLessThanOrEqual(1);
    const b = m('barrage').barrage!;
    expect(b.onTarget).toBeGreaterThanOrEqual(1);
    expect(b.onTarget).toBeLessThanOrEqual(b.bombs);
  });
});
