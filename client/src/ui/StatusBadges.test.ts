import { describe, expect, it } from 'vitest';
import { computeFxClasses } from './StatusBadges';
import type { StatusView } from './status';

describe('computeFxClasses', () => {
  it('returns false for all FX flags when status list is empty', () => {
    const fx = computeFxClasses([]);
    expect(fx.queimando).toBe(false);
    expect(fx.chocado).toBe(false);
    expect(fx.atordoado).toBe(false);
    expect(fx.gelado).toBe(false);
    expect(fx.congelado).toBe(false);
  });

  it('correctly maps queimando and chocado to FX flags', () => {
    const list: StatusView[] = [
      { kind: 'queimando', left: 4.0, level: 0.8 },
      { kind: 'chocado', left: 3.0, level: 1.0 },
    ];
    const fx = computeFxClasses(list);
    expect(fx.queimando).toBe(true);
    expect(fx.chocado).toBe(true);
    expect(fx.atordoado).toBe(false);
    expect(fx.gelado).toBe(false);
    expect(fx.congelado).toBe(false);
  });

  it('correctly maps atordoado, gelado, and congelado to FX flags', () => {
    const list: StatusView[] = [
      { kind: 'atordoado', left: 0.8, level: 1.0 },
      { kind: 'gelado', left: 4.0, level: 0.6 },
      { kind: 'congelado', left: 1.5, level: 1.0 },
    ];
    const fx = computeFxClasses(list);
    expect(fx.queimando).toBe(false);
    expect(fx.chocado).toBe(false);
    expect(fx.atordoado).toBe(true);
    expect(fx.gelado).toBe(true);
    expect(fx.congelado).toBe(true);
  });
});
