import type * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WARMUP_TIMEOUT_MS, warmUpSceneResources, warmUpShaders, type WarmupRenderer } from './ShaderWarmup';

const TARGET = { id: 'alvo-hdr' } as unknown as THREE.WebGLRenderTarget;
const SCENE = {} as THREE.Object3D;
const CAMERA = {} as THREE.Camera;

interface Fake {
  renderer: WarmupRenderer;
  calls: string[];
  uniforms: ReturnType<typeof vi.fn>[];
}

/** Um renderer falso que anota a ordem das chamadas; `compile` decide o que `compileAsync` devolve. */
function falso(nProgramas: number, compile: () => Promise<unknown> = () => Promise.resolve(), previous: THREE.WebGLRenderTarget | null = null): Fake {
  const calls: string[] = [];
  const uniforms = Array.from({ length: nProgramas }, (_, i) => vi.fn(() => calls.push(`getUniforms#${i}`)));
  const renderer: WarmupRenderer = {
    getRenderTarget: () => previous,
    setRenderTarget: (t) => calls.push(`setRenderTarget(${t === null ? 'null' : (t as unknown as { id: string }).id})`),
    compileAsync: () => {
      calls.push('compileAsync');
      return compile();
    },
    info: { programs: uniforms.map((u) => ({ getUniforms: u })) },
  };
  return { renderer, calls, uniforms };
}

describe('pré-compilação dos shaders', () => {
  it.each(['ok', 'rejeita', 'sincrono', 'timeout'] as const)('restaura o alvo anterior ao preparar uma variante: %s', async (mode) => {
    const previous = { id: 'compositor-anterior' } as unknown as THREE.WebGLRenderTarget;
    const compile = () => {
      if (mode === 'sincrono') throw new Error('GPU perdida');
      if (mode === 'rejeita') return Promise.reject(new Error('GPU perdida'));
      if (mode === 'timeout') return new Promise(() => {});
      return Promise.resolve();
    };
    const f = falso(0, compile, previous);
    expect(await warmUpShaders(f.renderer, TARGET, SCENE, CAMERA, undefined, 20)).toBe(mode === 'ok' ? 'ok' : mode === 'timeout' ? 'timeout' : 'erro');
    expect(f.calls.slice(0, 3)).toEqual(['setRenderTarget(alvo-hdr)', 'compileAsync', 'setRenderTarget(compositor-anterior)']);
  });

  it('prepara recursos num quadro oculto e devolve o alvo anterior, sem desenhar no canvas', () => {
    const previous = { id: 'anterior' } as unknown as THREE.WebGLRenderTarget;
    const targets: Parameters<THREE.WebGLRenderer['setRenderTarget']>[0][] = [];
    const render = vi.fn(() => expect(targets.at(-1)).toBe(TARGET));
    warmUpSceneResources({ getRenderTarget: () => previous, setRenderTarget: t => { targets.push(t); }, render }, TARGET, SCENE as THREE.Scene, CAMERA);
    expect(render).toHaveBeenCalledWith(SCENE, CAMERA);
    expect(targets).toEqual([TARGET, previous]);
  });

  it('falha no desenho oculto restaura o alvo da tela antes de propagar para o fallback', () => {
    const targets: Parameters<THREE.WebGLRenderer['setRenderTarget']>[0][] = [];
    expect(() => warmUpSceneResources({ getRenderTarget: () => null, setRenderTarget: t => { targets.push(t); }, render: () => { throw new Error('GPU perdida'); } }, TARGET, SCENE as THREE.Scene, CAMERA)).toThrow('GPU perdida');
    expect(targets).toEqual([TARGET, null]);
  });

  it('compila contra o alvo HDR do jogo (não contra a tela) e solta o alvo logo depois da parte síncrona', async () => {
    const f = falso(2);
    const r = await warmUpShaders(f.renderer, TARGET, SCENE, CAMERA);
    expect(r).toBe('ok');
    // O alvo vale durante a chamada de compilação, e só nela; depois volta para a tela.
    expect(f.calls.slice(0, 3)).toEqual(['setRenderTarget(alvo-hdr)', 'compileAsync', 'setRenderTarget(null)']);
  });

  it('força o primeiro uso de CADA programa ligado, na ordem, depois que a ligação em paralelo termina', async () => {
    const f = falso(4);
    await warmUpShaders(f.renderer, TARGET, SCENE, CAMERA);
    for (const u of f.uniforms) expect(u).toHaveBeenCalledTimes(1);
    expect(f.calls.slice(3)).toEqual(['getUniforms#0', 'getUniforms#1', 'getUniforms#2', 'getUniforms#3']);
  });

  it('avisa o progresso a cada programa, de 1 até o total, sem pular nem repetir', async () => {
    const f = falso(5);
    const marcas: [number, number][] = [];
    await warmUpShaders(f.renderer, TARGET, SCENE, CAMERA, (done, total) => marcas.push([done, total]));
    expect(marcas).toEqual([[1, 5], [2, 5], [3, 5], [4, 5], [5, 5]]);
  });

  it('cede a vez à página entre os programas (o contador na tela e o teclado respondem)', async () => {
    const f = falso(3);
    let ticks = 0;
    const timer = setInterval(() => { ticks++; }, 0);
    await warmUpShaders(f.renderer, TARGET, SCENE, CAMERA);
    clearInterval(timer);
    expect(ticks).toBeGreaterThan(0); // houve turnos do laço de eventos no meio
  });

  it('sem programas ligados, termina sem erro', async () => {
    const f = falso(0);
    expect(await warmUpShaders(f.renderer, TARGET, SCENE, CAMERA)).toBe('ok');
    const nulo: WarmupRenderer = { ...f.renderer, info: { programs: null } };
    expect(await warmUpShaders(nulo, TARGET, SCENE, CAMERA)).toBe('ok');
  });

  it('o carregamento nunca fica preso: se a ligação não responde, desiste no tempo limite e deixa o alvo da tela', async () => {
    const f = falso(2, () => new Promise(() => {})); // o driver nunca avisa
    const r = await warmUpShaders(f.renderer, TARGET, SCENE, CAMERA, undefined, 30);
    expect(r).toBe('timeout');
    expect(f.calls[f.calls.length - 1]).toBe('setRenderTarget(null)');
    expect(f.uniforms[0]).not.toHaveBeenCalled();
  });

  it('desiste no meio da fila de primeiros usos se estourar o tempo total, sem forçar o resto', async () => {
    const f = falso(50);
    // Cada primeiro uso leva ~2 ms; o limite de 10 ms corta a fila bem antes dos 50.
    for (const u of f.uniforms) u.mockImplementation(() => { const t = Date.now(); while (Date.now() - t < 2); });
    const r = await warmUpShaders(f.renderer, TARGET, SCENE, CAMERA, undefined, 10);
    expect(r).toBe('timeout');
    const feitos = f.uniforms.filter((u) => u.mock.calls.length > 0).length;
    expect(feitos).toBeGreaterThan(0);
    expect(feitos).toBeLessThan(50);
  });

  it('erro na ligação ou no primeiro uso vira "erro", e o alvo da tela é sempre devolvido', async () => {
    const rejeita = falso(1, () => Promise.reject(new Error('contexto perdido')));
    expect(await warmUpShaders(rejeita.renderer, TARGET, SCENE, CAMERA)).toBe('erro');
    expect(rejeita.calls).toContain('setRenderTarget(null)');

    const lanca = falso(1);
    lanca.uniforms[0]!.mockImplementation(() => { throw new Error('programa inválido'); });
    expect(await warmUpShaders(lanca.renderer, TARGET, SCENE, CAMERA)).toBe('erro');

    const sincrono: WarmupRenderer = { ...falso(1).renderer, compileAsync: () => { throw new Error('boom'); } };
    expect(await warmUpShaders(sincrono, TARGET, SCENE, CAMERA)).toBe('erro');
  });

  it('o limite padrão é folgado para GPU lenta, mas finito', () => {
    expect(WARMUP_TIMEOUT_MS).toBeGreaterThanOrEqual(15_000);
    expect(WARMUP_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });
});
