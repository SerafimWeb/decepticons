import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { BARRICADES_DA_ARENA } from './Arena';
import { Destructibles, type DestructibleDef } from './Destructibles';
import { criarSupercomputadores, montarSupercomputador, varianteDe, type VarianteDeServidor } from './Supercomputadores';

const abertas: PhysicsWorld[] = [];
afterEach(() => {
  while (abertas.length) abertas.pop()!.world.free();
});

const triangulos = (g: THREE.BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const caixaDe = (def: Pick<DestructibleDef, 'w' | 'd' | 'h'>) => ({ x: def.w / 2, y: def.h / 2, z: def.d / 2 });
const finito = (g: THREE.BufferGeometry): boolean => {
  for (const nome of ['position', 'normal', 'color']) {
    const a = g.getAttribute(nome);
    if (!a) return false;
    for (const v of a.array) if (!Number.isFinite(v)) return false;
  }
  return true;
};
/** O maior valor de cor (HDR) de cada vértice de uma geometria. */
const brilhos = (g: THREE.BufferGeometry): number[] => {
  const c = g.getAttribute('color');
  const out: number[] = [];
  for (let i = 0; i < c.count; i++) out.push(Math.max(c.getX(i), c.getY(i), c.getZ(i)));
  return out;
};

describe('os supercomputadores da praça (P272): a máquina de cada barricada', () => {
  it('cada tamanho de barricada vira uma máquina pelo formato, e a praça tem as quatro (mini-Mac, rack, nó quântico e banco)', () => {
    const variantes = BARRICADES_DA_ARENA.map((b) => varianteDe(b));
    expect(new Set(variantes)).toEqual(new Set<VarianteDeServidor>(['minimac', 'rack', 'noQuantico', 'banco']));
    // Por tamanho: lajes viram mini-Macs (nos dois sentidos), a torre fina é rack, a parede comprida é banco, o cubo é nó.
    expect(varianteDe({ w: 8, d: 2, h: 2.2 })).toBe('minimac');
    expect(varianteDe({ w: 2, d: 8, h: 2.2 })).toBe('minimac');
    expect(varianteDe({ w: 3, d: 3, h: 6 })).toBe('rack');
    expect(varianteDe({ w: 12, d: 1.5, h: 4 })).toBe('banco');
    expect(varianteDe({ w: 6, d: 6, h: 3.5 })).toBe('noQuantico');
    expect(varianteDe({ w: 4, d: 4, h: 3.6 })).toBe('noQuantico'); // o quiosque
  });

  it('o desenho cabe EXATAMENTE no colisor: nada sai da caixa e preenche (quase) as três medidas (só desenho: o que o tiro acerta não muda)', () => {
    for (const def of BARRICADES_DA_ARENA) {
      const m = montarSupercomputador(def);
      const box = new THREE.Box3().union(m.corpo.boundingBox!).union(m.luz.boundingBox!);
      const meia = caixaDe(def);
      const e = 1e-3;
      const nome = `${m.variante} ${def.w}x${def.d}x${def.h}`;
      expect(box.max.x, nome).toBeLessThanOrEqual(meia.x + e);
      expect(box.min.x, nome).toBeGreaterThanOrEqual(-meia.x - e);
      expect(box.max.y, nome).toBeLessThanOrEqual(meia.y + e);
      expect(box.min.y, nome).toBeGreaterThanOrEqual(-meia.y - e);
      expect(box.max.z, nome).toBeLessThanOrEqual(meia.z + e);
      expect(box.min.z, nome).toBeGreaterThanOrEqual(-meia.z - e);
      const tam = box.getSize(new THREE.Vector3());
      expect(tam.x, nome).toBeGreaterThanOrEqual(def.w * 0.94);
      expect(tam.y, nome).toBeGreaterThanOrEqual(def.h * 0.94);
      expect(tam.z, nome).toBeGreaterThanOrEqual(def.d * 0.94);
    }
  });

  it('o custo é o combinado: poucos milhares de triângulos por máquina, e a praça inteira numa conta curta', () => {
    let total = 0;
    for (const def of BARRICADES_DA_ARENA) {
      const m = montarSupercomputador(def);
      const t = triangulos(m.corpo) + triangulos(m.luz);
      expect(t, `${m.variante} ${def.w}x${def.d}x${def.h}`).toBeLessThan(2400);
      total += t;
    }
    expect(total).toBeLessThan(14_000);
  });

  it('as luzes passam do limiar do bloom: LEDs acima de 3 (os que respiram) e linhas de acento entre 1 e 3 (as que ficam firmes) em toda máquina; nada vira NaN', () => {
    for (const def of BARRICADES_DA_ARENA) {
      const m = montarSupercomputador(def);
      const nome = `${m.variante} ${def.w}x${def.d}x${def.h}`;
      expect(finito(m.corpo), nome).toBe(true);
      expect(finito(m.luz), nome).toBe(true);
      const l = brilhos(m.luz);
      expect(l.some((v) => v > 3), `${nome}: sem LED`).toBe(true);
      expect(l.some((v) => v > 1 && v <= 3), `${nome}: sem linha de acento`).toBe(true);
      // O corpo não passa de 1: quem acende é a luz da cena, não o material.
      expect(Math.max(...brilhos(m.corpo)), nome).toBeLessThanOrEqual(1.0001);
    }
  });

  it('é determinístico (a mesma barricada dá sempre a mesma máquina: cliente e cliente veem a mesma) e a laje comprida em Z é a de X girada', () => {
    const def = BARRICADES_DA_ARENA[0]!;
    const a = montarSupercomputador(def);
    const b = montarSupercomputador({ ...def });
    expect(Array.from(a.corpo.getAttribute('position').array)).toEqual(Array.from(b.corpo.getAttribute('position').array));
    expect(Array.from(a.luz.getAttribute('color').array)).toEqual(Array.from(b.luz.getAttribute('color').array));
    const x = montarSupercomputador({ w: 8, d: 2, h: 2.2, accent: 0x00ffff });
    const z = montarSupercomputador({ w: 2, d: 8, h: 2.2, accent: 0x00ffff });
    expect(triangulos(x.corpo)).toBe(triangulos(z.corpo));
    const tz = z.corpo.boundingBox!.getSize(new THREE.Vector3());
    expect(tz.z).toBeGreaterThan(tz.x * 3);
  });

  it('tamanhos fora do comum nunca lançam nem geram NaN: o miúdo vira uma caixa lisa com filete, o enorme segue a mesma receita', () => {
    for (const [w, d, h] of [[0.5, 0.5, 0.5], [1, 1, 1], [0.1, 9, 0.2], [30, 30, 30], [100, 1, 1], [1.5, 1.5, 9], [5, 5, 2.4]] as const) {
      const m = montarSupercomputador({ w, d, h, accent: 0xff00ff });
      expect(finito(m.corpo), `${w}x${d}x${h}`).toBe(true);
      expect(finito(m.luz), `${w}x${d}x${h}`).toBe(true);
      const box = new THREE.Box3().union(m.corpo.boundingBox!).union(m.luz.boundingBox!);
      expect(box.max.x).toBeLessThanOrEqual(w / 2 + 1e-3);
      expect(box.max.y).toBeLessThanOrEqual(h / 2 + 1e-3);
      expect(box.max.z).toBeLessThanOrEqual(d / 2 + 1e-3);
    }
  });
});

describe('o estilo nas barricadas e o shader das luzes', () => {
  it('o piscar é do shader, pelo relógio da cidade (o mesmo uniforme), e não tem pow, sqrt nem log: nada que vire NaN na GPU', () => {
    const relogio = { value: 0 };
    const criados = criarSupercomputadores(relogio);
    const grupo = criados.estilo({ x: 0, z: 0, w: 3, d: 3, h: 6, accent: 0x39ff6a, hp: 500 })!;
    const luz = grupo.children[1] as THREE.Mesh;
    const material = luz.material as THREE.MeshBasicMaterial;
    const sombreador = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
    material.onBeforeCompile(sombreador as never, {} as never);
    expect(sombreador.uniforms.uTempo).toBe(relogio); // a mesma referência: a cidade avança o relógio e os LEDs respiram, sem nada por quadro aqui
    const glsl = sombreador.vertexShader + sombreador.fragmentShader;
    expect(glsl).toContain('uTempo');
    expect(glsl).not.toMatch(/\b(pow|sqrt|log|log2|inversesqrt)\s*\(/);
    // A luz entra na energia da cidade (o transformador do banco a escurece) e só os LEDs respiram (o limiar do shader é o da conta de brilho).
    expect(criados.luzes).toEqual([material.color]);
    expect(glsl).toContain('step(3.0');
    expect(material.toneMapped).toBe(false);
    criados.dispose();
  });

  it('Destructibles.estilizar troca o corpo das barricadas em pé, deixa as arestas e o colisor, e vale também para a que volta na rodada nova (sem refazer a geometria)', async () => {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const scene = new THREE.Scene();
    const debris = { shatter: () => {} } as never;
    const particles = { burst: () => {} } as never;
    const d = new Destructibles(scene, physics, debris, particles);
    const defs: DestructibleDef[] = [
      { x: -8, z: 0, w: 8, d: 2, h: 2.2, accent: 0xaaff00, hp: 400 },
      { x: 22, z: 30, w: 3, d: 3, h: 6, accent: 0x39ff6a, hp: 500 },
    ];
    for (const def of defs) d.add(def);
    const grupos = (): THREE.Group[] => scene.children.filter((o): o is THREE.Group => o instanceof THREE.Group);
    /** O corpo de um grupo de barricada (o que não é a linha das arestas); a ordem dentro do grupo não importa. */
    const corpoDe = (g: THREE.Group): THREE.Object3D => g.children.find((c) => c.type !== 'LineSegments')!;
    expect(grupos()).toHaveLength(2);
    for (const g of grupos()) expect(g.children.map((c) => c.type).sort()).toEqual(['LineSegments', 'Mesh']); // a caixa de sempre + as arestas

    const criados = criarSupercomputadores({ value: 0 });
    d.estilizar(criados.estilo);
    expect(criados.desenhadas()).toBe(2);
    for (const g of grupos()) {
      expect(g.children).toHaveLength(2); // o corpo (agora o grupo da máquina) + as arestas
      expect(corpoDe(g).type).toBe('Group');
      expect(g.children.filter((c) => c.type === 'LineSegments')).toHaveLength(1);
    }
    expect(d.standingIds()).toEqual([0, 1]);

    // A barricada quebra e volta na rodada nova: volta com o desenho de máquina, e a geometria é a mesma (o cache), não outra.
    const antes = ((corpoDe(grupos()[0]!) as THREE.Group).children[0] as THREE.Mesh).geometry;
    d.breakById(0);
    expect(d.standingIds()).toEqual([1]);
    d.restoreAll();
    expect(d.standingIds()).toEqual([0, 1]);
    const depois = grupos().map((g) => ((corpoDe(g) as THREE.Group).children[0] as THREE.Mesh).geometry);
    expect(depois).toContain(antes);
    for (const g of grupos()) expect(corpoDe(g).type).toBe('Group');

    // Voltar ao estilo `null` devolve a caixa de sempre.
    d.estilizar(null);
    for (const g of grupos()) expect(corpoDe(g).type).toBe('Mesh');
    criados.dispose();
  });
});
