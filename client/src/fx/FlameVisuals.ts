import * as THREE from 'three';
import type { MechBase } from '../entities/MechBase';
import type { BurstOptions, ParticleSystem } from './ParticleSystem';

/**
 * O fluxo do lança-chamas, desenhado a partir da bandeira `status.flaming` do dono: o mesmo código serve ao jogador local, ao bot e ao
 * jogador remoto (o servidor só liga a bandeira; o dano do cone é dele, `Match.flameCone`). Uma língua de fogo que sai da boca, cresce e
 * sobe, com uma fumaça escura atrás. **30 Hz**, ~150 partículas por segundo por lança-chamas aceso, no pool que já existe (G5): o alcance
 * visual é o do cone de dano (14 m). Zero draw call novo.
 */
const FLAME: BurstOptions = { count: 4, color: new THREE.Color(1.9, 0.78, 0.12), speed: 20, life: 0.62, size: 1.2, expansion: 1.1, spread: 0.16, gravity: -1.5 };
const CORE: BurstOptions = { count: 1, color: new THREE.Color(1.8, 1.5, 0.7), speed: 17, life: 0.3, size: 0.8, expansion: 0.4, spread: 0.06, gravity: -0.5 };
const SMOKE: BurstOptions = { count: 1, color: new THREE.Color(0.24, 0.25, 0.25), speed: 9, life: 1.1, size: 1.8, expansion: 1.4, spread: 0.3, gravity: -2 };

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
    return FLAME.count + CORE.count + SMOKE.count;
  }
}
