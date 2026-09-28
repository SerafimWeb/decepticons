import { describe, expect, it } from 'vitest';
import { ModeSelector, GAME_MODES } from './ModeSelector';

describe('ModeSelector (seletor de modo de jogo)', () => {
  it('inicializa no modo padrão deathmatch', () => {
    const selector = new ModeSelector();
    expect(selector.currentMode).toBe('deathmatch');
    expect(GAME_MODES.length).toBe(2);
  });

  it('permite alterar o modo programaticamente e acionar callbacks', () => {
    const selector = new ModeSelector();
    let changedMode = '';
    selector.onModeChange((mode) => {
      changedMode = mode;
    });

    selector.setMode('survival');
    expect(selector.currentMode).toBe('survival');
    expect(changedMode).toBe('survival');
  });

  it('não dispara callback se selecionar o mesmo modo ativo', () => {
    const selector = new ModeSelector();
    let count = 0;
    selector.onModeChange(() => {
      count++;
    });

    selector.setMode('deathmatch'); // Já é o padrão
    expect(count).toBe(0);
  });

  it('attachTo executa de forma segura sem lançar no Node sem DOM', () => {
    const selector = new ModeSelector();
    expect(() => selector.attachTo(null)).not.toThrow();
  });
});
