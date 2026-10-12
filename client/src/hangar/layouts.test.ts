import { describe, expect, it } from 'vitest';
import { SHOULDER_TRIGGERS, SPLIT_SHOULDER_TRIGGERS } from '../combat/mounts';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import { triggersOf } from '../entities/MechBase';
import { factorySpec, layoutCount, loadoutKey, parseLoadoutKey, slotAttack, specWeapons, validateLoadout, type LoadoutSpec } from './loadout';

const MARAUDER: LoadoutSpec = { v: 2, chassis: 'marauder', right: { id: 'blaster', tier: 0 }, left: { id: 'plasma', tier: 0 }, shoulders: { id: 'sonic', tier: 0 }, module: null };
const DIVIDIDO: LoadoutSpec = { ...MARAUDER, layout: 1 };

/**
 * O layout de gatilhos na montagem (P95): quem tem mais de um jeito de dividir os encaixes entre o Ataque 1 e o Ataque 2 escolhe no Hangar, e a escolha vai no link, no JOIN e no
 * roster (a chave de texto v2 ganha um último grupo `L1`), validada pelo servidor.
 */
describe('o layout na montagem: validação', () => {
  it('só o Marauder tem mais de um layout; os outros chassis têm um só', () => {
    expect(layoutCount('marauder')).toBe(2);
    for (const id of Object.keys(CHASSIS) as ChassisId[]) if (id !== 'marauder') expect(layoutCount(id), id).toBe(1);
  });

  it('o layout 1 do Marauder vale, e a montagem leva o layout para o Loadout (o Mech usa)', () => {
    const c = validateLoadout(DIVIDIDO);
    expect(c.ok).toBe(true);
    expect(c.ok && c.loadout.layout).toBe(1);
    expect(c.ok && triggersOf(CHASSIS.marauder, c.loadout.layout)).toBe(SPLIT_SHOULDER_TRIGGERS);
    const padrao = validateLoadout(MARAUDER);
    expect(padrao.ok && padrao.loadout.layout).toBeUndefined(); // o padrão não escreve nada: as montagens de sempre ficam iguais
    expect(padrao.ok && triggersOf(CHASSIS.marauder, padrao.ok ? padrao.loadout.layout : undefined)).toBe(SHOULDER_TRIGGERS);
  });

  it('layout fora da lista, negativo, fracionário ou de um chassi que só tem um: recusado (encaixe)', () => {
    expect(validateLoadout({ ...MARAUDER, layout: 2 })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...MARAUDER, layout: -1 })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...MARAUDER, layout: 0.5 })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...MARAUDER, layout: Number.NaN })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...factorySpec('vector09'), v: 2, module: null, layout: 1 })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...factorySpec('onca'), v: 2, module: null, layout: 1 })).toMatchObject({ ok: false, error: 'encaixe' });
  });

  it('o layout diferente de 0 só vive na versão 2 do formato', () => {
    expect(validateLoadout({ ...MARAUDER, v: 1, layout: 1 })).toMatchObject({ ok: false, error: 'formato' });
  });

  it('a carga não muda com o layout: os ombros contam duas vezes nos dois (a mão esquerda segue contando uma)', () => {
    const a = validateLoadout(MARAUDER);
    const b = validateLoadout(DIVIDIDO);
    expect(a.ok && b.ok).toBe(true);
    expect(b.ok && b.mass).toBe(a.ok ? a.mass : -1);
    expect(specWeapons(DIVIDIDO)).toHaveLength(specWeapons(MARAUDER).length);
    expect(specWeapons(DIVIDIDO).filter((w) => w.id === 'sonic')).toHaveLength(2);
  });
});

describe('o layout na chave de texto (link, JOIN e roster)', () => {
  it('vai e volta: o layout 1 vira o último grupo L1 e o padrão não escreve nada', () => {
    expect(loadoutKey(DIVIDIDO)).toBe('v2.marauder.blaster-0.plasma-0.sonic-0.-.L1');
    expect(parseLoadoutKey('v2.marauder.blaster-0.plasma-0.sonic-0.-.L1')).toEqual(DIVIDIDO);
    expect(loadoutKey(MARAUDER)).toBe('v2.marauder.blaster-0.plasma-0.sonic-0.-');
    expect(parseLoadoutKey(loadoutKey(MARAUDER))).toEqual(MARAUDER);
    expect(parseLoadoutKey(loadoutKey(DIVIDIDO))).toEqual(DIVIDIDO);
  });

  it('as chaves antigas (v1 e v2 sem layout) seguem lendo igual', () => {
    expect(parseLoadoutKey('v1.marauder.blaster-0.blaster-0.rockets-0')).toMatchObject({ v: 1, chassis: 'marauder' });
    expect(parseLoadoutKey('v2.vector09.plasma-0.rockets-0.-.fire')).toMatchObject({ v: 2, module: 'fire' });
  });

  it('o layout convive com o módulo extra: v2.marauder...fire.L1', () => {
    const spec: LoadoutSpec = { ...DIVIDIDO, module: 'frontal', left: { id: 'blaster', tier: 0 }, shoulders: { id: 'rockets', tier: 0 } };
    const key = loadoutKey(spec);
    expect(key.endsWith('.frontal.L1')).toBe(true);
    expect(parseLoadoutKey(key)).toEqual(spec);
  });

  it('chave com layout inválido (L0, L2, L9, texto) ou num chassi que só tem um: null', () => {
    for (const ruim of ['L0', 'L2', 'L9', 'X1', 'L', 'L10', '1']) {
      expect(parseLoadoutKey(`v2.marauder.blaster-0.plasma-0.sonic-0.-.${ruim}`), ruim).toBeNull();
    }
    expect(parseLoadoutKey('v2.vector09.plasma-0.rockets-0.-.-.L1')).toBeNull();
    expect(parseLoadoutKey('v2.marauder.blaster-0.plasma-0.sonic-0.-.L1.L1')).toBeNull();
  });
});

describe('o ataque de cada ranhura muda com o layout', () => {
  it('padrão: os dois braços no Ataque 1, os ombros no 2; dividido: o braço direito no 1, o esquerdo e os ombros no 2', () => {
    expect(['right', 'left', 'shoulders'].map((s) => slotAttack(s as never, 'marauder'))).toEqual([1, 1, 2]);
    expect(['right', 'left', 'shoulders'].map((s) => slotAttack(s as never, 'marauder', 0))).toEqual([1, 1, 2]);
    expect(['right', 'left', 'shoulders'].map((s) => slotAttack(s as never, 'marauder', 1))).toEqual([1, 2, 2]);
  });

  it('o layout de um robô que só tem um é ignorado (cai no padrão dele)', () => {
    expect(slotAttack('left', 'vector09', 1)).toBe(2);
    expect(slotAttack('right', 'vector09', 1)).toBe(1);
  });
});
