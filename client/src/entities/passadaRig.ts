import type { MechRig } from './MechBase';
import type { GeometriaDaPerna } from './passadaGen3';

/**
 * Mede a perna do rig (P321) para a passada da geração 3: o comprimento da coxa e da canela e o deslocamento do joelho, lidos das posições
 * LOCAIS dos nós (a translação de um filho em relação ao pai não muda com a pose, então vale a qualquer hora, não só no repouso e sem
 * atualizar matriz nenhuma). Só o rig procedural, que informa onde estão a ponta e o calcanhar do pé (`MechRig.pe`); o importado (`.glb`)
 * devolve `null` e anda na passada de hoje até ser medido e fotografado.
 */
export function medirGeometriaDaPerna(rig: MechRig): GeometriaDaPerna | null {
  const pe = rig.pe;
  if (!pe) return null;
  const quadril = rig.leftLeg.hip.position; // o eixo do quadril, em relação à pelve
  const joelho = rig.leftLeg.knee.position; // o joelho, em relação ao quadril
  const uv = -joelho.y; // coxa na vertical (o joelho fica abaixo do quadril)
  const fk = -joelho.z; // deslocamento do joelho para a frente (a perna digitígrada)
  const ue = Math.hypot(fk, uv);
  const dRest = rig.hipHeight + quadril.y; // altura do eixo do quadril no repouso (a origem do modelo é o chão)
  const w = dRest - uv; // do joelho ao chão: a canela e o pé juntos
  if (!(ue > 0.05) || !(uv > 0) || !(w > 0.05) || !Number.isFinite(ue + w)) return null;
  return { ue, eps: Math.atan2(fk, uv), w, f0: fk, dRest, peFrente: pe.frente, peTras: pe.tras };
}
