import * as THREE from "three";
import { expect, it } from "vitest";
import { Vector09 } from "../entities/Vector09";
import { CombatSystem } from "./CombatSystem";
import { weapon } from "./weapons";

it("impacto frontal gasta energia antes da vida; flanco passa e excesso de dano atravessa", () => {
  const combat = new CombatSystem(
    { damage: () => {} } as never,
    {} as never,
    { burst: () => {} } as never,
  );
  const target = new Vector09();
  const collider = { handle: 77 };
  Object.defineProperty(target, "collider", { value: collider });
  combat.register(target);
  const hit = { collider, point: new THREE.Vector3(0, 2.4, 0) };
  target.energyShield.equip(true);
  target.energyShield.step(1 / 60, true);
  const hp = target.modules.torso,
    energy = target.energyShield.energy;
  combat.onProjectileHit(
    hit as never,
    new THREE.Vector3(0, 0, 1),
    20,
    undefined,
    weapon("plasma"),
  );
  expect(target.modules.torso).toBe(hp);
  expect(target.energyShield.energy).toBeCloseTo(energy - 20);
  combat.onProjectileHit(
    hit as never,
    new THREE.Vector3(-1, 0, 0),
    20,
    undefined,
    weapon("plasma"),
  );
  expect(target.modules.torso).toBe(hp - 20);
  target.energyShield.energy = 5;
  combat.onProjectileHit(
    hit as never,
    new THREE.Vector3(0, 0, 1),
    20,
    undefined,
    weapon("plasma"),
  );
  expect(target.modules.torso).toBe(hp - 35);
  expect(target.energyShield.active).toBe(false);
});
