import { describe, expect, it } from 'vitest';
import { weapon, type WeaponId } from '../combat/weapons';
import type { BurstOptions } from './ParticleSystem';
import { SHAPE } from './particleShapes';
import { ICE_MIST, ICE_MIST_EVERY, ICE_TRAIL, ICE_TRAIL_EVERY, IMPACT_FX } from './impactFx';

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

  it('o rastro do gelo é uma bruma de frio (dono, 11/10: "partículas menores, pra dar mais a sensação de gelo frio") e só de vez em quando um floco pequeno', () => {
    // A bruma: fagulhas de gelo minúsculas e um vapor azulado, a cada metro; tudo bem menor que o floco grande de antes (3,2).
    expect(ICE_MIST_EVERY).toBe(1);
    expect(ICE_MIST.map((o) => o.shape)).toEqual([SHAPE.dot, SHAPE.puff]);
    for (const o of ICE_MIST) expect(o.size!, String(o.shape)).toBeLessThanOrEqual(1.6);
    // Pálida e fria: o azul manda e nada passa de 1,2 de brilho (o frio nunca ofusca).
    for (const o of [...ICE_MIST, ICE_TRAIL]) {
      expect(dominante(o)).toBe('b');
      expect(Math.max(o.color.r, o.color.g, o.color.b)).toBeLessThan(1.2);
    }
    // O floco que sobra é pequeno, gira e é raro (a cada 3,5 m).
    expect(ICE_TRAIL.shape).toBe(SHAPE.flake);
    expect(ICE_TRAIL.spin).toBeGreaterThan(0);
    expect(ICE_TRAIL.size!).toBeLessThan(2);
    expect(ICE_TRAIL_EVERY).toBeCloseTo(3.5, 5);
  });

  it('o custo do rastro do gelo é conhecido: ~180 partículas por tiro, de um tiro a cada 0,6 s (o pool tem 3000)', () => {
    const w = weapon('cryo');
    const bruma = Math.floor(w.maxRange / ICE_MIST_EVERY) * ICE_MIST.reduce((a, o) => a + o.count, 0);
    const flocos = Math.floor(w.maxRange / ICE_TRAIL_EVERY) * ICE_TRAIL.count;
    expect(bruma + flocos).toBeLessThanOrEqual(200);
    expect(((bruma + flocos) / w.fireInterval)).toBeLessThan(400); // por segundo de gatilho apertado
  });
});
