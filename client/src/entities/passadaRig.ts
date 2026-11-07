import * as THREE from 'three';
import type { MechRig } from './MechBase';
import type { GeometriaDaPerna } from './passadaGen3';

/**
 * Mede a perna do rig (P319) para a passada da geração 3: o comprimento da coxa e da canela e o deslocamento do joelho,
 * lidos da posição real dos ossos em repouso. Vale igual para os Mechs procedurais e para os `.glb` importados, porque
 * não depende do blueprint. Roda uma vez por Mech (na criação), então não entra no custo por quadro.
 *
 * Devolve `null` quando o rig não dá uma perna medível (a passada antiga continua valendo para ele).
 */
const _hip = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _ground = new THREE.Vector3();
const _vec = new THREE.Vector3();
const _quat = new THREE.Quaternion();

export function medirGeometriaDaPerna(rig: MechRig): GeometriaDaPerna | null {
  rig.model.updateMatrixWorld(true);
  const leg = rig.leftLeg;
  leg.hip.getWorldPosition(_hip);
  leg.knee.getWorldPosition(_knee);
  rig.model.getWorldPosition(_ground);
  // Vetor quadril→joelho no referencial da pelve (a convenção do rig: frente em -Z, quadril positivo leva o pé à frente).
  _vec.subVectors(_knee, _hip);
  rig.pelvis.getWorldQuaternion(_quat).invert();
  _vec.applyQuaternion(_quat);
  const uv = -_vec.y; // coxa na vertical (o quadril fica acima do joelho)
  const fk = -_vec.z; // deslocamento do joelho para a frente (digitígrado)
  const ue = Math.hypot(fk, uv);
  const w = _knee.y - _ground.y; // joelho até o chão (a canela e o pé)
  if (!(ue > 0.05) || !(uv > 0) || !(w > 0.05) || !Number.isFinite(ue + w)) return null;
  return { ue, eps: Math.atan2(fk, uv), w, f0: fk, dRest: uv + w };
}
