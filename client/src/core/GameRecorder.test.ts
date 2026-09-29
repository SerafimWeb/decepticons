import { describe, expect, it } from 'vitest';
import { AudioSystem } from '../audio/AudioSystem';
import { GameRecorder } from './GameRecorder';

/**
 * Os testes rodam no Node, sem `MediaRecorder` nem `canvas.captureStream` de verdade — o que se prova aqui
 * é que o módulo nunca lança quando os dois faltam (o boot headless do smoke, e qualquer navegador sem
 * suporte), e que a tecla escondida (F9, ver Game.ts) sempre tem algo seguro para chamar.
 */
describe('GameRecorder (gravação nativa, dono, 28/09)', () => {
  const canvasSemSuporte = {} as HTMLCanvasElement; // sem captureStream: o mesmo que um navegador antigo

  it('nasce parado', () => {
    const r = new GameRecorder(canvasSemSuporte, new AudioSystem());
    expect(r.gravando).toBe(false);
  });

  it('sem captureStream/MediaRecorder, alternar() não lança e não liga a gravação', () => {
    const r = new GameRecorder(canvasSemSuporte, new AudioSystem());
    expect(() => r.alternar()).not.toThrow();
    expect(r.gravando).toBe(false);
  });

  it('chamar alternar() várias vezes seguidas (a tecla F9 apertada repetido) nunca lança', () => {
    const r = new GameRecorder(canvasSemSuporte, new AudioSystem());
    for (let i = 0; i < 5; i++) expect(() => r.alternar()).not.toThrow();
  });
});
