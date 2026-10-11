import * as THREE from 'three';
import { FIRE_RING } from '../combat/EnergyShield';
import type { MechBase } from '../entities/MechBase';
import type { BurstOptions, ParticleSystem } from './ParticleSystem';
import { SHAPE } from './particleShapes';

/**
 * As chamas do anel de fogo (dono, 11/10: "um círculo de fogo ao redor do Mech"), desenhadas a partir do escudo ligado do dono (`energyShield.active` com o módulo
 * `fire`): o mesmo código serve ao jogador local, ao bot e ao jogador remoto (o servidor decide o dano; o cliente só desenha). O aro e o disco de brasa no chão são do
 * `ShieldVisuals`; aqui entram as **línguas de fogo que sobem do aro**, uma fumaça escura e brasas dentro do círculo.
 *
 * **20 Hz**, por anel ligado: 8 línguas no aro (giram um pouco a cada pulso, para o círculo parecer vivo) + 2 brasas dentro + 1 fumaça = 11 partículas por pulso,
 * 220 por segundo, no pool que já existe (G5). Zero draw call novo. Sem sorteio: a posição de cada língua é função do número do pulso (determinístico).
 */
const TONGUES = 8;
/** Quanto o círculo gira a cada pulso (rad): meia língua, para o desenho nunca repetir no mesmo lugar. */
const TURN = Math.PI / TONGUES;
const TONGUE: BurstOptions = { count: 1, color: new THREE.Color(2.0, 0.8, 0.12), speed: 4.5, life: 0.6, size: 2.4, expansion: 1.6, spread: 0.25, gravity: -2, shape: SHAPE.flame };
const EMBER: BurstOptions = { count: 1, color: new THREE.Color(2.2, 1.0, 0.25), speed: 3.2, life: 0.9, size: 0.9, spread: 0.9, gravity: -2.5, shape: SHAPE.dot };
const SMOKE: BurstOptions = { count: 1, color: new THREE.Color(0.24, 0.25, 0.25), speed: 2, life: 1.2, size: 2.6, expansion: 2, spread: 0.5, gravity: -1.5, shape: SHAPE.puff };

const UP = new THREE.Vector3(0, 1, 0);
const _at = new THREE.Vector3();

export class FireRingVisuals {
  private timer = 0;
  private pulse = false;
  private index = 0;

  constructor(private readonly particles: Pick<ParticleSystem, 'burst'>) {}

  /** Uma vez por quadro, antes dos `update`: abre um pulso a cada 1/20 s. */
  beginFrame(dt: number, active: boolean): void {
    this.pulse = false;
    if (!active) {
      this.timer = 0;
      return;
    }
    this.timer += dt;
    if (this.timer < 1 / 20) return;
    this.timer %= 1 / 20;
    this.pulse = true;
    this.index++;
  }

  /** Quantas partículas este Mech solta neste pulso (para o teste e para o orçamento). */
  update(mech: MechBase): number {
    if (!this.pulse || !mech.alive || !mech.root.visible || mech.energyShield.kind !== 'fire' || !mech.energyShield.active) return 0;
    let n = 0;
    const turn = this.index * TURN;
    for (let i = 0; i < TONGUES; i++) {
      const a = turn + (i / TONGUES) * Math.PI * 2;
      _at.set(mech.position.x + Math.cos(a) * FIRE_RING.radius, mech.position.y + 0.2, mech.position.z + Math.sin(a) * FIRE_RING.radius);
      this.particles.burst(_at, UP, TONGUE);
      n += TONGUE.count;
    }
    // Duas brasas dentro do círculo (a meio raio, em lados opostos) e uma fumaça no meio.
    for (let k = 0; k < 2; k++) {
      const a = -turn * 1.7 + k * Math.PI;
      _at.set(mech.position.x + Math.cos(a) * FIRE_RING.radius * 0.5, mech.position.y + 0.3, mech.position.z + Math.sin(a) * FIRE_RING.radius * 0.5);
      this.particles.burst(_at, UP, EMBER);
      n += EMBER.count;
    }
    _at.set(mech.position.x, mech.position.y + 0.4, mech.position.z);
    this.particles.burst(_at, UP, SMOKE);
    return n + SMOKE.count;
  }
}
