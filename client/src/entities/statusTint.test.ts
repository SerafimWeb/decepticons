import { describe, expect, it } from 'vitest';
import { StatusSet } from '../combat/StatusEffects';
import { statusTint, TINT_MAX, type Tint } from './statusTint';

const tint = (s: StatusSet, t = 0): Tint => {
  const out: Tint = { r: -1, g: -1, b: -1 };
  statusTint(s, t, out);
  return out;
};
/** Varre um segundo de tempo (60 amostras) e devolve o menor e o maior valor de cada canal. */
function varrer(s: StatusSet): { min: Tint; max: Tint } {
  const min: Tint = { r: 9, g: 9, b: 9 };
  const max: Tint = { r: -9, g: -9, b: -9 };
  for (let i = 0; i < 240; i++) {
    const c = tint(s, i / 60);
    for (const k of ['r', 'g', 'b'] as const) {
      min[k] = Math.min(min[k], c[k]);
      max[k] = Math.max(max[k], c[k]);
    }
  }
  return { min, max };
}

/** Dono, 11/10: "o gelo funcionou, mas não percebi que o robô inimigo ficou congelado". */
describe('a cor do estado no casco', () => {
  it('sem estado, o casco não ganha cor nenhuma (o Mech comum não paga nem escreve no material)', () => {
    expect(tint(new StatusSet())).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('congelado é azul-gelo firme: o azul manda, o vermelho é o mais fraco, e quase não varia no tempo', () => {
    const s = new StatusSet();
    for (let i = 0; i < 3; i++) s.chillUp();
    expect(s.isFrozen).toBe(true);
    const { min, max } = varrer(s);
    expect(max.b).toBeGreaterThan(max.g);
    expect(max.g).toBeGreaterThan(max.r);
    expect(min.b).toBeGreaterThan(0.5); // visível o tempo todo: congelado não pisca (só um brilho lento de cristal)
  });

  it('gelado fica mais azul a cada acúmulo, até chegar perto do congelado', () => {
    const cores = [1, 2, 3].map((n) => {
      const s = new StatusSet();
      s.stacks = n;
      return tint(s).b;
    });
    expect(cores[0]!).toBeLessThan(cores[1]!);
    expect(cores[1]!).toBeLessThan(cores[2]!);
    const congelado = new StatusSet();
    for (let i = 0; i < 3; i++) congelado.chillUp();
    expect(cores[2]!).toBeLessThan(varrer(congelado).min.b); // o congelamento é sempre mais forte que o gelado no máximo, em qualquer instante
  });

  it('queimando é laranja que tremula: o vermelho manda, e a intensidade varia (nunca apaga de vez)', () => {
    const s = new StatusSet();
    s.burnUp();
    const { min, max } = varrer(s);
    expect(max.r).toBeGreaterThan(max.g);
    expect(max.g).toBeGreaterThan(max.b);
    expect(max.r - min.r).toBeGreaterThan(0.1); // tremula
    expect(min.r).toBeGreaterThan(0.25); // mas não apaga
  });

  it('chocado é azul elétrico que pisca (pulsos secos com fundo fraco)', () => {
    const s = new StatusSet();
    s.shockUp(false);
    const { min, max } = varrer(s);
    expect(max.b).toBeGreaterThan(max.g);
    expect(max.b).toBeGreaterThan(0.35); // 27/10 (P261): pico cortado de 0,66 pra 0,42 — era o único estrobo puro do jogo
    expect(max.b - min.b).toBeGreaterThan(0.3); // pisca
    expect(min.b).toBeGreaterThan(0); // o fundo existe: entre os pulsos o corpo não volta ao normal
  });

  it('atordoado é amarelo e sobrepõe o azul do choque de onde ele vem', () => {
    const s = new StatusSet();
    s.shockUp(true); // tiro na cabeça: choca e atordoa
    expect(s.stunned).toBe(true);
    const { max } = varrer(s);
    expect(max.r).toBeGreaterThan(0.3); // 27/10 (P261): pico cortado de 0,6 pra 0,4
    expect(max.g).toBeGreaterThan(0.25); // pico cortado de 0,5 pra 0,33
  });

  it('nenhum estado passa de 0,7 (bem abaixo do limiar do bloom, 0,9): lê-se no corpo, não vira halo nem satura o casco em branco', () => {
    const casos: StatusSet[] = [];
    const congelado = new StatusSet();
    for (let i = 0; i < 3; i++) congelado.chillUp();
    casos.push(congelado);
    const queimando = new StatusSet();
    queimando.burnUp();
    casos.push(queimando);
    const chocado = new StatusSet();
    chocado.shockUp(false);
    casos.push(chocado);
    const atordoado = new StatusSet();
    atordoado.shockUp(true);
    casos.push(atordoado);
    for (const s of casos) {
      const { max } = varrer(s);
      expect(Math.max(max.r, max.g, max.b)).toBeLessThanOrEqual(TINT_MAX);
    }
    expect(TINT_MAX).toBeLessThanOrEqual(0.7);
  });

  it('o estado que acaba apaga a cor (o tempo corre e o casco volta ao normal)', () => {
    const s = new StatusSet();
    s.burnUp();
    expect(tint(s).r).toBeGreaterThan(0);
    for (let i = 0; i < 600; i++) s.step(1 / 60); // 10 s
    expect(s.active).toBe(false);
    expect(tint(s)).toEqual({ r: 0, g: 0, b: 0 });
  });
});
