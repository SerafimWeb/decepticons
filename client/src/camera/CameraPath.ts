export interface Ponto3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraKeyframe {
  /** Segundos desde o início da cutscene. Crescente, o primeiro é 0. */
  t: number;
  position: Ponto3;
  lookAt: Ponto3;
  /** Graus; se omitido, mantém o FOV do quadro-chave vizinho. */
  fov?: number;
}

export interface CameraPathSample {
  position: Ponto3;
  lookAt: Ponto3;
  fov: number;
}

const FOV_PADRAO = 55;

const suaviza = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerp3 = (a: Ponto3, b: Ponto3, t: number): Ponto3 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });

/**
 * Trajetória de câmera por quadros-chave, para cutscenes pré-renderizadas (não é gameplay: não roda no tick fixo nem
 * entra no `shared/`). Pura e determinística (sem `Math.random`, sem `Date.now`): a mesma amostra do mesmo tempo
 * sempre dá o mesmo resultado, para a captura em vídeo ser repetível.
 *
 * Interpolação suave (smoothstep) entre cada par de quadros-chave consecutivos — sem causar um "chicote" nas pontas
 * como a interpolação linear pura. Não evita que a câmera atravesse geometria sólida (não é a câmera de jogo,
 * `CameraRig`/`KillCam`, que faz isso); quem desenha os quadros-chave escolhe posições livres de propósito.
 */
export class CameraPath {
  private readonly keys: readonly CameraKeyframe[];

  constructor(keyframes: readonly CameraKeyframe[]) {
    if (keyframes.length < 2) throw new Error('CameraPath precisa de ao menos 2 quadros-chave');
    for (let i = 1; i < keyframes.length; i++) {
      if (keyframes[i]!.t <= keyframes[i - 1]!.t) throw new Error('os quadros-chave precisam de t crescente');
    }
    this.keys = keyframes;
  }

  /** Duração total (s): o `t` do último quadro-chave. */
  get duration(): number {
    return this.keys[this.keys.length - 1]!.t;
  }

  /** Amostra a câmera em `t` segundos (sujeito aos limites: antes do início fica no primeiro quadro, depois do fim no último). */
  sample(t: number): CameraPathSample {
    const alvo = Math.max(0, Math.min(this.duration, t));
    let i = 0;
    while (i < this.keys.length - 2 && this.keys[i + 1]!.t <= alvo) i++;
    const a = this.keys[i]!;
    const b = this.keys[i + 1]!;
    const vao = b.t - a.t;
    const fracao = vao > 1e-6 ? suaviza((alvo - a.t) / vao) : 1;
    const fovA = a.fov ?? b.fov ?? FOV_PADRAO;
    const fovB = b.fov ?? a.fov ?? FOV_PADRAO;
    return { position: lerp3(a.position, b.position, fracao), lookAt: lerp3(a.lookAt, b.lookAt, fracao), fov: lerp(fovA, fovB, fracao) };
  }
}
