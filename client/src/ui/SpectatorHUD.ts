/**
 * HUD do Modo Espectador: banner no topo/centro com indicador de gravação/câmera,
 * botões táteis [ ◄ ] e [ ► ] para trocar de alvo, e botão de retorno.
 * Zero alocações por frame (G1/G4).
 */
export class SpectatorHUD {
  private readonly root: HTMLElement | null = null;
  private readonly labelEl: HTMLElement | null = null;
  private readonly prevBtn: HTMLButtonElement | null = null;
  private readonly nextBtn: HTMLButtonElement | null = null;
  private readonly exitBtn: HTMLButtonElement | null = null;

  private visible = false;
  private lastLabel = '';

  onPrev?: () => void;
  onNext?: () => void;
  onExit?: () => void;

  constructor(parent?: HTMLElement) {
    if (typeof document === 'undefined') return;
    const container = parent ?? document.getElementById('hud') ?? document.body;
    this.root = document.createElement('div');
    this.root.id = 'spectator-hud';
    this.root.className = 'spectator-hud hidden';

    this.root.innerHTML = `
      <div class="spec-header">
        <span class="spec-rec-dot">●</span>
        <span class="spec-title">CÂMERA DE VIGILÂNCIA E ESPECTADOR</span>
      </div>
      <div class="spec-controls">
        <button id="spec-btn-prev" class="spec-btn" type="button" title="Alvo anterior (Seta Esquerda / Q)">◄</button>
        <div id="spec-target-name" class="spec-target-name">CARREGANDO...</div>
        <button id="spec-btn-next" class="spec-btn" type="button" title="Próximo alvo (Seta Direita / E)">►</button>
      </div>
      <div class="spec-footer">
        <span class="spec-hint">Use [ ← / → ] ou setas para trocar · [ C / ESC ] voltar</span>
        <button id="spec-btn-exit" class="spec-exit-btn" type="button">VOLTAR AO MECH</button>
      </div>
    `;

    this.labelEl = this.root.querySelector('#spec-target-name');
    this.prevBtn = this.root.querySelector('#spec-btn-prev');
    this.nextBtn = this.root.querySelector('#spec-btn-next');
    this.exitBtn = this.root.querySelector('#spec-btn-exit');

    this.prevBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onPrev?.();
    });

    this.nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onNext?.();
    });

    this.exitBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onExit?.();
    });

    container.appendChild(this.root);
  }

  setVisible(on: boolean): void {
    if (this.visible === on) return;
    this.visible = on;
    this.root?.classList.toggle('hidden', !on);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  get label(): string {
    return this.lastLabel;
  }

  setLabel(label: string): void {
    if (this.lastLabel === label) return;
    this.lastLabel = label;
    if (this.labelEl) {
      this.labelEl.textContent = label;
    }
  }

  destroy(): void {
    this.root?.remove();
  }
}
