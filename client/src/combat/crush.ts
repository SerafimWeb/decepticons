import type { MechBase } from '../entities/MechBase';
import type { CombatSystem } from './CombatSystem';

/** Encostado: distância entre as cápsulas (m) para contar como pisão. */
const CONTACT = 0.6;
/** Um pisão por passo: o mesmo robô não é esmagado de novo antes disto (s). */
export const STEP_S = 0.35;
/** Só esmaga quem é pelo menos este tanto mais alto (Mech de 5,3 m × andróide de 1,6 m). */
const SCALE = 2;
/** "Andando na direção": o comando de movimento aponta para o pequeno (cosseno do ângulo). */
const TOWARD = 0.5;

/**
 * Pisão (dono, 25/09: "se andarmos na direção dele, 2 passos matam: são pequenos"). Um robô grande que
 * anda na direção de um pequeno encostado nele tira metade da vida do torso a cada passo: dois passos
 * derrubam. Vale nos dois sentidos (Mech do jogador contra andróide rebelde; Mech rebelde contra um
 * jogador de andróide), sempre de um lado contra o outro, nunca entre aliados.
 * Regra de simulação: tick fixo, posições da simulação e o comando do tick (`moveIntent`), sem sorteio.
 * Custo: um laço grandes × pequenos (≤ 8 × 8) com contas de distância; nada alocado depois do primeiro pisão.
 */
export class CrushRule {
  private time = 0;
  /** Último pisão em cada robô pequeno (tempo da simulação). */
  private readonly last = new Map<MechBase, number>();

  constructor(private readonly combat: CombatSystem) {}

  /** Avança o relógio; chame uma vez por tick, antes dos `check`. */
  tick(dt: number): void {
    this.time += dt;
  }

  /** Os grandes de `bigs` pisam nos pequenos de `smalls` (lados opostos). */
  check(bigs: readonly MechBase[], smalls: readonly MechBase[]): void {
    for (const big of bigs) {
      const intent = big.moveIntent;
      const want = Math.hypot(intent.x, intent.z);
      if (!big.alive || !big.grounded || want < 0.3) continue;
      for (const small of smalls) {
        if (small === big || !small.alive || big.stats.height < SCALE * small.stats.height) continue;
        const dx = small.simPosition.x - big.simPosition.x;
        const dz = small.simPosition.z - big.simPosition.z;
        const d = Math.hypot(dx, dz);
        if (d - big.stats.radius - small.stats.radius > CONTACT) continue;
        if ((intent.x * dx + intent.z * dz) / (want * (d || 1)) < TOWARD) continue;
        if (this.time - (this.last.get(small) ?? -Infinity) < STEP_S) continue;
        this.last.set(small, this.time);
        this.combat.crush(big, small, Math.ceil(small.stats.maxModuleHealth.torso / 2));
      }
    }
  }
}
