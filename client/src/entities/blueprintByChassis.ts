import type { ChassisId } from './chassis';
import { COLOSSUS_01_BLUEPRINT, HEAVY_MECH_BLUEPRINT, LIGHT_MECH_BLUEPRINT, type MechBlueprint } from './mechBlueprint';

/**
 * Blueprint visual de cada chassi que o `Vector09` desenha (o andróide tem classe própria; o resto usa o médio). Sem isto, um chassi novo
 * nasce com a silhueta do Vector-09 esticada (era o bug do Colossus como boss, achado e corrigido em 29/09). Fica fora do `Game` porque o
 * jogador (Hangar) e os bots do esquadrão (`combat/BotSystem.ts`) escolhem o corpo pela mesma tabela.
 */
export const BLUEPRINT_BY_CHASSIS: Partial<Record<ChassisId, MechBlueprint>> = {
  colossus01: COLOSSUS_01_BLUEPRINT,
  arara: LIGHT_MECH_BLUEPRINT,
  onca: HEAVY_MECH_BLUEPRINT,
};
