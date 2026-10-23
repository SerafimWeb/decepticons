import * as THREE from 'three';
import type { CameraPath } from './CameraPath';

/**
 * Toca uma `CameraPath` sobre a câmera do jogo, do mesmo jeito que o `KillCam` assume a câmera por um tempo:
 * expõe `overridesRig` para o `Game` pular o `CameraRig` enquanto ela está tocando. Só visual — não lê nem
 * escreve a simulação, não aloca por quadro (G1/G4).
 */
export class CutsceneDirector {
  private state: 'idle' | 'playing' | 'done' = 'idle';
  private elapsed = 0;
  private readonly lookAt = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly path: CameraPath,
  ) {}

  /** Enquanto true, o `Game` pula o `CameraRig`: só esta trajetória decide a câmera. */
  get overridesRig(): boolean {
    return this.state === 'playing';
  }

  get active(): boolean {
    return this.state !== 'idle';
  }

  get done(): boolean {
    return this.state === 'done';
  }

  /** De 0 a 1: para uma barra de progresso ou para o script de captura saber quando parar. */
  get progress(): number {
    return this.path.duration > 0 ? Math.min(1, this.elapsed / this.path.duration) : 1;
  }

  start(): void {
    this.elapsed = 0;
    this.state = 'playing';
  }

  /** O jogador pulou (clique ou tecla): vai direto para o fim, sem mais quadros intermediários. */
  pular(): void {
    if (this.state !== 'playing') return;
    this.elapsed = this.path.duration;
    this.aplicarAmostra(this.path.sample(this.elapsed));
    this.state = 'done';
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.elapsed += dt;
    this.aplicarAmostra(this.path.sample(this.elapsed));
    if (this.elapsed >= this.path.duration) this.state = 'done';
  }

  private aplicarAmostra(s: ReturnType<CameraPath['sample']>): void {
    this.camera.position.set(s.position.x, s.position.y, s.position.z);
    this.lookAt.set(s.lookAt.x, s.lookAt.y, s.lookAt.z);
    this.camera.lookAt(this.lookAt);
    if (Math.abs(this.camera.fov - s.fov) > 0.001) {
      this.camera.fov = s.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
