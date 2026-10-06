import type { NetInput } from '../../../shared/net/input';
import { NET_PARTS, type UnitState } from '../../../shared/net/state';
import { NET_WEAPONS, type NetWeapon } from '../../../shared/net/events';
import type { WeaponId } from '../combat/weapons';
import type { MechBase, MechInput, MechPart } from '../entities/MechBase';

/**
 * Ponte entre a simulação do jogo e os contratos de rede (`shared/net/`, M2). O servidor usa para montar o estado
 * de cada unidade e aplicar os comandos; o cliente, para o contrário. Tudo escreve em objetos do chamador (G4).
 */

// Se a lista de partes da rede e a do jogo se desencontrarem, o build quebra aqui.
const PARTS: readonly MechPart[] = NET_PARTS;
const WEAPONS: readonly WeaponId[] = NET_WEAPONS;

/** O estado de rede de uma unidade da simulação (posição dos pés, mira, vida de cada parte em fração, calor). */
export function unitFromMech(mech: MechBase, id: number, out: UnitState): UnitState {
  const p = mech.simPosition;
  const max = mech.stats.maxModuleHealth;
  out.id = id;
  out.x = p.x;
  out.y = p.y;
  out.z = p.z;
  out.yaw = mech.yaw;
  out.pitch = mech.pitch;
  for (const part of PARTS) out.parts[part] = mech.modules[part] / max[part];
  out.heat = mech.heat;
  out.alive = mech.alive;
  out.grounded = mech.grounded;
  out.dashing = mech.isDashing;
  out.overheated = mech.overheated;
  out.charging = mech.weaponCharging;
  return out;
}

/** O comando da simulação a partir do comando de rede (os gatilhos e a inclinação ficam no `NetInput`). */
export function mechInputFromNet(n: NetInput, out: MechInput): MechInput {
  out.moveX = n.moveX;
  out.moveZ = n.moveZ;
  out.moveYaw = n.moveYaw;
  out.yaw = n.yaw;
  out.jump = n.jump;
  out.dash = n.dash;
  return out;
}

/** O comando de rede de um tick, a partir do comando da simulação, da inclinação da mira e dos gatilhos. */
export function netInputFromMech(tick: number, cmd: MechInput, pitch: number, fire: boolean, secondary: boolean, out: NetInput): NetInput {
  out.tick = tick;
  out.moveX = cmd.moveX;
  out.moveZ = cmd.moveZ;
  out.moveYaw = cmd.moveYaw;
  out.yaw = cmd.yaw;
  out.pitch = pitch;
  out.jump = cmd.jump;
  out.dash = cmd.dash;
  out.fire = fire;
  out.secondary = secondary;
  return out;
}

/** Posição da arma na lista da rede (evento de tiro). */
export function netWeaponIndex(id: WeaponId): number {
  return WEAPONS.indexOf(id);
}

export function weaponFromNet(index: number): NetWeapon | undefined {
  return NET_WEAPONS[index];
}
