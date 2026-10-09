import { describe, expect, it } from 'vitest';
import { computeSpinGauge } from './HUD';

describe('HUD rotary spin meter (logic without DOM)', () => {
  it('hides meter when spin level is 0 or negative', () => {
    expect(computeSpinGauge(0).hidden).toBe(true);
    expect(computeSpinGauge(-0.5).hidden).toBe(true);
  });

  it('calculates fill strokeDashoffset and clamps spin level to [0, 1]', () => {
    const half = computeSpinGauge(0.5);
    expect(half.hidden).toBe(false);
    expect(half.level).toBe(0.5);
    expect(half.strokeDashoffset).toBeCloseTo(half.circumference * 0.5);

    const full = computeSpinGauge(1.0);
    expect(full.hidden).toBe(false);
    expect(full.level).toBe(1.0);
    expect(full.strokeDashoffset).toBeCloseTo(0);

    const over = computeSpinGauge(1.5);
    expect(over.level).toBe(1.0);
    expect(over.strokeDashoffset).toBeCloseTo(0);
  });
});
