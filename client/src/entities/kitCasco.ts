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
 * - `listras`: a mesma faixa repetida (respiros, risco de perigo);
 * - `ombreira` (a tampa em tronco de pirâmide e duas lâminas que caem junto do braço, nunca uma bola), `joelheira` (duas placas em ">") e `perigo` (os riscos
 *   pequenos de acento): as peças de armadura da geração 3 (`MODELADOR.md` § 8). São malhas diretas do pivô: um grupo aninhado viraria um draw call a mais no lote.
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

/** Os materiais de uma armadura: o casco, o aço escuro de dentro e a cor de acento (a pintura do jogador). */
export interface MateriaisDaArmadura {
  readonly armor: THREE.Material;
  readonly frame: THREE.Material;
  readonly paint: THREE.Material;
}

/**
 * O risco de perigo: `n` traços inclinados e pequenos (o acento raro do print 4, não a barra grande). Fica numa face de placa: `rotY` vira a marca para o
 * lado (π/2 numa face que olha para +x ou -x). São malhas diretas do pivô (um grupo aninhado viraria um draw call a mais no lote).
 */
export function perigo(parent: THREE.Object3D, x: number, y: number, z: number, mat: THREE.Material, escala = 1, n = 3, rotZ = 0.62, rotY = 0): THREE.Mesh[] {
  const cos = Math.cos(rotY);
  const sen = Math.sin(rotY);
  const riscos: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const passo = (i - (n - 1) / 2) * 0.034 * escala;
    const m = box(parent, 0.018 * escala, 0.1 * escala, 0.012, mat, x + passo * cos, y, z - passo * sen);
    m.rotation.set(0, rotY, rotZ);
    riscos.push(m);
  }
  return riscos;
}

/**
 * A ombreira angular da geração 3 (o ombro do print 4: placas sobrepostas, não uma bola): a tampa (um tronco de pirâmide de cantos chanfrados, a face de cima
 * menor, caída para fora), duas lâminas que descem pelo lado de fora, cada uma mais inclinada, a guarda da frente e a junta escura por dentro. `lado` é +1 no braço
 * direito (o de fora é +x) e -1 no esquerdo; (x, y, z) é a junta do ombro; `tamanho` multiplica tudo e `inclinacao` (rad) é a queda da tampa para fora.
 */
export function ombreira(parent: THREE.Object3D, lado: number, tamanho: number, inclinacao: number, M: MateriaisDaArmadura, acentos: number, x = 0, y = 0, z = 0): void {
  const t = tamanho;
  const w = 0.56 * t;
  const h = 0.2 * t;
  const d = 0.66 * t;
  const queda = -lado * inclinacao;
  // A tampa fica quase por cima da junta (a ombreira compacta do print 4, não asas abertas) e cai um pouco para fora.
  const tampa = casca(parent, [{ y: 0, w, d }, { y: h * 0.5, w: w * 0.97, d: d * 0.97 }, { y: h, w: w * 0.7, d: d * 0.74 }], 0.07 * t, M.armor, x + lado * 0.05 * t, y + 0.03 * t, z);
  tampa.rotation.z = queda;
  // As lâminas caem junto do braço, quase em pé (a segunda mais que a primeira): o ombro em degraus, rente ao braço.
  for (let i = 0; i < 2; i++) {
    const lamina = placa(parent, (0.34 - 0.04 * i) * t, 0.1 * t, (0.62 - 0.05 * i) * t, 0.022 * t, M.armor, x + lado * (0.21 + 0.07 * i) * t, y - (0.05 + 0.12 * i) * t, z);
    lamina.rotation.z = queda - lado * (0.6 + 0.4 * i);
  }
  // A guarda da frente: uma placa em pé na frente da tampa, com o risco de perigo.
  const guarda = placa(parent, 0.26 * t, 0.18 * t, 0.06 * t, 0.02 * t, M.armor, x + lado * 0.1 * t, y + 0.05 * t, z - d * 0.5 - 0.02 * t);
  guarda.rotation.z = queda;
  if (acentos > 0.05) perigo(parent, x + lado * 0.1 * t, y + 0.05 * t, z - d * 0.5 - 0.058 * t, M.paint, 0.8 * t * acentos, 3, 0.62 * lado);
  cupula(parent, 0.18 * t, 0.18 * t, 0.18 * t, M.frame, x, y - 0.08 * t, z);
}

/** A joelheira de placas (não uma bola): a de cima deitada para trás, a de baixo para a frente, e duas abas escuras nos lados. `(x, y, z)` é o centro da frente do joelho. */
export function joelheira(parent: THREE.Object3D, largura: number, M: MateriaisDaArmadura, x = 0, y = 0, z = 0): void {
  // Vistas de lado formam um ">": o topo da placa de cima fica para trás (+z) e o pé da de baixo também; o ápice, no meio, aponta para a frente.
  const cima = placa(parent, largura * 0.82, 0.24, 0.14, 0.045, M.armor, x, y + 0.07, z);
  cima.rotation.x = 0.32;
  const baixo = placa(parent, largura * 0.7, 0.2, 0.12, 0.04, M.armor, x, y - 0.12, z - 0.03);
  baixo.rotation.x = -0.28;
  for (const lado of [-1, 1]) placa(parent, 0.06, 0.26, largura * 0.5, 0.02, M.frame, x + lado * largura * 0.46, y - 0.02, z + 0.1);
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
