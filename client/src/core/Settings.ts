/**
 * Configurações do jogador: o contrato entre a tela de configurações (UI) e os sistemas do jogo.
 * A UI só chama `update()`; o Game escuta `onChange()` e aplica. Tudo fica salvo no navegador do
 * jogador (localStorage), que é dado de fora: `sanitizeSettings` valida e limita campo a campo.
 */

/** Ações do teclado que o jogador pode trocar. O valor é `KeyboardEvent.code` (posição física). */
export type KeyAction = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'dash' | 'secondary' | 'camera' | 'shield';
export type QualityPreset = 'auto' | 'alta' | 'media' | 'baixa';
export type Difficulty = 'facil' | 'normal' | 'dificil';
/** Personalidade de um Mech inimigo (os números ficam em `combat/BotController.ts`, `PERSONAS`). */
export type Persona = 'soldado' | 'brabo' | 'manso' | 'fujao';

/**
 * Radianos de giro por ponto do mouse com sensibilidade 1. Com 800 DPI dá ~25 cm de mouse por volta
 * de 360° (a faixa dos shooters de mira precisa). O valor antigo (0,0022 = 9 cm) era rápido demais.
 */
export const BASE_SENSITIVITY = 0.0008;
const TURN = 2 * Math.PI;
const CM_PER_INCH = 2.54;

export interface GameSettings {
  /** Multiplicador da sensibilidade do mouse (1 = padrão). */
  sensitivity: number;
  /** DPI do mouse do jogador: só para mostrar e digitar a sensibilidade em cm por volta de 360°. */
  mouseDpi: number;
  /** Entrada crua do mouse (Pointer Lock sem aceleração do sistema), onde o navegador permite. */
  rawInput: boolean;
  /** Toque: fricção e puxão leve da mira perto de inimigos (no mouse, nunca). */
  touchAimAssist: boolean;
  /** Toque: atira sozinho com um inimigo sob a mira. */
  touchAutoFire: boolean;
  invertY: boolean;
  /** Graus somados ao campo de visão da 1ª e da 3ª pessoa (a tática não muda). */
  fovOffset: number;
  /** 'auto' = qualidade adaptativa (G12); os outros fixam a qualidade. */
  quality: QualityPreset;
  difficulty: Difficulty;
  /** Mechs rebeldes na arena (vale ao reiniciar a partida). */
  enemyMechs: number;
  /** Andróides de combate na arena (vale ao reiniciar a partida). */
  enemyAndroids: number;
  /** Técnico que conserta os Mechs rebeldes (vale ao reiniciar a partida). */
  technician: boolean;
  /** Personalidade de cada Mech rebelde, na ordem (CLAWD, GEMINAI, CHAD-GPT). Vale na hora. */
  enemyPersonas: Persona[];
  /** Quantos atacam ao mesmo tempo (Mech conta 1, andróide ½); os outros esperam a vez. Vale na hora. */
  maxAttackers: number;
  /** Painel de desempenho compacto no canto (FPS, tick, draws). */
  showPerf: boolean;
  /** Volume mestre do áudio (0 a 1) */
  volume: number;
  keys: Record<KeyAction, string>;
}

export const LIMITS = {
  sensitivity: { min: 0.1, max: 5, step: 0.01 },
  mouseDpi: { min: 100, max: 32000, step: 50 },
  fovOffset: { min: -10, max: 20, step: 1 },
  volume: { min: 0, max: 1, step: 0.05 },
  enemyMechs: { min: 0, max: 3, step: 1 },
  enemyAndroids: { min: 0, max: 3, step: 1 },
  maxAttackers: { min: 0.5, max: 4, step: 0.5 },
} as const;

export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  sensitivity: 1,
  mouseDpi: 800,
  rawInput: true,
  touchAimAssist: true,
  touchAutoFire: true,
  invertY: false,
  fovOffset: 0,
  quality: 'auto',
  // A dificuldade de hoje foi aprovada pelo dono como a "normal" (2026-09-24).
  difficulty: 'normal',
  // Dono, 25/09: "muito difícil, eles são muitos e me juntam": menos andróides e no máximo 2 atacando juntos.
  enemyMechs: 3,
  enemyAndroids: 2,
  technician: true,
  enemyPersonas: Object.freeze(['brabo', 'soldado', 'fujao']) as Persona[],
  maxAttackers: 2,
  showPerf: true,
  volume: 0.8,
  keys: Object.freeze({
    forward: 'KeyW',
    back: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    dash: 'Shift',
    secondary: 'KeyQ',
    shield: 'KeyE',
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
  { action: 'secondary', label: 'Foguetes' },
  { action: 'camera', label: 'Trocar câmera' },
  { action: 'shield', label: 'Barreira de energia' },
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

export const PERSONA_LABELS: Record<Persona, { label: string; about: string }> = {
  soldado: { label: 'Soldado', about: 'troca tiros de média distância e recua avariado' },
  brabo: { label: 'Brabo', about: 'vem para cima, quase não recua e atira até ferver' },
  manso: { label: 'Manso', about: 'fica longe, atira menos e recua cedo' },
  fujao: { label: 'Fujão', about: 'espreita pelas costas, ataca com brecha e foge se for visto' },
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
const PERSONAS: readonly Persona[] = ['soldado', 'brabo', 'manso', 'fujao'];
const ENEMY_SLOTS = 3;

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
    mouseDpi: Math.round(num(r.mouseDpi, d.mouseDpi, LIMITS.mouseDpi.min, LIMITS.mouseDpi.max)),
    rawInput: typeof r.rawInput === 'boolean' ? r.rawInput : d.rawInput,
    touchAimAssist: typeof r.touchAimAssist === 'boolean' ? r.touchAimAssist : d.touchAimAssist,
    touchAutoFire: typeof r.touchAutoFire === 'boolean' ? r.touchAutoFire : d.touchAutoFire,
    invertY: typeof r.invertY === 'boolean' ? r.invertY : d.invertY,
    fovOffset: Math.round(num(r.fovOffset, d.fovOffset, LIMITS.fovOffset.min, LIMITS.fovOffset.max)),
    quality: QUALITIES.includes(r.quality as QualityPreset) ? (r.quality as QualityPreset) : d.quality,
    difficulty: DIFFICULTIES.includes(r.difficulty as Difficulty) ? (r.difficulty as Difficulty) : d.difficulty,
    enemyMechs: Math.round(num(r.enemyMechs, d.enemyMechs, LIMITS.enemyMechs.min, LIMITS.enemyMechs.max)),
    enemyAndroids: Math.round(num(r.enemyAndroids, d.enemyAndroids, LIMITS.enemyAndroids.min, LIMITS.enemyAndroids.max)),
    technician: typeof r.technician === 'boolean' ? r.technician : d.technician,
    enemyPersonas: Array.from({ length: ENEMY_SLOTS }, (_, i) => {
      const p = Array.isArray(r.enemyPersonas) ? (r.enemyPersonas[i] as unknown) : undefined;
      return PERSONAS.includes(p as Persona) ? (p as Persona) : d.enemyPersonas[i]!;
    }),
    maxAttackers: Math.round(num(r.maxAttackers, d.maxAttackers, LIMITS.maxAttackers.min, LIMITS.maxAttackers.max) * 2) / 2,
    showPerf: typeof r.showPerf === 'boolean' ? r.showPerf : d.showPerf,
    volume: num(r.volume, d.volume, LIMITS.volume.min, LIMITS.volume.max),
    keys,
  };
}

// ---------- calibração do mouse (contas físicas) ----------

/** Radianos de giro por ponto do mouse. */
export function radiansPerCount(sensitivity: number): number {
  return BASE_SENSITIVITY * sensitivity;
}

/** Centímetros de mouse para uma volta de 360°, dado o DPI. */
export function cmPer360(sensitivity: number, dpi: number): number {
  return (TURN / radiansPerCount(sensitivity) / dpi) * CM_PER_INCH;
}

/** Sensibilidade que dá uma volta de 360° em `cm` centímetros de mouse. */
export function sensitivityForCm360(cm: number, dpi: number): number {
  return TURN / ((cm / CM_PER_INCH) * dpi) / BASE_SENSITIVITY;
}

/** Menos que isto numa "volta gravada" é movimento curto demais para medir com precisão. */
export const MIN_CALIBRATION_COUNTS = 300;

/**
 * Gravar uma volta: o jogador move o mouse a distância física que quer para 360°, e os pontos
 * medidos viram a sensibilidade. Não precisa saber o DPI. Fora dos limites, fica no limite.
 */
export function calibrateFromCounts(counts: number): { ok: boolean; sensitivity: number } {
  const c = Math.abs(counts);
  if (!Number.isFinite(c) || c < MIN_CALIBRATION_COUNTS) return { ok: false, sensitivity: DEFAULT_SETTINGS.sensitivity };
  const raw = TURN / c / BASE_SENSITIVITY;
  const { min, max } = LIMITS.sensitivity;
  return { ok: true, sensitivity: Math.min(max, Math.max(min, Math.round(raw * 1000) / 1000)) };
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
