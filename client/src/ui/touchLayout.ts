/**
 * Onde ficam os botões do toque. Posições em fração da tela (0..1, centro do botão), para o mesmo
 * layout servir de celular a tablet; o jogador pode arrastar cada um e mudar o tamanho (editor no
 * TouchControls). Salvo no próprio aparelho, validado campo a campo como as configurações.
 */

export type PadButton = 'fire' | 'jump' | 'dash' | 'rocket' | 'cam';
export const PAD_BUTTONS: readonly PadButton[] = ['fire', 'jump', 'dash', 'rocket', 'cam'];

export interface TouchLayout {
  pos: Record<PadButton, [number, number]>;
  /** Tamanho de todos os botões (1 = padrão). */
  scale: number;
}

export const SCALE_LIMITS = { min: 0.7, max: 1.4 } as const;

/**
 * Padrão em arco em volta do polegar direito: FOGO para dentro da tela (dá para segurar o celular
 * pelo meio, não pela ponta), PULO embaixo à direita, DASH à direita, FOGUETE e CAM acima.
 */
export const DEFAULT_TOUCH_LAYOUT: Readonly<TouchLayout> = Object.freeze({
  pos: Object.freeze({
    fire: [0.8, 0.66] as [number, number],
    jump: [0.925, 0.86] as [number, number],
    dash: [0.935, 0.5] as [number, number],
    rocket: [0.68, 0.46] as [number, number],
    cam: [0.8, 0.32] as [number, number],
  }),
  scale: 1,
});

/** Diâmetro (px) de cada botão na tela w×h: proporcional ao lado menor, com piso e teto. */
export function buttonSize(button: PadButton, w: number, h: number, scale: number): number {
  const vmin = Math.min(w, h) / 100;
  const base = button === 'fire' ? Math.min(96, Math.max(68, 21 * vmin)) : button === 'cam' ? Math.min(56, Math.max(44, 12 * vmin)) : Math.min(68, Math.max(50, 15 * vmin));
  return Math.round(base * scale);
}

export interface Placed {
  x: number;
  y: number;
  d: number;
}

/** Centros e diâmetros em px, cada botão inteiro dentro da tela (margem de 6 px). */
export function placeButtons(layout: TouchLayout, w: number, h: number): Record<PadButton, Placed> {
  const out = {} as Record<PadButton, Placed>;
  for (const b of PAD_BUTTONS) {
    const d = buttonSize(b, w, h, layout.scale);
    const r = d / 2 + 6;
    const [fx, fy] = layout.pos[b];
    out[b] = { x: Math.min(w - r, Math.max(r, fx * w)), y: Math.min(h - r, Math.max(r, fy * h)), d };
  }
  return out;
}

/** Pares de botões que se sobrepõem (para testes e para o editor avisar). */
export function overlapping(placed: Record<PadButton, Placed>): [PadButton, PadButton][] {
  const pairs: [PadButton, PadButton][] = [];
  for (let i = 0; i < PAD_BUTTONS.length; i++) {
    for (let j = i + 1; j < PAD_BUTTONS.length; j++) {
      const a = placed[PAD_BUTTONS[i]!];
      const b = placed[PAD_BUTTONS[j]!];
      if (Math.hypot(a.x - b.x, a.y - b.y) < (a.d + b.d) / 2) pairs.push([PAD_BUTTONS[i]!, PAD_BUTTONS[j]!]);
    }
  }
  return pairs;
}

const frac = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);

/** Qualquer coisa → layout válido; botão com posição inválida volta ao padrão. */
export function sanitizeTouchLayout(raw: unknown): TouchLayout {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const p = (r.pos && typeof r.pos === 'object' ? r.pos : {}) as Record<string, unknown>;
  const pos = {} as Record<PadButton, [number, number]>;
  for (const b of PAD_BUTTONS) {
    const v = p[b];
    const x = Array.isArray(v) ? frac(v[0]) : null;
    const y = Array.isArray(v) ? frac(v[1]) : null;
    pos[b] = x !== null && y !== null ? [x, y] : [...DEFAULT_TOUCH_LAYOUT.pos[b]];
  }
  const s = typeof r.scale === 'number' && Number.isFinite(r.scale) ? r.scale : 1;
  return { pos, scale: Math.min(SCALE_LIMITS.max, Math.max(SCALE_LIMITS.min, s)) };
}

const KEY = 'cybermech.touch.v1';

/** Layout salvo no aparelho (ou o padrão, se não houver ou se o armazenamento falhar). */
export function loadTouchLayout(storage: Pick<Storage, 'getItem'> | null): TouchLayout {
  try {
    const text = storage?.getItem(KEY);
    return sanitizeTouchLayout(text ? JSON.parse(text) : null);
  } catch {
    return sanitizeTouchLayout(null);
  }
}

export function saveTouchLayout(storage: Pick<Storage, 'setItem'> | null, layout: TouchLayout): void {
  try {
    storage?.setItem(KEY, JSON.stringify(layout));
  } catch {
    // Armazenamento bloqueado: vale nesta sessão.
  }
}
