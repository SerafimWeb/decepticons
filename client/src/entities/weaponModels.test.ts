import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { weapon, type Tier, type WeaponId } from '../combat/weapons';
import { weaponModel } from './weaponModels';

const IDS: WeaponId[] = ['plasma', 'rockets', 'blaster', 'shotgun', 'chainsaw'];
const TIERS: Tier[] = [0, 1, 2];

function meshesOf(o: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  o.traverse((n) => {
    if ((n as THREE.Mesh).isMesh) out.push(n as THREE.Mesh);
  });
  return out;
}

const triangles = (o: THREE.Object3D): number =>
  meshesOf(o).reduce((sum, m) => sum + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3, 0);

describe('weaponModels: o módulo de cada arma, no padrão do encaixe', () => {
  it('toda arma em todo nível é UMA malha (um draw call), com o engate na origem e a boca à frente (-Z)', () => {
    for (const id of IDS) {
      for (const tier of TIERS) {
        const { object, muzzle } = weaponModel(weapon(id, tier));
        expect(meshesOf(object)).toHaveLength(1);
        const box = new THREE.Box3().setFromObject(object);
        expect(box.max.z).toBeLessThan(0.2); // nada atrás da placa de engate além do flange
        expect(muzzle.z).toBeLessThan(-0.5);
        expect(muzzle.x).toBe(0);
        expect(muzzle.y).toBe(0);
        expect(Math.abs(box.min.z - muzzle.z)).toBeLessThan(0.35); // a boca está na ponta do módulo
      }
    }
  });

  it('o nível muda o desenho: plasma e casulo ganham peças, e nenhuma arma perde triângulos ou comprimento', () => {
    for (const id of IDS) {
      const models = TIERS.map((tier) => weaponModel(weapon(id, tier)));
      for (let i = 1; i < models.length; i++) {
        expect(triangles(models[i]!.object)).toBeGreaterThanOrEqual(triangles(models[i - 1]!.object));
        expect(models[i]!.muzzle.z).toBeLessThanOrEqual(models[i - 1]!.muzzle.z);
      }
    }
    for (const id of ['plasma', 'rockets'] as const) {
      expect(triangles(weaponModel(weapon(id, 2)).object)).toBeGreaterThan(triangles(weaponModel(weapon(id, 0)).object));
    }
  });

  it('as instâncias são objetos distintos que compartilham geometria e material (nada de memória por Mech)', () => {
    const a = weaponModel(weapon('plasma', 1));
    const b = weaponModel(weapon('plasma', 1));
    expect(a.object).not.toBe(b.object);
    const [ma] = meshesOf(a.object);
    const [mb] = meshesOf(b.object);
    expect(ma!.geometry).toBe(mb!.geometry);
    expect(ma!.material).toBe(mb!.material);
  });

  it('sem arma: o engate fechado com tampa, também uma malha só', () => {
    const { object, muzzle } = weaponModel(null);
    expect(meshesOf(object)).toHaveLength(1);
    expect(muzzle.z).toBeLessThan(0);
    expect(muzzle.z).toBeGreaterThan(weaponModel(weapon('blaster', 0)).muzzle.z);
  });
});
