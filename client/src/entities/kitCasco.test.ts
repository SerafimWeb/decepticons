import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { casca, cupula, listras, placa } from './kitCasco';
import { batchRigMeshes, box, group } from './meshKit';

const material = new THREE.MeshStandardMaterial({ color: 0x888888 });

const triangulos = (m: THREE.Mesh): number => ((m.geometry as THREE.BufferGeometry).index?.count ?? (m.geometry as THREE.BufferGeometry).getAttribute('position').count) / 3;

function caixa(m: THREE.Mesh): THREE.Box3 {
  m.updateMatrix();
  return new THREE.Box3().setFromBufferAttribute((m.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute).applyMatrix4(m.matrix);
}

/** Toda face aponta para fora do centro da peça: a casca não saiu do avesso e a luz cai do lado certo. */
function normaisParaFora(m: THREE.Mesh): boolean {
  const g = m.geometry as THREE.BufferGeometry;
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const centro = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) centro.add(new THREE.Vector3().fromBufferAttribute(pos, i));
  centro.divideScalar(pos.count);
  for (let i = 0; i + 2 < pos.count; i += 3) {
    const meio = new THREE.Vector3();
    for (let k = 0; k < 3; k++) meio.add(new THREE.Vector3().fromBufferAttribute(pos, i + k));
    meio.divideScalar(3).sub(centro);
    if (new THREE.Vector3().fromBufferAttribute(nor, i).dot(meio) <= 0) return false;
  }
  return true;
}

describe('o kit de casco da geração 3 (kitCasco)', () => {
  const coxa = [{ y: -0.1, w: 0.4, d: 0.36 }, { y: -0.5, w: 0.36, d: 0.34 }, { y: -0.9, w: 0.28, d: 0.28 }] as const;

  it('uma casca de três seções tem 2 faixas de 16 triângulos e as duas tampas (44 triângulos)', () => {
    const m = casca(new THREE.Group(), coxa, 0.05, material);
    expect(triangulos(m)).toBe(2 * 16 + 12);
  });

  it('a casca ocupa as seções: a largura e a profundidade das maiores, a altura de uma ponta à outra', () => {
    const c = caixa(casca(new THREE.Group(), coxa, 0.05, material));
    expect(c.max.x - c.min.x).toBeCloseTo(0.4, 5);
    expect(c.max.z - c.min.z).toBeCloseTo(0.36, 5);
    expect(c.max.y).toBeCloseTo(-0.1, 5);
    expect(c.min.y).toBeCloseTo(-0.9, 5);
  });

  it('o deslocamento do centro (a panturrilha atrás) muda a posição da seção, não o tamanho', () => {
    const reta = caixa(casca(new THREE.Group(), [{ y: 0, w: 0.3, d: 0.3 }, { y: -1, w: 0.3, d: 0.3 }], 0.04, material));
    const torta = caixa(casca(new THREE.Group(), [{ y: 0, w: 0.3, d: 0.3 }, { y: -1, w: 0.3, d: 0.3, oz: 0.1 }], 0.04, material));
    expect(torta.max.z).toBeCloseTo(reta.max.z + 0.1, 5);
    expect(torta.min.z).toBeCloseTo(reta.min.z, 5);
  });

  it('as faces da casca apontam para fora, inclusive com seção deslocada e deitada para a frente', () => {
    expect(normaisParaFora(casca(new THREE.Group(), coxa, 0.05, material))).toBe(true);
    expect(normaisParaFora(casca(new THREE.Group(), [{ y: 0, w: 0.3, d: 0.3 }, { y: -1, w: 0.4, d: 0.42, oz: 0.08 }, { y: -2, w: 0.2, d: 0.2 }], 0.06, material))).toBe(true);
    expect(normaisParaFora(casca(new THREE.Group(), coxa, 0.05, material, 0, 0, 0, -Math.PI / 2))).toBe(true);
  });

  it('a placa tem as medidas de fora pedidas (o beveledBox do meshKit alarga 2 vezes o chanfro): a bota pisa o chão', () => {
    for (const [w, h, d, c] of [[0.4, 0.2, 0.9, 0.05], [0.1, 0.28, 0.36, 0.03], [1, 1, 1, 0.3]] as const) {
      const caixaDaPlaca = caixa(placa(new THREE.Group(), w, h, d, c, material));
      expect(caixaDaPlaca.max.x - caixaDaPlaca.min.x).toBeCloseTo(w, 5);
      expect(caixaDaPlaca.max.y - caixaDaPlaca.min.y).toBeCloseTo(h, 5);
      expect(caixaDaPlaca.max.z - caixaDaPlaca.min.z).toBeCloseTo(d, 5);
    }
  });

  it('uma casca de uma seção só não existe', () => {
    expect(() => casca(new THREE.Group(), [{ y: 0, w: 1, d: 1 }], 0.05, material)).toThrow();
  });

  it('a cúpula tem os raios pedidos (os polos são vértices) e as faces para fora', () => {
    const m = cupula(new THREE.Group(), 0.3, 0.2, 0.25, material);
    const c = caixa(m);
    expect(c.max.y - c.min.y).toBeCloseTo(0.4, 5);
    expect(c.max.x - c.min.x).toBeGreaterThan(0.54);
    expect(c.max.x - c.min.x).toBeLessThanOrEqual(0.6 + 1e-6);
    expect(normaisParaFora(m)).toBe(true);
    // Poucos lados, de propósito: meia centena de triângulos por peça.
    expect(triangulos(m)).toBeLessThan(80);
  });

  it('uma cúpula (até metade da esfera) tem menos triângulos que a esfera inteira', () => {
    const inteira = triangulos(cupula(new THREE.Group(), 1, 1, 1, material));
    const meia = triangulos(cupula(new THREE.Group(), 1, 1, 1, material, 0, 0, 0, { ate: Math.PI / 2 }));
    expect(meia).toBeLessThan(inteira);
  });

  it('as listras se repetem em fila, centradas, e cada uma pode girar', () => {
    const grupo = new THREE.Group();
    const faixas = listras(grupo, 3, 0.1, 0.02, 0.02, 0.2, material, 1, 2, 3, 0.5);
    expect(faixas.map((f) => f.position.x)).toEqual([0.8, 1, 1.2]);
    expect(faixas.every((f) => f.position.y === 2 && f.position.z === 3 && f.rotation.z === 0.5)).toBe(true);
  });

  it('funde com as peças do meshKit num pivô só, com todos os atributos do lote (a casca não quebra o `batchRigMeshes`)', () => {
    const raiz = new THREE.Group();
    const pivo = group(raiz, 0, 0, 0);
    placa(pivo, 0.4, 0.2, 0.3, 0.04, material);
    casca(pivo, coxa, 0.05, material, 0, 1, 0);
    cupula(pivo, 0.2, 0.2, 0.2, material, 0, 2, 0);
    box(pivo, 0.1, 0.1, 0.1, material, 0, 3, 0);
    batchRigMeshes(raiz, [material]);
    const malhas = pivo.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    expect(malhas).toHaveLength(1);
    const g = malhas[0]!.geometry as THREE.BufferGeometry;
    for (const nome of ['position', 'normal', 'uv', 'color', 'mechHull', 'mechFoot']) expect(g.getAttribute(nome), nome).toBeDefined();
    expect(Number.isFinite(g.getAttribute('position').getX(0))).toBe(true);
  });
});
