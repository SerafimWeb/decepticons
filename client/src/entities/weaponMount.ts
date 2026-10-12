import * as THREE from 'three';
import type { Loadout, WeaponStats } from '../combat/weapons';
import { podModel, weaponModel } from './weaponModels';

/** Um lado do Mech: o antebraço, a mão (o pulso) e o nó de boca que o jogo já usa (Hangar, efeitos). */
export interface MountSide {
  forearm: THREE.Object3D;
  hand: THREE.Object3D;
  muzzle: THREE.Object3D;
}

/**
 * A mão some encolhendo o osso: a malha é uma peça só, com peso de pele, então os dedos não se removem do modelo,
 * mas os vértices ligados à mão e aos dedos colapsam no pulso. Não pode ser zero: matriz singular quebra o cálculo
 * de orientação de quem usar o osso depois.
 */
const HAND_SCALE = 0.001;

/** Um ombro do Mech: onde o lançador assenta e a boca de onde o foguete sai (ver `createWeaponMounts`). */
export interface PodSide {
  /** O osso do tronco a que o lançador fica preso: ele acompanha a inclinação do torso. */
  parent: THREE.Object3D;
  /** Nó de boca, filho do lançador (o jogo lê a posição dele). */
  muzzle: THREE.Object3D;
  /** A traseira do lançador no referencial do Mech em repouso (m, a partir dos pés; x positivo = a direita dele). */
  at: readonly [number, number, number];
  /** Metros por unidade do módulo (1 = o comprimento do antebraço dos módulos do pulso). */
  size: number;
}

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();

/**
 * Cria um **ponto de encaixe** em cada pulso e devolve a função que monta as armas da montagem neles.
 *
 * O ponto de encaixe é o contrato entre qualquer Mech e qualquer arma (`weaponModels.ts`): um nó no pulso, com a
 * frente (-Z) ao longo do antebraço, o cima (+Y) o mais perto possível do cima do Mech e a escala igual ao
 * comprimento do antebraço. O robô só precisa ter antebraço e pulso; não precisa ter mão, dedos nem arma no modelo.
 *
 * Chame uma vez ao montar o rig, DEPOIS de o braço estar na pose final (a orientação sai dessa pose). A função
 * devolvida é barata e idempotente: remontar a mesma arma não faz nada; trocar de arma troca só o módulo.
 */
export function createWeaponMounts(
  frame: THREE.Object3D,
  right: MountSide,
  left: MountSide,
  pods?: { right: PodSide; left: PodSide },
): (loadout: Loadout) => void {
  const mountRight = prepare(frame, right);
  const mountLeft = prepare(frame, left);
  const podRight = pods && preparePod(frame, pods.right);
  const podLeft = pods && preparePod(frame, pods.left);
  return (loadout) => {
    mountRight(loadout.primary);
    if (podRight && podLeft) {
      // Com lançadores nos ombros, a mão esquerda leva a segunda arma do botão principal e o secundário é dos ombros.
      mountLeft(loadout.offhand ?? null);
      podRight(loadout.secondary);
      podLeft(loadout.secondary);
    } else mountLeft(loadout.secondary);
  };
}

function prepare(frame: THREE.Object3D, { forearm, hand, muzzle }: MountSide): (weapon: WeaponStats | null) => void {
  frame.updateMatrixWorld(true);
  const frameQuat = frame.getWorldQuaternion(new THREE.Quaternion());

  forearm.getWorldPosition(_from);
  hand.getWorldPosition(_to);
  const forward = _to.clone().sub(_from);
  const length = forward.length();
  forward.divideScalar(length).applyQuaternion(frameQuat.clone().invert());

  // Base do encaixe, no referencial do Mech: -Z ao longo do antebraço, +Y o mais perto possível do cima.
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(forward, -forward.y);
  if (up.lengthSq() < 1e-6) up.set(0, 0, 1).addScaledVector(forward, -forward.z);
  up.normalize();
  const back = forward.clone().negate();
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, back), up, back);

  const point = new THREE.Object3D();
  point.name = 'hardpoint';
  point.position.copy(hand.position);
  point.quaternion
    .copy(forearm.getWorldQuaternion(new THREE.Quaternion()).invert())
    .multiply(frameQuat)
    .multiply(new THREE.Quaternion().setFromRotationMatrix(basis));
  // Quem for filho do encaixe fica em unidades de antebraço, qualquer que seja a escala acumulada dos ossos.
  point.scale.setScalar(length / forearm.getWorldScale(new THREE.Vector3()).x);
  forearm.add(point);
  point.add(muzzle);
  muzzle.position.set(0, 0, 0);
  hand.scale.setScalar(HAND_SCALE);

  let key = '';
  let current: THREE.Object3D | null = null;
  return (weapon) => {
    const next = weapon ? `${weapon.id}:${weapon.tier}` : 'vazio';
    if (next === key) return;
    key = next;
    if (current) point.remove(current);
    const model = weaponModel(weapon);
    current = model.object;
    point.add(current);
    muzzle.position.copy(model.muzzle);
  };
}

/**
 * Um lançador de ombro: o encaixe é um nó preso ao osso do tronco, na posição `at` (referencial do Mech em repouso),
 * com a frente (-Z) para a frente do Mech e o cima (+Y) para cima, na escala `size`. Idempotente como o do pulso.
 */
function preparePod(frame: THREE.Object3D, { parent, muzzle, at, size }: PodSide): (weapon: WeaponStats | null) => void {
  frame.updateMatrixWorld(true);
  const point = new THREE.Object3D();
  point.name = 'hardpoint-ombro';
  // A posição vem do mundo com o Mech em repouso (o quadro ainda sem pai: o mundo é o referencial dos pés).
  point.position.copy(parent.worldToLocal(new THREE.Vector3(at[0], at[1], at[2])));
  point.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(frame.getWorldQuaternion(new THREE.Quaternion()));
  point.scale.setScalar(size / parent.getWorldScale(new THREE.Vector3()).x);
  parent.add(point);
  point.add(muzzle);
  muzzle.position.set(0, 0, 0);

  let key = '';
  let current: THREE.Object3D | null = null;
  return (weapon) => {
    const next = weapon ? `${weapon.id}:${weapon.tier}` : 'vazio';
    if (next === key) return;
    key = next;
    if (current) point.remove(current);
    const model = podModel(weapon);
    current = model.object;
    point.add(current);
    muzzle.position.copy(model.muzzle);
  };
}
