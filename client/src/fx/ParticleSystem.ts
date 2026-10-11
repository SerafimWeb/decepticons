import * as THREE from 'three';
import { ATLAS_GRID, CELL, drawAtlas, SHAPE, type ParticleShape } from './particleShapes';

export { SHAPE, type ParticleShape };

export interface BurstOptions {
  count: number;
  color: THREE.Color; // pode ser HDR (>1) para acender o bloom
  speed: number;
  life: number; // segundos
  size?: number; // multiplicador do tamanho de tela; maior em explosões e fumaça
  expansion?: number; // variação de tamanho até o fim da vida: positivo cresce, negativo encolhe
  spread?: number; // 0 = cone fechado na normal, 1+ = quase esférico
  gravity?: number;
  /** A forma da partícula (`fx/particleShapes.ts`). Sem ela, é o brilho redondo de sempre. */
  shape?: ParticleShape;
  /** Giro máximo em rad/s (cada partícula sorteia entre -spin e +spin). Sem ela, não gira. A faísca alongada gira sozinha para onde anda. */
  spin?: number;
}

/** Teto G5: o cursor circular sempre mantém, no máximo, esta quantidade de partículas vivas. */
export const MAX_PARTICLES = 3000;

const _v = new THREE.Vector3();

/** O atlas de formas (`particleShapes.ts`): uma textura de 4 × 4 células, desenhada uma vez. */
function makeAtlas(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = ATLAS_GRID * CELL;
  drawAtlas(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
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
  private readonly shape: Float32Array;
  private readonly angle: Float32Array;
  private readonly spin: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colAttr: THREE.BufferAttribute;
  private readonly sizeAttr: THREE.BufferAttribute;
  private readonly velAttr: THREE.BufferAttribute;
  private readonly angleAttr: THREE.BufferAttribute;
  private readonly shapeAttr: THREE.BufferAttribute;
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
    this.shape = new Float32Array(max);
    this.angle = new Float32Array(max);
    this.spin = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('particleScale', this.sizeAttr);
    // A forma, o giro e a velocidade (a faísca alongada aponta para onde anda, e isso se calcula na GPU).
    this.angleAttr = new THREE.BufferAttribute(this.angle, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('particleAngle', this.angleAttr);
    this.shapeAttr = new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('particleShape', this.shapeAttr);
    this.velAttr = new THREE.BufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('particleVel', this.velAttr);

    const material = new THREE.PointsMaterial({
      size: 0.45,
      map: makeAtlas(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float particleScale;\nattribute float particleShape;\nattribute float particleAngle;\nattribute vec3 particleVel;\nvarying float vShape;\nvarying float vAngle;',
        )
        .replace(
          'gl_PointSize = size;',
          [
            'gl_PointSize = size * particleScale;',
            'vShape = particleShape;',
            '// Faísca alongada (4) e onda sonora (12): o ângulo é a direção em que andam na tela. As outras giram pelo ângulo que vem da CPU.',
            'vec4 cp0 = projectionMatrix * mvPosition;',
            'vec4 cp1 = projectionMatrix * modelViewMatrix * vec4( transformed + particleVel * 0.05, 1.0 );',
            'vec2 sd = cp1.xy / cp1.w - cp0.xy / cp0.w;',
            'sd.x *= projectionMatrix[1][1] / projectionMatrix[0][0];',
            'bool oriented = ( particleShape > 3.5 && particleShape < 4.5 ) || ( particleShape > 11.5 && particleShape < 12.5 );',
            'vAngle = oriented ? atan( sd.y, sd.x ) : particleAngle;',
          ].join('\n'),
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vShape;\nvarying float vAngle;')
        .replace(
          '#include <map_particle_fragment>',
          [
            '// A célula do atlas (4 x 4), com a amostragem girada por vAngle em volta do centro do sprite.',
            'vec2 pc = gl_PointCoord - 0.5;',
            'float ca = cos( vAngle );',
            'float sa = sin( vAngle );',
            'pc = vec2( ca * pc.x - sa * pc.y, sa * pc.x + ca * pc.y ) + 0.5;',
            'if ( pc.x < 0.0 || pc.x > 1.0 || pc.y < 0.0 || pc.y > 1.0 ) discard;',
            'vec2 cell = vec2( mod( vShape, 4.0 ), floor( vShape / 4.0 ) );',
            'vec2 uv = vec2( ( cell.x + pc.x ) / 4.0, 1.0 - ( cell.y + pc.y ) / 4.0 );',
            'diffuseColor *= texture2D( map, uv );',
          ].join('\n'),
        );
    };
    material.customProgramCacheKey = () => 'cybermech-particle-shapes-v2';
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
      this.shape[i] = o.shape ?? SHAPE.glow;
      // A língua de fogo fica com a ponta para cima (só balança um pouco); as outras formas nascem em qualquer ângulo.
      this.angle[i] = o.shape === SHAPE.flame ? (Math.random() - 0.5) * 0.5 : Math.random() * Math.PI * 2;
      this.spin[i] = (o.spin ?? 0) * (Math.random() * 2 - 1);
    }
    this.shapeAttr.needsUpdate = true;
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
      this.angle[i] += this.spin[i] * dt;
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
    this.angleAttr.needsUpdate = true;
    this.velAttr.needsUpdate = true;
  }
}
