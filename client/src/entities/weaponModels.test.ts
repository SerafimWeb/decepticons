import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { weapon, type Tier, type WeaponId } from '../combat/weapons';
import { podModel, weaponModel } from './weaponModels';

const IDS: WeaponId[] = ['plasma', 'rockets', 'blaster', 'shotgun', 'chainsaw', 'barrage', 'railgun', 'emp'];
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

describe('weaponModels: o lançador de ombro (podModel)', () => {
  it('em todo nível é UMA malha, com a traseira na origem e a boca à frente (-Z), sem o engate do pulso', () => {
    for (const tier of TIERS) {
      const { object, muzzle } = podModel(weapon('rockets', tier));
      expect(meshesOf(object)).toHaveLength(1);
      const box = new THREE.Box3().setFromObject(object);
      expect(box.max.z).toBeLessThan(0.05); // traseira fechada na origem, nada atrás
      expect(muzzle.z).toBeLessThan(-0.8);
      expect(muzzle.x).toBe(0);
      expect(muzzle.y).toBe(0);
      expect(Math.abs(box.min.z - muzzle.z)).toBeLessThan(0.3); // a boca está na ponta do módulo
      // Sem o colar do pulso (que sobra para os lados da traseira): o lançador não passa da largura do casulo mais a folga.
      expect(box.max.x - box.min.x).toBeLessThan(1.6);
    }
  });

  it('o nível aumenta a grade de tubos (mais triângulos) e as instâncias compartilham geometria e material', () => {
    expect(triangles(podModel(weapon('rockets', 2)).object)).toBeGreaterThan(triangles(podModel(weapon('rockets', 0)).object));
    const a = podModel(weapon('rockets', 1));
    const b = podModel(weapon('rockets', 1));
    expect(a.object).not.toBe(b.object);
    expect(meshesOf(a.object)[0]!.geometry).toBe(meshesOf(b.object)[0]!.geometry);
    expect(meshesOf(a.object)[0]!.material).toBe(meshesOf(b.object)[0]!.material);
  });

  it('o morteiro da chuva também tem desenho de ombro, em todo nível, uma malha só', () => {
    for (const tier of TIERS) {
      const { object, muzzle } = podModel(weapon('barrage', tier));
      expect(meshesOf(object)).toHaveLength(1);
      expect(muzzle.z).toBeLessThan(-0.8);
    }
  });

  it('só os foguetes e a chuva têm desenho de ombro: sem arma, ou com outra, o ombro fica limpo (grupo vazio, boca na origem)', () => {
    for (const w of [null, weapon('blaster'), weapon('plasma')]) {
      const { object, muzzle } = podModel(w);
      expect(meshesOf(object)).toHaveLength(0);
      expect(muzzle.length()).toBe(0);
    }
  });
});
