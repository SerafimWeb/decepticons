import { describe, expect, it } from 'vitest';
import { type Stick, stickVector, touchLookGain } from './TouchControls';

const s = (): Stick => ({ x: 0, z: 0, knobX: 0, knobY: 0 });

describe('mira pelo toque', () => {
  it('dedo devagar = ajuste fino (ganho 1); rápido acelera até 2,2; sem saltos', () => {
    expect(touchLookGain(0)).toBe(1);
    expect(touchLookGain(0.2)).toBe(1);
    expect(touchLookGain(1)).toBeGreaterThan(1);
    expect(touchLookGain(1)).toBeLessThan(2.2);
    expect(touchLookGain(5)).toBeCloseTo(2.2);
    expect(touchLookGain(0.26) - touchLookGain(0.25)).toBeLessThan(0.01);
  });
});

describe('direcional de toque', () => {
  it('polegar parado perto do centro não anda (zona morta)', () => {
    const out = stickVector(5, -5, 60, s()); // ~7 px de 60: dentro dos 15%
    expect(out.x).toBe(0);
    expect(out.z).toBe(0);
  });

  it('polegar para cima = frente; para a direita = direita', () => {
    const up = stickVector(0, -60, 60, s());
    expect(up.z).toBeCloseTo(1);
    expect(up.x).toBeCloseTo(0);
    const right = stickVector(60, 0, 60, s());
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
  });

  it('além do raio satura em 1 e o pino fica preso na borda da base', () => {
    const out = stickVector(0, 200, 60, s());
    expect(out.z).toBeCloseTo(-1);
    expect(out.knobY).toBeCloseTo(60);
    const diag = stickVector(300, -300, 60, s());
    expect(Math.hypot(diag.x, diag.z)).toBeCloseTo(1);
    expect(Math.hypot(diag.knobX, diag.knobY)).toBeCloseTo(60);
  });

  it('é analógico e sem degrau: sai do zero logo depois da zona morta e cresce até 1', () => {
    const justOut = stickVector(0, -10, 60, s()); // 16,7% do raio
    expect(justOut.z).toBeGreaterThan(0);
    expect(justOut.z).toBeLessThan(0.05);
    const half = stickVector(0, -30, 60, s()).z;
    const most = stickVector(0, -50, 60, s()).z;
    expect(half).toBeGreaterThan(justOut.z);
    expect(most).toBeGreaterThan(half);
    expect(most).toBeLessThan(1);
  });
});
