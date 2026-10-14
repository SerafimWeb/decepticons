import { describe, expect, it } from 'vitest';
import { ChargeTimer } from './ChargeTimer';
import { weapon } from './weapons';
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

describe('carga com espera (o canhão de cerco, P124): completa e NÃO dispara; o tiro sai ao soltar', () => {
  it('completar não dispara: a arma fica pronta e o tiro sai ao soltar o gatilho', () => {
    const c = new ChargeTimer();
    let disparou = false;
    for (let i = 0; i < 300 && !c.charged; i++) if (c.step(DT, true, true, 2.4, true)) disparou = true;
    expect(disparou).toBe(false); // não disparou ao completar
    expect(c.charged).toBe(true); // ficou carregada e pronta
    expect(c.progress).toBe(1);
    // Segurando a carga pronta, continua esperando — não dispara sozinha.
    for (let i = 0; i < 180; i++) expect(c.step(DT, true, true, 2.4, true)).toBe(false);
    expect(c.charged).toBe(true);
    // Soltou: dispara neste tick e a carga é consumida.
    expect(c.step(DT, false, true, 2.4, true)).toBe(true);
    expect(c.charged).toBe(false);
    expect(c.progress).toBe(0);
  });

  it('soltar antes de completar perde a carga parcial (tem de segurar até o fim)', () => {
    const c = new ChargeTimer();
    c.step(1.0, true, true, 2.4, true);
    expect(c.progress).toBeGreaterThan(0);
    expect(c.step(DT, false, true, 2.4, true)).toBe(false);
    expect(c.progress).toBe(0);
    expect(c.charged).toBe(false);
  });

  it('travada (recarregando ou superaquecida), a carga espera onde está, sem perder nem avançar', () => {
    const c = new ChargeTimer();
    c.step(1.0, true, true, 2.4, true);
    const antes = c.progress;
    c.step(0.5, true, false, 2.4, true);
    expect(c.progress).toBeCloseTo(antes);
    expect(c.charged).toBe(false);
  });

  it('sem `hold` (o trilho), nada muda: completar dispara e soltar perde', () => {
    const r = new ChargeTimer();
    r.step(1.0, true, true, 1.2);
    r.step(DT, false, true, 1.2);
    expect(r.step(0.5, true, true, 1.2)).toBe(false);
    expect(r.charged).toBe(false);
    expect(r.step(0.8, true, true, 1.2)).toBe(true); // completou e disparou na hora
  });
});

describe('a carga com espera é do canhão de cerco (P124)', () => {
  it('o cerco segura a carga e ficou mais rápido; o trilho segue sem espera', () => {
    expect(weapon('siege').chargeHold).toBe(true);
    expect(weapon('siege').chargeTime).toBeLessThan(3); // era 3 s: o Comandante pediu mais rápido
    expect(weapon('railgun').chargeHold).toBeUndefined();
  });
});
