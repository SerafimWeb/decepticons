import { describe, expect, it } from 'vitest';
import { VECTOR09_STATS } from '../entities/Vector09';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { HeatSink } from './heat';
import { FireTimer } from './trigger';

const S = VECTOR09_STATS;
const P = S.loadout.primary;

/** Segura o gatilho: um tiro a cada intervalo da arma (regra do jogo) enquanto ela deixa. Devolve os tiros dados. */
function hold(h: HeatSink, seconds: number): number {
  let shots = 0;
  const timer = new FireTimer();
  for (let t = 0; t < seconds; t += FIXED_DT) {
    h.fixedUpdate(FIXED_DT);
    timer.fixedUpdate(FIXED_DT);
    if (timer.ready && !h.overheated) {
      h.shot(P.heatPerShot);
      shots++;
      timer.shot(P.fireInterval);
    }
  }
  return shots;
}

describe('calor da arma (Vector-09)', () => {
  it('segurar o gatilho superaquece depois de ~12 tiros e a arma trava', () => {
    const h = new HeatSink(S);
    const shots = hold(h, 3);
    expect(shots).toBe(Math.ceil(1 / P.heatPerShot));
    expect(h.overheated).toBe(true);
  });

  it('superaquecida, só volta depois de esfriar abaixo do limite (um respiro de ~2,4 s)', () => {
    const h = new HeatSink(S);
    while (!h.overheated) h.shot(P.heatPerShot);
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
    h.shot(P.heatPerShot);
    const after = h.heat;
    h.fixedUpdate(S.heatCoolDelay / 2);
    expect(h.heat).toBe(after);
    h.fixedUpdate(S.heatCoolDelay);
    expect(h.heat).toBeLessThan(after);
  });

  it('em rajadas com pausa, dá para atirar mais que segurando direto', () => {
    // Quem administra o calor atira até ~85% e solta até esfriar; contra segurar direto, em 20 s.
    const burst = new HeatSink(S);
    const timer = new FireTimer();
    let burstShots = 0;
    let cooling = false;
    for (let t = 0; t < 20; t += FIXED_DT) {
      burst.fixedUpdate(FIXED_DT);
      timer.fixedUpdate(FIXED_DT);
      if (burst.heat >= 0.85) cooling = true;
      else if (burst.heat <= 0.1) cooling = false;
      if (!cooling && timer.ready && !burst.overheated) {
        burst.shot(P.heatPerShot);
        burstShots++;
        timer.shot(P.fireInterval);
      }
    }
    const held = hold(new HeatSink(S), 20);
    expect(burstShots).toBeGreaterThan(held);
    // E segurar direto rende bem menos que a cadência cheia: o calor corta ~40% ou mais.
    expect(held).toBeLessThan((20 / P.fireInterval) * 0.65);
  });

  it('renascer zera o calor', () => {
    const h = new HeatSink(S);
    while (!h.overheated) h.shot(P.heatPerShot);
    h.reset();
    expect(h.heat).toBe(0);
    expect(h.overheated).toBe(false);
  });
});
