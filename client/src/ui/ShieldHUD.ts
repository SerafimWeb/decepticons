import { keyLabel } from "../core/Settings";
import type { MechBase } from "../entities/MechBase";
import type { InputManager } from "../core/InputManager";
export class ShieldHUD {
  private readonly root = document.createElement("button");
  private wait = 0;
  constructor(private readonly input: InputManager) {
    this.root.id = "energy-shield";
    this.root.type = "button";
    this.root.hidden = true;
    this.root.setAttribute("aria-label", "Segurar barreira frontal");
    document.getElementById("hud")!.append(this.root);
    this.root.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.virtualShield = true;
      this.root.setPointerCapture(e.pointerId);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      this.root.addEventListener(type, () => {
        this.input.virtualShield = false;
      });
    window.addEventListener("blur", () => {
      this.input.virtualShield = false;
    });
  }
  update(dt: number, m: MechBase, playing: boolean, key: string): void {
    this.root.hidden = !playing || !m.alive || !m.energyShield.equipped;
    if (this.root.hidden) {
      this.input.virtualShield = false;
      return;
    }
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = 0.1;
    const s = m.energyShield;
    this.root.textContent =
      (this.input.touchMode ? "SEGURE" : "SEGURE " + keyLabel(key)) +
      " · BARREIRA " +
      Math.round(s.fraction * 100) +
      "%" +
      (s.active ? " · ATIVA" : "");
    this.root.setAttribute("aria-pressed", String(s.active));
    this.root.style.setProperty("--energy", s.fraction * 100 + "%");
  }
}
