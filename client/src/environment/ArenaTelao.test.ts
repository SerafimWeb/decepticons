import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Arena } from './Arena';
import { ALCANCE_DO_TELAO, deveTocar, TIER_SEM_VIDEO } from './ArenaTelao';
import { ARENA_TELAO_1, ARENA_TELAO_2 } from './ArenaLayout';
import { Destructibles } from './Destructibles';
import type { MapId } from './Bunker';
import { carregarMapaSeFor } from './mapasSobDemanda';

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

async function arena(mapa: MapId) {
  const m = await mundo();
  return { ...m, arena: new Arena(m.scene, m.physics, m.destructibles, mapa) };
}

describe('os telões diegéticos da Cidade Neon (P246)', () => {
  it('só a Cidade Neon tem telão: a praia e o bunker (que retornam antes, no construtor) ficam sem — o mesmo ramo que já guarda o transformador guarda o telão', async () => {
    expect((await arena('arena')).arena.telao).not.toBeNull();
    await carregarMapaSeFor('praia'); // sob demanda (P228)
    for (const mapa of ['praia', 'bunker'] as MapId[]) {
      expect((await arena(mapa)).arena.telao, mapa).toBeNull();
    }
  });

  it('as duas telas nascem no lugar do layout (a fachada que já existe é quem bloqueia; o telão não acrescenta colisor próprio)', async () => {
    const { scene, arena: a } = await arena('arena');
    expect(a.telao).not.toBeNull();
    const nasPosicoes = [ARENA_TELAO_1, ARENA_TELAO_2].every((p) => scene.children.some((o) => o instanceof THREE.Group && o.position.x === p.x && o.position.y === p.y && o.position.z === p.z));
    expect(nasPosicoes, 'as duas telas, cada uma no lugar do layout').toBe(true);
  });

  it('sem vídeo atribuído (o caso de sempre antes do Comandante gravar algo), atualizar nunca lança e não faz nada', async () => {
    const { arena: a } = await arena('arena');
    expect(() => {
      for (let i = 0; i < 120; i++) a.telao!.atualizar(0.016, new THREE.Vector3(ARENA_TELAO_1.x, ARENA_TELAO_1.y, ARENA_TELAO_1.z), 0);
    }).not.toThrow();
  });
});

describe('deveTocar: a decisão pura de tocar vídeo (distância + degrau de qualidade, G12)', () => {
  it('toca perto e com qualidade cheia; não toca longe, nem a partir do degrau que corta vídeo', () => {
    expect(deveTocar(0, 0)).toBe(true);
    expect(deveTocar(ALCANCE_DO_TELAO - 1, 0)).toBe(true);
    expect(deveTocar(ALCANCE_DO_TELAO, 0)).toBe(false); // fronteira: exclusiva
    expect(deveTocar(ALCANCE_DO_TELAO + 50, 0)).toBe(false);
    expect(deveTocar(0, TIER_SEM_VIDEO)).toBe(false); // perto, mas a qualidade já cortou
    expect(deveTocar(0, TIER_SEM_VIDEO - 1)).toBe(true);
  });
});
