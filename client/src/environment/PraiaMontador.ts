import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * O MONTADOR de geometrias da praia (P127): junta peças (caixa, cilindro, esfera, barra, tubo, malha solta) numa geometria só, com cor
 * de vértice. É o que `PraiaGeometrias.ts` (a base: coqueiro, barraca, carro...) e `PraiaGeometriasCena.ts` (a cena: a base da estação, a
 * praia, a calçada, o porto) usam para desenhar cada adereço. As **camadas** de um adereço dizem com que material cada malha se desenha:
 * `padrao` (cor de vértice, uma face), `duplo` (o mesmo, dupla face), `folha` (dupla face, balança ao vento), `vela` (dupla face,
 * tremula), `bandeira` (dupla face, ondula a partir do mastro) e `brilho` (acende, passa do limiar do bloom). Com `tinta`, a cor da
 * instância (`Adereco.cor`) multiplica a camada.
 */

export type MaterialDaCamada = 'padrao' | 'duplo' | 'folha' | 'vela' | 'bandeira' | 'brilho';

export interface Camada {
  geo: THREE.BufferGeometry;
  material: MaterialDaCamada;
  tinta: boolean;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const CIMA = new THREE.Vector3(0, 1, 0);

export const hex = (r: number, g: number, b: number): number => (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);

/** Põe a cor de vértice (uma só) numa geometria que ainda não tem. */
export function pinta(g: THREE.BufferGeometry, cor: number): void {
  const n = g.attributes.position!.count;
  const c = new THREE.Color(cor);
  const cores = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) cores.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
}

/** Junta peças (caixa, cilindro, esfera, barra, tubo, malha solta) numa geometria só, com cor de vértice. */
export class Montador {
  private readonly partes: THREE.BufferGeometry[] = [];

  /** Aplica a matriz, tira o UV, desfaz o índice (todas as peças precisam ter os mesmos atributos) e guarda. */
  private guarda(g: THREE.BufferGeometry, cor: number | null, m: THREE.Matrix4): this {
    g.applyMatrix4(m);
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute('uv');
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (cor !== null) pinta(ng, cor);
    this.partes.push(ng);
    return this;
  }

  private junta(g: THREE.BufferGeometry, cor: number | null, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): this {
    return this.guarda(g, cor, _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
  }

  caixa(w: number, h: number, d: number, x: number, y: number, z: number, cor: number, rx = 0, ry = 0, rz = 0): this {
    return this.junta(new THREE.BoxGeometry(w, h, d), cor, x, y, z, rx, ry, rz);
  }

  cilindro(rTopo: number, rBase: number, h: number, lados: number, x: number, y: number, z: number, cor: number, rx = 0, ry = 0, rz = 0): this {
    return this.junta(new THREE.CylinderGeometry(rTopo, rBase, h, lados, 1), cor, x, y, z, rx, ry, rz);
  }

  esfera(r: number, lados: number, x: number, y: number, z: number, cor: number, sx = 1, sy = 1, sz = 1): this {
    return this.junta(new THREE.SphereGeometry(r, lados, Math.max(4, Math.floor(lados / 2))), cor, x, y, z, 0, 0, 0, sx, sy, sz);
  }

  /** Uma barra quadrada de `espessura` entre dois pontos: a perna e a diagonal de uma treliça. */
  barra(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, espessura: number, cor: number): this {
    _a.set(x0, y0, z0);
    _b.set(x1, y1, z1);
    const dir = _b.clone().sub(_a);
    const comp = dir.length();
    _q.setFromUnitVectors(CIMA, dir.normalize());
    _p.copy(_a).add(_b).multiplyScalar(0.5);
    return this.guarda(new THREE.BoxGeometry(espessura, comp, espessura), cor, _m.compose(_p, _q, _s.set(1, 1, 1)));
  }

  /** Uma malha já pronta (posição e índices), de uma cor: normais calculadas aqui. */
  malha(posicoes: readonly number[], indices: readonly number[], cor: number): this {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3));
    g.setIndex([...indices]);
    g.computeVertexNormals();
    return this.guarda(g, cor, _m.identity());
  }

  /** Um tubo cônico ao longo de `centros` (o tronco curvo do coqueiro), com `raios` e uma cor por anel. */
  tubo(centros: readonly THREE.Vector3[], raios: readonly number[], lados: number, cores: readonly number[]): this {
    const pos: number[] = [];
    const cor: number[] = [];
    const idx: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < centros.length; i++) {
      c.set(cores[i % cores.length]!);
      for (let k = 0; k < lados; k++) {
        const a = (k / lados) * Math.PI * 2;
        pos.push(centros[i]!.x + Math.cos(a) * raios[i]!, centros[i]!.y, centros[i]!.z + Math.sin(a) * raios[i]!);
        cor.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i + 1 < centros.length; i++) {
      for (let k = 0; k < lados; k++) {
        const a = i * lados + k;
        const b = i * lados + ((k + 1) % lados);
        idx.push(a, a + lados, b, b, a + lados, b + lados);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return this.guarda(g, null, _m.identity());
  }

  /** Uma geometria que já veio com cor de vértice (o casco, as folhas, o prato). */
  pronta(g: THREE.BufferGeometry): this {
    return this.guarda(g, null, _m.identity());
  }

  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.partes, false);
    if (!g) throw new Error('PraiaGeometrias: as peças não têm os mesmos atributos');
    g.computeBoundingSphere();
    return g;
  }
}


/** O prisma do casco: o contorno em planta (a proa a +x), do fundo `y0` até `y1`, numa cor. Lados e tampa de fora para fora. */
export function prisma(contorno: readonly (readonly [number, number])[], y0: number, y1: number, cor: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = contorno.length;
  for (const [x, z] of contorno) pos.push(x, y0, z);
  for (const [x, z] of contorno) pos.push(x, y1, z);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(i, n + i, j, j, n + i, n + j);
  }
  for (let i = 1; i + 1 < n; i++) idx.push(n, n + i + 1, n + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const ng = g.toNonIndexed();
  pinta(ng, cor);
  return ng;
}
