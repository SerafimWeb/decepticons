import { describe, expect, it } from 'vitest';
import { AudioSystem } from './AudioSystem';

describe('AudioSystem (efeitos sonoros sintetizados)', () => {
  it('cria o AudioSystem com volume mestre padrão', () => {
    const audio = new AudioSystem();
    expect(audio.enabled).toBe(true);
    expect(audio.masterVolume).toBe(0.6);
  });

  it('permite alterar volume mestre', () => {
    const audio = new AudioSystem();
    audio.setVolume(0.8);
    expect(audio.masterVolume).toBe(0.8);
  });

  it('métodos de áudio do modo sobrevivência funcionam sem erro quando inativo ou sem contexto', () => {
    const audio = new AudioSystem();
    expect(() => audio.playWaveSiren()).not.toThrow();
    expect(() => audio.playCountdownBeep(false)).not.toThrow();
    expect(() => audio.playCountdownBeep(true)).not.toThrow();
    expect(() => audio.playWaveClearSound()).not.toThrow();
  });
});
