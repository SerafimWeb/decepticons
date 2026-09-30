import type { Loadout } from '../combat/weapons';
import { MechBase, type MechRig, type MechStats } from './MechBase';

/**
 * Mech cuja malha vem de um `.glb` importado (`importedMechRig.ts`), não de primitivas em `meshKit.ts`.
 * A classe em si não faz nada além de existir: `MechBase` é abstrata só pra forçar uma subclasse
 * concreta, e o rig já chega pronto (carregar um glTF é assíncrono; não dá pra fazer isso dentro de
 * um construtor, então quem cria este objeto já chama `await loadImportedMechRig(...)` antes).
 */
export class ImportedMech extends MechBase {
  constructor(stats: MechStats, rig: MechRig, loadout?: Loadout) {
    super(stats, rig, loadout);
  }
}
