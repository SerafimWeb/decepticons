import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import {
  AMAZONIA_ALDEIA,
  AMAZONIA_LIMITES,
  AMAZONIA_MINA,
  AMAZONIA_NASCIMENTO_JOGADOR,
  AMAZONIA_PEDACO,
  AMAZONIA_PLANTA,
  AMAZONIA_REJEITOS,
  larguraDoRio,
  NIVEL_DA_AGUA,
  rioEmX,
} from './AmazoniaLayout';
import { geometriaDe, juntar, novoAcumulador } from './AmazoniaGeometria';
import { PEDACOS_X, PEDACOS_Z } from './AmazoniaMalha';
import { alturaDoTerreno } from './AmazoniaTerreno';

/**
 * A FLORESTA DA AMAZÔNIA (P180, parte B): as árvores como **dado puro** (`arvoresDaAmazonia`: deterministas, com a semente fixa) e a malha **instanciada por pedaço de 300 m**, com **dois
 * níveis de detalhe** escolhidos pela distância da câmera (o `observar` do mapa): a árvore de perto (copa de dois blocos e tronco de 6 lados, ~50 triângulos) e o **cartão de longe** (4
 * triângulos). A floresta **não existe onde não pode existir**: no rio, na aldeia, na planta, na cava, na lagoa, nas encostas íngremes; e **rareia em volta da mina** (o desmatamento, a
 * história da fase).
 *
 * **Custo:** uma malha instanciada por pedaço e nível (a câmera descarta os pedaços fora da vista e o `observar` esconde os de nível errado): de ~16 desenhos de árvore no pior caso. Sem
 * alocar por quadro (só troca \`visible\`).
 */

export interface Arvore {
  x: number;
  z: number;
  /** O tamanho (1 = 18 m de altura). */
  escala: number;
  giro: number;
  /** A variação do brilho (0,85 a 1,15). */
  tom: number;
}

const ESPACAMENTO = 14;
const SEMENTE = 0xa11a20;

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

let cache: readonly Arvore[] | null = null;

/** A probabilidade (0 a 1) de haver uma árvore em (x, z): 0 onde a floresta não pode estar, mais rala em volta da mina e na encosta. */
export function densidadeDaFloresta(x: number, z: number): number {
  const d = Math.abs(z - rioEmX(x));
  const meia = larguraDoRio(x) / 2;
  if (d < meia + 9) return 0; // o rio e a beira lamacenta
  const h = alturaDoTerreno(x, z);
  if (h < NIVEL_DA_AGUA + 0.8) return 0; // baixio alagado
  const a = AMAZONIA_ALDEIA;
  if (Math.hypot(x - a.x, z - a.z) < a.raio + 14) return 0;
  const p = AMAZONIA_PLANTA;
  if (Math.abs(x - p.x) < p.comprimento / 2 + 28 && Math.abs(z - p.z) < p.largura / 2 + 28) return 0;
  const m = AMAZONIA_MINA;
  const dm = Math.hypot(x - m.x, z - m.z);
  if (dm < m.raio * 1.25) return 0;
  const r = AMAZONIA_REJEITOS;
  if (Math.hypot((x - r.x) / r.rx, (z - r.z) / r.rz) < 1.55) return 0;
  const n = AMAZONIA_NASCIMENTO_JOGADOR;
  if (Math.hypot(x - n.x, z - n.z) < 30) return 0;
  // a encosta íngreme tem menos árvore (e a muito íngreme, nenhuma)
  const dhdx = (alturaDoTerreno(x + 6, z) - alturaDoTerreno(x - 6, z)) / 12;
  const dhdz = (alturaDoTerreno(x, z + 6) - alturaDoTerreno(x, z - 6)) / 12;
  const declive = Math.hypot(dhdx, dhdz);
  if (declive > 0.5) return 0;
  let dens = 0.82 * (1 - clamp01((declive - 0.25) / 0.3));
  // o desmatamento: em volta da cava a floresta rareia até 2,2 raios e a oeste, na faixa da planta e da margem fortificada
  dens *= clamp01((dm - m.raio * 1.25) / (m.raio * 0.95));
  const dPlanta = Math.hypot(Math.max(0, Math.abs(x - p.x) - p.comprimento / 2), Math.max(0, Math.abs(z - p.z) - p.largura / 2));
  dens *= clamp01((dPlanta - 28) / 90);
  return dens;
}

/** Todas as árvores do mapa (calculadas uma vez e guardadas). */
export function arvoresDaAmazonia(): readonly Arvore[] {
  if (cache) return cache;
  const rand = mulberry32(SEMENTE);
  const lista: Arvore[] = [];
  for (let gx = AMAZONIA_LIMITES.minX + ESPACAMENTO / 2; gx < AMAZONIA_LIMITES.maxX; gx += ESPACAMENTO) {
    for (let gz = AMAZONIA_LIMITES.minZ + ESPACAMENTO / 2; gz < AMAZONIA_LIMITES.maxZ; gz += ESPACAMENTO) {
      const x = gx + (rand() - 0.5) * ESPACAMENTO * 0.9;
      const z = gz + (rand() - 0.5) * ESPACAMENTO * 0.9;
      const sorteio = rand();
      const escala = 0.75 + rand() * 0.85;
      const giro = rand() * Math.PI * 2;
      const tom = 0.85 + rand() * 0.3;
      if (sorteio < densidadeDaFloresta(x, z)) lista.push({ x, z, escala, giro, tom });
    }
  }
  cache = lista;
  return lista;
}

/** O índice do pedaço de 300 m que contém (x, z). */
export function pedacoDe(x: number, z: number): { ix: number; iz: number } {
  const ix = Math.min(PEDACOS_X - 1, Math.max(0, Math.floor((x - AMAZONIA_LIMITES.minX) / AMAZONIA_PEDACO)));
  const iz = Math.min(PEDACOS_Z - 1, Math.max(0, Math.floor((z - AMAZONIA_LIMITES.minZ) / AMAZONIA_PEDACO)));
  return { ix, iz };
}

// ── a geometria: a árvore de perto e o cartão de longe ─────────────────────────────────────────────────────────────────────────────

/** A árvore de perto: tronco de 6 lados e duas copas de blocos (icosaedros achatados), 18 m de altura. ~52 triângulos. */
export function geometriaDaArvore(): THREE.BufferGeometry {
  const a = novoAcumulador();
  const tronco = new THREE.CylinderGeometry(0.55, 0.95, 10, 6, 1, true);
  tronco.translate(0, 5, 0);
  juntar(a, tronco, [0.13, 0.085, 0.05], 0.35);
  const copaBaixa = new THREE.IcosahedronGeometry(1, 0);
  copaBaixa.scale(7.2, 4.4, 7.2);
  copaBaixa.translate(0, 11.5, 0);
  juntar(a, copaBaixa, [0.035, 0.12, 0.035], 1);
  const copaAlta = new THREE.IcosahedronGeometry(1, 0);
  copaAlta.scale(5.2, 3.6, 5.2);
  copaAlta.rotateY(0.6);
  copaAlta.translate(0.6, 15.2, -0.4);
  juntar(a, copaAlta, [0.06, 0.17, 0.05], 1);
  return geometriaDe(a);
}

/** A árvore de longe: a copa vira um bloco de 8 faces (um octaedro achatado) e o tronco, uma faixa, 18 m de altura. 10 triângulos (nada de cartão chato, que de longe lê como caixa). */
export function geometriaDoCartao(): THREE.BufferGeometry {
  const a = novoAcumulador();
  const copa = new THREE.OctahedronGeometry(1, 0);
  copa.scale(8.2, 5.6, 8.2);
  copa.translate(0, 13.2, 0);
  juntar(a, copa, [0.045, 0.14, 0.04], 1);
  const tronco = new THREE.PlaneGeometry(1.6, 9);
  tronco.translate(0, 4.5, 0);
  juntar(a, tronco, [0.13, 0.085, 0.05], 0.35);
  return geometriaDe(a);
}

/** A malha instanciada de um pedaço: as árvores do pedaço num só desenho. */
function instanciar(geometria: THREE.BufferGeometry, material: THREE.Material, arvores: readonly Arvore[], centro: THREE.Vector3): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometria, material, Math.max(1, arvores.length));
  mesh.count = arvores.length;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Vector3();
  const p = new THREE.Vector3();
  const cor = new THREE.Color();
  const eixoY = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < arvores.length; i++) {
    const a = arvores[i]!;
    q.setFromAxisAngle(eixoY, a.giro);
    e.set(a.escala, a.escala * (0.9 + 0.2 * ((i * 7919) % 13) / 13), a.escala);
    p.set(a.x, alturaDoTerreno(a.x, a.z) - 0.4, a.z);
    m.compose(p, q, e);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, cor.setScalar(a.tom));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.matrixAutoUpdate = false;
  mesh.boundingSphere = new THREE.Sphere(centro.clone(), AMAZONIA_PEDACO * 0.75 + 30);
  mesh.frustumCulled = true;
  return mesh;
}

export interface FlorestaDoPedaco {
  ix: number;
  iz: number;
  centroX: number;
  centroZ: number;
  perto: THREE.InstancedMesh;
  longe: THREE.InstancedMesh;
  arvores: number;
}

/** A distância (m) do centro do pedaço até a câmera abaixo da qual ele usa a árvore de perto; até `ALCANCE_DA_FLORESTA` usa o cartão; além, some (a névoa já o esconde). */
export const ALCANCE_DA_ARVORE = 260;
export const ALCANCE_DA_FLORESTA = 1050;

export class Floresta {
  readonly pedacos: FlorestaDoPedaco[] = [];

  constructor(scene: THREE.Scene, material: THREE.Material) {
    const porPedaco = new Map<number, Arvore[]>();
    for (const a of arvoresDaAmazonia()) {
      const { ix, iz } = pedacoDe(a.x, a.z);
      const k = ix * PEDACOS_Z + iz;
      let l = porPedaco.get(k);
      if (!l) porPedaco.set(k, (l = []));
      l.push(a);
    }
    const geoPerto = geometriaDaArvore();
    const geoLonge = geometriaDoCartao();
    for (let ix = 0; ix < PEDACOS_X; ix++) {
      for (let iz = 0; iz < PEDACOS_Z; iz++) {
        const lista = porPedaco.get(ix * PEDACOS_Z + iz) ?? [];
        if (!lista.length) continue;
        const centroX = AMAZONIA_LIMITES.minX + (ix + 0.5) * AMAZONIA_PEDACO;
        const centroZ = AMAZONIA_LIMITES.minZ + (iz + 0.5) * AMAZONIA_PEDACO;
        const centro = new THREE.Vector3(centroX, 8, centroZ);
        const perto = instanciar(geoPerto, material, lista, centro);
        const longe = instanciar(geoLonge, material, lista, centro);
        perto.name = `arvores-perto-${ix}-${iz}`;
        longe.name = `arvores-longe-${ix}-${iz}`;
        perto.visible = false;
        longe.visible = false;
        scene.add(perto, longe);
        this.pedacos.push({ ix, iz, centroX, centroZ, perto, longe, arvores: lista.length });
      }
    }
  }

  /** Escolhe, por pedaço, a árvore de perto, o cartão de longe ou nada, pela distância à câmera (x, z). Só troca `visible`: sem alocar. */
  observar(x: number, z: number): void {
    for (const p of this.pedacos) {
      const d = Math.hypot(p.centroX - x, p.centroZ - z);
      p.perto.visible = d < ALCANCE_DA_ARVORE;
      p.longe.visible = d >= ALCANCE_DA_ARVORE && d < ALCANCE_DA_FLORESTA;
    }
  }
}
