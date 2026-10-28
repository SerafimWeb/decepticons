import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Arena, PISO_DA_LUZ_DA_CIDADE } from './Arena';
import { ArenaQuadro } from './ArenaQuadro';
import { ARENA_QUADRO_DE_LUZ, ARENA_QUADRO_VOLUME } from './ArenaLayout';
import type { JanelasDoPredio } from './BuildingWindows';
import { Destructibles } from './Destructibles';
import { carregarMapaSeFor } from './mapasSobDemanda';
import { aparenciaDoQuadro } from './PraiaPorto';

const abertas: PhysicsWorld[] = [];
afterEach(() => {
  while (abertas.length) abertas.pop()!.world.free();
});

async function mundo() {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const scene = new THREE.Scene();
  const particles = { burst: () => {} } as never;
  const debris = { shatter: () => {} } as never;
  return { physics, scene, destructibles: new Destructibles(scene, physics, debris, particles) };
}

async function arena(transformador: boolean) {
  const m = await mundo();
  return { ...m, arena: new Arena(m.scene, m.physics, m.destructibles, 'arena', { transformador }) };
}

const janelasDoPrimeiroPredio = (a: Arena): JanelasDoPredio => a.occluders[0]!.material.userData.janelas as JanelasDoPredio;

describe('o desenho do transformador do Banco Vorcaris (P164, parte E)', () => {
  it('a cabine fica no lugar do layout, com o tamanho do volume, e tem colisor (bloqueia como as barricadas)', async () => {
    const { physics, scene } = await mundo();
    const antes = physics.world.colliders.len();
    const q = new ArenaQuadro(scene, physics);
    expect(physics.world.colliders.len()).toBe(antes + 1);
    expect(scene.children).toContain(q.raiz);
    q.raiz.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(q.raiz.children[0]!);
    const centro = caixa.getCenter(new THREE.Vector3());
    expect(centro.x).toBeCloseTo(ARENA_QUADRO_DE_LUZ.x, 5);
    expect(centro.z).toBeCloseTo(ARENA_QUADRO_DE_LUZ.z, 5);
    expect(caixa.max.x - caixa.min.x).toBeCloseTo(ARENA_QUADRO_VOLUME.w, 5);
    expect(caixa.max.y - caixa.min.y).toBeCloseTo(ARENA_QUADRO_VOLUME.h, 5);
    expect(caixa.min.y).toBeCloseTo(0, 5);
  });

  it('são quatro desenhos e nada mais: o corpo, as arestas, a tela e o farol (o teto de custo)', async () => {
    const { physics, scene } = await mundo();
    const q = new ArenaQuadro(scene, physics);
    expect(q.raiz.children).toHaveLength(4);
  });

  it('o farol passa do topo da cabine (dá para achar de longe) e a tela fica na face voltada para o meio da arena (+z)', async () => {
    const { physics, scene } = await mundo();
    const q = new ArenaQuadro(scene, physics);
    q.raiz.updateMatrixWorld(true);
    const [corpo, , tela, farol] = q.raiz.children as THREE.Mesh[];
    const topo = new THREE.Box3().setFromObject(corpo!).max.y;
    expect(new THREE.Box3().setFromObject(farol!).min.y).toBeGreaterThanOrEqual(topo - 1e-6);
    expect(new THREE.Box3().setFromObject(farol!).max.y).toBeGreaterThan(topo + 3);
    expect(tela!.position.z).toBeGreaterThan(ARENA_QUADRO_VOLUME.d / 2);
  });

  it('a tela e o farol leem a aparência do painel: verde ligado, laranja sabotado, vermelho apagado (e o apagado pisca)', async () => {
    const { physics, scene } = await mundo();
    const q = new ArenaQuadro(scene, physics);
    const tela = (q.raiz.children[2] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const farol = (q.raiz.children[3] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    for (const [estado, vida, t] of [[0, 1, 0], [1, 0.4, 0.3], [2, 0, 0.5]] as const) {
      q.atualiza(t, estado, vida);
      const a = aparenciaDoQuadro(estado, vida, t);
      expect(tela.emissive.getHex(), `tela do estado ${estado}`).toBe(a.cor);
      expect(tela.emissiveIntensity).toBeCloseTo(a.intensidade, 9);
    }
    q.atualiza(0, 0, 1);
    expect(farol.color.g, 'ligado: o farol é verde').toBeGreaterThan(farol.color.r);
    q.atualiza(0.5, 2, 0);
    expect(farol.color.r, 'apagado: o farol é vermelho').toBeGreaterThan(farol.color.g);
    const aceso = farol.color.r;
    q.atualiza(1.5, 2, 0); // a metade escura do pisca
    expect(farol.color.r).toBeLessThan(aceso);
  });
});

describe('a Arena com o transformador: a cidade escurece com a energia (P164, parte E)', () => {
  it('só quem pede tem o transformador: a Arena do Deathmatch, da Bandeira e do Domínio é a de sempre; o bunker e a praia ignoram o pedido', async () => {
    expect((await arena(false)).arena.transformador).toBeNull();
    expect((await arena(true)).arena.transformador).not.toBeNull();
    await carregarMapaSeFor('praia'); // o cenário da Praia é sob demanda (P228)
    for (const mapa of ['bunker', 'praia'] as const) {
      const m = await mundo();
      expect(new Arena(m.scene, m.physics, m.destructibles, mapa, { transformador: true }).transformador, mapa).toBeNull();
    }
  });

  it('o transformador acrescenta quatro desenhos e um colisor à arena, e nada mais', async () => {
    const sem = await arena(false);
    const com = await arena(true);
    const contar = (s: THREE.Scene): number => {
      let n = 0;
      s.traverse((o) => {
        if ((o as THREE.Mesh).isMesh || (o as THREE.LineSegments).isLineSegments) n++;
      });
      return n;
    };
    expect(contar(com.scene) - contar(sem.scene)).toBe(4);
    expect(com.physics.world.colliders.len() - sem.physics.world.colliders.len()).toBe(1);
  });

  it('sem energia as janelas, as faixas e o horizonte caem para o piso; com energia plena voltam exatamente às cores de fábrica', async () => {
    const { arena: a } = await arena(true);
    const j = janelasDoPrimeiroPredio(a);
    const base = j.windowColor.value.clone();
    const sodio = j.windowSodium.value.clone();
    a.setEnergia(0);
    expect(j.windowColor.value.r).toBeCloseTo(base.r * PISO_DA_LUZ_DA_CIDADE, 6);
    expect(j.windowColor.value.g).toBeCloseTo(base.g * PISO_DA_LUZ_DA_CIDADE, 6);
    expect(j.windowSodium.value.b).toBeCloseTo(sodio.b * PISO_DA_LUZ_DA_CIDADE, 6);
    a.setEnergia(1);
    expect(j.windowColor.value.equals(base)).toBe(true);
    expect(j.windowSodium.value.equals(sodio)).toBe(true);
  });

  it('a luz acompanha a energia de forma linear entre o piso e o pleno (meia energia = meio caminho)', async () => {
    const { arena: a } = await arena(true);
    const j = janelasDoPrimeiroPredio(a);
    const brilho = (c: THREE.Color): number => c.r + c.g + c.b; // o primeiro prédio é ciano (r = 0): o brilho é a soma dos canais
    const base = brilho(j.windowColor.value);
    expect(base).toBeGreaterThan(0);
    a.setEnergia(0.5);
    expect(brilho(j.windowColor.value)).toBeCloseTo(base * (PISO_DA_LUZ_DA_CIDADE + (1 - PISO_DA_LUZ_DA_CIDADE) * 0.5), 6);
    a.setEnergia(0.25);
    expect(brilho(j.windowColor.value)).toBeCloseTo(base * (PISO_DA_LUZ_DA_CIDADE + (1 - PISO_DA_LUZ_DA_CIDADE) * 0.25), 6);
  });

  it('as arestas e as faixas dos prédios escurecem junto, e o desenho das zonas some sem energia e volta com ela', async () => {
    const { arena: a, scene } = await arena(true);
    const arestas: THREE.LineBasicMaterial[] = [];
    const discos: THREE.Mesh[] = [];
    const horizonte: THREE.MeshBasicMaterial[] = [];
    scene.traverse((o) => {
      if ((o as THREE.LineSegments).isLineSegments) arestas.push((o as THREE.LineSegments).material as THREE.LineBasicMaterial);
      if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === 'CircleGeometry') discos.push(o as THREE.Mesh);
      if ((o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).material instanceof THREE.MeshBasicMaterial) horizonte.push((o as THREE.InstancedMesh).material as THREE.MeshBasicMaterial);
    });
    expect(arestas.length).toBeGreaterThanOrEqual(5); // 3 prédios + plataforma + rampa + (a torre Serafim e a grade, que ficam de fora)
    // As faixas de cada prédio e os LEDs da torre Serafim (que ficam de fora). A cidade em volta (P264) não mora mais na Arena: ela escurece
    // pelo uniforme que entrega a `registraLuzes` (`CidadeNeonCenario.test.ts`).
    expect(horizonte.length).toBeGreaterThanOrEqual(4);
    expect(discos).toHaveLength(2); // as duas zonas
    const brilho = (c: THREE.Color): number => c.r + c.g + c.b; // o ciano puro tem r = 0: o brilho é a soma dos canais
    const antesArestas = arestas.map((m) => brilho(m.color));
    const antesHorizonte = horizonte.map((m) => brilho(m.color));
    a.setEnergia(0);
    // as arestas dos três prédios, da plataforma e da rampa baixaram (a torre Serafim, a grade e o contorno ficam como são), e as faixas e o horizonte também
    expect(arestas.filter((m, i) => brilho(m.color) < antesArestas[i]! - 1e-6)).toHaveLength(5);
    // as faixas dos três prédios caem até o piso; os LEDs da torre Serafim (a base do time, com os modos próprios) não são da cidade
    const escurecidas = horizonte.map((m, i) => [m, i] as const).filter(([m, i]) => brilho(m.color) < antesHorizonte[i]! - 1e-6);
    expect(escurecidas).toHaveLength(3);
    for (const [m, i] of escurecidas) expect(brilho(m.color)).toBeCloseTo(antesHorizonte[i]! * PISO_DA_LUZ_DA_CIDADE, 6);
    for (const d of discos) expect(d.visible, 'sem energia as zonas somem').toBe(false);
    a.setEnergia(0.3);
    for (const d of discos) expect(d.visible, 'com um fio de energia elas voltam').toBe(true);
  });

  it('o que é aceso fora da Arena (a placa do banco) entra na mesma conta: registraLuzes o escurece com a energia e o devolve inteiro', async () => {
    const { arena: a } = await arena(true);
    const placa = new THREE.Color(2, 2, 2);
    const contorno = new THREE.Color(0.26, 0.55, 1).multiplyScalar(2.5);
    const contornoBase = contorno.clone();
    a.registraLuzes([placa, contorno]);
    a.setEnergia(0);
    expect(placa.r).toBeCloseTo(2 * PISO_DA_LUZ_DA_CIDADE, 6);
    expect(contorno.b).toBeCloseTo(contornoBase.b * PISO_DA_LUZ_DA_CIDADE, 6);
    a.setEnergia(1);
    expect(placa.equals(new THREE.Color(2, 2, 2))).toBe(true);
    expect(contorno.equals(contornoBase)).toBe(true);
  });

  it('sem o transformador (Deathmatch, Bandeira, Domínio) a energia não mexe em nada: a cidade e as zonas ficam como são', async () => {
    const { arena: a, scene } = await arena(false);
    const j = janelasDoPrimeiroPredio(a);
    const base = j.windowColor.value.clone();
    a.setEnergia(0);
    expect(j.windowColor.value.equals(base)).toBe(true);
    let discos = 0;
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === 'CircleGeometry') {
        discos++;
        expect(o.visible).toBe(true);
      }
    });
    expect(discos).toBe(2);
  });

  it('o painel anda com o relógio da Arena: setQuadro + update pintam a tela do estado (apagado pisca)', async () => {
    const { arena: a } = await arena(true);
    a.setQuadro(2, 0);
    a.update(0.5);
    const tela = (a.transformador!.raiz.children[2] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const esperado = aparenciaDoQuadro(2, 0, 0.5);
    expect(tela.emissive.getHex()).toBe(esperado.cor);
    expect(tela.emissiveIntensity).toBeCloseTo(esperado.intensidade, 9);
    a.setQuadro(0, 1);
    a.update(0.1);
    expect(tela.emissive.getHex()).toBe(aparenciaDoQuadro(0, 1, 0.6).cor);
  });
});
