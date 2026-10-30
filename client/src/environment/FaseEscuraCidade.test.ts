import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Arena, PISO_DA_LUZ_DA_CIDADE, PISO_DA_LUZ_NO_ESCURO } from './Arena';
import { CidadeNeonCenario } from './CidadeNeonCenario';
import { Destructibles } from './Destructibles';
import type { JanelasDoPredio } from './BuildingWindows';

const abertas: PhysicsWorld[] = [];
afterEach(() => {
  while (abertas.length) abertas.pop()!.world.free();
});
beforeAll(async () => {
  await RAPIER.init();
});

/** A Arena da Cidade Neon montada no Node; `transformador` liga o quadro da missão em ondas. */
async function mundo(transformador: boolean) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const scene = new THREE.Scene();
  const particles = { burst: () => {} } as never;
  const debris = { shatter: () => {} } as never;
  const destructibles = new Destructibles(scene, physics, debris, particles);
  const arena = new Arena(scene, physics, destructibles, 'arena', { transformador });
  return { physics, scene, destructibles, arena };
}

const janelasDoPrimeiroPredio = (a: Arena): JanelasDoPredio => a.occluders[0]!.material!.userData.janelas as JanelasDoPredio;
const brilho = (c: THREE.Color): number => c.r + c.g + c.b;
const contorno = (d: Destructibles, id: number): THREE.Color => (d as unknown as { byId: Map<number, { edgeMat: THREE.LineBasicMaterial }> }).byId.get(id)!.edgeMat.color;

describe('a cidade às escuras (P282): as luzes neon caem com a escuridão, em qualquer modo', () => {
  it('na escuridão total as janelas e as faixas caem ao piso do escuro (menor que o do transformador); sem escuridão voltam exatamente às de fábrica', async () => {
    const { arena } = await mundo(false); // sem transformador: o Deathmatch e a Bandeira também escurecem
    const j = janelasDoPrimeiroPredio(arena);
    const base = j.windowColor.value.clone();
    const sodio = j.windowSodium.value.clone();
    arena.setEscuridao(1);
    expect(j.windowColor.value.g).toBeCloseTo(base.g * PISO_DA_LUZ_NO_ESCURO, 6);
    expect(j.windowSodium.value.b).toBeCloseTo(sodio.b * PISO_DA_LUZ_NO_ESCURO, 6);
    expect(PISO_DA_LUZ_NO_ESCURO).toBeLessThan(PISO_DA_LUZ_DA_CIDADE);
    arena.setEscuridao(0);
    expect(j.windowColor.value.equals(base)).toBe(true);
    expect(j.windowSodium.value.equals(sodio)).toBe(true);
  });

  it('a luz acompanha a escuridão em rampa: meia escuridão fica entre o dia e o piso', async () => {
    const { arena } = await mundo(false);
    const j = janelasDoPrimeiroPredio(arena);
    const dia = brilho(j.windowColor.value);
    arena.setEscuridao(0.5);
    expect(brilho(j.windowColor.value)).toBeCloseTo(dia * (1 - 0.5 * (1 - PISO_DA_LUZ_NO_ESCURO)), 6);
  });

  it('vale o menor entre a luz da energia do transformador e a da escuridão (a escuridão não acende o que o quadro já apagou)', async () => {
    const { arena } = await mundo(true);
    const j = janelasDoPrimeiroPredio(arena);
    const dia = brilho(j.windowColor.value);
    arena.setEnergia(0); // quadro apagado: piso do transformador
    expect(brilho(j.windowColor.value)).toBeCloseTo(dia * PISO_DA_LUZ_DA_CIDADE, 6);
    arena.setEscuridao(0.2); // a escuridão sozinha deixaria 0,806: vale o piso do transformador
    expect(brilho(j.windowColor.value)).toBeCloseTo(dia * PISO_DA_LUZ_DA_CIDADE, 6);
    arena.setEscuridao(1); // e a escuridão total derruba mais que o quadro apagado
    expect(brilho(j.windowColor.value)).toBeCloseTo(dia * PISO_DA_LUZ_NO_ESCURO, 6);
    arena.setEnergia(1);
    arena.setEscuridao(0);
    expect(brilho(j.windowColor.value)).toBeCloseTo(dia, 6);
  });

  it('as zonas de cura e resfriamento e a borda do chão apagam só com a escuridão (a energia do transformador não mexe nelas)', async () => {
    const { arena, scene } = await mundo(true);
    const neons: THREE.Color[] = [];
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      // Só o que a escuridão apaga sozinha: o anel (Line) e o disco das zonas e a borda do chão (LineLoop). As arestas dos prédios são LineSegments e seguem a energia do transformador.
      const ehZonaOuBorda = o.constructor === THREE.Line || o.constructor === THREE.LineLoop || (o instanceof THREE.Mesh && (o.geometry as THREE.BufferGeometry).type === 'CircleGeometry');
      if (ehZonaOuBorda && m && 'color' in m) neons.push((m as THREE.LineBasicMaterial).color);
    });
    expect(neons.length).toBeGreaterThanOrEqual(5);
    const antes = neons.map((c) => c.clone());
    arena.setEnergia(0);
    expect(neons.every((c, i) => c.equals(antes[i]!))).toBe(true); // o quadro apagado não mexe nelas (elas somem por `visible`)
    arena.setEscuridao(1);
    expect(neons.every((c, i) => brilho(c) < brilho(antes[i]!) * 0.5)).toBe(true);
    arena.setEscuridao(0);
    expect(neons.every((c, i) => c.equals(antes[i]!))).toBe(true);
  });

  it('o contorno das caixas e os telões seguem a escuridão: apagam no escuro total e voltam ao neon de fábrica', async () => {
    const { arena, destructibles } = await mundo(false);
    expect(destructibles.standingIds().length).toBeGreaterThan(0);
    const c0 = contorno(destructibles, 0);
    const dia = c0.clone();
    arena.setEscuridao(1);
    expect(c0.g).toBeCloseTo(dia.g * PISO_DA_LUZ_NO_ESCURO, 6);
    arena.setEscuridao(0);
    expect(c0.equals(dia)).toBe(true);
    const telao = arena.telao!;
    arena.setEscuridao(0.4);
    expect((telao as unknown as { ligado: boolean }).ligado).toBe(true);
    arena.setEscuridao(0.5);
    expect((telao as unknown as { ligado: boolean }).ligado).toBe(false);
    arena.setEscuridao(0);
    expect((telao as unknown as { ligado: boolean }).ligado).toBe(true);
  });

  it('o valor torto (NaN) não apaga a cidade por engano; o mapa que não é a Cidade Neon ignora', async () => {
    const { arena } = await mundo(false);
    const j = janelasDoPrimeiroPredio(arena);
    const base = j.windowColor.value.clone();
    arena.setEscuridao(Number.NaN);
    expect(j.windowColor.value.equals(base)).toBe(true);
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const scene = new THREE.Scene();
    const bunker = new Arena(scene, physics, new Destructibles(scene, physics, { shatter: () => {} } as never, { burst: () => {} } as never), 'bunker');
    expect(() => bunker.setEscuridao(1)).not.toThrow();
  });
});

describe('os contornos das caixas (Destructibles.setLuz)', () => {
  async function caixas() {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const d = new Destructibles(new THREE.Scene(), physics, { shatter: () => {} } as never, { burst: () => {} } as never);
    d.add({ x: 0, z: -10, w: 4, d: 1, h: 2, accent: 0x00ff00, hp: 100 });
    d.add({ x: 20, z: -10, w: 4, d: 1, h: 2, accent: 0x00ff00, hp: 100 });
    return d;
  }

  it('baixa o neon das caixas em pé e o devolve exato; o piso nunca chega a zero', async () => {
    const d = await caixas();
    const dia = contorno(d, 0).clone();
    d.setLuz(0.5);
    expect(contorno(d, 0).g).toBeCloseTo(dia.g * 0.5, 6);
    d.setLuz(0);
    expect(contorno(d, 0).g).toBeCloseTo(dia.g * 0.005, 6); // o piso de 0,5% mantém a conta reversível
    d.setLuz(1);
    expect(contorno(d, 0).g).toBeCloseTo(dia.g, 6);
    d.setLuz(Number.NaN);
    expect(contorno(d, 0).g).toBeCloseTo(dia.g, 6);
  });

  it('a caixa que quebra e volta na rodada nova volta com a luz de agora, não com o neon de fábrica', async () => {
    const d = await caixas();
    const dia = contorno(d, 1).clone();
    d.setLuz(0.1);
    d.breakById(1);
    d.restoreAll();
    expect(contorno(d, 1).g).toBeCloseTo(dia.g * 0.1, 6);
  });

  it('o vermelho do dano também apaga no escuro (a caixa avariada não vira o único farol da cidade)', async () => {
    const d = await caixas();
    d.setLuz(0.1);
    const physics = (d as unknown as { physics: PhysicsWorld }).physics;
    physics.step();
    const hit = physics.raycast(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), 50)!;
    d.damage(hit.collider, 60, new THREE.Vector3(0, 0, 1));
    const c = contorno(d, 0);
    expect(c.r).toBeLessThan(3 * 0.5); // o vermelho de fábrica (3) sairia perto de 1,8 aqui; apagado, bem abaixo
  });
});

describe('o holograma do prédio Serafim se apaga com a cidade', () => {
  it('a partir de metade da escuridão o holograma, o anel e o feixe somem; com luz voltam', async () => {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const scene = new THREE.Scene();
    const arena = new Arena(scene, physics, new Destructibles(scene, physics, { shatter: () => {} } as never, { burst: () => {} } as never), 'arena');
    const cenario = new CidadeNeonCenario(scene, arena, { burst: () => {} } as never);
    const partes = ['cidade-holograma', 'cidade-holograma-anel', 'cidade-holograma-feixe'].map((n) => scene.getObjectByName(n)!);
    expect(partes.every((p) => p?.visible)).toBe(true);
    cenario.setEscuridao(0.3);
    expect(partes.every((p) => p.visible)).toBe(true);
    cenario.setEscuridao(1);
    expect(partes.every((p) => !p.visible)).toBe(true);
    cenario.setEscuridao(0);
    expect(partes.every((p) => p.visible)).toBe(true);
  });
});
