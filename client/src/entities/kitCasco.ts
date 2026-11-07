import * as THREE from 'three';
import { beveledBox, box, cyl, group, taperedBox } from './meshKit';

/**
 * O kit de casco da geração 3 (P323): peças de hard-surface para montar um Mech em código, no mesmo molde do `meshKit.ts` (cada função põe uma
 * `THREE.Mesh` no pivô; o `batchRigMeshes` as funde numa malha só por pivô, com a cor do material de cada peça). Só entra no pedaço sob demanda da
 * geração 3: o pacote de partida não o carrega.
 *
 * - `casca`: uma casca que passa por várias seções (largura × profundidade a cada altura), de cantos chanfrados: a placa que afunila, alarga e quebra
 *   (coxa, canela, peito, capacete);
 * - `cupula`: um pedaço de elipsoide de poucos lados (ombreira, joelheira, ponta de bota);
 * - `listras`: a mesma faixa repetida (respiros, risco de perigo).
 * As peças retas e chanfradas do `meshKit.ts` (`placa` é o `beveledBox`, mais `box`, `cyl`, `taperedBox`) valem e são reexportadas daqui.
 *
 * Toda face é plana (normal por face): o chanfro pega a luz e a aresta não "derrete". O lado de fora é conferido pelo centro da peça, então uma
 * casca não sai do avesso. Custo: tudo na criação do rig; nada por quadro (G4/G5).
 */
export { box, cyl, group, taperedBox };

/**
 * Uma placa reta de bordas chanfradas, com as medidas de FORA (largura `w`, altura `h`, profundidade `d`). O `beveledBox` do `meshKit.ts` alarga a peça em 2 vezes o
 * chanfro em x e y (o chanfro sai para fora do contorno); aqui a peça tem o tamanho pedido, então uma bota de 0,2 m de altura pisa o chão e não 4 cm abaixo dele.
 */
export function placa(parent: THREE.Object3D, w: number, h: number, d: number, chanfro: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  // O chanfro cabe em 1/7 de cada lado: assim o `beveledBox` não o encolhe de novo pela largura que sobrou.
  const e = Math.max(0.001, Math.min(chanfro, w / 7, h / 7, d * 0.2));
  return beveledBox(parent, w - 2 * e, h - 2 * e, d, e, mat, x, y, z);
}

/** Uma seção de uma casca: a posição ao longo do eixo (y), a largura (x) e a profundidade (z), e o deslocamento do centro (ox, oz). */
export interface Secao {
  readonly y: number;
  readonly w: number;
  readonly d: number;
  readonly ox?: number;
  readonly oz?: number;
}

/** Lados de cada seção: um retângulo de quatro cantos chanfrados vira um octógono. */
const LADOS = 8;
type Tri = readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3];

/** Os oito pontos da seção, no plano XZ, na altura `y` (o chanfro `c` corta os quatro cantos). */
function anel(s: Secao, c: number): THREE.Vector3[] {
  const hw = s.w / 2;
  const hd = s.d / 2;
  const k = Math.max(0, Math.min(c, hw * 0.9, hd * 0.9));
  const ox = s.ox ?? 0;
  const oz = s.oz ?? 0;
  const p: readonly (readonly [number, number])[] = [
    [hw - k, -hd], [hw, -hd + k], [hw, hd - k], [hw - k, hd],
    [-hw + k, hd], [-hw, hd - k], [-hw, -hd + k], [-hw + k, -hd],
  ];
  return p.map(([x, z]) => new THREE.Vector3(x + ox, s.y, z + oz));
}

/** Monta a malha de triângulos soltos (faces planas), confere o lado de fora de cada um pelo centro da peça e a põe no pivô. */
function montar(parent: THREE.Object3D, tris: readonly Tri[], mat: THREE.Material, x: number, y: number, z: number, rot: THREE.Euler): THREE.Mesh {
  const centro = new THREE.Vector3();
  for (const [a, b, c] of tris) centro.add(a).add(b).add(c);
  centro.divideScalar(tris.length * 3);
  const posicao: number[] = [];
  const uv: number[] = [];
  const n = new THREE.Vector3();
  const meio = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  for (const [a, b0, c0] of tris) {
    let b = b0;
    let c = c0;
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    meio.copy(a).add(b).add(c).divideScalar(3).sub(centro);
    if (n.dot(meio) < 0) {
      b = c0;
      c = b0;
    }
    for (const p of [a, b, c]) {
      posicao.push(p.x, p.y, p.z);
      uv.push(p.x, p.y);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posicao), 3));
  // O lote exige os mesmos atributos em todas as peças de um pivô (`batchRigMeshes`): posição, normal e uv.
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geometry.computeVertexNormals();
  geometry.userData.mechOwnedGeometry = true;
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.copy(rot);
  parent.add(mesh);
  return mesh;
}

/**
 * Uma casca de cantos chanfrados que passa pelas seções, em ordem, ao longo de +Y (a tampa de cada ponta fecha a peça). `rotX = -Math.PI / 2`
 * a deita apontando para a frente (-Z), como o antebraço de um Mech que leva a arma.
 */
export function casca(parent: THREE.Object3D, secoes: readonly Secao[], chanfro: number, mat: THREE.Material, x = 0, y = 0, z = 0, rotX = 0): THREE.Mesh {
  if (secoes.length < 2) throw new Error('uma casca tem pelo menos duas seções');
  const aneis = secoes.map((s) => anel(s, chanfro));
  const tris: Tri[] = [];
  for (let i = 0; i < aneis.length - 1; i++) {
    const a = aneis[i]!;
    const b = aneis[i + 1]!;
    for (let j = 0; j < LADOS; j++) {
      const k = (j + 1) % LADOS;
      tris.push([a[j]!, a[k]!, b[k]!], [a[j]!, b[k]!, b[j]!]);
    }
  }
  for (const ponta of [aneis[0]!, aneis[aneis.length - 1]!]) for (let j = 1; j < LADOS - 1; j++) tris.push([ponta[0]!, ponta[j]!, ponta[j + 1]!]);
  return montar(parent, tris, mat, x, y, z, new THREE.Euler(rotX, 0, 0));
}

export interface OpcoesDaCupula {
  /** Lados em volta (8 por padrão) e anéis de cima a baixo (5 na esfera inteira; menos numa cúpula, na mesma proporção). */
  readonly lados?: number;
  readonly aneis?: number;
  /** Até onde a esfera vai a partir do polo de cima, em radianos: PI é a esfera inteira; PI / 2, uma cúpula. */
  readonly ate?: number;
  readonly rotX?: number;
  readonly rotY?: number;
  readonly rotZ?: number;
}

/** Um pedaço de elipsoide de raios `rx`, `ry` e `rz`, de faces planas (poucos lados: ombreira, joelheira, capacete, ponta de bota). */
export function cupula(parent: THREE.Object3D, rx: number, ry: number, rz: number, mat: THREE.Material, x = 0, y = 0, z = 0, opcoes: OpcoesDaCupula = {}): THREE.Mesh {
  const ate = opcoes.ate ?? Math.PI;
  // Os anéis são do arco inteiro: uma cúpula tem menos, na mesma proporção (poucos triângulos por peça).
  const esfera = new THREE.SphereGeometry(1, opcoes.lados ?? 8, opcoes.aneis ?? Math.max(2, Math.round((5 * ate) / Math.PI)), 0, Math.PI * 2, 0, ate);
  const geometry = esfera.toNonIndexed();
  esfera.dispose();
  geometry.scale(rx, ry, rz);
  geometry.computeVertexNormals();
  geometry.userData.mechOwnedGeometry = true;
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(opcoes.rotX ?? 0, opcoes.rotY ?? 0, opcoes.rotZ ?? 0);
  parent.add(mesh);
  return mesh;
}

/** A mesma faixa `n` vezes, em fila ao longo de X (a cada `passo` m, centrada em `x`), cada uma girada `rotZ`: respiros e risco de perigo. */
export function listras(parent: THREE.Object3D, n: number, w: number, h: number, d: number, passo: number, mat: THREE.Material, x = 0, y = 0, z = 0, rotZ = 0): THREE.Mesh[] {
  const faixas: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const m = box(parent, w, h, d, mat, x + (i - (n - 1) / 2) * passo, y, z);
    m.rotation.z = rotZ;
    faixas.push(m);
  }
  return faixas;
}
