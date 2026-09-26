import type { Loadout } from '../combat/weapons';
import { PALETTE } from '../core/palette';
import { VECTOR09_STATS } from './chassis';
import { buildMechBlueprintRig, MEDIUM_MECH_BLUEPRINT, type MechBlueprint } from './mechBlueprint';
import { MechBase, type MechStats } from './MechBase';

/** Os números do Vector-09 ficam em `chassis.ts` (sem modelo 3D: servidor e site leem de lá). */
export { VECTOR09_STATS };

export interface Vector09Options {
  /** Cor da pintura (ex.: alvos e inimigos com cor diferente do jogador). */
  paint?: number;
  /** Cor do visor e das luzes: verde do jogador ou vermelho das IAs. */
  visor?: number;
  /** Armas nos braços (Hangar); sem isso, as de fábrica. */
  loadout?: Loadout;
  /** Números de gameplay continuam independentes da proporção visual. */
  stats?: MechStats;
  /** Blueprint visual; o padrão mantém o Vector-09 médio. */
  blueprint?: MechBlueprint;
}

export class Vector09 extends MechBase {
  constructor(options: Vector09Options = {}) {
    const blueprint = options.blueprint ?? MEDIUM_MECH_BLUEPRINT;
    const height = options.stats?.height ?? VECTOR09_STATS.height;
    super(
      options.stats ?? VECTOR09_STATS,
      buildMechBlueprintRig(blueprint, {
        paint: options.paint ?? PALETTE.playerPaint,
        visor: options.visor ?? PALETTE.green,
        scaleToHeight: height / blueprint.referenceHeight,
      }),
      options.loadout,
    );
  }
}
