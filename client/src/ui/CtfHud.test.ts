import { describe, expect, it } from 'vitest';
import { CtfHud, type CtfMatchState } from './CtfHud';

describe('CtfHud (Interface do Modo Capture The Flag)', () => {
  it('nasce oculto por padrão', () => {
    const hud = new CtfHud();
    expect(hud.visible).toBe(false);
  });

  it('permite alternar visibilidade', () => {
    const hud = new CtfHud();
    hud.setVisible(true);
    expect(hud.visible).toBe(true);
    hud.setVisible(false);
    expect(hud.visible).toBe(false);
  });

  it('atualiza o placar e o estado das bandeiras', () => {
    const hud = new CtfHud();
    const state: CtfMatchState = {
      blue: { score: 2, flagState: 'home' },
      red: { score: 1, flagState: 'carried', carrierName: 'CLAWD' },
      targetScore: 3,
    };
    hud.update(state);
    expect(hud.blueScore).toBe(2);
    expect(hud.redScore).toBe(1);
    expect(hud.blueFlagState).toBe('home');
    expect(hud.redFlagState).toBe('carried');
    expect(hud.redCarrier).toBe('CLAWD');
  });
});
