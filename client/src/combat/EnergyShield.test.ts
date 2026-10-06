import { describe, it, expect } from "vitest";
import { EnergyShield } from "./EnergyShield";
const ready = () => {
  const s = new EnergyShield();
  s.equip(true);
  s.step(1 / 60, true);
  return s;
};
describe("barreira frontal e energia", () => {
  it("dura até cinco segundos, colapsa e exige soltar antes de reativar", () => {
    const s = ready();
    for (let i = 1; i < 300; i++) s.step(1 / 60, true);
    expect(s.active).toBe(false);
    expect(s.energy).toBe(0);
    for (let i = 0; i < 300; i++) s.step(1 / 60, true);
    expect(s.active).toBe(false);
    expect(s.energy).toBeGreaterThan(15);
    s.step(1 / 60, false);
    s.step(1 / 60, true);
    expect(s.active).toBe(true);
  });
  it("cobre frente e mira vertical, deixa flancos e costas expostos", () => {
    const s = ready();
    expect(s.absorb(10, 0, 0, 1, 0, 0)).toBe(10);
    expect(s.absorb(10, 1, 0, 0, 0, 0)).toBe(10);
    expect(s.absorb(10, 0, 0, -1, 0, 0)).toBe(0);
    expect(s.absorb(10, -1, 0, 0, Math.PI / 2, 0)).toBe(0);
    expect(s.absorb(10, 0, 1, 0, 0, Math.PI / 2)).toBe(0);
  });
  it("dano além da energia atravessa, recuperação espera e troca preserva reserva", () => {
    const s = ready();
    s.applyNet(0.2, true);
    expect(s.absorb(50, 0, 0, -1, 0, 0)).toBe(30);
    expect(s.active).toBe(false);
    for (let i = 0; i < 60; i++) s.step(1 / 60, false);
    expect(s.energy).toBe(0);
    s.equip(true, true);
    expect(s.energy).toBe(0);
    s.reset();
    expect(s.energy).toBe(100);
    s.equip(false);
    expect(s.energy).toBe(0);
  });
});
