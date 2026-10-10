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
