import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Arena, PISO_DA_LUZ_DA_CIDADE } from './Arena';
import { CidadeNeonCenario } from './CidadeNeonCenario';
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
    for (const n of ['cidade-torres', 'cidade-teloes', 'cidade-letreiros', 'cidade-neons', 'cidade-postes', 'cidade-chao-molhado']) expect(nomes.has(n), n).toBe(true);
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
    // torres, telões, letreiros, desenhos, a luz dos postes, o rastro do reflexo e a poça de luz
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

  it('a qualidade baixa tira o chão molhado e a grade de LEDs dos telões, e a alta os devolve', async () => {
    const { scene, cenario } = await cidade();
    const chao = scene.getObjectByName('cidade-chao-molhado')!;
    const telao = (scene.getObjectByName('cidade-teloes') as THREE.Mesh).material as THREE.ShaderMaterial;
    cenario.setDetalhe(false);
    expect(chao.visible).toBe(false);
    expect(telao.uniforms.uDetalhe!.value).toBe(0);
    cenario.setDetalhe(true);
    expect(chao.visible).toBe(true);
    expect(telao.uniforms.uDetalhe!.value).toBe(1);
  });

  it('o pedaço sob demanda entrega a fábrica da cidade', async () => {
    await carregarCenarioDaCidade();
    expect(cenarioDaCidadeCarregado()?.construir).toBeTypeOf('function');
  });
});
