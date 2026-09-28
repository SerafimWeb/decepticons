/**
 * CtfHud — Interface visual do modo Capture The Flag (CTF Vermelho × Azul).
 *
 * Exibe o placar de equipes (Azul × Vermelho), status das duas bandeiras
 * (na base, carregada por [Nome], ou caída no mapa), e anúncios de evento.
 *
 * Design (G3 / G4):
 *  - Interatividade puramente reativa via callbacks.
 *  - Atualização do DOM com textContent, escrevendo somente quando os valores mudam.
 */

export type FlagState = 'home' | 'carried' | 'dropped';

export interface CtfTeamState {
  score: number;
  flagState: FlagState;
  carrierName?: string;
}

export interface CtfMatchState {
  blue: CtfTeamState;
  red: CtfTeamState;
  targetScore: number;
}

export type CtfEventKind = 'stolen' | 'captured' | 'returned' | 'dropped';

function flagStateLabel(state: FlagState, carrierName?: string): string {
  if (state === 'home') return 'NA BASE';
  if (state === 'carried') return carrierName ? `COM ${carrierName.toUpperCase()}` : 'ROUBADA';
  return 'CAÍDA NO MAPA';
}

export class CtfHud {
  private readonly rootEl: HTMLElement;

  private shownBlueScore = -1;
  private shownRedScore = -1;
  private shownBlueFlag = '';
  private shownRedFlag = '';

  blueScore = 0;
  redScore = 0;
  blueFlagState: FlagState = 'home';
  redFlagState: FlagState = 'home';
  blueCarrier = '';
  redCarrier = '';
  visible = false;

  constructor() {
    this.rootEl = this._getOrCreateRoot();
  }

  /** Exibe ou oculta a interface de CTF. */
  setVisible(show: boolean): void {
    this.visible = show;
    this.rootEl.classList.toggle('hidden', !show);
  }

  /** Atualiza o estado das equipes sem reescrever o DOM se nada mudou. */
  update(state: CtfMatchState): void {
    this.blueScore = state.blue.score;
    this.redScore = state.red.score;
    this.blueFlagState = state.blue.flagState;
    this.redFlagState = state.red.flagState;
    this.blueCarrier = state.blue.carrierName || '';
    this.redCarrier = state.red.carrierName || '';

    const bFlagText = flagStateLabel(this.blueFlagState, this.blueCarrier);
    const rFlagText = flagStateLabel(this.redFlagState, this.redCarrier);

    if (
      this.blueScore === this.shownBlueScore &&
      this.redScore === this.shownRedScore &&
      bFlagText === this.shownBlueFlag &&
      rFlagText === this.shownRedFlag
    ) {
      return;
    }

    if (typeof document !== 'undefined') {
      if (this.blueScore !== this.shownBlueScore) {
        const el = document.getElementById('ctf-blue-score');
        if (el) el.textContent = String(this.blueScore);
      }
      if (this.redScore !== this.shownRedScore) {
        const el = document.getElementById('ctf-red-score');
        if (el) el.textContent = String(this.redScore);
      }
      if (bFlagText !== this.shownBlueFlag) {
        const el = document.getElementById('ctf-blue-flag-status');
        if (el) {
          el.textContent = bFlagText;
          el.className = `ctf-flag-status ${this.blueFlagState}`;
        }
      }
      if (rFlagText !== this.shownRedFlag) {
        const el = document.getElementById('ctf-red-flag-status');
        if (el) {
          el.textContent = rFlagText;
          el.className = `ctf-flag-status ${this.redFlagState}`;
        }
      }
    }

    this.shownBlueScore = this.blueScore;
    this.shownRedScore = this.redScore;
    this.shownBlueFlag = bFlagText;
    this.shownRedFlag = rFlagText;
  }

  /**
   * Exibe um banner de anúncio de evento CTF (ex.: "BANDEIRA AZUL ROUBADA!").
   */
  showEventBanner(kind: CtfEventKind, team: 'blue' | 'red', actorName?: string): void {
    if (typeof document === 'undefined') return;

    const existing = document.getElementById('ctf-event-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'ctf-event-banner';
    banner.className = `ctf-event-banner team-${team}`;

    const titleEl = document.createElement('div');
    titleEl.className = 'ctf-banner-title';

    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'ctf-banner-subtitle';

    const teamLabel = team === 'blue' ? 'AZUL' : 'VERMELHA';

    if (kind === 'stolen') {
      titleEl.textContent = `BANDEIRA ${teamLabel} ROUBADA!`;
      subtitleEl.textContent = actorName ? `// PILOTO ${actorName.toUpperCase()}` : '// EM MOVIMENTO';
    } else if (kind === 'captured') {
      titleEl.textContent = `PONTO PARA O TIME ${teamLabel}!`;
      subtitleEl.textContent = actorName ? `// CAPTURADA POR ${actorName.toUpperCase()}` : '// BANDEIRA ENTREGUE';
    } else if (kind === 'returned') {
      titleEl.textContent = `BANDEIRA ${teamLabel} RECUPERADA!`;
      subtitleEl.textContent = '// RETORNADA À BASE';
    } else {
      titleEl.textContent = `BANDEIRA ${teamLabel} SOLTA!`;
      subtitleEl.textContent = '// CAÍDA NO CAMPO DE BATALHA';
    }

    banner.appendChild(titleEl);
    banner.appendChild(subtitleEl);

    document.getElementById('hud')?.appendChild(banner);

    requestAnimationFrame(() => banner.classList.add('show'));
    setTimeout(() => {
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 500);
    }, 2800);
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private _getOrCreateRoot(): HTMLElement {
    if (typeof document === 'undefined') {
      return {
        id: 'ctf-hud',
        className: 'ctf-hud hidden',
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        innerHTML: '',
      } as unknown as HTMLElement;
    }

    let el = document.getElementById('ctf-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ctf-hud';
      el.className = 'ctf-hud hidden';
      el.innerHTML = `
        <div class="ctf-team-box blue">
          <div class="ctf-team-name">TIME AZUL</div>
          <div class="ctf-team-score" id="ctf-blue-score">0</div>
          <div class="ctf-flag-status home" id="ctf-blue-flag-status">NA BASE</div>
        </div>
        <div class="ctf-vs">VS</div>
        <div class="ctf-team-box red">
          <div class="ctf-team-name">TIME VERMELHO</div>
          <div class="ctf-team-score" id="ctf-red-score">0</div>
          <div class="ctf-flag-status home" id="ctf-red-flag-status">NA BASE</div>
        </div>
      `;
      document.getElementById('hud')?.appendChild(el);
    }
    return el;
  }
}
