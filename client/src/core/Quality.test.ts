import { describe, it, expect, vi } from 'vitest';
import { Quality } from './Quality';

describe('Quality', () => {
  it('should not degrade if FPS is >= 50', () => {
    const setPixelRatio = vi.fn();
    const setBloom = vi.fn();
    const quality = new Quality(setPixelRatio, setBloom);

    // Simula 2.1 segundos a 60 FPS (126 frames de 1/60s)
    const dt = 1 / 60;
    for (let i = 0; i < 126; i++) {
      quality.update(dt);
    }

    expect(quality.currentTier).toBe(0);
    expect(setPixelRatio).not.toHaveBeenCalled();
    expect(setBloom).not.toHaveBeenCalled();
  });

  it('should degrade pixelRatio (tier 1) if FPS < 50', () => {
    const setPixelRatio = vi.fn();
    const setBloom = vi.fn();
    const quality = new Quality(setPixelRatio, setBloom);

    // Simula 2.1 segundos a 40 FPS (84 frames de 1/40s)
    const dt = 1 / 40;
    for (let i = 0; i < 84; i++) {
      quality.update(dt);
    }

    expect(quality.currentTier).toBe(1);
    expect(setPixelRatio).toHaveBeenCalledWith(1.0);
    expect(setBloom).not.toHaveBeenCalled();
  });

  it('should degrade bloom (tier 2) if FPS remains < 50 for another cycle', () => {
    const setPixelRatio = vi.fn();
    const setBloom = vi.fn();
    const quality = new Quality(setPixelRatio, setBloom);

    // Ciclo 1 (cai para tier 1)
    const dt = 1 / 40;
    for (let i = 0; i < 84; i++) {
      quality.update(dt);
    }
    expect(quality.currentTier).toBe(1);

    // Ciclo 2 (cai para tier 2)
    for (let i = 0; i < 84; i++) {
      quality.update(dt);
    }
    expect(quality.currentTier).toBe(2);
    expect(setBloom).toHaveBeenCalledWith(false);
  });

  it('should not degrade past max tiers', () => {
    const setPixelRatio = vi.fn();
    const setBloom = vi.fn();
    const quality = new Quality(setPixelRatio, setBloom);

    // Simula 3 ciclos de degradação
    const dt = 1 / 40;
    for (let i = 0; i < 260; i++) {
      quality.update(dt);
    }

    expect(quality.currentTier).toBe(2);
    expect(setPixelRatio).toHaveBeenCalledTimes(1); // Foi chamado uma vez no tier 1
    expect(setBloom).toHaveBeenCalledTimes(1);      // Foi chamado uma vez no tier 2
  });

  it('should not recover quality if FPS improves', () => {
    const setPixelRatio = vi.fn();
    const setBloom = vi.fn();
    const quality = new Quality(setPixelRatio, setBloom);

    // Ciclo 1: degrada
    for (let i = 0; i < 84; i++) {
      quality.update(1 / 40);
    }
    expect(quality.currentTier).toBe(1);

    // Ciclo 2: melhora (60 FPS)
    for (let i = 0; i < 126; i++) {
      quality.update(1 / 60);
    }
    expect(quality.currentTier).toBe(1); // Não recuperou
  });
});
