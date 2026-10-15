import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { praiaAderecos } from './PraiaAderecos';
import { PraiaGente } from './PraiaGente';
import { coneDeFeixe, PraiaLuzes } from './PraiaLuzes';
import { criarUniformes } from './PraiaUniformes';

const desenhos = (cena: THREE.Scene): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  cena.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
};

describe('o desenho das luzes da praia (P127, rodada de luz)', () => {
  it('são cinco desenhos: os halos, as poças, os feixes dos refletores e os dois holofotes', () => {
    const cena = new THREE.Scene();
    cena.fog = new THREE.FogExp2(0xffffff, 0.0024);
    new PraiaLuzes(cena, criarUniformes(), praiaAderecos());
    expect(desenhos(cena).length).toBe(5);
  });

  it('os halos são UM desenho instanciado, com uma instância por luz', () => {
    const cena = new THREE.Scene();
    new PraiaLuzes(cena, criarUniformes(), praiaAderecos());
    const halos = desenhos(cena).find((m) => m.geometry instanceof THREE.InstancedBufferGeometry && m.geometry.attributes.iDados);
    expect(halos).toBeDefined();
    const g = halos!.geometry as THREE.InstancedBufferGeometry;
    expect(g.instanceCount).toBeGreaterThan(200);
    expect(g.instanceCount).toBeLessThanOrEqual(600);
    expect(g.attributes.iCentro!.count).toBe(g.instanceCount);
    expect(g.attributes.iCor!.count).toBe(g.instanceCount);
  });

  it('a qualidade baixa desliga as poças, os feixes e os holofotes, e deixa os halos', () => {
    const cena = new THREE.Scene();
    const luzes = new PraiaLuzes(cena, criarUniformes(), praiaAderecos());
    luzes.setDetalhe(false);
    const visiveis = desenhos(cena).filter((m) => {
      let o: THREE.Object3D | null = m;
      while (o) {
        if (!o.visible) return false;
        o = o.parent;
      }
      return true;
    });
    expect(visiveis.length, 'só os halos').toBe(1);
    luzes.setDetalhe(true);
    expect(desenhos(cena).every((m) => m.visible && m.parent!.visible)).toBe(true);
  });

  it('os holofotes giram com o tempo (uma matriz por torre, nada alocado)', () => {
    const cena = new THREE.Scene();
    const luzes = new PraiaLuzes(cena, criarUniformes(), praiaAderecos());
    const raizes = cena.children.filter((c): c is THREE.Group => c instanceof THREE.Group);
    expect(raizes.length).toBe(2);
    luzes.update(0);
    const a = raizes.map((r) => r.rotation.y);
    luzes.update(5);
    const b = raizes.map((r) => r.rotation.y);
    expect(b[0]).not.toBeCloseTo(a[0]!, 3);
    expect(b[1]).not.toBeCloseTo(a[1]!, 3);
    expect(Math.sign(b[0]! - a[0]!)).not.toBe(Math.sign(b[1]! - a[1]!));
  });

  it('o cone de feixe tem a ponta na origem, a boca no comprimento certo e o atributo de distância de 0 a 1', () => {
    const g = coneDeFeixe(80, 6);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.y).toBeCloseTo(0, 5);
    expect(g.boundingBox!.min.y).toBeCloseTo(-80, 5);
    const t = g.attributes.aT!;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < t.count; i++) {
      lo = Math.min(lo, t.getX(i));
      hi = Math.max(hi, t.getX(i));
    }
    expect(lo).toBeCloseTo(0, 5);
    expect(hi).toBeCloseTo(1, 5);
  });
});

describe('a gente e as pipas da praia, no cenário', () => {
  it('são quatro desenhos (passantes, ciclistas, nadadores e pipas), todos instanciados e sem corpo físico', () => {
    const cena = new THREE.Scene();
    new PraiaGente(cena, criarUniformes().tempo);
    const malhas = desenhos(cena);
    expect(malhas.length).toBe(4);
    for (const m of malhas) expect(m).toBeInstanceOf(THREE.InstancedMesh);
    const triangulos = malhas.reduce((s, m) => s + ((m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position!.count) / 3) * (m as THREE.InstancedMesh).count, 0);
    expect(triangulos, 'poucos milhares de triângulos no total').toBeLessThan(16000);
  });

  it('a orla evacuada (a missão em ondas) apaga a gente e as pipas; voltar acende de novo', () => {
    const cena = new THREE.Scene();
    const gente = new PraiaGente(cena, criarUniformes().tempo);
    gente.setCivis(false);
    expect(desenhos(cena).every((m) => !m.visible)).toBe(true);
    gente.setCivis(true);
    expect(desenhos(cena).every((m) => m.visible)).toBe(true);
  });
});
