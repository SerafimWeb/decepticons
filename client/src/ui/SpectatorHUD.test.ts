import { describe, expect, it } from 'vitest';
import { SpectatorHUD } from './SpectatorHUD';

describe('SpectatorHUD (banner e controles de espectador)', () => {
  it('inicializa oculto por padrão', () => {
    const hud = new SpectatorHUD();
    expect(hud.isVisible).toBe(false);
  });

  it('permite alternar visibilidade e atualizar o rótulo do alvo', () => {
    const hud = new SpectatorHUD();
    hud.setVisible(true);
    expect(hud.isVisible).toBe(true);

    hud.setLabel('TOPO DO PRÉDIO SERAFIM');
    expect(hud.label).toBe('TOPO DO PRÉDIO SERAFIM');

    hud.setVisible(false);
    expect(hud.isVisible).toBe(false);
  });

  it('preserva callbacks de navegação e saída', () => {
    const hud = new SpectatorHUD();
    let prevCalls = 0;
    let nextCalls = 0;
    let exitCalls = 0;

    hud.onPrev = () => { prevCalls++; };
    hud.onNext = () => { nextCalls++; };
    hud.onExit = () => { exitCalls++; };

    hud.onPrev();
    hud.onNext();
    hud.onExit();

    expect(prevCalls).toBe(1);
    expect(nextCalls).toBe(1);
    expect(exitCalls).toBe(1);
  });
});
