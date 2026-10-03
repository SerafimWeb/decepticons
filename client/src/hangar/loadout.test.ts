import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { weapon, type Tier } from '../combat/weapons';
import { VECTOR09_STATS, Vector09 } from '../entities/Vector09';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Hangar, HANGAR_STORAGE_KEY } from './Hangar';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import { armOptions, FACTORY_LOADOUT, factorySpec, loadoutKey, parseLoadoutKey, validateLoadout, type LoadoutSpec } from './loadout';

const LEVELS: Tier[] = [0, 1, 2];
const build = (p: Tier, r: Tier | null): LoadoutSpec => ({ v: 1, chassis: 'vector09', right: { id: 'plasma', tier: p }, left: r === null ? null : { id: 'rockets', tier: r } });

/** Armazenamento de mentira (o do navegador não existe no Node). */
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe('Hangar: contrato da montagem', () => {
  it('a montagem de fábrica é válida e é a do Vector-09', () => {
    const c = validateLoadout(FACTORY_LOADOUT);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.loadout.primary).toBe(VECTOR09_STATS.loadout.primary);
    expect(c.loadout.secondary).toBe(VECTOR09_STATS.loadout.secondary);
    expect(c.mass).toBe(7);
    expect(c.capacity).toBe(VECTOR09_STATS.weaponCapacity);
  });

  it('nada é confiado: formato, chassi, arma e nível inválidos são recusados', () => {
    expect(validateLoadout(null)).toMatchObject({ ok: false, error: 'formato' });
    expect(validateLoadout('v1')).toMatchObject({ ok: false, error: 'formato' });
    expect(validateLoadout({ ...FACTORY_LOADOUT, v: 2 })).toMatchObject({ ok: false, error: 'formato' });
    expect(validateLoadout({ ...FACTORY_LOADOUT, chassis: 'ferret' })).toMatchObject({ ok: false, error: 'chassi' });
    expect(validateLoadout({ ...FACTORY_LOADOUT, chassis: '__proto__' })).toMatchObject({ ok: false, error: 'chassi' });
    expect(validateLoadout({ ...FACTORY_LOADOUT, right: { id: 'laser', tier: 0 } })).toMatchObject({ ok: false, error: 'arma' });
    expect(validateLoadout({ ...FACTORY_LOADOUT, right: { id: 'plasma', tier: 3 } })).toMatchObject({ ok: false, error: 'nível' });
    expect(validateLoadout({ ...FACTORY_LOADOUT, right: { id: 'plasma', tier: '1' } })).toMatchObject({ ok: false, error: 'nível' });
    expect(validateLoadout({ ...FACTORY_LOADOUT, right: null })).toMatchObject({ ok: false, error: 'formato' });
  });

  it('cada braço aceita o seu tipo: energia no direito, munição no esquerdo; o blaster é só dos andróides', () => {
    expect(armOptions('right')).toEqual(['plasma']);
    expect(armOptions('left')).toEqual(['rockets']);
    expect(validateLoadout({ ...FACTORY_LOADOUT, right: { id: 'rockets', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...FACTORY_LOADOUT, left: { id: 'plasma', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...FACTORY_LOADOUT, right: { id: 'blaster', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout(build(0, null)).ok).toBe(true); // braço esquerdo vazio é permitido
  });

  it('poder custa carga: os dois braços no máximo não cabem; MK III num braço e MK I no outro cabem', () => {
    expect(validateLoadout(build(2, 2))).toMatchObject({ ok: false, error: 'carga', mass: 14 });
    expect(validateLoadout(build(2, 1)).ok).toBe(false);
    expect(validateLoadout(build(1, 2)).ok).toBe(false);
    expect(validateLoadout(build(2, 0)).ok).toBe(true);
    expect(validateLoadout(build(0, 2)).ok).toBe(true);
    expect(validateLoadout(build(1, 1)).ok).toBe(true);
    // Há escolha de verdade: das 9 combinações, cabem 6 e ficam 3 de fora.
    const fits = LEVELS.flatMap((p) => LEVELS.map((r) => validateLoadout(build(p, r)).ok)).filter(Boolean).length;
    expect(fits).toBe(6);
  });

  it('andróide pilotado: blaster no braço direito, motosserra no esquerdo, carga de 3 t', () => {
    const android = factorySpec('android');
    expect(android).toEqual({ v: 1, chassis: 'android', right: { id: 'blaster', tier: 0 }, left: { id: 'chainsaw', tier: 0 } });
    expect(validateLoadout(android)).toMatchObject({ ok: true, mass: 2 });
    expect(armOptions('right', 'android')).toEqual(['blaster']);
    expect(armOptions('left', 'android')).toEqual(['chainsaw']);
    // Arma de Mech não vai no andróide, e motosserra não vai no Mech.
    expect(validateLoadout({ ...android, right: { id: 'plasma', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...FACTORY_LOADOUT, left: { id: 'chainsaw', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    // Os dois no máximo não cabem (1 t + 3 t).
    expect(validateLoadout({ ...android, right: { id: 'blaster', tier: 2 }, left: { id: 'chainsaw', tier: 2 } })).toMatchObject({ ok: false, error: 'carga' });
    expect(parseLoadoutKey(loadoutKey(android))).toEqual(android);
    expect(loadoutKey(android)).toBe('v1.android.blaster-0.chainsaw-0');
  });

  it('nível bloqueado (progressão) é recusado', () => {
    const onlyMk1 = (_id: string, tier: Tier) => tier === 0;
    expect(validateLoadout(build(1, 0), onlyMk1)).toMatchObject({ ok: false, error: 'bloqueado' });
    expect(validateLoadout(build(0, 0), onlyMk1).ok).toBe(true);
  });

  it('texto curto do build: ida e volta, e texto que não é montagem vira null', () => {
    for (const p of LEVELS) for (const r of [...LEVELS, null]) {
      const spec = build(p, r);
      if (!validateLoadout(spec).ok) continue;
      expect(parseLoadoutKey(loadoutKey(spec))).toEqual(spec);
    }
    expect(loadoutKey(build(2, 0))).toBe('v1.vector09.plasma-2.rockets-0');
    expect(parseLoadoutKey('v1.vector09.plasma-2.rockets-2')).toBeNull(); // não cabe na carga
    expect(parseLoadoutKey('<script>')).toBeNull();
    expect(parseLoadoutKey('')).toBeNull();
  });
});

describe('Hangar: montagem salva, link e troca no renascimento', () => {
  it('sem nada salvo, de fábrica; montagem salva inválida ou adulterada também vira a de fábrica', () => {
    expect(new Hangar(memory(), '').current).toEqual(FACTORY_LOADOUT);
    expect(new Hangar(memory({ [HANGAR_STORAGE_KEY]: '{quebrado' }), '').current).toEqual(FACTORY_LOADOUT);
    expect(new Hangar(memory({ [HANGAR_STORAGE_KEY]: JSON.stringify(build(2, 2)) }), '').current).toEqual(FACTORY_LOADOUT);
  });

  it('aplicar salva e agenda para o renascimento (uma vez só); montagem inválida não muda nada', () => {
    const store = memory();
    const h = new Hangar(store, '');
    expect(h.apply(build(2, 2)).ok).toBe(false);
    expect(h.takePending()).toBeNull();
    const c = h.apply(build(2, 0));
    expect(c.ok).toBe(true);
    expect(h.current).toEqual(build(2, 0));
    expect(JSON.parse(store.data.get(HANGAR_STORAGE_KEY)!)).toEqual(build(2, 0));
    expect(h.takePending()?.primary).toBe(weapon('plasma', 2));
    expect(h.takePending()).toBeNull();
    // Reabriu o jogo: a montagem salva volta.
    expect(new Hangar(store, '').current).toEqual(build(2, 0));
  });

  it('um link ?build= válido entra e fica salvo; um inválido é ignorado', () => {
    const store = memory();
    expect(new Hangar(store, '?build=v1.vector09.plasma-1.rockets-1').current).toEqual(build(1, 1));
    expect(JSON.parse(store.data.get(HANGAR_STORAGE_KEY)!)).toEqual(build(1, 1));
    expect(new Hangar(memory(), '?build=v1.vector09.plasma-2.rockets-2').current).toEqual(FACTORY_LOADOUT);
  });

  it('o relatório para a tela sai da simulação do jogo: MK III derruba mais rápido e ferve mais cedo', () => {
    const h = new Hangar(memory(), '');
    const factory = h.report(FACTORY_LOADOUT);
    const heavy = h.report(build(2, 0));
    expect(factory.mass).toBe(7);
    expect(heavy.mass).toBe(10);
    expect(heavy.ttkTorso).toBeLessThan(factory.ttkTorso);
    expect(heavy.overheatAt!).toBeLessThanOrEqual(factory.overheatAt!);
    expect(h.report(build(2, 2)).check.ok).toBe(false);
  });
});

describe('Mech com a montagem do Hangar', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('nasce com as armas montadas e troca no renascimento, frio', async () => {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(200, 2, 200));
    const heavy = validateLoadout(build(2, 0));
    if (!heavy.ok) throw new Error('montagem de teste inválida');
    const m = new Vector09({ loadout: heavy.loadout });
    m.spawn(physics, new THREE.Vector3(0, 0, 0));
    expect(m.loadout.primary.damage).toBe(weapon('plasma', 2).damage);
    m.onFire();
    expect(m.heat).toBeCloseTo(weapon('plasma', 2).heatPerShot, 5);
    m.equip(VECTOR09_STATS.loadout);
    expect(m.loadout.primary).toBe(weapon('plasma', 0));
    expect(m.heat).toBe(0);
  });

  it('trocar pelo Hangar no meio da partida mantém o calor: a pausa não vira um jeito de esfriar', async () => {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(200, 2, 200));
    const m = new Vector09();
    m.spawn(physics, new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < 5; i++) m.onFire();
    const hot = m.heat;
    expect(hot).toBeGreaterThan(0.2);
    const heavy = validateLoadout(build(2, 0));
    if (!heavy.ok) throw new Error('montagem de teste inválida');
    m.equip(heavy.loadout, true);
    expect(m.loadout.primary).toBe(weapon('plasma', 2));
    expect(m.heat).toBeCloseTo(hot, 6);
  });
});

describe('o texto da montagem vale para todos os chassis (link e rede)', () => {
  it('a montagem de fábrica de cada chassi volta idêntica do texto, inclusive os que têm maiúscula no id', () => {
    for (const id of Object.keys(CHASSIS) as ChassisId[]) {
      const spec = factorySpec(id);
      expect(validateLoadout(spec).ok, id).toBe(true);
      expect(parseLoadoutKey(loadoutKey(spec)), id).toEqual(spec);
    }
  });
});

describe('Lancer-L1: escopeta no braço direito e escudo no esquerdo (sem lança-mísseis)', () => {
  it('a fábrica é a escopeta sozinha, e o braço esquerdo não aceita arma nenhuma', () => {
    expect(factorySpec('lancerL1')).toEqual({ v: 1, chassis: 'lancerL1', right: { id: 'shotgun', tier: 0 }, left: null });
    expect(armOptions('right', 'lancerL1')).toEqual(['shotgun']);
    expect(armOptions('left', 'lancerL1')).toEqual([]);
  });

  it('foguete no braço do escudo e plasma no braço da escopeta são recusados; a escopeta em MK III cabe na carga', () => {
    const lancer = factorySpec('lancerL1');
    expect(validateLoadout({ ...lancer, left: { id: 'rockets', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...lancer, right: { id: 'plasma', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...lancer, right: { id: 'shotgun', tier: 2 } })).toMatchObject({ ok: true });
  });

  it('a escopeta não vai no Vector-09 (cada chassi diz o que aceita)', () => {
    expect(validateLoadout({ ...FACTORY_LOADOUT, right: { id: 'shotgun', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
  });
});
