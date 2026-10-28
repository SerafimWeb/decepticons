import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Arena } from './Arena';
import { ALCANCE_DO_TELAO, deveAtualizarTela, TIER_SEM_VIDEO } from './ArenaTelao';
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

/** Um `WebGLRenderer` de mentira: só os dois métodos que `renderizarCameras` chama, como espiões (sem GPU: Node não tem contexto WebGL). */
function rendererFalso() {
  const render = vi.fn();
  const setRenderTarget = vi.fn();
  return { render, setRenderTarget, three: { render, setRenderTarget } as unknown as THREE.WebGLRenderer };
}

const PERTO = new THREE.Vector3(ARENA_TELAO_1.x, ARENA_TELAO_1.y, ARENA_TELAO_1.z);
const LONGE = new THREE.Vector3(ARENA_TELAO_1.x + 1000, ARENA_TELAO_1.y, ARENA_TELAO_1.z);

describe('os telões diegéticos da Cidade Neon (P246/P254)', () => {
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

  it('sem nada atribuído (o caso de sempre antes do Comandante gravar algo), atualizar e renderizarCameras nunca lançam e não fazem nada', async () => {
    const { arena: a, scene } = await arena('arena');
    const { render, setRenderTarget, three } = rendererFalso();
    expect(() => {
      for (let i = 0; i < 120; i++) a.telao!.atualizar(0.016, PERTO, 0);
      a.telao!.renderizarCameras(three, scene);
    }).not.toThrow();
    expect(render, 'nenhuma tela em modo câmera: nada para desenhar').not.toHaveBeenCalled();
    expect(setRenderTarget).not.toHaveBeenCalled();
  });

  it('câmera ao vivo (P254): perto, redesenha a cena nessa tela a cada ~0,5 s; longe, ou em qualidade baixa, não redesenha', async () => {
    const { arena: a, scene } = await arena('arena');
    await a.telao!.carregar('ws://127.0.0.1:0', async () => ({ ok: true, json: async () => ({ versao: 1, itens: { 'arena:telao-1': { tipo: 'camera' } } }) }) as unknown as Response);

    const { render, setRenderTarget, three } = rendererFalso();
    // Antes de 0,5 s acumulado, a decisão ainda não rodou.
    a.telao!.atualizar(0.1, PERTO, 0);
    a.telao!.renderizarCameras(three, scene);
    expect(render).not.toHaveBeenCalled();

    // Acumula até passar do intervalo: perto, tier bom — desenha.
    a.telao!.atualizar(0.5, PERTO, 0);
    a.telao!.renderizarCameras(three, scene);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(scene, expect.any(THREE.PerspectiveCamera));
    expect(setRenderTarget).toHaveBeenNthCalledWith(2, null); // o alvo da tela, depois null no fim

    // Longe: a próxima decisão desliga.
    render.mockClear();
    a.telao!.atualizar(0.5, LONGE, 0);
    a.telao!.renderizarCameras(three, scene);
    expect(render, 'longe: a tela não redesenha mais').not.toHaveBeenCalled();

    // Perto de novo, mas tier alto (qualidade caída): também não redesenha (G12).
    render.mockClear();
    a.telao!.atualizar(0.5, PERTO, TIER_SEM_VIDEO);
    a.telao!.renderizarCameras(three, scene);
    expect(render, 'qualidade baixa: nunca redesenha').not.toHaveBeenCalled();
  });

  it('trocar de câmera para desligada solta a câmera e o alvo (a tela volta a ficar sem sinal, sem lançar)', async () => {
    const { arena: a, scene } = await arena('arena');
    const config = { versao: 1, itens: { 'arena:telao-1': { tipo: 'camera' } } };
    await a.telao!.carregar('ws://127.0.0.1:0', async () => ({ ok: true, json: async () => config }) as unknown as Response);
    a.telao!.atualizar(0.5, PERTO, 0);
    const { render, three } = rendererFalso();
    a.telao!.renderizarCameras(three, scene);
    expect(render).toHaveBeenCalledTimes(1);

    await a.telao!.carregar('ws://127.0.0.1:0', async () => ({ ok: true, json: async () => ({ versao: 2, itens: { 'arena:telao-1': null } }) }) as unknown as Response);
    render.mockClear();
    a.telao!.atualizar(0.5, PERTO, 0);
    expect(() => a.telao!.renderizarCameras(three, scene)).not.toThrow();
    expect(render, 'desligada: nada para desenhar mais').not.toHaveBeenCalled();
  });
});

describe('o vídeo do telão sai da base do jogo, não da raiz do site (achado no site publicado em 28/10: 404 em /telao/)', () => {
  it('o endereço do clipe começa na base do jogo (BASE_URL), nunca em "/telao/" absoluto', async () => {
    vi.stubEnv('BASE_URL', '/jogar/'); // a base do site publicado: o jogo vive em /jogar/, os clipes em /jogar/telao/
    const criados: { src: string }[] = [];
    vi.stubGlobal('document', {
      createElement: () => {
        const v = { src: '', addEventListener: () => {}, readyState: 4, pause: () => {}, removeAttribute: () => {}, load: () => {} };
        criados.push(v);
        return v;
      },
    });
    try {
      const { arena: a } = await arena('arena');
      const config = { versao: 1, itens: { 'arena:telao-1': { tipo: 'video', arquivo: 'arena-clip2.mp4' } } };
      await a.telao!.carregar('ws://127.0.0.1:0', async () => ({ ok: true, json: async () => config }) as unknown as Response);
      expect(criados).toHaveLength(1);
      expect(criados[0]!.src).toBe('/jogar/telao/arena-clip2.mp4');
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});

describe('deveAtualizarTela: a decisão pura de tocar vídeo ou redesenhar a câmera (distância + degrau de qualidade, G12)', () => {
  it('atualiza perto e com qualidade cheia; não atualiza longe, nem a partir do degrau que corta vídeo/câmera', () => {
    expect(deveAtualizarTela(0, 0)).toBe(true);
    expect(deveAtualizarTela(ALCANCE_DO_TELAO - 1, 0)).toBe(true);
    expect(deveAtualizarTela(ALCANCE_DO_TELAO, 0)).toBe(false); // fronteira: exclusiva
    expect(deveAtualizarTela(ALCANCE_DO_TELAO + 50, 0)).toBe(false);
    expect(deveAtualizarTela(0, TIER_SEM_VIDEO)).toBe(false); // perto, mas a qualidade já cortou
    expect(deveAtualizarTela(0, TIER_SEM_VIDEO - 1)).toBe(true);
  });
});
