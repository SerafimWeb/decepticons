/**
 * Captura teclado + mouse. Funciona com Pointer Lock (1ª/3ª pessoa: deltas do
 * mouse) e com cursor livre (visão tática: posição do cursor na tela).
 * Eventos "pressionados neste frame" são limpos em endFrame().
 */
export class InputManager {
  mouseDown = false;
  locked = false;
  /** Posição do cursor em pixels (client). */
  mouseX = window.innerWidth / 2;
  mouseY = window.innerHeight / 2;

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
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      this.pressed.add(e.code);
      this.onKey?.(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
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
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
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
    // O Chrome rejeita a promise se o lock for pedido logo após um Esc.
    Promise.resolve(this.target.requestPointerLock()).catch(() => {});
  }

  exitLock(): void {
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

  endFrame(): void {
    this.pressed.clear();
  }

  private reset(): void {
    this.keys.clear();
    this.pressed.clear();
    this.mouseDown = false;
    this.mouseDX = this.mouseDY = 0;
  }
}
