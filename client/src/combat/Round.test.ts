import { describe, expect, it } from 'vitest';
import type { MechBase } from '../entities/MechBase';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { INTERMISSION_S, ROUND_S, Round } from './Round';

// A rodada só usa a identidade do Mech: objetos vazios bastam.
const mech = () => ({}) as MechBase;

describe('Round (todos contra todos)', () => {
  it('5 min de jogo, 10 s de intervalo, e a rodada seguinte começa zerada', () => {
    const r = new Round();
    const you = mech();
    const bot = mech();
    r.register(you, 'VOCÊ');
    r.register(bot, 'KESTREL');
    r.recordKill(bot, you);

    const events: [number, string][] = [];
    const ticks = Math.round((ROUND_S + INTERMISSION_S + 1) / FIXED_DT);
    for (let i = 1; i <= ticks; i++) {
      const e = r.fixedUpdate(FIXED_DT);
      if (e) events.push([i, e]);
    }
    expect(events.map(([, e]) => e)).toEqual(['ended', 'started']);
    const [endTick, startTick] = events.map(([t]) => t * FIXED_DT);
    expect(endTick).toBeCloseTo(ROUND_S, 1);
    expect(startTick! - endTick!).toBeCloseTo(INTERMISSION_S, 1);
    expect(r.number).toBe(2);
    expect(r.playing).toBe(true);
    expect(r.scoreOf(you)?.kills).toBe(0);
    expect(r.scoreOf(bot)?.deaths).toBe(0);
  });

  it('abate para quem atirou, morte para quem caiu; morte sem atirador ou própria só conta a morte', () => {
    const r = new Round();
    const a = mech();
    const b = mech();
    r.register(a, 'A');
    r.register(b, 'B');
    r.recordKill(b, a);
    r.recordKill(a); // sem atirador conhecido
    r.recordKill(b, b); // a própria explosão, no futuro
    expect(r.scoreOf(a)).toMatchObject({ kills: 1, deaths: 1 });
    expect(r.scoreOf(b)).toMatchObject({ kills: 0, deaths: 2 });
  });

  it('no intervalo nada conta', () => {
    const r = new Round(1, 5);
    const a = mech();
    const b = mech();
    r.register(a, 'A');
    r.register(b, 'B');
    while (r.fixedUpdate(FIXED_DT) !== 'ended');
    r.recordKill(b, a);
    expect(r.scoreOf(a)?.kills).toBe(0);
  });

  it('placar: mais abates; empate, menos mortes; depois ordem de entrada', () => {
    const r = new Round();
    const [a, b, c, d] = [mech(), mech(), mech(), mech()];
    r.register(a, 'A');
    r.register(b, 'B');
    r.register(c, 'C');
    r.register(d, 'D');
    r.recordKill(d, b); // B: 1 abate
    r.recordKill(a, c); // C: 1 abate; A: 1 morte
    r.recordKill(b, c); // C: 2 abates; B: 1 morte
    const order = () => r.standings().map((s) => s.name);
    // C 2/0, B 1/1, A 0/1, D 0/1 → A e D empatam: vale a ordem de entrada.
    expect(order()).toEqual(['C', 'B', 'A', 'D']);
    r.recordKill(d, a);
    // C 2/0, A 1/1, B 1/1, D 0/2 → A e B empatam em abates e mortes: A entrou antes.
    expect(order()).toEqual(['C', 'A', 'B', 'D']);
    r.recordKill(a, b);
    // C 2/0, B 2/1, A 1/2, D 0/2 → C e B empatam em abates: C tem menos mortes.
    expect(order()).toEqual(['C', 'B', 'A', 'D']);
  });
});
