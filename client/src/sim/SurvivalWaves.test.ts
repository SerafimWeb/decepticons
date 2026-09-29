import { describe, expect, it, vi } from 'vitest';
import { SURVIVAL_WAVE_PLANS, SurvivalWaves, WAVE_BRIEFING_S, WAVE_CLEAR_S } from './SurvivalWaves';

describe('máquina de Ondas', () => {
  it('avança deterministicamente pelas seis hordas e conclui a missão', () => {
    const roster = vi.fn();
    const start = vi.fn();
    const clear = vi.fn();
    const end = vi.fn();
    const waves = new SurvivalWaves({ onRoster: roster, onWaveStart: start, onWaveClear: clear, onMissionEnd: end });

    for (const plan of SURVIVAL_WAVE_PLANS) {
      waves.fixedUpdate((plan.wave === 1 ? WAVE_BRIEFING_S : WAVE_CLEAR_S) + 0.001, true);
      expect(waves.phase).toBe('active');
      expect(waves.total).toBe(plan.mechs + plan.androids + (plan.boss ? 1 : 0));
      for (let i = 0; i < waves.total; i++) waves.recordEnemyKilled();
    }

    expect(waves.phase).toBe('completed');
    expect(start).toHaveBeenCalledTimes(6);
    expect(clear).toHaveBeenCalledTimes(6);
    expect(end).toHaveBeenCalledWith(true, expect.objectContaining({ wavesCleared: 6, kills: 20 }));
    expect(roster).toHaveBeenLastCalledWith(null);
  });

  it('a última onda é o Colossus, e a missão só termina quando ele cai', () => {
    const start = vi.fn();
    const end = vi.fn();
    const waves = new SurvivalWaves({ onRoster: () => {}, onWaveStart: start, onMissionEnd: end });

    for (let w = 0; w < SURVIVAL_WAVE_PLANS.length - 1; w++) {
      waves.fixedUpdate((w === 0 ? WAVE_BRIEFING_S : WAVE_CLEAR_S) + 0.001, true);
      for (let i = 0; i < waves.total; i++) waves.recordEnemyKilled();
    }

    waves.fixedUpdate(WAVE_CLEAR_S + 0.001, true);
    expect(start).toHaveBeenLastCalledWith(expect.objectContaining({ wave: 6, boss: true }));
    expect(waves.total).toBe(3); // dois andróides de escolta e o Colossus

    waves.recordEnemyKilled();
    waves.recordEnemyKilled();
    expect(waves.phase).toBe('active'); // os escoltas caíram; o Colossus ainda está de pé
    expect(end).not.toHaveBeenCalled();

    waves.recordEnemyKilled();
    expect(waves.phase).toBe('completed');
    expect(end).toHaveBeenCalledWith(true, expect.objectContaining({ wavesCleared: 6 }));
  });

  it('encerra quando todos os pilotos caem e preserva as estatísticas', () => {
    const end = vi.fn();
    const waves = new SurvivalWaves({ onRoster: () => {}, onMissionEnd: end });
    waves.fixedUpdate(WAVE_BRIEFING_S + 0.001, true);
    waves.recordDamage(37);
    waves.recordEnemyKilled();
    waves.fixedUpdate(2, false);

    expect(waves.phase).toBe('failed');
    expect(end).toHaveBeenCalledWith(false, expect.objectContaining({ kills: 1, damageDealt: 37 }));
  });

  it('reset volta ao briefing sem carregar progresso da tentativa anterior', () => {
    const roster = vi.fn();
    const waves = new SurvivalWaves({ onRoster: roster });
    waves.fixedUpdate(WAVE_BRIEFING_S + 0.001, true);
    waves.recordDamage(10);
    waves.recordEnemyKilled();
    waves.reset();

    expect(waves.phase).toBe('briefing');
    expect(waves.wave).toBe(1);
    expect(waves.damageDealt).toBe(0);
    expect(waves.killed).toBe(0);
    expect(roster).toHaveBeenLastCalledWith(null);
  });
});
