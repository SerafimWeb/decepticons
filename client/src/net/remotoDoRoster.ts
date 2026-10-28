import { PALETTE } from '../core/palette';
import { Android } from '../entities/Android';
import { BLUEPRINT_BY_CHASSIS } from '../entities/blueprintByChassis';
import { CHASSIS, PILOT_ANDROID_STATS, type ChassisId } from '../entities/chassis';
import { ImportedMech } from '../entities/ImportedMech';
import type { MechBase, MechRig } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { factorySpec, loadoutKey, parseLoadoutKey, validateLoadout } from '../hangar/loadout';
import type { RosterEntry } from '../../../shared/net/messages';

/**
 * O robô de **outra pessoa** da sala online (P214): o chassi da montagem dela (o Marauder, o Colossus V4, o Onça…), com as armas dela e os números dele (tamanho e colisão), e visor ciano
 * (verde é você; vermelho, as IAs). Antes todo mundo aparecia como o Vector-09 amarelo: só o Vector-09 e o andróide eram distinguidos. Os bots, com as cores de sempre.
 *
 * `rigDe` devolve a malha importada do chassi **se já baixou** (o preload do boot é assíncrono) ou `null`: sem ela entra a silhueta do chassi (`BLUEPRINT_BY_CHASSIS`) e o chamador refaz o robô
 * quando a malha chegar (`pendente`). Só desenho: o servidor é quem decide posição, vida e dano (G13).
 *
 * O Mech de uma IA (P270) é o Vector-09 vermelho de sempre, **a não ser que o esquadrão do dono lhe tenha dado outro chassi ou outras armas**: o servidor então manda a montagem dele no roster
 * e o robô aparece como ela, com o visor vermelho das IAs. Montagem ilegível ou a de fábrica = o desenho de sempre.
 */
export interface RemotoDoRoster {
  mech: MechBase;
  /** O chassi de malha importada que ainda não estava pronto: o desenho é provisório e deve ser refeito quando esta malha chegar. */
  pendente: ChassisId | null;
}

/** A montagem do Mech de IA sem esquadrão: o servidor a manda assim, e o desenho continua o de sempre. */
const BUILD_DO_MECH_DE_FABRICA = loadoutKey(factorySpec('vector09'));

export function criarRemoto(e: RosterEntry, rigDe: (chassi: ChassisId) => MechRig | null, temMalha: (chassi: ChassisId) => boolean): RemotoDoRoster {
  const pronto = (mech: MechBase): RemotoDoRoster => ({ mech, pendente: null });
  const doEsquadrao = e.kind === 'mech' && e.build !== BUILD_DO_MECH_DE_FABRICA ? parseLoadoutKey(e.build) : null;
  if (e.kind === 'mech' && (!doEsquadrao || doEsquadrao.chassis === 'android')) return pronto(new Vector09({ paint: PALETTE.enemyPaint, visor: PALETTE.signal }));
  if (e.kind === 'android') return pronto(new Android());
  if (e.kind === 'technician') return pronto(new Android({ visor: PALETTE.fluo, tool: 'repair' }));
  if (e.kind === 'faxineiro') return pronto(new Android({ visor: PALETTE.green, tool: 'repair' }));
  const spec = doEsquadrao ?? parseLoadoutKey(e.build);
  if (spec?.chassis === 'android') return pronto(new Android({ stats: PILOT_ANDROID_STATS, paint: PALETTE.playerPaint, visor: PALETTE.cyan, tool: 'pilot' }));
  const check = spec ? validateLoadout(spec) : null;
  const chassi: ChassisId = spec?.chassis ?? 'vector09';
  const stats = CHASSIS[chassi];
  const loadout = check?.ok ? check.loadout : undefined;
  const rig = temMalha(chassi) ? rigDe(chassi) : null;
  if (rig) return pronto(new ImportedMech(stats, rig, loadout));
  const ia = e.kind === 'mech';
  return { mech: new Vector09({ ...(ia ? { paint: PALETTE.enemyPaint } : {}), visor: ia ? PALETTE.signal : PALETTE.cyan, stats, loadout, blueprint: BLUEPRINT_BY_CHASSIS[chassi] }), pendente: temMalha(chassi) ? chassi : null };
}
