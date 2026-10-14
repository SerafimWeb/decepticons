import type { DominioLado, DominioPontoDef } from './Dominio';
import type { Ponto } from './nascimentos';

/**
 * Os cinco pontos de controle da Arena (200 m de lado), de A (perto da base azul) a E (perto da vermelha), simétricos pelo centro: o que
 * está a (x, z) tem o par em (-x, -z). Cada um fica em chão livre (o `dominioMapa.test.ts` confere contra a física da arena), com cobertura
 * perto (barricadas, prédios) e longe de uma parede: C no meio, B e D nos flancos, A e E nas bases.
 *
 * É **dado**: um mapa maior (a ordem P114, "cenários bem maiores") entrega a lista dele e a regra (`Dominio.ts`) não muda. Seis pontos,
 * idem: mais uma linha.
 */
export const PONTOS_DO_DOMINIO: readonly DominioPontoDef[] = [
  { letra: 'A', x: -65, z: 60 },
  { letra: 'B', x: -55, z: -30 },
  { letra: 'C', x: 0, z: 0 },
  { letra: 'D', x: 55, z: 30 },
  { letra: 'E', x: 65, z: -60 },
];

/**
 * Onde o lado vermelho nasce e renasce: 38 pontos de chão livre no canto de baixo à direita, de 6 em 6 m, do mais perto da base para fora,
 * fora das zonas de cura e de resfriamento (ninguém nasce numa vantagem) e com folga de 3,6 m de raio para um Mech grande. Os do lado azul
 * são os mesmos de cabeça para baixo (`NASCIMENTOS_DO_DOMINIO.blue`), então os dois lados começam em condições iguais.
 */
const VERMELHO: readonly Ponto[] = [
  [64, -60], [58, -66], [58, -72], [58, -60], [58, -78], [52, -66], [82, -60], [52, -72], [58, -54], [52, -60],
  [52, -78], [58, -84], [52, -54], [88, -60], [46, -66], [46, -72], [64, -90], [58, -48], [52, -84], [46, -60],
  [46, -78], [58, -90], [52, -48], [46, -54], [82, -90], [46, -84], [52, -90], [40, -66], [40, -72], [40, -60],
  [46, -48], [88, -90], [40, -78], [46, -90], [40, -54], [40, -84], [40, -48], [40, -90],
];

export const NASCIMENTOS_DO_DOMINIO: Readonly<Record<DominioLado, readonly Ponto[]>> = {
  red: VERMELHO,
  blue: VERMELHO.map(([x, z]) => [-x, -z] as const),
};
