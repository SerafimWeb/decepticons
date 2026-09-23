import type { CameraMode } from '../camera/CameraMode';
import type { DamageResult } from '../combat/damage';
import type { MechBase, MechPart } from '../entities/MechBase';

const $ = (id: string) => document.getElementById(id)!;

/** Anúncio quando uma parte do alvo cai (com a concordância de cada uma). */
const PART_DESTROYED: Record<MechPart, string> = {
  torso: 'TORSO DESTRUÍDO',
  head: 'CABEÇA DESTRUÍDA',
  leftArm: 'BRAÇO ESQ DESTRUÍDO',
  rightArm: 'BRAÇO DIR DESTRUÍDO',
  leftLeg: 'PERNA ESQ DESTRUÍDA',
  rightLeg: 'PERNA DIR DESTRUÍDA',
};
const HIT_S = 0.12;
const CRIT_S = 0.35;
const LABEL_S = 1.4;

export class HUD {
  private readonly root = $('hud');
  private readonly overlay = $('overlay');
  private readonly cta = $('cta');
  private readonly crosshair = $('crosshair');
  private readonly dash = $('dash');
  private readonly dashFill = $('dash-fill');
  private readonly stats = $('stats');
  private readonly modeLabel = $('mode');
  private readonly hitmarker = $('hitmarker');
  private readonly hitLabel = $('hit-label');
  private cursorMode = false;
  private textTimer = 0;
  private hitTimer = 0;
  private labelTimer = 0;

  setReady(): void {
    this.cta.textContent = '[ clique para jogar ]';
  }

  setPaused(paused: boolean): void {
    this.overlay.classList.toggle('hidden', !paused);
  }

  toggleVisibility(): void {
    this.root.classList.toggle('hidden');
  }

  /** Marcador de acerto na mira; parte destruída ou abate ganham destaque e texto. */
  showHit(result: DamageResult): void {
    const crit = result.partDestroyed;
    this.hitmarker.classList.add('show');
    this.hitmarker.classList.toggle('crit', crit);
    this.hitTimer = crit ? CRIT_S : HIT_S;
    if (!crit) return;
    this.hitLabel.textContent = result.killed ? 'ALVO ABATIDO' : PART_DESTROYED[result.part];
    this.hitLabel.classList.add('show');
    this.labelTimer = LABEL_S;
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

    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.hitmarker.classList.remove('show');
    }
    if (this.labelTimer > 0) {
      this.labelTimer -= dt;
      if (this.labelTimer <= 0) this.hitLabel.classList.remove('show');
    }

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
