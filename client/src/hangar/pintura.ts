import type { MeshStandardMaterial } from 'three';
import { corDaPintura } from '../../../shared/pinturas';

/**
 * A cor do casco que uma montagem pede (P305), ou `null` = a de fábrica do chassi. Só desenho: nada aqui entra na simulação (G1), e quem decide o que o
 * outro piloto vê é o roster, que leva a montagem com o `.P<n>`.
 */
export function corDaMontagem(spec: { pintura?: number } | null | undefined): number | null {
  return corDaPintura(spec?.pintura ?? 0);
}

/**
 * Tinge o casco de um Mech importado (`.glb`). A cor vai no material do casco: o Marauder, sem textura, sai na cor exata; os modelos com textura saem
 * tingidos pela textura (a cor multiplica o desenho do modelo). Cada Mech tem os próprios materiais (clonados em `importedMechRig`), então não há
 * vazamento entre robôs. Sem cor (`null`), não mexe em nada.
 */
export function pintarCasco(materiais: readonly MeshStandardMaterial[], cor: number | null): void {
  if (cor === null) return;
  for (const m of materiais) m.color.setHex(cor);
}
