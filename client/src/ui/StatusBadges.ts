import type { StatusKind, StatusView } from './status';

export const STATUS_LABELS: Record<StatusKind, string> = {
  queimando: 'EM CHAMAS',
  chocado: 'CHOCADO',
  atordoado: 'ATORDOADO',
  gelado: 'GELADO',
  congelado: 'CONGELADO',
};

export const STATUS_ICONS: Record<StatusKind, string> = {
  queimando: '<path d="M12 2c1.5 3 4 4.5 4 7.5a4 4 0 0 1-8 0C8 6.5 10.5 5 12 2z" /><path d="M12 12c1 1.5 2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 1-2.5 2-4z" />',
  chocado: '<path d="M13 2L4 14h7l-2 8 11-12h-7l2-8z" />',
  atordoado: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />',
  gelado: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" />',
  congelado: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" /><circle cx="12" cy="12" r="6" />',
};

const MAX_CHIPS = 4;

export interface FxFlags {

  queimando: boolean;
  chocado: boolean;
  atordoado: boolean;
  gelado: boolean;
  congelado: boolean;
}

export function computeFxClasses(list: readonly StatusView[]): FxFlags {
  let queimando = false;
  let chocado = false;
  let atordoado = false;
  let gelado = false;
  let congelado = false;

  for (let i = 0; i < list.length; i++) {
    const k = list[i].kind;
    if (k === 'queimando') queimando = true;
    else if (k === 'chocado') chocado = true;
    else if (k === 'atordoado') atordoado = true;
    else if (k === 'gelado') gelado = true;
    else if (k === 'congelado') congelado = true;
  }

  return { queimando, chocado, atordoado, gelado, congelado };
}

interface CachedChipState {

  kind: StatusKind | null;
  leftText: string;
  fillPct: number;
}

/**
 * T1 — Indicadores de estado do jogador no HUD e efeitos CSS de tela.
 * SEM alocações por quadro: reusa nós DOM e atualiza apenas quando valores mudam.
 */
export class StatusBadges {
  private readonly container: HTMLDivElement;
  private readonly chips: HTMLDivElement[] = [];
  private readonly fills: HTMLElement[] = [];
  private readonly labels: HTMLElement[] = [];
  private readonly iconContainers: HTMLElement[] = [];
  private readonly times: HTMLElement[] = [];
  private readonly states: CachedChipState[] = [];

  constructor(private readonly root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'status-badges';
    this.container.className = 'status-badges';

    for (let i = 0; i < MAX_CHIPS; i++) {
      const chip = document.createElement('div');
      chip.className = 'status-chip';
      chip.hidden = true;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'status-icon-wrap';

      const textSpan = document.createElement('span');
      textSpan.className = 'status-label';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'status-time';

      const barDiv = document.createElement('div');
      barDiv.className = 'status-bar';
      const fillI = document.createElement('i');
      fillI.className = 'status-fill';
      barDiv.appendChild(fillI);

      chip.appendChild(iconSpan);
      chip.appendChild(textSpan);
      chip.appendChild(timeSpan);
      chip.appendChild(barDiv);

      this.container.appendChild(chip);

      this.chips.push(chip);
      this.iconContainers.push(iconSpan);
      this.labels.push(textSpan);
      this.times.push(timeSpan);
      this.fills.push(fillI);
      this.states.push({ kind: null, leftText: '', fillPct: -1 });
    }

    this.root.appendChild(this.container);
  }

  /**
   * Atualiza a lista de estados no HUD e as classes de efeito CSS na raiz.
   */
  update(list: readonly StatusView[]): void {
    // 1. Alterna classes de efeitos visuais de tela na raiz
    const fx = computeFxClasses(list);
    this.root.classList.toggle('fx-queimando', fx.queimando);
    this.root.classList.toggle('fx-chocado', fx.chocado);
    this.root.classList.toggle('fx-atordoado', fx.atordoado);
    this.root.classList.toggle('fx-gelado', fx.gelado);
    this.root.classList.toggle('fx-congelado', fx.congelado);

    // 2. Atualiza até 4 chips de estado sem alocação por frame

    const count = Math.min(MAX_CHIPS, list.length);

    for (let i = 0; i < MAX_CHIPS; i++) {
      const chip = this.chips[i];
      if (i < count) {
        const item = list[i];
        const state = this.states[i];
        const leftSec = Math.max(0, item.left);
        const leftText = leftSec.toFixed(1) + 's';
        const fillPct = Math.round(Math.min(1, Math.max(0, item.level)) * 100);

        if (state.kind !== item.kind) {
          state.kind = item.kind;
          chip.className = `status-chip status-${item.kind}`;
          this.iconContainers[i].innerHTML = `<svg viewBox="0 0 24 24" class="status-svg" aria-hidden="true">${STATUS_ICONS[item.kind]}</svg>`;
          this.labels[i].textContent = STATUS_LABELS[item.kind];
        }

        if (state.leftText !== leftText) {
          state.leftText = leftText;
          this.times[i].textContent = leftText;
        }

        if (state.fillPct !== fillPct) {
          state.fillPct = fillPct;
          this.fills[i].style.width = `${fillPct}%`;
        }

        if (chip.hidden) {
          chip.hidden = false;
        }
      } else {
        if (!chip.hidden) {
          chip.hidden = true;
          this.states[i].kind = null;
          this.states[i].leftText = '';
          this.states[i].fillPct = -1;
        }
      }
    }
  }
}
