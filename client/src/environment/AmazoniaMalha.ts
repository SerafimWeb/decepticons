import * as THREE from 'three';
import { corDoChao, type CorDoChao } from './AmazoniaCores';
import {
  AMAZONIA_CELULA,
  AMAZONIA_LIMITES,
  AMAZONIA_PEDACO,
  AMAZONIA_REJEITOS,
  larguraDoRio,
  NIVEL_DA_AGUA,
  rioEmX,
} from './AmazoniaLayout';
import { alturaDoTerreno } from './AmazoniaTerreno';

/**
 * AS MALHAS DA AMAZÔNIA (P180, parte B): o terreno **em pedaços de 300 m** (a câmera descarta o pedaço inteiro que não vê: o custo de um mapa 14 vezes a praia), a **fita do rio** e a
 * **lagoa de rejeitos**. Tudo nasce em **coordenadas do mundo** (a malha não se move) e **uma vez**, na montagem.
 *
 * As normais do terreno saem da **mesma função de altura** (diferenças centrais numa grade com uma célula de borda), então **a luz não racha nas emendas** entre pedaços.
 */

/** O pedaço (a malha) do terreno: o índice na grade de pedaços e a caixa no mundo. */
export interface PedacoDoTerreno {
  ix: number;
  iz: number;
  mesh: THREE.Mesh;
  /** O centro do pedaço no mundo (x, z): a distância da câmera escolhe o detalhe dos adereços e da floresta. */
  centroX: number;
  centroZ: number;
}

/** Quantos pedaços em x e em z. */
export const PEDACOS_X = Math.round((AMAZONIA_LIMITES.maxX - AMAZONIA_LIMITES.minX) / AMAZONIA_PEDACO);
export const PEDACOS_Z = Math.round((AMAZONIA_LIMITES.maxZ - AMAZONIA_LIMITES.minZ) / AMAZONIA_PEDACO);

const _cor: CorDoChao = { r: 0, g: 0, b: 0, vida: 1 };

/** A geometria de um pedaço do terreno (publica para o teste conferir o custo e as emendas). */
export function geometriaDoPedaco(ix: number, iz: number): THREE.BufferGeometry {
  const celulas = AMAZONIA_PEDACO / AMAZONIA_CELULA;
  const minX = AMAZONIA_LIMITES.minX + ix * AMAZONIA_PEDACO;
  const minZ = AMAZONIA_LIMITES.minZ + iz * AMAZONIA_PEDACO;
  const n = celulas + 1;
  // as alturas com uma célula de borda de cada lado (as normais das beiradas leem a vizinha)
  const m = n + 2;
  const alturas = new Float32Array(m * m);
  for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) alturas[a * m + b] = alturaDoTerreno(minX + (a - 1) * AMAZONIA_CELULA, minZ + (b - 1) * AMAZONIA_CELULA);
  const posicoes = new Float32Array(n * n * 3);
  const normais = new Float32Array(n * n * 3);
  const cores = new Float32Array(n * n * 3);
  const vidas = new Float32Array(n * n);
  const passo2 = 2 * AMAZONIA_CELULA;
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      const i = a * n + b;
      const x = minX + a * AMAZONIA_CELULA;
      const z = minZ + b * AMAZONIA_CELULA;
      const h = alturas[(a + 1) * m + (b + 1)]!;
      const dhdx = (alturas[(a + 2) * m + (b + 1)]! - alturas[a * m + (b + 1)]!) / passo2;
      const dhdz = (alturas[(a + 1) * m + (b + 2)]! - alturas[(a + 1) * m + b]!) / passo2;
      const inv = 1 / Math.hypot(dhdx, 1, dhdz);
      posicoes[i * 3] = x;
      posicoes[i * 3 + 1] = h;
      posicoes[i * 3 + 2] = z;
      normais[i * 3] = -dhdx * inv;
      normais[i * 3 + 1] = inv;
      normais[i * 3 + 2] = -dhdz * inv;
      corDoChao(x, z, h, Math.min(1, Math.hypot(dhdx, dhdz)), _cor);
      cores[i * 3] = _cor.r;
      cores[i * 3 + 1] = _cor.g;
      cores[i * 3 + 2] = _cor.b;
      vidas[i] = _cor.vida;
    }
  }
  const indices = new Uint32Array(celulas * celulas * 6);
  let k = 0;
  for (let a = 0; a < celulas; a++) {
    for (let b = 0; b < celulas; b++) {
      const i00 = a * n + b;
      const i10 = (a + 1) * n + b;
      const i01 = a * n + b + 1;
      const i11 = (a + 1) * n + b + 1;
      // a ordem faz a face de cima olhar para +Y (a normal acima)
      indices[k++] = i00;
      indices[k++] = i01;
      indices[k++] = i10;
      indices[k++] = i10;
      indices[k++] = i01;
      indices[k++] = i11;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normais, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  g.setAttribute('aVida', new THREE.BufferAttribute(vidas, 1));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(minX + AMAZONIA_PEDACO / 2, 5, minZ + AMAZONIA_PEDACO / 2), AMAZONIA_PEDACO * 0.75 + 40);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(minX, -40, minZ), new THREE.Vector3(minX + AMAZONIA_PEDACO, 40, minZ + AMAZONIA_PEDACO));
  return g;
}

/** O terreno inteiro, pedaço por pedaço. */
export function criarTerreno(scene: THREE.Scene, material: THREE.Material): PedacoDoTerreno[] {
  const pedacos: PedacoDoTerreno[] = [];
  for (let ix = 0; ix < PEDACOS_X; ix++) {
    for (let iz = 0; iz < PEDACOS_Z; iz++) {
      const mesh = new THREE.Mesh(geometriaDoPedaco(ix, iz), material);
      mesh.name = `terreno-${ix}-${iz}`;
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = true;
      scene.add(mesh);
      pedacos.push({ ix, iz, mesh, centroX: AMAZONIA_LIMITES.minX + (ix + 0.5) * AMAZONIA_PEDACO, centroZ: AMAZONIA_LIMITES.minZ + (iz + 0.5) * AMAZONIA_PEDACO });
    }
  }
  return pedacos;
}

/**
 * A fita do rio: uma malha de água que segue o eixo (`rioEmX`) com a largura (`larguraDoRio`), a 5 vértices de uma margem à outra (as ondas do shader mexem os vértices) e a cada 12 m ao longo.
 * A beira fica **debaixo do chão** (a fita é a largura toda; o leito sobe da água antes da margem), então nenhuma borda aparece.
 */
export function geometriaDoRio(): THREE.BufferGeometry {
  const passo = 12;
  const nx = Math.round((AMAZONIA_LIMITES.maxX - AMAZONIA_LIMITES.minX) / passo);
  const ny = 5;
  const posicoes = new Float32Array((nx + 1) * ny * 3);
  const uvs = new Float32Array((nx + 1) * ny * 2);
  for (let i = 0; i <= nx; i++) {
    const x = AMAZONIA_LIMITES.minX + i * passo;
    const zc = rioEmX(x);
    const meia = larguraDoRio(x) / 2;
    for (let j = 0; j < ny; j++) {
      const v = j / (ny - 1);
      const k = i * ny + j;
      posicoes[k * 3] = x;
      posicoes[k * 3 + 1] = NIVEL_DA_AGUA;
      posicoes[k * 3 + 2] = zc - meia + v * 2 * meia;
      uvs[k * 2] = x / 100;
      uvs[k * 2 + 1] = v;
    }
  }
  const indices = new Uint32Array(nx * (ny - 1) * 6);
  let q = 0;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny - 1; j++) {
      const a = i * ny + j;
      const b = (i + 1) * ny + j;
      indices[q++] = a;
      indices[q++] = a + 1;
      indices[q++] = b;
      indices[q++] = b;
      indices[q++] = a + 1;
      indices[q++] = b + 1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.boundingBox = new THREE.Box3(new THREE.Vector3(AMAZONIA_LIMITES.minX, NIVEL_DA_AGUA - 1, AMAZONIA_LIMITES.minZ), new THREE.Vector3(AMAZONIA_LIMITES.maxX, NIVEL_DA_AGUA + 1, AMAZONIA_LIMITES.maxZ));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1400);
  return g;
}

export function criarRio(scene: THREE.Scene, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometriaDoRio(), material);
  mesh.name = 'rio';
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);
  return mesh;
}

/** A lagoa de rejeitos: um disco elíptico de água preta no nível da água, com a borda dentro do dique. */
export function criarLagoa(scene: THREE.Scene, material: THREE.Material): THREE.Mesh {
  const r = AMAZONIA_REJEITOS;
  const g = new THREE.CircleGeometry(1, 48);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'lagoa-de-rejeitos';
  mesh.scale.set(r.rx * 0.98, 1, r.rz * 0.98);
  mesh.position.set(r.x, NIVEL_DA_AGUA + 0.2, r.z);
  mesh.renderOrder = 2;
  scene.add(mesh);
  return mesh;
}
