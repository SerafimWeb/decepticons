import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';

/**
 * Uma cópia da imagem já desenhada (HDR, antes do bloom), para o que precisa **olhar através dela**: a distorção do ar dos anéis da
 * onda sônica (`WaveRings`) lê esta cópia com o quadro deslocado. Fica logo depois do `RenderPass` e **só roda enquanto `enabled`**
 * (há onda no ar): desligada, não custa nada, e quem a desliga também perde o `ready`.
 *
 * Custo quando ligada: uma cópia de tela cheia por quadro (uma passada de textura, sem MSAA, meia precisão). O anel lê o quadro **anterior** (uma
 * cópia só, depois do desenho), então `ready` só vale a partir do quadro seguinte ao que a ligou; o anel usa o brilho fraco de reserva até lá.
 */
export class FrameCopyPass extends Pass {
  readonly target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  /** A cópia tem um quadro inteiro dentro (e o tamanho não mudou desde então)? */
  ready = false;
  /** O tamanho da cópia em pixels (o do alvo de render do jogo): o anel converte o pixel em coordenada de textura com ele. */
  width = 1;
  height = 1;
  private readonly quad: FullScreenQuad;

  /** A textura da cópia (o que o anel lê). */
  get texture(): THREE.Texture {
    return this.target.texture;
  }

  constructor() {
    super();
    this.needsSwap = false;
    this.enabled = false;
    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        name: 'FrameCopy',
        uniforms: { tDiffuse: { value: null as THREE.Texture | null }, opacity: { value: 1 } },
        vertexShader: CopyShader.vertexShader,
        fragmentShader: CopyShader.fragmentShader,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending,
      }),
    );
  }

  override setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.target.setSize(this.width, this.height);
    this.ready = false;
  }

  /** Liga ou desliga a cópia; desligar apaga o `ready` (a próxima vez recomeça da cópia nova). */
  setActive(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    if (!on) this.ready = false;
  }

  override render(renderer: THREE.WebGLRenderer, _writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    (this.quad.material as THREE.ShaderMaterial).uniforms.tDiffuse!.value = readBuffer.texture;
    renderer.setRenderTarget(this.target);
    this.quad.render(renderer);
    this.ready = true;
  }

  override dispose(): void {
    this.target.dispose();
    (this.quad.material as THREE.ShaderMaterial).dispose();
    this.quad.dispose();
  }
}
