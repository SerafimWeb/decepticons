import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Arena, PISO_DA_LUZ_DA_CIDADE } from './Arena';
import { CidadeNeonCenario } from './CidadeNeonCenario';
import { layoutDaCidade } from './CidadeNeonLayout';
import { HOLOGRAMA } from './HologramaSerafim';
import { SERAFIM_TOWER } from './SerafimTower';
import { Destructibles } from './Destructibles';
import { carregarCenarioDaCidade, cenarioDaCidadeCarregado } from './mapasSobDemanda';

const abertas: PhysicsWorld[] = [];
afterEach(() => {
  while (abertas.length) abertas.pop()!.world.free();
});

/** A Arena de sempre com a cidade em volta, montada no Node (sem canvas: a arte vira um pixel cinza e o resto monta igual). */
async function cidade(transformador = false) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const scene = new THREE.Scene();
  const particles = { burst: () => {} } as never;
  const debris = { shatter: () => {} } as never;
  const arena = new Arena(scene, physics, new Destructibles(scene, physics, debris, particles), 'arena', { transformador });
  const vapor: unknown[] = [];
  const cenario = new CidadeNeonCenario(scene, arena, { burst: (...a: unknown[]) => vapor.push(a) } as never);
  return { scene, arena, cenario, vapor };
}

/** Os materiais da cidade (os que leem a luz dela). */
function materiaisDaCidade(scene: THREE.Scene): THREE.ShaderMaterial[] {
  const lista: THREE.ShaderMaterial[] = [];
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (m instanceof THREE.ShaderMaterial && m.uniforms.uLuz) lista.push(m);
  });
  return lista;
}

describe('a cidade em volta da Cidade Neon (P264, PR2)', () => {
  it('troca a grade Tron pela rua desenhada e põe a cidade na cena', async () => {
    const { scene, arena } = await cidade();
    expect(arena.grade!.visible).toBe(false);
    expect((arena.chao!.material as THREE.Material).customProgramCacheKey()).toBe('cybermech-rua-v1');
    const nomes = new Set<string>();
    scene.traverse((o) => nomes.add(o.name));
    for (const n of ['cidade-torres', 'cidade-outdoors', 'cidade-outdoors-brilho', 'cidade-letreiros', 'cidade-neons', 'cidade-postes', 'cidade-chao-molhado', 'cidade-holograma']) expect(nomes.has(n), n).toBe(true);
  });

  it('a luz da cidade inteira cai com o transformador do banco e volta com ele', async () => {
    const { arena, cenario } = await cidade(true);
    arena.registraLuzes(cenario.luzes);
    const luz = cenario.luzes[0]!;
    arena.setEnergia(0);
    expect(luz.r).toBeCloseTo(PISO_DA_LUZ_DA_CIDADE, 6);
    expect(luz.b).toBeCloseTo(PISO_DA_LUZ_DA_CIDADE, 6);
    arena.setEnergia(1);
    expect(luz.r).toBeCloseTo(1, 6);
  });

  it('todo material da cidade lê a mesma luz e o mesmo relógio (o mesmo objeto, não uma cópia)', async () => {
    const { scene, cenario } = await cidade();
    const materiais = materiaisDaCidade(scene);
    // torres, outdoors, letreiros, desenhos, a luz dos postes, o rastro do reflexo e a poça de luz
    expect(materiais.length).toBeGreaterThanOrEqual(7);
    for (const m of materiais) expect(m.uniforms.uLuz!.value).toBe(cenario.luzes[0]);
    const relogio = materiais[0]!.uniforms.uTempo!;
    for (const m of materiais) expect(m.uniforms.uTempo).toBe(relogio);
    cenario.update(0.5);
    expect(relogio.value).toBeCloseTo(0.5, 6);
  });

  it('os bueiros soltam vapor no ParticleSystem da cena, cada um no seu tempo', async () => {
    const { cenario, vapor } = await cidade();
    for (let i = 0; i < 240; i++) cenario.update(1 / 60); // 4 s
    expect(vapor.length).toBeGreaterThanOrEqual(12);
  });

  it('a qualidade baixa tira o chão molhado, a grade de LEDs e o brilho dos outdoors e metade das fatias do holograma, e a alta os devolve', async () => {
    const { scene, cenario } = await cidade();
    const chao = scene.getObjectByName('cidade-chao-molhado')!;
    const brilho = scene.getObjectByName('cidade-outdoors-brilho')!;
    const painel = (scene.getObjectByName('cidade-outdoor-odp-olho') as THREE.Mesh).material as THREE.ShaderMaterial;
    const fatias = scene.getObjectByName('cidade-holograma-fatias') as THREE.InstancedMesh;
    const total = fatias.count;
    cenario.setDetalhe(false);
    expect(chao.visible).toBe(false);
    expect(brilho.visible).toBe(false);
    expect(painel.uniforms.uDetalhe!.value).toBe(0);
    expect(fatias.count).toBe(Math.ceil(total / 2));
    cenario.setDetalhe(true);
    expect(chao.visible).toBe(true);
    expect(brilho.visible).toBe(true);
    expect(painel.uniforms.uDetalhe!.value).toBe(1);
    expect(fatias.count).toBe(total);
  });

  it('os outdoors: uma malha por anúncio do catálogo que aparece, com tantas instâncias quanto o layout manda, e o que alterna leva as quatro imagens', async () => {
    const { scene } = await cidade();
    const layout = layoutDaCidade();
    const porAnuncio = new Map<string, number>();
    for (const o of layout.outdoors) porAnuncio.set(o.anuncio, (porAnuncio.get(o.anuncio) ?? 0) + 1);
    for (const [id, n] of porAnuncio) {
      const malha = scene.getObjectByName(`cidade-outdoor-${id}`) as THREE.InstancedMesh | undefined;
      expect(malha, id).toBeDefined();
      expect(malha!.count, id).toBe(n);
    }
    const familia = (scene.getObjectByName('cidade-outdoor-odp-familia') as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(familia.uniforms.uSlides!.value).toBe(4);
    expect(new Set([0, 1, 2, 3].map((i) => familia.uniforms[`uImagem${i}`]!.value)).size, 'quatro texturas distintas').toBe(4);
    const fixo = (scene.getObjectByName('cidade-outdoor-odp-gps') as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(fixo.uniforms.uSlides!.value).toBe(1);
  });

  it('o holograma flutua sobre o prédio Serafim (no ar, acima do teto, centrado nele), gira e balança sozinho', async () => {
    const { scene, cenario } = await cidade();
    const h = scene.getObjectByName('cidade-holograma')!;
    expect(h.position.x).toBe(SERAFIM_TOWER.x);
    expect(h.position.z).toBe(SERAFIM_TOWER.z);
    expect(h.position.y - HOLOGRAMA.tamanho / 2, 'a base do holograma fica acima do teto do prédio').toBeGreaterThan(SERAFIM_TOWER.height);
    const antes = h.rotation.y;
    cenario.update(1);
    expect(h.rotation.y).toBeCloseTo(antes + HOLOGRAMA.giro, 6);
    cenario.update(1);
    expect(h.rotation.y).toBeGreaterThan(antes + HOLOGRAMA.giro);
    expect(h.position.y).not.toBe(HOLOGRAMA.y); // o balanço
    expect(scene.getObjectByName('cidade-holograma-anel')).toBeDefined();
    expect(scene.getObjectByName('cidade-holograma-feixe')).toBeDefined();
  });

  it('o holograma desenha menos camadas quando a câmera está perto (custo de preenchimento) e todas quando está longe, sem mudar o brilho total', async () => {
    const { scene, cenario } = await cidade();
    const fatias = scene.getObjectByName('cidade-holograma-fatias') as THREE.InstancedMesh;
    const material = fatias.material as THREE.ShaderMaterial;
    const alfaCheio = material.uniforms.uAlfa!.value as number;
    const total = fatias.count;
    cenario.update(1 / 60, new THREE.Vector3(HOLOGRAMA.x, 4, HOLOGRAMA.z + 26)); // de baixo dele, no chão
    expect(fatias.count).toBeLessThan(total / 2);
    expect(material.uniforms.uFatias!.value, 'o shader espalha as camadas pelo número de agora').toBe(fatias.count);
    expect((material.uniforms.uAlfa!.value as number) * fatias.count, 'a soma do brilho não muda').toBeCloseTo(alfaCheio * total, 6);
    cenario.update(1 / 60, new THREE.Vector3(HOLOGRAMA.x - 400, 4, HOLOGRAMA.z)); // de longe
    expect(fatias.count).toBe(total);
    expect(material.uniforms.uAlfa!.value).toBeCloseTo(alfaCheio, 6);
    // Na qualidade baixa a rampa vale do mesmo jeito, sobre a metade.
    cenario.setDetalhe(false);
    expect(fatias.count).toBe(Math.ceil(total / 2));
  });

  it('o pedaço sob demanda entrega a fábrica da cidade', async () => {
    await carregarCenarioDaCidade();
    expect(cenarioDaCidadeCarregado()?.construir).toBeTypeOf('function');
  });
});
