/**
 * LoadingScreen — Tela de carregamento com barra de progresso e dicas.
 * Exibida durante boot, carregamento de assets e entre rodadas.
 */
export class LoadingScreen {
  private readonly el: HTMLDivElement | null = null;
  private readonly barEl: HTMLDivElement | null = null;
  private readonly tipsEl: HTMLDivElement | null = null;
  private progress = 0;

  private static readonly TIPS = [
    'Dica: Pernas destruídas deixam o inimigo mais lento',
    'Dica: Braço direito destruído desativa o plasma',
    'Dica: Rajadas de disparo aquecem menos que gatilho preso',
    'Dica: Zonas de cura só funcionam se você estiver vivo',
    'Dica: O aviso de dano mostra de onde o tiro veio',
    'Dica: Qualidade adapta automaticamente em GPUs fracas',
    'Dica: F9 grava gameplay (tecla escondida, só para o dev)',
    'Dica: Destruir a cabeça causa cegueira temporária',
  ];

  constructor(parent?: HTMLElement) {
    if (typeof document === 'undefined') return;
    const p = parent ?? document.body;
    let el = p.querySelector<HTMLDivElement>('#loading-screen');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-screen';
      el.className = 'loading-screen';
      el.style.display = 'none';

      const randomTip = LoadingScreen.TIPS[Math.floor(Math.random() * LoadingScreen.TIPS.length)];

      el.innerHTML = `
        <div class="ls-container">
          <div class="ls-title">// CYBERMECH //</div>
          <div class="ls-bar-container">
            <div class="ls-bar-fill" id="ls-bar"></div>
          </div>
          <div class="ls-progress-text" id="ls-progress">0%</div>
          <div class="ls-tip" id="ls-tip">${randomTip}</div>
        </div>
      `;
      p.appendChild(el);
    }
    this.el = el;
    this.barEl = el.querySelector('#ls-bar');
    this.tipsEl = el.querySelector('#ls-tip');
  }

  show(): void {
    if (this.el) this.el.style.display = 'flex';
    this.setProgress(0);
  }

  hide(): void {
    if (this.el) this.el.style.display = 'none';
  }

  setProgress(percent: number): void {
    this.progress = Math.max(0, Math.min(100, percent));
    if (this.barEl) {
      this.barEl.style.width = `${this.progress}%`;
    }
    const progressText = this.el?.querySelector('#ls-progress');
    if (progressText) progressText.textContent = `${Math.floor(this.progress)}%`;
  }

  incrementProgress(delta: number): void {
    this.setProgress(this.progress + delta);
  }

  setTip(text: string): void {
    if (this.tipsEl) this.tipsEl.textContent = text;
  }
}
