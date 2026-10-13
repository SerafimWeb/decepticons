/**
 * KillBanner — Banner de confirmação de abate e sequências no topo da tela.
 * Exibe anúncios curtos em vermelho neon quando o jogador elimina uma unidade.
 *
 * O som não é daqui: o banner **avisa** (`som`) e o `Game` toca pelo `AudioSystem` (um contexto de áudio só; criar um por abate estourava o limite do navegador).
 */
export class KillBanner {
  private readonly el: HTMLDivElement | null = null;
  private timer: number | null = null;
  public currentText = '';
  /** Quem toca o som do abate (a sequência vai de 1 em diante). `null` = mudo. */
  public som: ((streak: number) => void) | null = null;

  constructor(parent?: HTMLElement) {
    if (typeof document === 'undefined') return;
    // Dentro do #hud (some com a pausa e com o F1, e fica acima do mundo); fora dele a faixa nascia atrás da camada do HUD e não aparecia.
    const p = parent ?? document.getElementById('hud') ?? document.body;
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

    this.som?.(streak);
    this.resetTimer();
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
