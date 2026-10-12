import type { MechBase } from '../entities/MechBase';
import { rangeFactor, type WeaponStats } from './weapons';

/** Impacto direto, autoritativo. Mesma queda por distância do dano estrutural. */
export function applyEmp(target: MechBase, w: WeaponStats, distance: number): void {
  if (w.empHeat && target.alive) target.absorbEmp(w.empHeat * rangeFactor(w, distance));
}
