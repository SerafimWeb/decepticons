import * as THREE from 'three';
import type { MechBase } from '../entities/MechBase';
import type { BurstOptions, ParticleSystem } from './ParticleSystem';
import { SHAPE } from './particleShapes';

/**
 * O fluxo do lança-chamas, desenhado a partir da bandeira `status.flaming` do dono: o mesmo código serve ao jogador local, ao bot e ao
 * jogador remoto (o servidor só liga a bandeira; o dano do cone é dele, `Match.flameCone`). Uma língua de fogo que sai da boca, cresce e
 * sobe, com uma fumaça escura atrás. **30 Hz**, ~270 partículas por segundo por lança-chamas aceso, no pool que já existe (G5): o alcance
 * visual é o do cone de dano (20 m). Zero draw call novo.
 *
 * Dono, 11/10: "o fogo está muito fraco e curto". A 1ª versão tinha 12 m de língua, partículas pequenas e fina; agora a língua vai até os 20 m do cone
 * (31 m/s por 0,66 s), é mais larga e mais gorda, tem um miolo claro mais longo e uma **boca acesa** (um clarão curto onde sai o fogo).
 */
// Línguas de fogo (a ponta para cima, crescendo), um miolo claro, uma fumaça escura atrás e o clarão da boca.
const FLAME: BurstOptions = { count: 5, color: new THREE.Color(2.0, 0.8, 0.12), speed: 31, life: 0.66, size: 2.8, expansion: 1.9, spread: 0.26, gravity: -1.5, shape: SHAPE.flame };
const CORE: BurstOptions = { count: 2, color: new THREE.Color(1.9, 1.5, 0.65), speed: 24, life: 0.34, size: 1.8, expansion: 0.7, spread: 0.1, gravity: -0.5, shape: SHAPE.flame };
const SMOKE: BurstOptions = { count: 1, color: new THREE.Color(0.24, 0.25, 0.25), speed: 14, life: 1.3, size: 3.2, expansion: 2, spread: 0.4, gravity: -2.5, shape: SHAPE.puff };
const MOUTH: BurstOptions = { count: 1, color: new THREE.Color(2.2, 1.5, 0.5), speed: 0, life: 0.1, size: 3.4, expansion: 1.2, gravity: 0 };

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class FlameVisuals {
  private timer = 0;
  private pulse = false;

  constructor(private readonly particles: Pick<ParticleSystem, 'burst'>) {}

  /** Uma vez por quadro, antes dos `update`: abre um pulso a cada 1/30 s. */
  beginFrame(dt: number, active: boolean): void {
    this.pulse = false;
    if (!active) {
      this.timer = 0;
      return;
    }
    this.timer += dt;
    if (this.timer < 1 / 30) return;
    this.timer %= 1 / 30;
    this.pulse = true;
  }

  /** Quantas partículas este Mech solta neste pulso (para o teste e para o orçamento). */
  update(mech: MechBase): number {
    if (!this.pulse || !mech.status.flaming || !mech.alive || !mech.root.visible) return 0;
    mech.mountWorldPosition('rightHand', _origin);
    const cp = Math.cos(mech.pitch);
    _dir.set(-Math.sin(mech.yaw) * cp, Math.sin(mech.pitch), -Math.cos(mech.yaw) * cp);
    this.particles.burst(_origin, _dir, FLAME);
    this.particles.burst(_origin, _dir, CORE);
    this.particles.burst(_origin, _dir, SMOKE);
    this.particles.burst(_origin, _dir, MOUTH);
    return FLAME.count + CORE.count + SMOKE.count + MOUTH.count;
  }
}
