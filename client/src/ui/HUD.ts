import type { CameraMode } from '../camera/CameraMode';
import type { MechBase } from '../entities/MechBase';

const $ = (id: string) => document.getElementById(id)!;

export class HUD {
  private readonly root = $('hud');
  private readonly overlay = $('overlay');
  private readonly cta = $('cta');
  private readonly crosshair = $('crosshair');
  private readonly dash = $('dash');
  private readonly dashFill = $('dash-fill');
  private readonly stats = $('stats');
  private readonly modeLabel = $('mode');
  private cursorMode = false;
  private textTimer = 0;

  setReady(): void {
    this.cta.textContent = '[ clique para jogar ]';
  }

  setPaused(paused: boolean): void {
    this.overlay.classList.toggle('hidden', !paused);
  }

  toggleVisibility(): void {
    this.root.classList.toggle('hidden');
  }

  setMode(mode: CameraMode): void {
    this.modeLabel.textContent = `CAM ${mode.label}  [V]`;
    this.cursorMode = !mode.pointerLock;
    if (!this.cursorMode) {
      this.crosshair.style.left = '50%';
      this.crosshair.style.top = '50%';
    }
  }

  update(dt: number, mech: MechBase, cursorX: number, cursorY: number, debrisCount: number): void {
    if (this.cursorMode) {
      this.crosshair.style.left = `${cursorX}px`;
      this.crosshair.style.top = `${cursorY}px`;
    }

    const ready = mech.dashReadiness;
    this.dashFill.style.transform = `scaleX(${ready})`;
    this.dash.classList.toggle('ready', ready >= 1);

    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = 0.2;

    const speed = Math.hypot(mech.velocity.x, mech.velocity.z);
    this.stats.textContent =
      `${mech.stats.name}\n` +
      `VEL    ${speed.toFixed(1).padStart(5)} m/s\n` +
      `DEBRIS ${debrisCount.toString().padStart(5)}`;
  }
}
