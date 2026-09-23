const $ = (id: string) => document.getElementById(id)!;

export class DebugPanel {
  private readonly panel = $('debug-panel');
  private fps = 60;
  private textTimer = 0;

  update(dt: number, tickMs: number, drawCalls: number): void {
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;

    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = 0.2;

    this.panel.textContent = 
      `FPS   ${Math.round(this.fps).toString().padStart(4)}\n` +
      `TICK  ${tickMs.toFixed(1).padStart(4)}ms\n` +
      `DRAWS ${drawCalls.toString().padStart(4)}`;
  }
}
