import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { factorySpec, loadoutKey, parseLoadoutKey, specWeapons, validateLoadout, type LoadoutSpec } from '../hangar/loadout';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { Armament } from './Armament';
import { CombatSystem } from './CombatSystem';
import { METAL_SHIELDS, MetalShield, metalShieldMass } from './MetalShield';
import { weapon, type Loadout } from './weapons';

const ARM = 120;
const plate = (id: 'muralha' | 'refratario' | 'reativo' | 'amortecedor' = 'muralha', tier: 0 | 1 | 2 = 0) => {
  const s = new MetalShield();
  s.equip({ id, tier }, ARM);
  return s;
};

describe('escudo físico: chapa, lado coberto e natureza do dano', () => {
  it('levantada cobre a frente com a resistência cheia; costas passam inteiras', () => {
    const s = plate();
    s.step(true, true);
    expect(s.raised).toBe(true);
    // Frente do Mech com yaw 0 é -Z: a fonte do tiro está em -Z.
    expect(s.absorb(100, 'balistico', 0, -1, 0)).toBeCloseTo(30);
    expect(s.absorb(100, 'balistico', 0, 1, 0)).toBe(100);
    expect(s.integrity).toBeCloseTo(ARM * 1.5 - 70);
  });

  it('abaixada protege só o flanco esquerdo, com metade da força', () => {
    const s = plate();
    s.step(false, true);
    expect(s.raised).toBe(false);
    // Esquerda do Mech com yaw 0 é -X.
    expect(s.absorb(100, 'balistico', -1, 0, 0)).toBeCloseTo(65);
    expect(s.absorb(100, 'balistico', 1, 0, 0)).toBe(100);
    expect(s.absorb(100, 'balistico', 0, 1, 0)).toBe(100);
  });

  it('cada modelo segura melhor a sua natureza de dano', () => {
    const through = (id: 'refratario' | 'reativo' | 'amortecedor', type: 'termico' | 'balistico' | 'pulso') => {
      const s = plate(id);
      s.step(true, true);
      return s.absorb(40, type, 0, -1, 0);
    };
    expect(through('refratario', 'termico')).toBeLessThan(through('reativo', 'termico'));
    expect(through('reativo', 'balistico')).toBeLessThan(through('refratario', 'balistico'));
    expect(through('amortecedor', 'pulso')).toBeLessThan(through('reativo', 'pulso'));
  });

  it('a chapa se esgota, cai e só volta com conserto ou renascimento; nível aumenta chapa e resistência', () => {
    const s = plate();
    s.step(true, true);
    expect(s.absorb(1000, 'balistico', 0, -1, 0)).toBeCloseTo(1000 - ARM * 1.5);
    expect(s.intact).toBe(false);
    expect(s.raised).toBe(false);
    s.step(true, true);
    expect(s.raised).toBe(false);
    expect(s.restore(50)).toBe(50);
    expect(s.intact).toBe(true);
    s.reset();
    expect(s.integrity).toBe(ARM * 1.5);
    const mk3 = plate('muralha', 2);
    expect(mk3.maxIntegrity).toBeCloseTo(ARM * 1.5 * 1.6);
    expect(mk3.resistTo('balistico')).toBeCloseTo(0.8);
    expect(metalShieldMass('muralha', 2)).toBe(3);
  });

  it('sem braço esquerdo não levanta', () => {
    const s = plate();
    s.step(true, false);
    expect(s.raised).toBe(false);
  });
});

describe('escudo físico na montagem', () => {
  const vector = (left: LoadoutSpec['left']): LoadoutSpec => ({ v: 2, module: null, chassis: 'vector09', right: { id: 'plasma', tier: 0 }, left, shoulders: null });

  it('ocupa a mão esquerda no lugar da arma, soma massa e volta do link', () => {
    const spec = vector({ id: 'reativo', tier: 1 });
    const check = validateLoadout(spec);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.loadout.secondary).toBeNull();
    expect(check.loadout.metalShield).toEqual({ id: 'reativo', tier: 1 });
    expect(check.mass).toBe(weapon('plasma').mass + METAL_SHIELDS.reativo.mass + 0.5);
    expect(specWeapons(spec).map((w) => w.id)).toEqual(['plasma']);
    expect(parseLoadoutKey(loadoutKey(spec))).toEqual(spec);
  });

  it('só em chassis compatíveis e só na mão esquerda', () => {
    expect(validateLoadout({ ...vector(null), chassis: 'arara' as const, left: { id: 'muralha', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
    expect(validateLoadout({ ...vector(null), right: { id: 'muralha', tier: 0 } })).toMatchObject({ ok: false, error: 'encaixe' });
  });

  it('o Lancer sai de fábrica com a chapa de verdade no braço do escudo', () => {
    const spec = factorySpec('lancerL1');
    expect(spec.left).toEqual({ id: 'muralha', tier: 0 });
    expect(validateLoadout(spec).ok).toBe(true);
  });
});

describe('escudo físico no combate', () => {
  const loadout: Loadout = { primary: weapon('plasma'), secondary: null, metalShield: { id: 'muralha', tier: 0 } };
  const rig = () => {
    const combat = new CombatSystem({ damage: () => {} } as never, {} as never, { burst: () => {} } as never);
    const target = new Vector09({ stats: { ...VECTOR09_STATS, loadout }, loadout });
    const collider = { handle: 91 };
    Object.defineProperty(target, 'collider', { value: collider });
    combat.register(target);
    return { combat, target, hit: { collider, point: new THREE.Vector3(0, 3, 0) } };
  };

  it('o botão 2 levanta a chapa pelo Armament; o tiro de frente perde a parte da chapa', () => {
    const { combat, target, hit } = rig();
    const armament = new Armament(target);
    const sink = { projectile: () => {}, rocket: () => {}, melee: () => {}, flame: () => {}, wave: () => {} };
    armament.fixedUpdate(FIXED_DT, false, true, sink);
    expect(target.metalShield.raised).toBe(true);
    const hp = target.modules.torso;
    // Projétil viajando para +Z vem da frente (-Z) do Mech com yaw 0.
    combat.onProjectileHit(hit as never, new THREE.Vector3(0, 0, 1), 20, undefined, weapon('plasma'));
    expect(target.modules.torso).toBe(hp - 8);
    armament.fixedUpdate(FIXED_DT, false, false, sink);
    expect(target.metalShield.raised).toBe(false);
  });

  it('braço esquerdo destruído leva o escudo junto; conserto devolve braço antes da chapa', () => {
    const { combat, target, hit } = rig();
    target.guard(true);
    target.damagePart('leftArm', ARM);
    const hp = target.modules.torso;
    combat.onProjectileHit(hit as never, new THREE.Vector3(0, 0, 1), 20, undefined, weapon('plasma'));
    expect(target.modules.torso).toBe(hp - 20);
    target.guard(true);
    expect(target.metalShield.raised).toBe(false);
  });
});
