/**
 * ModeSelector — Seletor de Modo de Jogo (Deathmatch vs Sobrevivência).
 *
 * Permite selecionar entre:
 *  - 'deathmatch': Todos contra todos em rodadas de 5 min.
 *  - 'survival': Modo Sobrevivência em fases/ondas contra hordas rebeldes.
 *
 * Persiste a escolha em localStorage ('cybermech_game_mode') ou via parâmetro URL '?modo='.
 * Custo de CPU: zero no loop de gameplay (opera apenas por interação no menu).
 */

export type GameModeId = 'deathmatch' | 'survival';

export interface GameModeInfo {
  id: GameModeId;
  label: string;
  badge: string;
  description: string;
}

export const GAME_MODES: GameModeInfo[] = [
  {
    id: 'deathmatch',
    label: 'DEATHMATCH',
    badge: 'COMBATE LIVRE',
    description: 'Partida livre contra bots ou outros pilotos em rodadas de 5 min.',
  },
  {
    id: 'survival',
    label: 'SOBREVIVÊNCIA',
    badge: 'MISSÃO EM ONDAS',
    description: 'Enfrente hordas progressivas de andróides e mechs rebeldes.',
  },
];

const STORAGE_KEY = 'cybermech_game_mode';

export class ModeSelector {
  private activeMode: GameModeId = 'deathmatch';
  private containerEl: HTMLElement | null = null;
  private onChangeCallbacks: ((mode: GameModeId) => void)[] = [];

  constructor() {
    this.activeMode = this._readInitialMode();
  }

  /** Retorna o modo de jogo atualmente selecionado. */
  get currentMode(): GameModeId {
    return this.activeMode;
  }

  /** Registra um listener para quando o modo de jogo for alterado pelo usuário. */
  onModeChange(fn: (mode: GameModeId) => void): void {
    this.onChangeCallbacks.push(fn);
  }

  /** Altera o modo programaticamente e dispara callbacks. */
  setMode(mode: GameModeId): void {
    if (this.activeMode === mode) return;
    this.activeMode = mode;
    this._persist(mode);
    this._updateUiState();
    for (const fn of this.onChangeCallbacks) {
      fn(mode);
    }
  }

  /** Insere ou atualiza o seletor HTML no container pai informado (ex.: #overlay ou painel do lobby). */
  attachTo(parent: HTMLElement | null): void {
    if (typeof document === 'undefined' || !parent) return;

    let el = document.getElementById('game-mode-selector');
    if (!el) {
      el = document.createElement('div');
      el.id = 'game-mode-selector';
      el.className = 'game-mode-selector';
      parent.appendChild(el);
    }
    this.containerEl = el;
    this._renderHtml();
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private _readInitialMode(): GameModeId {
    if (typeof window !== 'undefined' && window.location) {
      const param = new URLSearchParams(window.location.search).get('modo');
      if (param === 'survival' || param === 'sobrevivencia') return 'survival';
      if (param === 'deathmatch') return 'deathmatch';
    }
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'survival' || stored === 'deathmatch') return stored;
    }
    return 'deathmatch';
  }

  private _persist(mode: GameModeId): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch { /* ignora se falhar */ }
    }
  }

  private _renderHtml(): void {
    if (!this.containerEl) return;

    this.containerEl.innerHTML = `
      <div class="mode-selector-label">// MODO DE JOGO</div>
      <div class="mode-selector-buttons">
        ${GAME_MODES.map(
          (m) => `
          <button type="button" class="btn-mode ${m.id === this.activeMode ? 'active' : ''}" data-mode="${m.id}">
            <div class="mode-btn-header">
              <span class="mode-title">${m.label}</span>
              <span class="mode-badge">${m.badge}</span>
            </div>
            <div class="mode-desc">${m.description}</div>
          </button>
        `
        ).join('')}
      </div>
    `;

    const buttons = this.containerEl.querySelectorAll<HTMLButtonElement>('.btn-mode');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.getAttribute('data-mode') as GameModeId;
        if (mode) this.setMode(mode);
      });
    });
  }

  private _updateUiState(): void {
    if (!this.containerEl) return;
    const buttons = this.containerEl.querySelectorAll<HTMLButtonElement>('.btn-mode');
    buttons.forEach((btn) => {
      const mode = btn.getAttribute('data-mode');
      btn.classList.toggle('active', mode === this.activeMode);
    });
  }
}
