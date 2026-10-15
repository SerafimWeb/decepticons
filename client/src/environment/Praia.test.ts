import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Praia } from './Praia';
import { praiaAderecos } from './PraiaAderecos';
import { TETO_DE_COLISORES } from './PraiaColisores';
import { camadasDoTipo, TIPOS_COM_GEOMETRIA } from './PraiaGeometrias';

const abertas: PhysicsWorld[] = [];

describe('o construtor da PRAIA DOS CABOS (P127)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  async function montar() {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const scene = new THREE.Scene();
    const praia = new Praia(scene, physics);
    return { physics, scene, praia };
  }

  it('monta sem tela (Node, sem GL): o servidor e os testes montam o mesmo mapa', async () => {
    const { scene } = await montar();
    expect(scene.children.length).toBeGreaterThan(20);
    expect(scene.fog).not.toBeNull();
  });

  it('cabe no orçamento da ficha: poucos desenhos (um por material/camada) e menos de 310 colisores', async () => {
    const { physics, scene } = await montar();
    let desenhos = 0;
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) desenhos++;
    });
    expect(desenhos, 'desenhos da cena').toBeLessThanOrEqual(67); // o teto da faixa do Bunker (ficha cenario-cabos.md § 4)
    expect(desenhos).toBeGreaterThan(18);
    expect(physics.world.colliders.len(), 'colisores estáticos').toBeLessThan(TETO_DE_COLISORES);
  });

  it('todos os adereços juntos são poucos desenhos: uma malha estática por material, não um desenho por coqueiro', async () => {
    const { scene } = await montar();
    const palmeiras = praiaAderecos().filter((a) => a.tipo === 'palmeira').length;
    expect(palmeiras).toBeGreaterThan(100); // há muitas...
    // ...e as folhas delas (e as de todo o resto que balança) são UMA malha, com a fase do balanço por vértice.
    const comFase = scene.children.filter((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.attributes.aFase) as THREE.Mesh[];
    expect(comFase.length).toBeGreaterThanOrEqual(3);
    expect(comFase.length).toBeLessThanOrEqual(8);
    const folhas = comFase.find((m) => (m.material as THREE.Material).side === THREE.DoubleSide && m.geometry.attributes.position!.count > 10_000)!;
    expect(folhas, 'a malha das folhas').toBeDefined();
    // As palmas não balançam juntas: a fase muda de um coqueiro para outro.
    const fase = folhas.geometry.attributes.aFase!.array as Float32Array;
    expect(new Set(Array.from(fase.slice(0, 40_000))).size).toBeGreaterThan(20);
  });

  it('o único que muda por quadro é o tempo (o mar, as nuvens e as palmas leem dele): update não cria nada', async () => {
    const { praia, scene } = await montar();
    const antes = scene.children.length;
    praia.update(12.5);
    praia.update(12.6);
    expect(scene.children.length).toBe(antes);
  });

  it('a luz, as zonas e a gente entram como desenhos próprios, e a missão em ondas evacua a orla', async () => {
    const { praia, scene } = await montar();
    const malhas: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) malhas.push(o as THREE.Mesh);
    });
    const com = (atributo: string): THREE.Mesh[] => malhas.filter((m) => m.geometry.attributes[atributo]);
    expect(com('iDados').length, 'os halos de luz: um desenho').toBe(1);
    expect(com('iPoca').length, 'as poças de luz: um desenho').toBe(1);
    expect(com('iInfo').length, 'o chão das zonas: um desenho').toBe(1);
    expect(com('aRota').length, 'passantes, ciclistas e nadadores: três desenhos').toBe(3);
    expect(com('aPipa').length, 'as pipas: um desenho').toBe(1);
    const gente = [...com('aRota'), ...com('aPipa')];
    expect(gente.every((m) => m.visible)).toBe(true);
    praia.setCivis(false); // a missão em ondas: a orla está evacuada
    expect(gente.every((m) => !m.visible)).toBe(true);
    praia.setCivis(true);
    expect(gente.every((m) => m.visible)).toBe(true);
    // A qualidade baixa tira as poças de luz (acabamento) e deixa os halos e o chão das zonas (informação).
    praia.setDetalhe(false);
    expect(com('iPoca')[0]!.visible).toBe(false);
    expect(com('iDados')[0]!.visible).toBe(true);
    expect(com('iInfo')[0]!.visible).toBe(true);
    praia.setDetalhe(true);
  });

  it('o detalhe caro do céu e do mar liga e desliga com a qualidade (G12)', async () => {
    const { praia } = await montar();
    expect(() => praia.setDetalhe(false)).not.toThrow();
    expect(() => praia.setDetalhe(true)).not.toThrow();
  });
});

describe('as geometrias dos adereços (P127)', () => {
  it('todo tipo monta, com posição, normal e cor de vértice (o que o material espera) e sem número quebrado', () => {
    for (const tipo of TIPOS_COM_GEOMETRIA) {
      const camadas = camadasDoTipo(tipo);
      expect(camadas.length, tipo).toBeGreaterThanOrEqual(1);
      for (const c of camadas) {
        const g = c.geo;
        for (const nome of ['position', 'normal', 'color']) expect(g.attributes[nome], `${tipo}: ${nome}`).toBeDefined();
        const p = g.attributes.position!.array as Float32Array;
        for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i]!)) throw new Error(`${tipo}: vértice quebrado em ${i}`);
        expect(g.attributes.position!.count % 3, `${tipo}: triângulos inteiros`).toBe(0);
      }
    }
  });

  it('o custo em triângulos de cada tipo é contido (G12): o coqueiro, que há mais de cem, é leve', () => {
    const triangulos = (tipo: Parameters<typeof camadasDoTipo>[0]): number => camadasDoTipo(tipo).reduce((n, c) => n + c.geo.attributes.position!.count / 3, 0);
    expect(triangulos('palmeira')).toBeLessThan(260);
    expect(triangulos('guardasol')).toBeLessThan(120);
    expect(triangulos('carro')).toBeLessThan(260);
    for (const tipo of TIPOS_COM_GEOMETRIA) expect(triangulos(tipo), tipo).toBeLessThan(2400);
    // O total que a cena gasta nos adereços (cada instância repete a malha do tipo).
    const total = praiaAderecos().reduce((n, a) => n + triangulos(a.tipo), 0);
    expect(total).toBeLessThan(90_000);
  });

  it('as medidas batem com o mundo: o coqueiro tem ~10 m, o carro ~4,5 m, o farol passa dos 35 m, o guindaste dos 30 m', () => {
    const altura = (tipo: Parameters<typeof camadasDoTipo>[0]): number => {
      let max = -Infinity;
      for (const c of camadasDoTipo(tipo)) {
        c.geo.computeBoundingBox();
        max = Math.max(max, c.geo.boundingBox!.max.y);
      }
      return max;
    };
    expect(altura('palmeira')).toBeGreaterThan(9);
    expect(altura('palmeira')).toBeLessThan(14);
    expect(altura('carro')).toBeLessThan(2);
    expect(altura('farol')).toBeGreaterThan(35);
    expect(altura('guindaste')).toBeGreaterThan(30);
    expect(altura('antena')).toBeGreaterThan(44);
  });
});
