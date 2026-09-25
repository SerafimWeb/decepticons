import * as THREE from 'three';

export interface BurstOptions {
  count: number;
  color: THREE.Color; // pode ser HDR (>1) para acender o bloom
  speed: number;
  life: number; // segundos
  size?: number; // multiplicador do tamanho de tela; maior em explosões e fumaça
  expansion?: number; // variação de tamanho até o fim da vida: positivo cresce, negativo encolhe
  spread?: number; // 0 = cone fechado na normal, 1+ = quase esférico
  gravity?: number;
}

/** Teto G5: o cursor circular sempre mantém, no máximo, esta quantidade de partículas vivas. */
export const MAX_PARTICLES = 3000;

const _v = new THREE.Vector3();

function makeSprite(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * Pool fixo de partículas num único THREE.Points (1 draw call).
 * Buffer circular: partículas novas sobrescrevem as mais antigas.
 */
export class ParticleSystem {
  readonly points: THREE.Points;

  private readonly max: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly base: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly gravity: Float32Array;
  private readonly baseSize: Float32Array;
  private readonly size: Float32Array;
  private readonly expansion: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colAttr: THREE.BufferAttribute;
  private readonly sizeAttr: THREE.BufferAttribute;
  private cursor = 0;

  constructor(max = MAX_PARTICLES) {
    if (!Number.isInteger(max) || max < 1 || max > MAX_PARTICLES) {
      throw new RangeError(`ParticleSystem aceita de 1 a ${MAX_PARTICLES} partículas`);
    }
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.size = new Float32Array(max);
    this.expansion = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('particleScale', this.sizeAttr);

    const material = new THREE.PointsMaterial({
      size: 0.45,
      map: makeSprite(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float particleScale;')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * particleScale;');
    };
    material.customProgramCacheKey = () => 'cybermech-particle-size-v1';
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
  }

  burst(origin: THREE.Vector3, normal: THREE.Vector3, o: BurstOptions): void {
    const spread = o.spread ?? 1;
    const count = Math.min(this.max, Math.max(0, Math.trunc(o.count)));
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const i3 = i * 3;

      _v.randomDirection().multiplyScalar(spread).add(normal).normalize();
      const sp = o.speed * (0.35 + Math.random() * 0.65);
      this.vel[i3] = _v.x * sp;
      this.vel[i3 + 1] = _v.y * sp;
      this.vel[i3 + 2] = _v.z * sp;
      this.pos[i3] = origin.x;
      this.pos[i3 + 1] = origin.y;
      this.pos[i3 + 2] = origin.z;

      const b = 0.6 + Math.random() * 0.8;
      this.base[i3] = o.color.r * b;
      this.base[i3 + 1] = o.color.g * b;
      this.base[i3 + 2] = o.color.b * b;

      this.maxLife[i] = this.life[i] = o.life * (0.5 + Math.random() * 0.5);
      this.gravity[i] = o.gravity ?? 20;
      this.baseSize[i] = (o.size ?? 1) * (0.75 + Math.random() * 0.5);
      this.size[i] = this.baseSize[i];
      this.expansion[i] = o.expansion ?? 0;
    }
  }

  update(dt: number): void {
    const drag = Math.max(0, 1 - 2.5 * dt);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      const i3 = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.col[i3] = this.col[i3 + 1] = this.col[i3 + 2] = 0;
        this.size[i] = 0;
        continue;
      }
      this.vel[i3 + 1] -= this.gravity[i] * dt;
      this.vel[i3] *= drag;
      this.vel[i3 + 1] *= drag;
      this.vel[i3 + 2] *= drag;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0) {
        this.pos[i3 + 1] = 0;
        this.vel[i3 + 1] *= -0.35;
      }
      const t = this.life[i] / this.maxLife[i];
      this.size[i] = Math.max(0, this.baseSize[i] * (1 + this.expansion[i] * (1 - t)));
      this.col[i3] = this.base[i3] * t;
      this.col[i3 + 1] = this.base[i3 + 1] * t;
      this.col[i3 + 2] = this.base[i3 + 2] * t;
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }
}
