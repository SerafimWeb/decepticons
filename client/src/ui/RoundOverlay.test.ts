import { describe, expect, it } from 'vitest';
import { RoundOverlay } from './RoundOverlay';

describe('RoundOverlay (contagem regressiva e resumo da rodada)', () => {
  it('nasce sem resumo de estatísticas', () => {
    const overlay = new RoundOverlay();
    expect(overlay.lastStats).toBeNull();
  });

  it('armazena e exibe o resumo de estatísticas no fim da rodada', () => {
    const overlay = new RoundOverlay();
    const stats = {
      kills: 5,
      damage: 1420,
      streak: 3,
      survivalSeconds: 120,
    };
    overlay.showSummary(stats);
    expect(overlay.lastStats).toEqual(stats);
  });
});
