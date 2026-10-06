import { normalizeKey } from './Settings';

/**
 * Captura teclado + mouse. Funciona com Pointer Lock (1ª/3ª pessoa: deltas do
 * mouse) e com cursor livre (visão tática: posição do cursor na tela).
 * Eventos "pressionados neste frame" são limpos em endFrame().
 */
export class InputManager {
  mouseDown = false;
  /** Botão direito (foguetes). */
  mouseDown2 = false;
  locked = false;
  /** Pede o Pointer Lock sem a aceleração do sistema (movimento cru), onde o navegador deixa. */
  rawInput = true;
  /** Posição do cursor em pixels (client). */
  mouseX = window.innerWidth / 2;
  mouseY = window.innerHeight / 2;
  
  /**
   * Modo toque (celular/tablet, decidido pelo Game): sem Pointer Lock. "Preso" passa a significar
   * "jogando", e o olhar chega pelo injectMouseDelta do TouchControls.
   */
  touchMode = false;

  // Controles virtuais (Touch / Mobile)
  virtualMoveX = 0;
  virtualMoveZ = 0;
  virtualJump = false;
  virtualDash = false;
  virtualFire = false;
  /** Tiro automático do toque (inimigo sob a mira), decidido pelo Game a cada quadro. */
  autoFire = false;
  /** Toque: FOGUETE e PLACAR pressionados. */
  virtualRocket = false;
  virtualBoard = false;
  /** Pulso de ativação do escudo, consumido pelo PlayerController. */
  virtualShield = false;
  resetVersion = 0;

  onLockChange?: (locked: boolean) => void;
  /** Tecla pressionada (sem auto-repeat). Útil para ações que exigem gesto do usuário. */
  onKey?: (code: string) => void;
  onWheel?: (deltaY: number) => void;

  private readonly keys = new Set<string>();
  private readonly pressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      // Digitando num campo de menu (DPI, apelido…): a tecla é do campo, não do jogo.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // F1 esconde o HUD; sem preventDefault o Chrome/Edge abre a própria Ajuda numa aba nova.
      // Quote (' no teclado US) abre a "busca rápida" do Firefox.
      if (e.code === 'Space' || e.code === 'F1' || e.code === 'Quote') e.preventDefault();
      // Tab é o placar dentro do jogo; em menu (mouse solto e um controle em foco) navega entre controles.
      if (e.code === 'Tab' && (this.locked || document.activeElement === document.body)) e.preventDefault();
      // Shift/Ctrl/Alt entram também pelo nome curto ("Shift"): tecla configurada vale dos dois lados.
      const key = normalizeKey(e.code);
      this.keys.add(e.code).add(key);
      if (e.repeat) return;
      this.pressed.add(e.code).add(key);
      this.onKey?.(key);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.keys.delete(normalizeKey(e.code));
    });
    window.addEventListener('blur', () => this.reset());

    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (!this.locked) return;
      // Alguns browsers emitem picos espúrios de movementX/Y com pointer lock.
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.mouseDown2 = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.mouseDown2 = false;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.onWheel?.(e.deltaY);
      },
      { passive: false },
    );

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.target;
      this.mouseDX = this.mouseDY = 0;
      this.onLockChange?.(this.locked);
    });
  }

  requestLock(): void {
    // No toque não existe Pointer Lock. Notebook com tela de toque (maxTouchPoints > 0) continua no
    // modo mouse: quem decide é o jeito que o jogador entrou (Game.setTouchMode).
    if (this.touchMode) {
      this.mouseDX = this.mouseDY = 0;
      this.locked = true;
      this.onLockChange?.(true);
      return;
    }

    // O Chrome rejeita a promise se o lock for pedido logo após um Esc.
    const lock = (options?: PointerLockOptions) => Promise.resolve(this.target.requestPointerLock(options));
    // Sem suporte a movimento cru (ex.: Firefox, Safari), cai no lock normal.
    lock(this.rawInput ? { unadjustedMovement: true } : undefined).catch(() => {
      if (this.rawInput) lock().catch(() => {});
    });
  }

  exitLock(): void {
    if (this.touchMode) {
      if (!this.locked) return;
      this.locked = false;
      this.onLockChange?.(false);
      return;
    }
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** -1, 0 ou 1 conforme as teclas positiva/negativa. */
  axis(positive: string, negative: string): number {
    return (this.isDown(positive) ? 1 : 0) - (this.isDown(negative) ? 1 : 0);
  }

  consumeMouseDelta(): { x: number; y: number } {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = this.mouseDY = 0;
    return d;
  }

  injectMouseDelta(dx: number, dy: number): void {
    this.mouseDX += dx;
    this.mouseDY += dy;
  }

  endFrame(): void {
    this.pressed.clear();
  }

  private reset(): void {
    this.resetVersion++;
    this.keys.clear();
    this.pressed.clear();
    this.mouseDown = this.mouseDown2 = false;
    this.virtualShield = false;
    this.mouseDX = this.mouseDY = 0;
  }
}
