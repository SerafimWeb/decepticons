/**
 * DailyChallenges — Progresso do Piloto & Missões Diárias (Metagame & Retenção).
 *
 * Gerencia o Nível do Piloto, XP acumulado, Créditos virtuais e 3 Missões Diárias
 * que se renovam a cada dia civil.
 *
 * Design (G3 / G4):
 *  - Persistência automática em localStorage ('cybermech_pilot_progression').
 *  - Interatividade puramente por eventos; zero custo no loop de física.
 *  - DOM seguro com textContent em todas as variáveis dinâmicas.
 */

export interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardXp: number;
  rewardCredits: number;
  claimed: boolean;
}

export interface PilotProgressionData {
  level: number;
  xp: number;
  credits: number;
  lastResetDate: string;
  challenges: Challenge[];
}

const STORAGE_KEY = 'cybermech_pilot_progression';
const XP_PER_LEVEL = 1000;

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

export function defaultChallenges(): Challenge[] {
  return [
    {
      id: 'kill_androids',
      title: 'CAÇADOR DE ANDRÓIDES',
      description: 'Elimine 6 andróides rebeldes em combate.',
      target: 6,
      progress: 0,
      rewardXp: 150,
      rewardCredits: 100,
      claimed: false,
    },
    {
      id: 'deal_damage',
      title: 'DEVASTAÇÃO TOTAL',
      description: 'Cause 2000 de dano acumulado em partidas.',
      target: 2000,
      progress: 0,
      rewardXp: 200,
      rewardCredits: 150,
      claimed: false,
    },
    {
      id: 'survive_waves',
      title: 'RESISTÊNCIA TÁTICA',
      description: 'Sobreviva a 3 ondas ou vença 2 partidas.',
      target: 3,
      progress: 0,
      rewardXp: 250,
      rewardCredits: 200,
      claimed: false,
    },
  ];
}

export class DailyChallenges {
  private data: PilotProgressionData;
  private containerEl: HTMLElement | null = null;

  constructor() {
    this.data = this._loadData();
    this._checkDailyReset();
  }

  get level(): number { return this.data.level; }
  get xp(): number { return this.data.xp; }
  get credits(): number { return this.data.credits; }
  get challenges(): readonly Challenge[] { return this.data.challenges; }

  /** Adiciona XP e processa ganho de níveis. */
  addXp(amount: number): boolean {
    if (amount <= 0) return false;
    this.data.xp += amount;
    let leveledUp = false;
    while (this.data.xp >= XP_PER_LEVEL) {
      this.data.xp -= XP_PER_LEVEL;
      this.data.level += 1;
      leveledUp = true;
    }
    this._saveData();
    this._updateUi();
    return leveledUp;
  }

  /** Adiciona créditos à conta do piloto. */
  addCredits(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.data.credits = Math.min(Number.MAX_SAFE_INTEGER, this.data.credits + Math.floor(amount));
    this._saveData();
    this._updateUi();
  }

  /** Registra o abate de uma unidade para progresso de missões. */
  trackKill(kind: 'android' | 'mech'): void {
    if (kind === 'android') {
      this._advanceChallenge('kill_androids', 1);
    }
  }

  /** Registra dano causado para progresso de missões. */
  trackDamage(amount: number): void {
    if (amount > 0) {
      this._advanceChallenge('deal_damage', Math.round(amount));
    }
  }

  /** Registra vitória de rodada ou onda vencida. */
  trackWaveOrRound(): void {
    this._advanceChallenge('survive_waves', 1);
  }

  /** Resgata as recompensas de um desafio concluído. */
  claimReward(challengeId: string): boolean {
    const ch = this.data.challenges.find((c) => c.id === challengeId);
    if (!ch || !ch.claimed && ch.progress < ch.target) return false;
    if (ch.claimed) return false;

    ch.claimed = true;
    this.addXp(ch.rewardXp);
    this.addCredits(ch.rewardCredits);
    this._saveData();
    this._updateUi();
    return true;
  }

  /** Acopla o painel de desafios e progresso a um container pai. */
  attachTo(parent: HTMLElement | null): void {
    if (typeof document === 'undefined' || !parent) return;

    let el = document.getElementById('daily-challenges-box');
    if (!el) {
      el = document.createElement('div');
      el.id = 'daily-challenges-box';
      el.className = 'daily-challenges-box';
      parent.appendChild(el);
    }
    this.containerEl = el;
    this._renderHtml();
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private _advanceChallenge(id: string, amount: number): void {
    const ch = this.data.challenges.find((c) => c.id === id);
    if (!ch || ch.claimed) return;
    ch.progress = Math.min(ch.target, ch.progress + amount);
    this._saveData();
    this._updateUi();
  }

  private _checkDailyReset(): void {
    const today = getTodayKey();
    if (this.data.lastResetDate !== today) {
      this.data.lastResetDate = today;
      this.data.challenges = defaultChallenges();
      this._saveData();
    }
  }

  private _loadData(): PilotProgressionData {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as PilotProgressionData;
          if (parsed && typeof parsed.level === 'number' && Array.isArray(parsed.challenges)) {
            return parsed;
          }
        }
      } catch { /* ignora */ }
    }
    return {
      level: 1,
      xp: 0,
      credits: 500,
      lastResetDate: getTodayKey(),
      challenges: defaultChallenges(),
    };
  }

  private _saveData(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch { /* ignora */ }
    }
  }

  private _renderHtml(): void {
    if (!this.containerEl) return;

    this.containerEl.innerHTML = `
      <div class="pilot-profile-header">
        <div class="pilot-level-badge">// PILOTO NÍVEL <span id="pilot-level-val"></span></div>
        <div class="pilot-xp-bar-track">
          <div class="pilot-xp-bar-fill" id="pilot-xp-fill"></div>
        </div>
        <div class="pilot-wallet">CRÉDITOS: <strong id="pilot-credits-val"></strong> ₵</div>
      </div>
      <div class="challenges-section-title">// MISSÕES DIÁRIAS</div>
      <div class="challenges-list" id="challenges-list"></div>
    `;

    this._updateUi();
  }

  private _updateUi(): void {
    if (!this.containerEl || typeof document === 'undefined') return;

    const lvlEl = document.getElementById('pilot-level-val');
    if (lvlEl) lvlEl.textContent = String(this.data.level);

    const credEl = document.getElementById('pilot-credits-val');
    if (credEl) credEl.textContent = String(this.data.credits);

    const xpFill = document.getElementById('pilot-xp-fill');
    if (xpFill) {
      const pct = Math.min(1, this.data.xp / XP_PER_LEVEL);
      xpFill.style.transform = `scaleX(${pct})`;
    }

    const listEl = document.getElementById('challenges-list');
    if (listEl) {
      listEl.innerHTML = '';
      this.data.challenges.forEach((ch) => {
        const item = document.createElement('div');
        item.className = `challenge-card ${ch.claimed ? 'claimed' : ch.progress >= ch.target ? 'ready' : ''}`;

        const header = document.createElement('div');
        header.className = 'challenge-card-header';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'challenge-title';
        titleSpan.textContent = ch.title;
        header.appendChild(titleSpan);

        const rewardSpan = document.createElement('span');
        rewardSpan.className = 'challenge-reward';
        rewardSpan.textContent = `+${ch.rewardXp} XP / +${ch.rewardCredits} ₵`;
        header.appendChild(rewardSpan);

        item.appendChild(header);

        const descDiv = document.createElement('div');
        descDiv.className = 'challenge-desc';
        descDiv.textContent = ch.description;
        item.appendChild(descDiv);

        const footer = document.createElement('div');
        footer.className = 'challenge-card-footer';

        const progSpan = document.createElement('span');
        progSpan.className = 'challenge-prog-text';
        progSpan.textContent = `${ch.progress} / ${ch.target}`;
        footer.appendChild(progSpan);

        if (ch.claimed) {
          const badge = document.createElement('span');
          badge.className = 'challenge-status-badge claimed';
          badge.textContent = '[ RESGATADO ]';
          footer.appendChild(badge);
        } else if (ch.progress >= ch.target) {
          const btn = document.createElement('button');
          btn.className = 'btn-terminal btn-claim';
          btn.textContent = '[ RESGATAR ]';
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.claimReward(ch.id);
          });
          footer.appendChild(btn);
        }

        item.appendChild(footer);
        listEl.appendChild(item);
      });
    }
  }
}
