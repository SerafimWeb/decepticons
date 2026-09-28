/**
 * RoundOverlay — Contagem regressiva (3·2·1) de início de partida e painel de estatísticas no fim.
 * Vocabulário e textos centralizados para facilitar localização (ex: CTI/SERAFIM).
 */
export interface RoundStatsSummary {
  kills: number;
  damage: number;
  streak: number;
  survivalSeconds: number;
}

export class RoundOverlay {
  private readonly el: HTMLDivElement | null = null;
  private readonly countdownEl: HTMLDivElement | null = null;
  private readonly summaryEl: HTMLDivElement | null = null;
  private timer: number | null = null;
  public lastStats: RoundStatsSummary | null = null;

  constructor(parent?: HTMLElement) {
    if (typeof document === 'undefined') return;
    const p = parent ?? document.body;
    let el = p.querySelector<HTMLDivElement>('#round-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'round-overlay';
      el.className = 'round-overlay';
      el.style.display = 'none';

      el.innerHTML = `
        <div class="ro-countdown"></div>
        <div class="ro-summary" hidden>
          <div class="ro-title">// FIM DA RODADA //</div>
          <div class="ro-stats-grid">
            <div class="ro-stat"><span class="ro-label">ABATES</span><span class="ro-val ro-kills">0</span></div>
            <div class="ro-stat"><span class="ro-label">DANO CAUSADO</span><span class="ro-val ro-damage">0</span></div>
            <div class="ro-stat"><span class="ro-label">MAIOR SEQUÊNCIA</span><span class="ro-val ro-streak">0x</span></div>
            <div class="ro-stat"><span class="ro-label">TEMPO DE COMBATE</span><span class="ro-val ro-time">0s</span></div>
          </div>
        </div>
      `;
      p.appendChild(el);
    }
    this.el = el;
    this.countdownEl = el.querySelector('.ro-countdown');
    this.summaryEl = el.querySelector('.ro-summary');
  }

  /** Inicia a contagem regressiva de início de rodada (3... 2... 1... COMBATE!). */
  startCountdown(seconds = 3, onComplete?: () => void): void {
    if (this.timer !== null) clearInterval(this.timer);
    if (this.summaryEl) this.summaryEl.hidden = true;
    if (this.countdownEl) this.countdownEl.hidden = false;
    if (this.el) this.el.style.display = 'flex';

    let count = seconds;
    if (this.countdownEl) this.countdownEl.textContent = count > 0 ? `${count}` : 'COMBATE!';

    this.timer = setInterval(() => {
      count--;
      if (count > 0) {
        if (this.countdownEl) this.countdownEl.textContent = `${count}`;
      } else if (count === 0) {
        if (this.countdownEl) this.countdownEl.textContent = 'COMBATE!';
      } else {
        if (this.timer !== null) clearInterval(this.timer);
        this.timer = null;
        if (this.el) this.el.style.display = 'none';
        onComplete?.();
      }
    }, 900) as unknown as number;
  }

  /** Exibe o painel de fim de rodada com as estatísticas do jogador. */
  showSummary(stats: RoundStatsSummary): void {
    this.lastStats = stats;
    if (this.timer !== null) clearInterval(this.timer);
    if (this.countdownEl) this.countdownEl.hidden = true;
    if (this.summaryEl) this.summaryEl.hidden = false;
    if (this.el) this.el.style.display = 'flex';

    if (this.summaryEl) {
      this.summaryEl.querySelector('.ro-kills')!.textContent = `${stats.kills}`;
      this.summaryEl.querySelector('.ro-damage')!.textContent = `${Math.round(stats.damage)}`;
      this.summaryEl.querySelector('.ro-streak')!.textContent = `${stats.streak}x`;
      this.summaryEl.querySelector('.ro-time')!.textContent = `${Math.round(stats.survivalSeconds)}s`;
    }
  }

  /** Esconde o overlay. */
  hide(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (this.el) this.el.style.display = 'none';
  }
}
