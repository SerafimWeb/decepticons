import type { MechModules, MechPart } from '../entities/MechBase';

/** Pontos de vida que um técnico devolve por segundo. */
export const REPAIR_RATE = 18;
/** Distância máxima (m, entre os centros) para o feixe de conserto alcançar o Mech. */
export const REPAIR_RANGE = 7;

const PARTS: readonly MechPart[] = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

/**
 * Conserto: devolve `amount` à parte mais avariada (menor fração de vida) que ainda existe. Parte
 * arrancada (0) não volta: reconstruir exige peças (coleta, no futuro). Regra de simulação pura:
 * roda no tick fixo e não depende de nada fora dos módulos. Devolve quanto consertou.
 */
export function repairModules(modules: MechModules, max: Readonly<MechModules>, amount: number): number {
  if (amount <= 0 || modules.torso <= 0) return 0;
  let worst: MechPart | null = null;
  let worstFrac = 1;
  for (const p of PARTS) {
    const hp = modules[p];
    if (hp <= 0 || hp >= max[p]) continue;
    const frac = hp / max[p];
    if (frac < worstFrac) {
      worstFrac = frac;
      worst = p;
    }
  }
  if (!worst) return 0;
  const before = modules[worst];
  modules[worst] = Math.min(max[worst], before + amount);
  return modules[worst] - before;
}

/** Quanto falta de vida no Mech inteiro (0 = inteiro), contando só as partes que existem. */
export function damageFraction(modules: MechModules, max: Readonly<MechModules>): number {
  let missing = 0;
  let total = 0;
  for (const p of PARTS) {
    if (modules[p] <= 0) continue;
    missing += max[p] - modules[p];
    total += max[p];
  }
  return total > 0 ? missing / total : 0;
}
