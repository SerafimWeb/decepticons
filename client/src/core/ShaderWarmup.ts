import type * as THREE from 'three';

/**
 * Pré-compilação dos shaders no carregamento. O three.js só termina de ligar o programa de um material no primeiro quadro em
 * que ele é usado, e na GPU integrada isso congela o jogo por ~1,5 s a cada programa novo. Medido na Iris Xe: em cada
 * travada de partida, o `getProgramInfoLog` do primeiro uso ocupava 1,2 a 1,8 s (partículas na primeira explosão, o robô
 * de malha na primeira aparição, a faixa do tiro no primeiro tiro).
 *
 * `compileAsync` sozinho NÃO resolve: ele liga todos os programas em paralelo e devolve "pronto" cedo demais, e o primeiro
 * uso ainda bloqueava o tempo todo. Por isso, depois dele, cada programa é consultado de verdade (`getUniforms()`, o que
 * o three faz no primeiro uso), um de cada vez, cedendo a vez à página entre um e outro: o custo continua o mesmo, mas
 * paga-se aqui, com a tela de carregamento e um contador, e não no meio da partida.
 */

/** O que a pré-compilação pede do renderer (o `WebGLRenderer` serve; o teste usa um falso). */
export interface WarmupRenderer {
  setRenderTarget(target: THREE.WebGLRenderTarget | null): void;
  compileAsync(scene: THREE.Object3D, camera: THREE.Camera): Promise<unknown>;
  /** `info.programs` lista os programas ligados; cada um termina de compilar quando se pede `getUniforms()`. */
  readonly info: { readonly programs: ReadonlyArray<{ getUniforms(): unknown }> | null };
}

/** Quanto esperar no máximo, no total: o carregamento nunca fica preso se o driver não responder. */
export const WARMUP_TIMEOUT_MS = 30_000;

export type WarmupResult = 'ok' | 'timeout' | 'erro';

/** Cede a vez ao navegador (desenha o contador, atende o teclado) entre dois programas. */
const yieldToBrowser = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** O primeiro desenho também envia texturas/geometrias à GPU: compilar programas não prepara esses recursos. */
export function warmUpSceneResources(
  renderer: Pick<THREE.WebGLRenderer, 'getRenderTarget' | 'setRenderTarget' | 'render'>,
  target: THREE.WebGLRenderTarget,
  scene: THREE.Scene,
  camera: THREE.Camera,
): void {
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  } finally {
    // Nada aparece no canvas; a Arena e o compositor continuam donos do próximo quadro.
    renderer.setRenderTarget(previous);
  }
}

/**
 * Compila os materiais de `scene` para `target`, o alvo em que o jogo desenha de verdade. O jogo desenha num alvo HDR do
 * compositor, sem tone mapping nem conversão de cor (o `OutputPass` faz isso no fim); compilar contra a tela geraria
 * outra variante dos programas, que ninguém usaria. O alvo só precisa valer durante a chamada: a parte síncrona da
 * compilação acontece nela, e o resto não mexe mais no estado do renderer.
 *
 * `onProgress(feitos, total)` é chamado a cada programa terminado (para o contador na tela).
 */
export async function warmUpShaders(
  renderer: WarmupRenderer,
  target: THREE.WebGLRenderTarget,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  onProgress?: (done: number, total: number) => void,
  timeoutMs: number = WARMUP_TIMEOUT_MS,
): Promise<WarmupResult> {
  const deadline = Date.now() + timeoutMs;
  let linking: Promise<unknown>;
  renderer.setRenderTarget(target);
  try {
    linking = renderer.compileAsync(scene, camera);
  } catch {
    return 'erro';
  } finally {
    renderer.setRenderTarget(null);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  try {
    const linked = await Promise.race([linking.then((): 'ok' => 'ok'), expired]);
    if (linked === 'timeout') return 'timeout';
    // Forçar o primeiro uso de cada programa: é aqui que o driver termina de compilar de verdade.
    const programs = [...(renderer.info.programs ?? [])];
    for (let i = 0; i < programs.length; i++) {
      if (Date.now() > deadline) return 'timeout';
      programs[i]!.getUniforms();
      onProgress?.(i + 1, programs.length);
      await yieldToBrowser();
    }
    return 'ok';
  } catch {
    return 'erro';
  } finally {
    clearTimeout(timer);
  }
}
