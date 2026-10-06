import { describe, expect, it } from 'vitest';
import { ChargeTimer } from './ChargeTimer';
const DT = 1 / 60;
describe('carga contínua determinística', () => {
  it('não dispara antes de 0,85 s; não acumula carga no repouso nem no cooldown', () => {
    const c = new ChargeTimer();
    for (let i=0;i<50;i++) expect(c.step(DT,true,true,0.85)).toBe(false);
    expect(c.step(DT,true,true,0.85)).toBe(true);
    expect(c.progress).toBe(0);
    for (let i=0;i<180;i++) expect(c.step(DT,true,false,0.85)).toBe(false);
    expect(c.step(DT,true,true,0.85)).toBe(false);
  });
  it('soltar ou bloquear perde a carga; arma sem carga mantém o disparo imediato', () => {
    const c = new ChargeTimer();
    c.step(0.8,true,true,0.85);
    c.step(DT,false,true,0.85);
    expect(c.step(0.1,true,true,0.85)).toBe(false);
    c.step(DT,true,false,0.85);
    expect(c.step(0.1,true,true,0.85)).toBe(false);
    expect(c.step(DT,true,true)).toBe(true);
    c.reset(); expect(c.progress).toBe(0);
  });
});
