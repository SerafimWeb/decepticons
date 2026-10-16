import { describe, expect, it, beforeEach } from 'vitest';
import { AudioSystem } from './AudioSystem';

describe('AudioSystem - T5 Elemental Audio & Fallbacks', () => {
  let audio: AudioSystem;

  beforeEach(() => {
    audio = new AudioSystem();
  });

  it('safely handles calls before resume / without AudioContext', () => {
    expect(() => {
      audio.setRotarySpin(0.8);
      audio.setRotarySpin(0);
      audio.playArcShot();
      audio.setFlame(true);
      audio.setFlame(false);
      audio.playCryoShot();
      audio.playCannonShot();
      audio.playAutocannonShot();
      audio.playSonicShot();
      audio.playKillStreak(1);
      audio.playKillStreak(4);
      audio.playKillStreak(99);
      audio.playKillStreak(0);
      audio.playStatusEnter('queimando');
      audio.playStatusEnter('chocado');
      audio.playStatusEnter('atordoado');
      audio.playStatusEnter('gelado');
      audio.playStatusEnter('congelado');
      audio.setStatusLoop('queimando');
      audio.setStatusLoop(null);
    }).not.toThrow();
  });

  it('safely handles calls when enabled is set to false', () => {
    audio.enabled = false;
    expect(() => {
      audio.setRotarySpin(1.0);
      audio.setFlame(true);
      audio.setStatusLoop('congelado');
    }).not.toThrow();
  });
});

describe('AudioSystem - sons de arma de referência (P146)', () => {
  it('sem contexto ou sem amostra carregada, playArma devolve false: quem chama cai no som sintetizado (nunca fica mudo)', () => {
    const audio = new AudioSystem();
    for (const id of ['blaster', 'plasma', 'cannon', 'siege', 'rockets', 'seeker', 'barrage']) expect(audio.playArma(id), id).toBe(false);
  });

  it('arma sem amostra na tabela devolve false e não quebra', () => {
    const audio = new AudioSystem();
    for (const id of ['rotary', 'arc', 'cryo', 'flamer', 'sonic', 'nao-existe', '']) expect(audio.playArma(id), id).toBe(false);
  });

  it('o narrador: clipe de voz ainda não carregado não toca e devolve duração 0', () => {
    const audio = new AudioSystem();
    expect(audio.temAmostra('voz:br/combate')).toBe(false);
    expect(audio.tocarVoz('voz:br/combate')).toBe(0);
  });
});
