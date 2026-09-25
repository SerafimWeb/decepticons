import { describe, expect, it } from 'vitest';
import { DEFAULT_TOUCH_LAYOUT, loadTouchLayout, overlapping, PAD_BUTTONS, placeButtons, sanitizeTouchLayout, saveTouchLayout, SCALE_LIMITS } from './touchLayout';

/** Telas deitadas comuns (px CSS): celulares pequenos, médios, grandes e tablets. */
const SCREENS: [number, number][] = [
  [640, 360],
  [740, 360],
  [844, 390],
  [915, 412],
  [932, 430],
  [1024, 768],
  [1180, 820],
];

describe('layout dos botões de toque', () => {
  it('o padrão não sobrepõe botões nem sai da tela, em celulares e tablets, do menor ao maior tamanho', () => {
    for (const [w, h] of SCREENS) {
      for (const scale of [SCALE_LIMITS.min, 1, SCALE_LIMITS.max]) {
        const placed = placeButtons({ ...DEFAULT_TOUCH_LAYOUT, scale }, w, h);
        expect(overlapping(placed), `${w}x${h} escala ${scale}`).toEqual([]);
        for (const b of PAD_BUTTONS) {
          const { x, y, d } = placed[b];
          expect(x - d / 2).toBeGreaterThanOrEqual(0);
          expect(y + d / 2).toBeLessThanOrEqual(h);
        }
      }
    }
  });

  it('FOGO fica para dentro da tela (dá para segurar pelo meio, não pela ponta) e longe da pausa', () => {
    for (const [w, h] of SCREENS) {
      const { fire } = placeButtons(DEFAULT_TOUCH_LAYOUT, w, h);
      expect(w - fire.x).toBeGreaterThan(w * 0.15);
      // Pausa e PLACAR ocupam o canto de cima à direita (~110 px); nenhum botão encosta nele.
      for (const b of PAD_BUTTONS) {
        const p = placeButtons(DEFAULT_TOUCH_LAYOUT, w, h)[b];
        const inCorner = p.x + p.d / 2 > w - 64 && p.y - p.d / 2 < 110;
        expect(inCorner, `${b} em ${w}x${h}`).toBe(false);
      }
    }
  });

  it('dado salvo corrompido vira layout válido; posição inválida volta ao padrão; escala limitada', () => {
    const l = sanitizeTouchLayout({ pos: { fire: [0.5, 0.5], jump: ['x', 1], dash: [2, -1] }, scale: 9 });
    expect(l.pos.fire).toEqual([0.5, 0.5]);
    expect(l.pos.jump).toEqual(DEFAULT_TOUCH_LAYOUT.pos.jump);
    expect(l.pos.dash).toEqual([1, 0]); // preso à tela
    expect(l.scale).toBe(SCALE_LIMITS.max);
    expect(sanitizeTouchLayout('lixo')).toEqual(sanitizeTouchLayout(null));
  });

  it('salva e recarrega; armazenamento que falha não derruba nada', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    saveTouchLayout(storage, { pos: { ...DEFAULT_TOUCH_LAYOUT.pos, fire: [0.6, 0.7] }, scale: 1.2 });
    const back = loadTouchLayout(storage);
    expect(back.pos.fire).toEqual([0.6, 0.7]);
    expect(back.scale).toBe(1.2);
    const hostile = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('cheio'); } };
    expect(loadTouchLayout(hostile).scale).toBe(1);
    expect(() => saveTouchLayout(hostile, back)).not.toThrow();
  });
});
