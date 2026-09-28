import { describe, expect, it } from 'vitest';
import { DailyChallenges, defaultChallenges } from './DailyChallenges';

describe('DailyChallenges (Progresso do Piloto & Missões Diárias)', () => {
  it('inicializa com nível 1 e desafios padrão', () => {
    const dc = new DailyChallenges();
    expect(dc.level).toBeGreaterThanOrEqual(1);
    expect(dc.challenges.length).toBe(3);
  });

  it('adiciona XP e sobe de nível a cada 1000 XP', () => {
    const dc = new DailyChallenges();
    const initialLvl = dc.level;
    const leveledUp = dc.addXp(1200);
    expect(leveledUp).toBe(true);
    expect(dc.level).toBe(initialLvl + 1);
  });

  it('avança a missão de abates ao derrotar andróides', () => {
    const dc = new DailyChallenges();
    const ch = dc.challenges.find((c) => c.id === 'kill_androids');
    const p0 = ch?.progress ?? 0;
    dc.trackKill('android');
    expect(ch?.progress).toBe(p0 + 1);
  });

  it('permite resgatar recompensas de missão concluída', () => {
    const dc = new DailyChallenges();
    const ch = dc.challenges.find((c) => c.id === 'kill_androids')!;
    ch.progress = ch.target; // Completa a força para o teste
    ch.claimed = false;

    const initialCredits = dc.credits;
    const res = dc.claimReward('kill_androids');
    expect(res).toBe(true);
    expect(ch.claimed).toBe(true);
    expect(dc.credits).toBe(initialCredits + ch.rewardCredits);
  });
});
