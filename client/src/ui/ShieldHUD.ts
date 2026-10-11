import { keyLabel } from "../core/Settings";
import type { MechBase } from "../entities/MechBase";
import type { InputManager } from "../core/InputManager";
export class ShieldHUD {
  private readonly root = document.createElement("button");
  private wait = 0;
  /** Chapa do escudo físico: integridade e se está levantada (botão 2). Só leitura, sem toque próprio. */
  private readonly plate = document.createElement("div");
  constructor(private readonly input: InputManager) {
    this.root.id = "energy-shield";
    this.root.type = "button";
    this.root.hidden = true;
    this.root.setAttribute("aria-label", "Ligar ou desligar escudo de energia");
    document.getElementById("hud")!.append(this.root);
    this.plate.id = "metal-shield";
    this.plate.hidden = true;
    document.getElementById("hud")!.append(this.plate);
    this.root.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.virtualShield = true;
    });
  }
  update(dt: number, m: MechBase, playing: boolean, key: string): void {
    this.updatePlate(m, playing);
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
      (this.input.touchMode ? "TOQUE" : keyLabel(key)) +
      (s.kind === "sphere" ? " · ESFERA " : s.kind === "fire" ? " · ANEL DE FOGO " : " · BARREIRA ") +
      Math.round(s.fraction * 100) +
      "%" +
      (s.active ? " · DESLIGAR" : s.energy < s.stats.minStart ? " · RECARGA" : " · LIGAR");
    this.root.setAttribute("aria-pressed", String(s.active));
    this.root.style.setProperty("--energy", s.fraction * 100 + "%");
  }

  private updatePlate(m: MechBase, playing: boolean): void {
    const p = m.metalShield;
    this.plate.hidden = !playing || !m.alive || !p.equipped;
    if (this.plate.hidden || !p.model) return;
    const pct = Math.round(p.fraction * 100);
    const state = !p.intact ? " · ROMPIDO" : m.modules.leftArm <= 0 ? " · SEM BRAÇO" : p.raised ? " · LEVANTADO" : this.input.touchMode ? " · SEGURE FOGUETE" : " · SEGURE BOTÃO 2";
    const text = p.model.name.toUpperCase() + " " + pct + "%" + state;
    if (this.plate.textContent !== text) this.plate.textContent = text;
    this.plate.dataset.raised = String(p.raised);
    this.plate.style.setProperty("--plate", pct + "%");
  }
}
