/**
 * ModeSelector — Modos reais da simulação (Arena, Sobrevivência e CTF).
 *
 * Permite selecionar entre:
 *  - 'deathmatch': Todos contra todos em rodadas de 5 min.
 *  - 'survival': Modo Sobrevivência em fases/ondas contra hordas rebeldes.
 *  - 'ctf': Captura de bandeiras no treino solo.
 *
 * A URL é a fonte do modo ativo, a mesma que o Game/Match leem. Escolher solicita a troca real da partida.
 * Custo de CPU: zero no loop de gameplay (opera apenas por interação no menu).
 */

import { gameModeFromSearch, type GameMode } from '../sim/gameMode';
export type GameModeId = GameMode;

export interface GameModeInfo {
  id: GameModeId;
  label: string;
  /** Nome curto do botão do seletor (a pausa mostra os três lado a lado). */
  short: string;
  badge: string;
  description: string;
}

const MODE_INFO: Record<GameMode, GameModeInfo> = {
  deathmatch:
  {
    id: 'deathmatch',
    label: 'DEATHMATCH',
    short: 'DEATHMATCH',
    badge: 'COMBATE LIVRE',
    description: 'Partida livre contra bots ou outros pilotos em rodadas de 5 min.',
  },
  survival: {
    id: 'survival',
    label: 'SOBREVIVÊNCIA',
    short: 'SOBREVIVÊNCIA',
    badge: 'MISSÃO EM ONDAS',
    description: 'Enfrente hordas progressivas de andróides e mechs rebeldes.',
  },
  ctf: { id: 'ctf', label: 'CAPTURE A BANDEIRA', short: 'BANDEIRA', badge: 'TREINO SOLO', description: 'Roube a bandeira vermelha e retorne à base azul. Vitória com 3 capturas.' },
};
export const GAME_MODES: GameModeInfo[] = Object.values(MODE_INFO);


export class ModeSelector {
  private activeMode: GameModeId = 'deathmatch';
  private containerEl: HTMLElement | null = null;
  private onChangeCallbacks: ((mode: GameModeId) => void)[] = [];

  constructor(search = typeof window === 'undefined' ? '' : window.location.search) {
    this.activeMode = gameModeFromSearch(search);
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

  private _renderHtml(): void {
    if (!this.containerEl) return;

    this.containerEl.innerHTML = `
      <div class="menu-row">
        <span class="menu-row-label">MODO</span>
        <div class="mode-selector-buttons" role="group" aria-label="Modo de jogo">
          ${GAME_MODES.map(
            (m) => `<button type="button" class="btn-mode ${m.id === this.activeMode ? 'active' : ''}" data-mode="${m.id}" aria-pressed="${m.id === this.activeMode}" title="${m.label}">${m.short}</button>`
          ).join('')}
        </div>
      </div>
      <div id="map-slot"></div>
      <p class="mode-desc" id="mode-desc"></p>
    `;
    this._paintDescription();

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
      btn.setAttribute('aria-pressed', String(mode === this.activeMode));
    });
    this._paintDescription();
  }

  /** Uma linha só: o selo e a frase do modo ativo (os outros dois não precisam ser lidos). */
  private _paintDescription(): void {
    const line = this.containerEl?.querySelector<HTMLElement>('#mode-desc');
    if (!line) return;
    const info = MODE_INFO[this.activeMode];
    line.textContent = `${info.badge} · ${info.description}`;
  }
}
