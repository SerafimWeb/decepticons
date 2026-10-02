import * as THREE from 'three';
import type { Loadout, WeaponStats } from '../combat/weapons';
import { weaponModel } from './weaponModels';

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
export function createWeaponMounts(frame: THREE.Object3D, right: MountSide, left: MountSide): (loadout: Loadout) => void {
  const mountRight = prepare(frame, right);
  const mountLeft = prepare(frame, left);
  return (loadout) => {
    mountRight(loadout.primary);
    mountLeft(loadout.secondary);
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
