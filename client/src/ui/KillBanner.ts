/**
 * KillBanner — Banner de confirmação de abate e sequências no topo da tela.
 * Exibe anúncios curtos em vermelho neon quando o jogador elimina uma unidade.
 */
export class KillBanner {
  private readonly el: HTMLDivElement | null = null;
  private timer: number | null = null;
  public currentText = '';

  constructor(parent?: HTMLElement) {
    if (typeof document === 'undefined') return;
    const p = parent ?? document.body;
    let el = p.querySelector<HTMLDivElement>('#kill-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kill-banner';
      el.className = 'kill-banner';
      el.style.display = 'none';
      p.appendChild(el);
    }
    this.el = el;
  }

  /**
   * Dispara o anúncio de abate com o nome da vítima e a sequência atual.
   * `victimName`: nome do robô ou piloto abatido.
   * `streak`: número de abates acumulados sem morrer (1, 2, 3...).
   */
  showKill(victimName: string, streak = 1): void {
    let title = `ABATE: ${victimName.toUpperCase()}`;
    if (streak === 2) title = `DUPLO ABATE · ${victimName.toUpperCase()}`;
    else if (streak === 3) title = `TRIPLO ABATE · ${victimName.toUpperCase()}`;
    else if (streak >= 4) title = `IMPARÁVEL (${streak}x) · ${victimName.toUpperCase()}`;

    if (this.currentText === title && this.el?.style.display !== 'none') {
      this.resetTimer();
      return;
    }

    this.currentText = title;
    if (this.el) {
      this.el.textContent = title;
      this.el.style.display = 'block';
      this.el.classList.remove('streak');
      if (streak >= 2) this.el.classList.add('streak');
    }

    this.playKillSound(streak);
    this.resetTimer();
  }

  private playKillSound(streak: number): void {
    if (typeof window === 'undefined' || !window.AudioContext) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Frequência sobe com streak (mais épico)
    const baseFreq = 800 + streak * 150;
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  private resetTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.el) this.el.style.display = 'none';
      this.currentText = '';
      this.timer = null;
    }, 2600) as unknown as number;
  }
}
