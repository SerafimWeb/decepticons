import { describe, expect, it } from 'vitest';
import { AIM_TARGET_HALF_LANE, AIM_TARGET_SPEED, aimTargetDirectionAt, aimTargetXAt } from './aimPractice';

describe('treino de mira do Hangar', () => {
  it('percorre a faixa de forma determinística e dentro dos limites', () => {
    const samples = Array.from({ length: 300 }, (_, i) => aimTargetXAt(i / 10));
    expect(samples).toEqual(Array.from({ length: 300 }, (_, i) => aimTargetXAt(i / 10)));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(-AIM_TARGET_HALF_LANE);
    expect(Math.max(...samples)).toBeLessThanOrEqual(AIM_TARGET_HALF_LANE);
    expect(samples.at(-1)).not.toBe(samples[0]);
  });

  it('inverte o passo nas duas extremidades e mantém o ritmo definido', () => {
    const turnAt = (AIM_TARGET_HALF_LANE * 2) / AIM_TARGET_SPEED;
    expect(aimTargetDirectionAt(0)).toBe(1);
    expect(aimTargetXAt(turnAt)).toBe(AIM_TARGET_HALF_LANE);
    expect(aimTargetDirectionAt(turnAt + 0.01)).toBe(-1);
    expect(aimTargetXAt(turnAt * 2)).toBe(-AIM_TARGET_HALF_LANE);
    expect(aimTargetDirectionAt(turnAt * 2 + 0.01)).toBe(1);
  });
});
