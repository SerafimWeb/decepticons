import type { MountId } from './mounts';
import type { Loadout, WeaponId, WeaponStats } from './weapons';
import { WEAPON_IDS, weapon } from './weapons';
import { WEAPON_CLASSES, WEAPON_FIT, type RobotSize, type WeaponClass } from './weaponClass';

/**
 * Os ENCAIXES EXTRAS (ordem P282, Comandante, 29/10: *"o colossus v1 precisa receber mais 3 slots de armas pesadas: um nas costas e 2 nos ombros ao lado da cabeça… o onça também pode
 * receber mais 2 slots"*): **um nas costas e um em cada ombro**, nos robôs que os têm (`ARM_SLOTS` do chassi). Cada um é uma arma só, com o seu próprio cronômetro e a sua carga; não divide
 * a arma com o outro lado, como o ombro do Marauder (que é um lançador duplo).
 *
 * **O teto de cada encaixe é a classe, não o tamanho do robô** (dono: *"no slot de arma pesada, podemos colocar armas pesadas, mas também as médias e leves; nas médias, médias e leves; nos
 * slots leve, apenas armas leves"*): o encaixe pesado aceita pesada, média e leve; o médio, média e leve; o leve, só leve. Só o tamanho da arma conta contra o robô: uma arma de tamanho 3
 * (o cerco) não cabe num robô de tamanho 2, por mais pesado que o encaixe seja.
 *
 * Só **armas de energia de tiro simples** cabem num encaixe extra: nada que gire o cano, acenda chama, solte chuva, salva de mísseis, feixe, onda, arpão ou corte. Essas têm o seu
 * próprio gatilho e a sua regra (`Armament.ts`); um encaixe extra só dispara o projétil. Dado puro (G14): o servidor lê o mesmo arquivo e confere a mesma conta.
 */

/** Os três encaixes extras, na ordem de `EXTRA_SLOTS` (a ordem das listas do Hangar e do texto da montagem). */
export type ExtraSlot = 'back' | 'rightShoulder' | 'leftShoulder';
export const EXTRA_SLOTS: readonly ExtraSlot[] = ['back', 'rightShoulder', 'leftShoulder'];

/** O encaixe do corpo de cada extra (o nó onde a arma aparece e de onde sai o tiro). */
export const MOUNT_DO_EXTRA: Readonly<Record<ExtraSlot, MountId>> = { back: 'back', rightShoulder: 'rightShoulder', leftShoulder: 'leftShoulder' };

/**
 * O encaixe do corpo é um extra **nesta montagem**? As costas são sempre extras (só os robôs com o encaixe as têm, e o gatilho só as inclui neles). Um ombro é extra quando a montagem
 * tem o campo dele (`Loadout.rightShoulder`, mesmo vazio): o Marauder não tem, e o ombro dele segue como o lançador duplo do `secondary`.
 */
export function extraDaMontagem(l: Loadout, mount: MountId): ExtraSlot | null {
  if (mount === 'back') return 'back';
  if (mount === 'rightShoulder') return l.rightShoulder !== undefined ? 'rightShoulder' : null;
  if (mount === 'leftShoulder') return l.leftShoulder !== undefined ? 'leftShoulder' : null;
  return null;
}

/** As armas que um encaixe extra aceita: energia de tiro simples, de tamanho até o do robô e de classe até o teto (`teto` = a classe máxima do encaixe). */
export function fitsExtraSlot(id: WeaponId, teto: WeaponClass, size: RobotSize): boolean {
  const fit = WEAPON_FIT[id];
  if (fit.size > size) return false;
  if (WEAPON_CLASSES.indexOf(fit.class) > WEAPON_CLASSES.indexOf(teto)) return false;
  const w: WeaponStats = weapon(id);
  return w.kind === 'energy' && !w.spin && !w.flame && !w.wave && !w.hook && !w.beam && !w.barrage && !w.cruise && !w.lob && !w.salvo && !w.guide;
}

/** Quais armas um encaixe extra oferece num robô de `size` com o teto `teto`, na ordem do catálogo (é a lista do Hangar). */
export const armasDoEncaixeExtra = (size: RobotSize, teto: WeaponClass): readonly WeaponId[] => WEAPON_IDS.filter((id) => fitsExtraSlot(id, teto, size));
