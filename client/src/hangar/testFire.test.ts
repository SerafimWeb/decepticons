import { describe, expect, it } from 'vitest';
import { weapon } from '../combat/weapons';
import { VECTOR09_STATS } from '../entities/chassis';
import { Hangar, PRESETS_STORAGE_KEY } from './Hangar';
import { FACTORY_LOADOUT, factorySpec, type LoadoutSpec } from './loadout';
import { MOVING_TARGET_PERIOD_S, MOVING_TARGET_RANGE_M, movingTargetOffset, testAt, testFire, TEST_FIRE_S } from './testFire';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe('Hangar: teste de disparo', () => {
  it('gatilho apertado por 4 s: os tiros saem na cadência da arma até o calor travar, como no jogo', () => {
    const w = weapon('plasma');
    const t = testFire(VECTOR09_STATS, w);
    expect(t.seconds).toBe(TEST_FIRE_S);
    expect(t.overheatAt).not.toBeNull();
    // Até travar, um tiro a cada intervalo da arma; o calor trava por volta do 15º tiro.
    const before = t.shots.filter((s) => s < t.overheatAt!);
    expect(before.length).toBeGreaterThanOrEqual(14);
    expect(before.length).toBeLessThanOrEqual(16);
    for (let i = 1; i < before.length; i++) expect(before[i]! - before[i - 1]!).toBeCloseTo(w.fireInterval, 1);
    // Travado, não sai tiro.
    expect(t.shots.some((s) => s > t.overheatAt! && s < t.overheatAt! + 1)).toBe(false);
    expect(t.damage).toBe(t.shots.length * w.damage);
  });

  it('o andamento na tela: tiros e dano até o segundo pedido, calor subindo e a trava', () => {
    const t = testFire(VECTOR09_STATS, weapon('plasma'));
    const early = testAt(t, 0.5);
    const late = testAt(t, t.overheatAt! + 0.1);
    expect(early.shots).toBeGreaterThan(0);
    expect(late.shots).toBeGreaterThan(early.shots);
    expect(late.heat).toBeGreaterThan(early.heat);
    expect(late.locked).toBe(true);
    expect(early.locked).toBe(false);
  });

  it('foguetes: o carregador de 4 sai e depois vem a recarga (o teste mostra o ritmo real)', () => {
    const t = testFire(VECTOR09_STATS, weapon('rockets'));
    expect(t.shots.filter((s) => s < 1.2).length).toBe(4);
    expect(t.shots.filter((s) => s >= 1.2 && s < 2).length).toBeLessThanOrEqual(1);
  });
});

describe('Hangar: alvo móvel do estande (Codex)', () => {
  it('é puro e determinístico: o mesmo t sempre dá o mesmo deslocamento', () => {
    expect(movingTargetOffset(3.7)).toBe(movingTargetOffset(3.7));
  });

  it('nunca passa da faixa e volta a zero a cada ciclo completo', () => {
    for (let t = 0; t < 40; t += 0.3) expect(Math.abs(movingTargetOffset(t))).toBeLessThanOrEqual(MOVING_TARGET_RANGE_M + 1e-9);
    expect(movingTargetOffset(0)).toBeCloseTo(0, 5);
    expect(movingTargetOffset(MOVING_TARGET_PERIOD_S)).toBeCloseTo(0, 5);
  });
});

describe('Hangar: montagens salvas nos atalhos 1 a 4', () => {
  const heavy: LoadoutSpec = { v: 1, chassis: 'vector09', right: { id: 'plasma', tier: 2 }, left: { id: 'rockets', tier: 0 } };

  it('salva e lê de volta; montagem que não cabe na carga não é salva', () => {
    const store = memory();
    const h = new Hangar(store, '');
    expect(h.presets()).toEqual([null, null, null, null]);
    expect(h.savePreset(1, heavy).ok).toBe(true);
    expect(h.savePreset(2, factorySpec('android')).ok).toBe(true);
    expect(h.savePreset(3, { ...heavy, left: { id: 'rockets', tier: 2 } }).ok).toBe(false);
    expect(new Hangar(store, '').presets()).toEqual([null, heavy, factorySpec('android'), null]);
  });

  it('salvo adulterado vira atalho vazio, sem quebrar os outros', () => {
    const store = memory({ [PRESETS_STORAGE_KEY]: JSON.stringify([FACTORY_LOADOUT, { chassis: 'hack' }, 'x']) });
    expect(new Hangar(store, '').presets()).toEqual([FACTORY_LOADOUT, null, null, null]);
    expect(new Hangar(memory({ [PRESETS_STORAGE_KEY]: '{quebrado' }), '').presets()).toEqual([null, null, null, null]);
  });
});
