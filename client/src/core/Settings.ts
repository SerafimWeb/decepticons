/**
 * Configurações do jogador: o contrato entre a tela de configurações (UI) e os sistemas do jogo.
 * A UI só chama `update()`; o Game escuta `onChange()` e aplica. Tudo fica salvo no navegador do
 * jogador (localStorage), que é dado de fora: `sanitizeSettings` valida e limita campo a campo.
 */

/** Ações do teclado que o jogador pode trocar. O valor é `KeyboardEvent.code` (posição física). */
export type KeyAction = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'dash' | 'camera';
export type QualityPreset = 'auto' | 'alta' | 'media' | 'baixa';
export type Difficulty = 'facil' | 'normal' | 'dificil';

export interface GameSettings {
  /** Multiplicador da sensibilidade do mouse (1 = padrão). */
  sensitivity: number;
  invertY: boolean;
  /** Graus somados ao campo de visão da 1ª e da 3ª pessoa (a tática não muda). */
  fovOffset: number;
  /** 'auto' = qualidade adaptativa (G12); os outros fixam a qualidade. */
  quality: QualityPreset;
  difficulty: Difficulty;
  /** Painel de desempenho compacto no canto (FPS, tick, draws). */
  showPerf: boolean;
  keys: Record<KeyAction, string>;
}

export const LIMITS = {
  sensitivity: { min: 0.25, max: 3, step: 0.05 },
  fovOffset: { min: -10, max: 20, step: 1 },
} as const;

export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  sensitivity: 1,
  invertY: false,
  fovOffset: 0,
  quality: 'auto',
  // A dificuldade de hoje foi aprovada pelo dono como a "normal" (2026-09-24).
  difficulty: 'normal',
  showPerf: true,
  keys: Object.freeze({
    forward: 'KeyW',
    back: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    dash: 'Shift',
    camera: 'KeyV',
  }),
});

/** Rótulos para a tela de configurações, na ordem de exibição. */
export const KEY_ACTIONS: readonly { action: KeyAction; label: string }[] = [
  { action: 'forward', label: 'Frente' },
  { action: 'back', label: 'Trás' },
  { action: 'left', label: 'Esquerda' },
  { action: 'right', label: 'Direita' },
  { action: 'jump', label: 'Pulo' },
  { action: 'dash', label: 'Dash' },
  { action: 'camera', label: 'Trocar câmera' },
];

export const QUALITY_LABELS: Record<QualityPreset, string> = {
  auto: 'Automática',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
};

/** Teclas do sistema: não podem ser usadas em ações (Esc pausa, F1 esconde o HUD, ' abre o painel). */
export const RESERVED_KEYS: readonly string[] = ['Escape', 'F1', 'Backquote', 'Quote'];

/** Shift, Ctrl e Alt valem pelos dois lados do teclado: o código vira só o nome do modificador. */
export function normalizeKey(code: string): string {
  const m = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code);
  return m ? m[1]! : code;
}

/** Nome curto para mostrar na tela ("KeyW" → "W", "Space" → "Espaço"). */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names: Record<string, string> = { Space: 'Espaço', Shift: 'Shift', Control: 'Ctrl', Alt: 'Alt', Tab: 'Tab' };
  return names[code] ?? code;
}

const QUALITIES: readonly QualityPreset[] = ['auto', 'alta', 'media', 'baixa'];
const DIFFICULTIES: readonly Difficulty[] = ['facil', 'normal', 'dificil'];

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function validKey(v: unknown): string | null {
  if (typeof v !== 'string' || !/^[A-Za-z0-9]{1,24}$/.test(v)) return null;
  const k = normalizeKey(v);
  return RESERVED_KEYS.includes(k) ? null : k;
}

/**
 * Qualquer coisa → configurações válidas. Campo inválido volta ao padrão; os outros são mantidos.
 * Não impede a mesma tecla em duas ações: a tela deve trocar as teclas (swap) ao reatribuir.
 */
export function sanitizeSettings(raw: unknown): GameSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const rk = (r.keys && typeof r.keys === 'object' ? r.keys : {}) as Record<string, unknown>;
  const keys = { ...d.keys };
  for (const { action } of KEY_ACTIONS) keys[action] = validKey(rk[action]) ?? d.keys[action];
  return {
    sensitivity: num(r.sensitivity, d.sensitivity, LIMITS.sensitivity.min, LIMITS.sensitivity.max),
    invertY: typeof r.invertY === 'boolean' ? r.invertY : d.invertY,
    fovOffset: Math.round(num(r.fovOffset, d.fovOffset, LIMITS.fovOffset.min, LIMITS.fovOffset.max)),
    quality: QUALITIES.includes(r.quality as QualityPreset) ? (r.quality as QualityPreset) : d.quality,
    difficulty: DIFFICULTIES.includes(r.difficulty as Difficulty) ? (r.difficulty as Difficulty) : d.difficulty,
    showPerf: typeof r.showPerf === 'boolean' ? r.showPerf : d.showPerf,
    keys,
  };
}

type Listener = (s: Readonly<GameSettings>) => void;

export class Settings {
  private current: GameSettings;
  private readonly listeners = new Set<Listener>();

  /** `storage` null = só memória (ex.: navegador que bloqueia o localStorage). */
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null,
    private readonly storageKey = 'cybermech.settings.v1',
  ) {
    let saved: unknown = null;
    try {
      const text = storage?.getItem(storageKey);
      saved = text ? JSON.parse(text) : null;
    } catch {
      saved = null;
    }
    this.current = sanitizeSettings(saved);
  }

  get value(): Readonly<GameSettings> {
    return this.current;
  }

  update(patch: Partial<GameSettings>): void {
    const keys = patch.keys ? { ...this.current.keys, ...patch.keys } : this.current.keys;
    this.current = sanitizeSettings({ ...this.current, ...patch, keys });
    this.save();
    for (const l of this.listeners) l(this.current);
  }

  reset(): void {
    this.update(structuredClone(DEFAULT_SETTINGS) as GameSettings);
  }

  /** Chama já com o valor atual e a cada mudança. Retorna a função que cancela. */
  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  private save(): void {
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(this.current));
    } catch {
      // Armazenamento cheio ou bloqueado: continua valendo nesta sessão.
    }
  }
}

/** localStorage quando o navegador deixa; senão null (o jogo segue sem salvar). */
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
