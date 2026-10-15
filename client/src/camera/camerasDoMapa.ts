import * as THREE from 'three';
import type { MapId } from '../environment/Bunker';
import { PRAIA_CFTV, PRAIA_ESTACAO, PRAIA_TITA, praiaBlocks } from '../environment/PraiaLayout';
import { DEFAULT_FIXED_CAMERAS, type FixedCameraPoint } from './SpectatorCam';

/**
 * As câmeras do CFTV de cada mapa (P148). Antes havia **uma lista só**, com as coordenadas da Arena: na praia o botão levava a pontos que não
 * existem ali (o Comandante nunca viu câmera de prédio nem de portaria). Agora cada mapa declara as suas, e o `Game.ts` entrega a do mapa ao
 * `SpectatorCam`. Custo: as posições nascem uma vez (G4); por quadro o `SpectatorCam` só lê.
 */
export function camerasDoMapa(mapa: MapId): readonly FixedCameraPoint[] {
  if (mapa === 'praia') return camerasDaPraia();
  // O bunker é um interior: o CFTV fica só com os drones e os Mechs até ele ganhar câmeras próprias.
  if (mapa === 'bunker') return [];
  return DEFAULT_FIXED_CAMERAS;
}

let praia: readonly FixedCameraPoint[] | null = null;

/** Altura da cabeça da câmera no poste de CFTV (`cftv()` em `PraiaGeometriasCena.ts`: braço em 4,2 m) e a distância do poste até a **frente da lente** (a caixa vai até 1,25 m). */
export const CFTV_CABECA_Y = 4.2;
export const CFTV_LENTE = 1.3;
/** A borda das torres de vigia: o piso da guarita tem ±2,2 m, e o corpo de colisão da torre ±2,1 m; a câmera fica 0,4 m para fora do corpo, na altura do parapeito. */
export const TORRE_BORDA = 2.5;
export const TORRE_ALTURA = 7.9;
/** A laje do teto da estação termina em z = 49; a câmera fica pendurada 0,7 m depois da borda, na altura da laje (16,85 m). */
const ESTACAO_BORDA_Z = PRAIA_ESTACAO.z - 15;
const ESTACAO_ALTURA = 17.2;
/** A altura mínima de um prédio para ganhar câmera: os hotéis da frente (16 a 34 m); os de trás são baixos. */
const HOTEL_ALTO = 28;

function camera(id: string, label: string, pos: readonly [number, number, number], alvo: readonly [number, number, number]): FixedCameraPoint {
  return { id, label, position: new THREE.Vector3(...pos), lookAt: new THREE.Vector3(...alvo) };
}

/**
 * A praia: os seis postes de CFTV da estação (os mesmos que o jogador vê nos portões, com a câmera na frente da lente), as duas torres de
 * vigia (na borda da guarita, para dentro do pátio), o teto da estação e dois hotéis da Av. Beira-Mar (o que fica mais perto de onde o
 * Colossus nasce e o mais perto da estação), pendurados na borda do telhado.
 */
function camerasDaPraia(): readonly FixedCameraPoint[] {
  if (praia) return praia;
  const lista: FixedCameraPoint[] = [];
  PRAIA_CFTV.forEach((p, i) => {
    // A lente aponta para o alvo (o `giro` do poste é calculado dele): a câmera fica na frente da lente, com o poste atrás.
    const x = p.x + Math.cos(p.giro) * CFTV_LENTE;
    const z = p.z - Math.sin(p.giro) * CFTV_LENTE;
    lista.push(camera(`praia_cftv_${i}`, p.nome, [x, CFTV_CABECA_Y, z], [p.alvo[0], 1.2, p.alvo[1]]));
  });
  lista.push(
    camera('praia_torre_oeste', 'TORRE DE VIGIA · OESTE', [241 + TORRE_BORDA, TORRE_ALTURA, 7], [276, 1.5, 40]),
    camera('praia_torre_leste', 'TORRE DE VIGIA · LESTE', [311 - TORRE_BORDA, TORRE_ALTURA, 7], [276, 1.5, 40]),
    camera('praia_estacao_teto', 'TETO DA ESTAÇÃO · PÁTIO E MAR', [PRAIA_ESTACAO.x, ESTACAO_ALTURA, ESTACAO_BORDA_Z - 0.7], [276, 2, 6]),
  );
  const hoteis = praiaBlocks().filter((b) => b.kind === 'predio' && b.h >= HOTEL_ALTO);
  const maisPerto = (xAlvo: number): (typeof hoteis)[number] | undefined =>
    hoteis.reduce<(typeof hoteis)[number] | undefined>((melhor, b) => (!melhor || Math.abs(b.x - xAlvo) < Math.abs(melhor.x - xAlvo) ? b : melhor), undefined);
  const doColossus = maisPerto(PRAIA_TITA[0]);
  const daEstacao = maisPerto(PRAIA_ESTACAO.x);
  for (const [id, label, b] of [
    ['praia_hotel_centro', 'TOPO DO HOTEL · AV. BEIRA-MAR (CENTRO)', doColossus],
    ['praia_hotel_leste', 'TOPO DO HOTEL · AV. BEIRA-MAR (LESTE)', daEstacao && daEstacao !== doColossus ? daEstacao : undefined],
  ] as const) {
    // Pendurada na borda da frente do telhado (a que olha para o mar), olhando para a avenida e a praia.
    if (b) lista.push(camera(id, label, [b.x, b.y * 2 + 0.3, b.z - b.d / 2 - 0.8], [b.x, 2, 22]));
  }
  praia = Object.freeze(lista);
  return praia;
}
