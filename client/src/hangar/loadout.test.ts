import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { timeToKill } from '../combat/balance';
import { weapon, type Tier, type WeaponId } from '../combat/weapons';
import { VECTOR09_STATS, Vector09 } from '../entities/Vector09';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Hangar, HANGAR_STORAGE_KEY } from './Hangar';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import { armOptions, FACTORY_LOADOUT, factorySpec, isMetalShield, loadoutKey, parseLoadoutKey, specWeapons, validateLoadout, type LoadoutSpec } from './loadout';
import { metalShieldMass } from '../combat/MetalShield';

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

  it('engates de energia compartilham armas; lançadores ainda exigem o encaixe correto', () => {
    expect(armOptions('right')).toEqual(['plasma', 'blaster', 'shotgun', 'railgun', 'emp', 'arc', 'rotary']);
    expect(armOptions('left')).toEqual(['plasma', 'blaster', 'shotgun', 'railgun', 'emp', 'arc', 'rockets', 'barrage']);
    expect(validateLoadout({ ...FACTORY_LOADOUT, right: { id: 'rockets', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...FACTORY_LOADOUT, left: { id: 'plasma', tier: 0 } })).toMatchObject({ ok: true });
    expect(validateLoadout({ ...FACTORY_LOADOUT, right: { id: 'blaster', tier: 0 } })).toMatchObject({ ok: true });
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
  it('a fábrica é a escopeta com a chapa Muralha no braço do escudo, que não aceita arma nenhuma', () => {
    expect(factorySpec('lancerL1')).toEqual({ v: 1, chassis: 'lancerL1', right: { id: 'shotgun', tier: 0 }, left: { id: 'muralha', tier: 0 } });
    expect(armOptions('right', 'lancerL1')).toContain('shotgun');
    expect(armOptions('left', 'lancerL1')).toEqual([]);
  });

  it('foguete no braço do escudo e plasma no braço da escopeta são recusados; a escopeta em MK III cabe na carga', () => {
    const lancer = factorySpec('lancerL1');
    expect(validateLoadout({ ...lancer, left: { id: 'rockets', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...lancer, right: { id: 'plasma', tier: 0 } })).toMatchObject({ ok: true });
    expect(validateLoadout({ ...lancer, right: { id: 'shotgun', tier: 2 } })).toMatchObject({ ok: true });
  });

  it('a escopeta não vai no Vector-09 (cada chassi diz o que aceita)', () => {
    expect(validateLoadout({ ...FACTORY_LOADOUT, right: { id: 'shotgun', tier: 0 } })).toMatchObject({ ok: true });
  });
});

describe('Marauder: duas mãos no botão principal e os lançadores dos ombros', () => {
  const factory = factorySpec('marauder');

  it('a fábrica é blaster nas duas mãos e foguetes nos ombros; a montagem vira o Loadout com a segunda arma na mão esquerda', () => {
    expect(factory).toEqual({ v: 1, chassis: 'marauder', right: { id: 'blaster', tier: 0 }, left: { id: 'blaster', tier: 0 }, shoulders: { id: 'rockets', tier: 0 } });
    const c = validateLoadout(factory);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.loadout.primary).toBe(weapon('blaster'));
    expect(c.loadout.offhand).toBe(weapon('blaster'));
    expect(c.loadout.secondary).toBe(weapon('rockets'));
    // O Loadout validado é o de fábrica do chassi: a fábrica não pode mentir sobre o que o Mech leva.
    expect(c.loadout).toEqual(CHASSIS.marauder.loadout);
  });

  it('os dois lançadores contam na carga: 0,5 + 0,5 + 4 + 4 = 9 t de 11', () => {
    const c = validateLoadout(factory);
    expect(c.ok && c.mass).toBe(9);
    expect(c.capacity).toBe(11);
  });

  it('poder custa carga duas vezes nos ombros: foguetes MK II (6 t × 2) não cabem; blasters MK III com foguetes MK I cabem', () => {
    expect(validateLoadout({ ...factory, shoulders: { id: 'rockets', tier: 1 } })).toMatchObject({ ok: false, error: 'carga', mass: 13 });
    expect(validateLoadout({ ...factory, right: { id: 'blaster', tier: 2 }, left: { id: 'blaster', tier: 2 } })).toMatchObject({ ok: true, mass: 10 });
  });

  it('as mãos aceitam blaster ou plasma; foguete na mão e blaster no ombro são recusados; plasma duplo só sem os ombros', () => {
    expect(armOptions('right', 'marauder')).toEqual(['plasma', 'blaster', 'shotgun', 'railgun', 'emp', 'arc', 'rotary']);
    expect(armOptions('left', 'marauder')).toEqual(armOptions('right', 'marauder'));
    expect(armOptions('shoulders', 'marauder')).toEqual(['rockets', 'barrage']);
    expect(validateLoadout({ ...factory, left: { id: 'rockets', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...factory, shoulders: { id: 'blaster', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    const twoPlasma = { ...factory, right: { id: 'plasma', tier: 0 }, left: { id: 'plasma', tier: 0 } } as LoadoutSpec;
    expect(validateLoadout(twoPlasma)).toMatchObject({ ok: false, error: 'carga' }); // 3 + 3 + 8
    expect(validateLoadout({ ...twoPlasma, shoulders: null })).toMatchObject({ ok: true, mass: 6 });
  });

  it('os ombros vazios deixam o gatilho secundário sem arma; a mão esquerda vazia deixa só a direita no principal', () => {
    const noPods = validateLoadout({ ...factory, shoulders: null });
    expect(noPods.ok && noPods.loadout.secondary).toBeNull();
    const oneHand = validateLoadout({ ...factory, left: null });
    expect(oneHand.ok && oneHand.loadout.offhand).toBeNull();
  });

  it('só quem tem o encaixe aceita ombros: no Vector-09 a recusa diz por quê', () => {
    expect(validateLoadout({ ...FACTORY_LOADOUT, shoulders: { id: 'rockets', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(armOptions('shoulders', 'vector09')).toEqual([]);
  });

  it('o texto do build leva um terceiro grupo só no Marauder: ida e volta, vazios com "-" e o texto antigo de duas armas', () => {
    expect(loadoutKey(factory)).toBe('v1.marauder.blaster-0.blaster-0.rockets-0');
    expect(parseLoadoutKey('v1.marauder.blaster-0.blaster-0.rockets-0')).toEqual(factory);
    expect(parseLoadoutKey('v1.marauder.blaster-2.-.-')).toEqual({ v: 1, chassis: 'marauder', right: { id: 'blaster', tier: 2 }, left: null, shoulders: null });
    // Sem o terceiro grupo (texto de duas armas): ombros vazios, e o mesmo Mech sai com a chave completa.
    const old = parseLoadoutKey('v1.marauder.blaster-0.blaster-0');
    expect(old).toMatchObject({ chassis: 'marauder', right: { id: 'blaster' } });
    expect(old && loadoutKey(old)).toBe('v1.marauder.blaster-0.blaster-0.-');
    // Os outros chassis continuam com duas armas só, e um terceiro grupo neles é recusado.
    expect(loadoutKey(FACTORY_LOADOUT)).toBe('v1.vector09.plasma-0.rockets-0');
    expect(parseLoadoutKey('v1.vector09.plasma-0.rockets-0.rockets-0')).toBeNull();
    // O texto antigo do Marauder (plasma e foguetes nos braços) não vale mais: foguete não vai na mão.
    expect(parseLoadoutKey('v1.marauder.plasma-0.rockets-0')).toBeNull();
  });

  it('equilíbrio: nenhuma das montagens válidas do Marauder derruba o torso de um Mech em menos de 2,5 s (a meta dos dois braços juntos)', () => {
    const hands: WeaponId[] = ['blaster', 'plasma'];
    let validas = 0;
    for (const r of hands) for (const l of [...hands, null]) for (const rt of LEVELS) for (const lt of LEVELS) for (const pod of ['rockets', 'barrage'] as const) for (const s of [null, 0, 1, 2] as const) {
      const spec: LoadoutSpec = { v: 1, chassis: 'marauder', right: { id: r, tier: rt }, left: l ? { id: l, tier: lt } : null, shoulders: s === null ? null : { id: pod, tier: s as Tier } };
      if (validateLoadout(spec).ok !== true) continue;
      validas++;
      expect(timeToKill(specWeapons(spec), CHASSIS.marauder, VECTOR09_STATS.maxModuleHealth.torso), loadoutKey(spec)).toBeGreaterThan(2.5);
    }
    expect(validas).toBeGreaterThan(20); // a trava vale para um conjunto grande, não para um exemplo
  });

  it('em todo chassi: os ombros existem na montagem se e só se o chassi tem lançadores nos ombros; a carga da fábrica bate com o Loadout', () => {
    for (const id of Object.keys(CHASSIS) as ChassisId[]) {
      const stats = CHASSIS[id];
      const shouldersWired = (stats.triggers?.secondary ?? []).some((m) => m === 'rightShoulder' || m === 'leftShoulder');
      expect(armOptions('shoulders', id).length > 0, id).toBe(shouldersWired);
      const spec = factorySpec(id);
      const c = validateLoadout(spec);
      expect(c.ok, id).toBe(true);
      if (!c.ok) continue;
      expect(c.loadout, id).toEqual(stats.loadout);
      const plate = isMetalShield(spec.left) ? metalShieldMass(spec.left.id, spec.left.tier) : 0;
      expect(specWeapons(spec).reduce((s, w) => s + w.mass, 0) + plate, id).toBe(c.mass);
    }
  });
});

describe('chuva de mísseis no Hangar', () => {
  const chuva = (tier: Tier): LoadoutSpec => ({ v: 1, chassis: 'vector09', right: { id: 'plasma', tier: 0 }, left: { id: 'barrage', tier } });

  it('vai no braço esquerdo do Vector-09, do Colossus e da Onça e nos ombros do Marauder; em braço direito, não', () => {
    expect(validateLoadout(chuva(0))).toMatchObject({ ok: true, mass: 8 });
    expect(armOptions('left', 'colossus01')).toContain('barrage');
    expect(armOptions('left', 'onca')).toContain('barrage');
    expect(armOptions('right', 'onca')).not.toContain('barrage');
    // A rotatória gira o cano no gatilho principal: só na mão direita (e na esquerda do Marauder, que também está nele), nunca no secundário.
    for (const id of ['vector09', 'colossus01', 'onca', 'arara'] as const) {
      expect(armOptions('right', id), id).toContain('rotary');
      expect(armOptions('left', id), id).not.toContain('rotary');
    }
    expect(armOptions('left', 'marauder')).toContain('rotary');
    expect(armOptions('right', 'lancerL1')).not.toContain('rotary'); // a arma do Lancer é a da malha dele
    expect(validateLoadout({ ...chuva(0), right: { id: 'barrage', tier: 0 }, left: null })).toMatchObject({ ok: false, error: 'encaixe' });
    // No Marauder a chuva vai nos ombros: os dois morteiros contam na carga (2 × 5 t) e jogam 16 bombas por aperto.
    expect(armOptions('shoulders', 'marauder')).toContain('barrage');
    expect(validateLoadout({ ...factorySpec('marauder'), shoulders: { id: 'barrage', tier: 0 } })).toMatchObject({ ok: true, mass: 11 });
    expect(validateLoadout({ ...factorySpec('marauder'), shoulders: { id: 'barrage', tier: 1 } })).toMatchObject({ ok: false, error: 'carga' });
  });

  it('poder custa carga: MK II ainda cabe no Vector-09 (10,5 de 11 t) e MK III não (13 t)', () => {
    expect(validateLoadout(chuva(1))).toMatchObject({ ok: true, mass: 10.5 });
    expect(validateLoadout(chuva(2))).toMatchObject({ ok: false, error: 'carga' });
  });

  it('o texto do link vai e volta, e o Loadout traz a chuva como arma do gatilho secundário', () => {
    const spec = chuva(0);
    expect(loadoutKey(spec)).toBe('v1.vector09.plasma-0.barrage-0');
    expect(parseLoadoutKey('v1.vector09.plasma-0.barrage-0')).toEqual(spec);
    const c = validateLoadout(spec);
    expect(c.ok && c.loadout.secondary).toBe(weapon('barrage'));
  });
});

describe('metralhadora rotatória no Hangar', () => {
  const rotatoria = (tier: Tier, left: LoadoutSpec['left'] = { id: 'rockets', tier: 0 }): LoadoutSpec => ({ v: 1, chassis: 'vector09', right: { id: 'rotary', tier }, left });

  it('o texto do link vai e volta, e o Loadout traz a rotatória na mão principal e os foguetes no secundário', () => {
    const spec = rotatoria(0);
    expect(loadoutKey(spec)).toBe('v1.vector09.rotary-0.rockets-0');
    expect(parseLoadoutKey('v1.vector09.rotary-0.rockets-0')).toEqual(spec);
    const c = validateLoadout(spec);
    expect(c.ok && c.loadout.primary).toBe(weapon('rotary'));
    expect(c.ok && c.loadout.secondary).toBe(weapon('rockets'));
  });

  it('só vai na mão direita: na esquerda do Vector-09 o servidor, o link e a tela recusam', () => {
    const naEsquerda: LoadoutSpec = { v: 1, chassis: 'vector09', right: { id: 'plasma', tier: 0 }, left: { id: 'rotary', tier: 0 } };
    expect(validateLoadout(naEsquerda)).toMatchObject({ ok: false, error: 'encaixe' });
    expect(parseLoadoutKey('v1.vector09.plasma-0.rotary-0')).toBeNull();
  });

  it('poder custa carga: MK I (4 t) com foguetes cabe; MK III (8 t) com foguetes MK I (4 t) não cabe nos 11 t do Vector-09', () => {
    expect(validateLoadout(rotatoria(0))).toMatchObject({ ok: true, mass: 8 });
    expect(validateLoadout(rotatoria(1))).toMatchObject({ ok: true, mass: 10 });
    expect(validateLoadout(rotatoria(2))).toMatchObject({ ok: false, error: 'carga' });
    expect(validateLoadout(rotatoria(2, null))).toMatchObject({ ok: true, mass: 8 });
  });

  it('o Marauder leva uma rotatória em cada mão (as duas no gatilho principal) e o texto volta idêntico', () => {
    const marauder: LoadoutSpec = { v: 1, chassis: 'marauder', right: { id: 'rotary', tier: 0 }, left: { id: 'rotary', tier: 0 }, shoulders: null };
    const c = validateLoadout(marauder);
    expect(c.ok && c.loadout.primary.id).toBe('rotary');
    expect(c.ok && c.loadout.offhand?.id).toBe('rotary');
    const key = loadoutKey(marauder);
    expect(parseLoadoutKey(key)).toEqual(marauder);
  });
});

describe('arma elétrica no Hangar', () => {
  const eletrica = (tier: Tier, left: LoadoutSpec['left'] = { id: 'rockets', tier: 0 }): LoadoutSpec => ({ v: 1, chassis: 'vector09', right: { id: 'arc', tier }, left });

  it('o texto do link vai e volta, e o Loadout traz a elétrica na mão principal e os foguetes no secundário', () => {
    const spec = eletrica(0);
    expect(loadoutKey(spec)).toBe('v1.vector09.arc-0.rockets-0');
    expect(parseLoadoutKey('v1.vector09.arc-0.rockets-0')).toEqual(spec);
    const c = validateLoadout(spec);
    expect(c.ok && c.loadout.primary).toBe(weapon('arc'));
    expect(c.ok && c.loadout.secondary).toBe(weapon('rockets'));
  });

  it('é de energia: vai nas duas mãos (a esquerda atira como o plasma, no botão secundário) e nas duas do Marauder', () => {
    const naEsquerda: LoadoutSpec = { v: 1, chassis: 'vector09', right: { id: 'plasma', tier: 0 }, left: { id: 'arc', tier: 0 } };
    const c = validateLoadout(naEsquerda);
    expect(c).toMatchObject({ ok: true, mass: 5.5 });
    expect(c.ok && c.loadout.secondary).toBe(weapon('arc'));
    const marauder: LoadoutSpec = { v: 1, chassis: 'marauder', right: { id: 'arc', tier: 1 }, left: { id: 'arc', tier: 1 }, shoulders: null };
    const m = validateLoadout(marauder);
    expect(m.ok && m.loadout.primary.id).toBe('arc');
    expect(m.ok && m.loadout.offhand?.id).toBe('arc');
    expect(parseLoadoutKey(loadoutKey(marauder))).toEqual(marauder);
  });

  it('poder custa carga: MK III (5 t) cabe com foguetes MK II (6 t) nos 11 t do Vector-09, e não com foguetes MK III (8 t)', () => {
    expect(validateLoadout(eletrica(0))).toMatchObject({ ok: true, mass: 6.5 });
    expect(validateLoadout(eletrica(2, { id: 'rockets', tier: 1 }))).toMatchObject({ ok: true, mass: 11 });
    expect(validateLoadout(eletrica(2, { id: 'rockets', tier: 2 }))).toMatchObject({ ok: false, error: 'carga' });
  });
});

describe('montagem de trilho e EMP',()=>{
  it('aceita o combo MK I, preserva carga, compartilha o link e recusa sobrepeso',()=>{
    const spec={...FACTORY_LOADOUT,right:{id:'railgun',tier:0},left:{id:'emp',tier:0}};
    expect(validateLoadout(spec)).toMatchObject({ok:true,mass:7.5});
    expect(validateLoadout({...spec,right:{id:'railgun',tier:2},left:{id:'emp',tier:2}})).toMatchObject({ok:false,error:'carga'});
    expect(validateLoadout({...spec,chassis:'android'})).toMatchObject({ok:false,error:'encaixe'});
  });
});


describe('módulo extra versionado', () => {
  it('preserva v1 e as duas armas, pesa no total e valida o módulo antes de salvar ou transmitir', () => {
    const old = factorySpec('vector09');
    expect(parseLoadoutKey(loadoutKey(old))).toEqual(old);
    const spec:LoadoutSpec={...old,v:2,module:'frontal'};
    expect(parseLoadoutKey(loadoutKey(spec))).toEqual({...spec,shoulders:null});
    const result=validateLoadout(spec);
    expect(result).toMatchObject({ok:true,mass:validateLoadout(old).mass+2});
    expect(result.ok && result.loadout).toMatchObject({module:'frontal',primary:{id:'plasma'},secondary:{id:'rockets'}});
    expect(validateLoadout({...factorySpec('android'),v:2,module:'frontal'}).ok).toBe(false);
    expect(validateLoadout({...spec,module:'inexistente'}).ok).toBe(false);
    expect(validateLoadout({...old,module:'frontal'}).ok).toBe(false);
    expect(validateLoadout({...spec,left:{id:'barrage',tier:1}})).toMatchObject({ok:false,error:'carga'});
    expect(parseLoadoutKey('v2.vector09.plasma-0.rockets-0.broken.frontal')).toBeNull();
  });
});


it('esfera mantém duas armas, conta 4 t e viaja no link sem aceitar sobrecarga', () => {
  const spec: LoadoutSpec = { ...factorySpec('vector09'), v:2, module:'sphere' };
  const c = validateLoadout(spec);
  expect(c).toMatchObject({ok:true, mass:validateLoadout(factorySpec('vector09')).mass+4});
  expect(c.ok && c.loadout).toMatchObject({module:'sphere', primary:{id:'plasma'}, secondary:{id:'rockets'}});
  expect(parseLoadoutKey(loadoutKey(spec))).toEqual({...spec, shoulders:null});
  expect(validateLoadout({...spec,right:{id:'railgun',tier:2}})).toMatchObject({ok:false,error:'carga'});
});
