import type { MechModules, MechPart } from '../entities/MechBase';

/**
 * Zonas de acerto, normalizadas pela cápsula de colisão (altura e raio). Tiradas das proporções do
 * Vector-09: pernas até o quadril (~2,4 m de 5,3), cabeça acima do torso (~4,65 m), torso com
 * ~1 m de meia-largura dentro do raio de 1,3 m (o que passa disso é braço).
 */
export interface HitZones {
  legTop: number; // fração da altura
  headBottom: number; // fração da altura
  armInner: number; // fração do raio a partir da qual é braço
}

export const DEFAULT_HIT_ZONES: HitZones = { legTop: 0.45, headBottom: 0.88, armInner: 0.78 };

/**
 * Parte atingida pelo ponto de impacto no referencial do Mech: `x` para a direita dele,
 * `y` = altura acima dos pés. Custo zero de física: usa a cápsula que já existe, sem colisor por parte.
 */
export function partAt(x: number, y: number, height: number, radius: number, zones = DEFAULT_HIT_ZONES): MechPart {
  const h = y / height;
  const side = x / radius;
  if (h < zones.legTop) return side < 0 ? 'leftLeg' : 'rightLeg';
  if (h > zones.headBottom) return 'head';
  if (Math.abs(side) > zones.armInner) return side < 0 ? 'leftArm' : 'rightArm';
  return 'torso';
}

export interface DamageResult {
  part: MechPart; // parte que de fato perdeu vida
  applied: number;
  partDestroyed: boolean;
  killed: boolean;
}

/**
 * Aplica dano nos módulos. Dano em parte já destruída vai para o torso (perder o braço não
 * "blinda" aquele lado). Torso zerado = morte; Mech morto não recebe mais dano.
 */
export function applyDamage(modules: MechModules, part: MechPart, amount: number): DamageResult {
  if (modules.torso <= 0 || amount <= 0) return { part, applied: 0, partDestroyed: false, killed: false };
  const target: MechPart = modules[part] > 0 ? part : 'torso';
  const before = modules[target];
  const after = Math.max(0, before - amount);
  modules[target] = after;
  return {
    part: target,
    applied: before - after,
    partDestroyed: after === 0,
    killed: target === 'torso' && after === 0,
  };
}
