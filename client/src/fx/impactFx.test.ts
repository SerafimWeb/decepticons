import { describe, expect, it } from 'vitest';
import { weapon, type WeaponId } from '../combat/weapons';
import type { BurstOptions } from './ParticleSystem';
import { SHAPE } from './particleShapes';
import { ICE_TRAIL, ICE_TRAIL_EVERY, IMPACT_FX } from './impactFx';

const shapesDe = (id: WeaponId): Set<number> => new Set(IMPACT_FX[id].map((o) => o.shape ?? SHAPE.glow));
const total = (lista: readonly BurstOptions[]) => lista.reduce((a, o) => a + o.count, 0);
const dominante = (o: BurstOptions): 'r' | 'g' | 'b' => (o.color.r >= o.color.g && o.color.r >= o.color.b ? 'r' : o.color.g >= o.color.b ? 'g' : 'b');

/** Dono, 11/10: "todos os tiros parecem iguais"; cada família ganhou a sua forma e a sua cor onde o tiro bate. */
describe('o impacto de cada arma (onde o tiro bate)', () => {
  const comProjetil: WeaponId[] = ['plasma', 'blaster', 'arc', 'cryo', 'emp', 'railgun', 'shotgun', 'rotary'];

  it('toda arma de projétil tem impacto; as que batem de outro jeito (foguete, chuva, serra, chama) não passam por aqui', () => {
    for (const id of comProjetil) expect(IMPACT_FX[id].length, id).toBeGreaterThan(0);
    for (const id of ['rockets', 'barrage', 'chainsaw', 'flamer'] as const) expect(IMPACT_FX[id], id).toEqual([]);
  });

  it('nenhum impacto passa de 20 partículas (o plasma bate 4,5 vezes por segundo: a nuvem em cima do alvo era o problema)', () => {
    for (const id of comProjetil) expect(total(IMPACT_FX[id]), id).toBeLessThanOrEqual(20);
  });

  it('o gelo bate com flocos de seis braços e cacos; a elétrica, com raios; o EMP, com anéis e hexágono; a bala de metal, com faíscas, fagulhas e poeira', () => {
    expect(shapesDe('cryo').has(SHAPE.flake)).toBe(true);
    expect(shapesDe('cryo').has(SHAPE.shard)).toBe(true);
    expect(shapesDe('arc').has(SHAPE.bolt)).toBe(true);
    expect(shapesDe('emp').has(SHAPE.ring)).toBe(true);
    expect(shapesDe('emp').has(SHAPE.hex)).toBe(true);
    for (const id of ['railgun', 'shotgun', 'rotary'] as const) {
      expect(shapesDe(id).has(SHAPE.streak), id).toBe(true);
      expect(shapesDe(id).has(SHAPE.dot), id).toBe(true);
      expect(shapesDe(id).has(SHAPE.puff), id).toBe(true);
    }
  });

  it('as famílias de energia são visivelmente diferentes entre si: nenhuma repete o conjunto de formas de outra', () => {
    const chaves = (['plasma', 'arc', 'cryo', 'emp', 'rotary'] as const).map((id) => [...shapesDe(id)].sort().join(','));
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('a bala de metal NÃO é de luz: faíscas alaranjadas (o vermelho manda, o azul é o mais fraco), nunca o verde do plasma', () => {
    for (const id of ['railgun', 'shotgun', 'rotary'] as const) {
      const faiscas = IMPACT_FX[id].filter((o) => o.shape === SHAPE.streak);
      expect(faiscas.length, id).toBeGreaterThan(0);
      for (const o of faiscas) {
        expect(dominante(o), id).toBe('r');
        expect(o.color.b, id).toBeLessThan(o.color.g);
      }
    }
    for (const o of IMPACT_FX.plasma.filter((x) => x.shape === SHAPE.streak)) expect(dominante(o)).toBe('g');
  });

  it('o gelo e os raios da elétrica têm cor fria (o azul manda)', () => {
    for (const o of IMPACT_FX.cryo.filter((x) => (x.shape ?? 0) !== SHAPE.glow)) expect(dominante(o), 'cryo').toBe('b');
    for (const o of IMPACT_FX.arc.filter((x) => x.shape === SHAPE.bolt || x.shape === SHAPE.streak)) expect(dominante(o), 'arc').toBe('b');
  });

  it('o brilho não volta: nenhuma cor de impacto passa de 3 (o dono achava que os tiros ofuscavam)', () => {
    for (const id of comProjetil) for (const o of IMPACT_FX[id]) expect(Math.max(o.color.r, o.color.g, o.color.b), id).toBeLessThanOrEqual(3);
  });

  it('o tiro de gelo deixa um floco que gira a cada 1,6 m do caminho', () => {
    expect(ICE_TRAIL.shape).toBe(SHAPE.flake);
    expect(ICE_TRAIL.spin).toBeGreaterThan(0);
    expect(ICE_TRAIL_EVERY).toBeCloseTo(1.6, 5);
    // O gelo voa a 70 m/s: o rastro de 1,6 m é de ~44 flocos por segundo de voo, de um tiro a cada 0,6 s.
    const voo = weapon('cryo').maxRange / weapon('cryo').speed;
    expect((weapon('cryo').speed * voo) / ICE_TRAIL_EVERY).toBeLessThan(80);
  });
});
