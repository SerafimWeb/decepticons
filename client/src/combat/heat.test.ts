import { describe, expect, it } from 'vitest';
import { VECTOR09_STATS } from '../entities/Vector09';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { HeatSink } from './heat';

const S = VECTOR09_STATS;

/** Segura o gatilho: um tiro a cada fireInterval enquanto a arma deixa. Devolve os tiros dados. */
function hold(h: HeatSink, seconds: number): number {
  let shots = 0;
  let cd = 0;
  for (let t = 0; t < seconds; t += FIXED_DT) {
    h.fixedUpdate(FIXED_DT);
    cd -= FIXED_DT;
    if (cd <= 0 && !h.overheated) {
      h.shot();
      shots++;
      cd = S.fireInterval;
    }
  }
  return shots;
}

describe('calor da arma (Vector-09)', () => {
  it('segurar o gatilho superaquece depois de ~12 tiros e a arma trava', () => {
    const h = new HeatSink(S);
    const shots = hold(h, 2.5);
    expect(shots).toBe(Math.ceil(1 / S.heatPerShot));
    expect(h.overheated).toBe(true);
  });

  it('superaquecida, só volta depois de esfriar abaixo do limite (um respiro de ~2,4 s)', () => {
    const h = new HeatSink(S);
    while (!h.overheated) h.shot();
    let t = 0;
    while (h.overheated) {
      h.fixedUpdate(FIXED_DT);
      t += FIXED_DT;
    }
    expect(h.heat).toBeLessThanOrEqual(S.heatRecover);
    expect(t).toBeGreaterThan(2);
    expect(t).toBeLessThan(3);
  });

  it('não esfria no meio da rajada: só depois do atraso sem atirar', () => {
    const h = new HeatSink(S);
    h.shot();
    const after = h.heat;
    h.fixedUpdate(S.heatCoolDelay / 2);
    expect(h.heat).toBe(after);
    h.fixedUpdate(S.heatCoolDelay);
    expect(h.heat).toBeLessThan(after);
  });

  it('em rajadas com pausa, dá para atirar mais que segurando direto', () => {
    // 5 tiros e uma pausa de 1 s, repetido; contra segurar direto, no mesmo tempo (10 s).
    const burst = new HeatSink(S);
    let burstShots = 0;
    let cd = 0;
    let inBurst = 0;
    let pause = 0;
    for (let t = 0; t < 10; t += FIXED_DT) {
      burst.fixedUpdate(FIXED_DT);
      cd -= FIXED_DT;
      pause -= FIXED_DT;
      if (pause > 0) continue;
      if (cd <= 0 && !burst.overheated) {
        burst.shot();
        burstShots++;
        cd = S.fireInterval;
        if (++inBurst === 5) {
          inBurst = 0;
          pause = 1;
        }
      }
    }
    const held = hold(new HeatSink(S), 10);
    expect(burstShots).toBeGreaterThan(held);
    // E segurar direto rende bem menos que a cadência cheia: o calor corta ~40% ou mais.
    expect(held).toBeLessThan((10 / S.fireInterval) * 0.65);
  });

  it('renascer zera o calor', () => {
    const h = new HeatSink(S);
    while (!h.overheated) h.shot();
    h.reset();
    expect(h.heat).toBe(0);
    expect(h.overheated).toBe(false);
  });
});
