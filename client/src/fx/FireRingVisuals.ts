import * as THREE from 'three';
import { FIRE_RING } from '../combat/EnergyShield';
import type { MechBase } from '../entities/MechBase';
import type { HeatHaze } from './HeatHaze';
import type { BurstOptions, ParticleSystem } from './ParticleSystem';
import { SHAPE } from './particleShapes';

/**
 * As chamas do anel de fogo (dono, 11/10: "um círculo de fogo ao redor do Mech"; 13/10: "o anel de fogo achei muito artificial, tem que mostrar que está quente"),
 * desenhadas a partir do escudo ligado do dono (`energyShield.active` com o módulo `fire`): o mesmo código serve ao jogador local, ao bot e ao jogador remoto (o servidor decide
 * o dano; o cliente só desenha). O aro e o disco de brasa no chão são do `ShieldVisuals`; aqui entram as **línguas de fogo que sobem do aro**, uma fumaça escura, brasas dentro
 * do círculo e, por cima de tudo, a **névoa de calor** (`HeatHaze`: o cenário treme e ondula sobre o círculo, como o ar quente sobre o asfalto).
 *
 * **Nada de oito línguas iguais girando:** a primeira versão soltava 8 línguas do mesmo tamanho, igualmente espaçadas e no raio exato, e parecia um desenho, não fogo. Agora cada pulso
 * escolhe, **sem sorteio** (uma função do número do pulso e da posição), quais das 12 posições do aro acendem, o quanto cada uma se desvia do ângulo, do raio e da altura, qual é alta,
 * média ou baixa, e se tende ao amarelo ou ao vermelho; o círculo ainda gira. O mesmo pulso dá o mesmo desenho (testável); dois pulsos seguidos nunca se repetem.
 *
 * **20 Hz**, por anel ligado: até 12 línguas + 2 brasas + 1 fumaça = no máximo 15 partículas por pulso (300 por segundo no pior caso, ~190 na média), no pool que já existe (G5). A névoa:
 * 10 Hz, 3 plumas no aro e 1 no meio (uma só draw call para todas as plumas do jogo).
 */
const SLOTS = 12;
/** Quanto o círculo gira a cada pulso (rad): um terço de posição, para o desenho nunca repetir no mesmo lugar. */
const TURN = (Math.PI * 2) / SLOTS / 3;
const TALL: BurstOptions = { count: 1, color: new THREE.Color(2.1, 0.75, 0.1), speed: 6.8, life: 0.8, size: 3.1, expansion: 1.5, spread: 0.2, gravity: -2.4, shape: SHAPE.flame };
const MEDIUM: BurstOptions = { count: 1, color: new THREE.Color(2.0, 0.85, 0.12), speed: 4.6, life: 0.62, size: 2.3, expansion: 1.6, spread: 0.3, gravity: -2, shape: SHAPE.flame };
const LOW: BurstOptions = { count: 1, color: new THREE.Color(2.2, 1.15, 0.3), speed: 2.8, life: 0.45, size: 1.5, expansion: 1.2, spread: 0.45, gravity: -1.6, shape: SHAPE.flame };
const EMBER: BurstOptions = { count: 1, color: new THREE.Color(2.2, 1.0, 0.25), speed: 3.4, life: 1.0, size: 0.8, spread: 1, gravity: -2.8, shape: SHAPE.dot };
const SMOKE: BurstOptions = { count: 1, color: new THREE.Color(0.24, 0.25, 0.25), speed: 2.2, life: 1.3, size: 2.8, expansion: 2.2, spread: 0.5, gravity: -1.5, shape: SHAPE.puff };
/** Quantas partículas, no máximo, um anel solta por pulso (as línguas, as brasas e a fumaça): o teto do orçamento. */
export const FIRE_RING_MAX_PER_PULSE = SLOTS + 2 + 1;

const UP = new THREE.Vector3(0, 1, 0);
const _at = new THREE.Vector3();

/** Um número de 0 a 1 que só depende de `a` e `b` (a mesma conta dá o mesmo valor: o desenho do pulso é uma função do pulso, não um sorteio). */
export function hash01(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453;
  return s - Math.floor(s);
}

export class FireRingVisuals {
  private timer = 0;
  private pulse = false;
  private index = 0;

  constructor(
    private readonly particles: Pick<ParticleSystem, 'burst'>,
    private readonly haze?: Pick<HeatHaze, 'emit'>,
  ) {}

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
    const k = this.index;
    // O círculo anda, e cada Mech tem o seu desenho (a posição dele entra na conta: dois anéis lado a lado não piscam iguais).
    const sal = mech.position.x * 0.37 + mech.position.z * 0.53;
    const turn = k * TURN;
    for (let i = 0; i < SLOTS; i++) {
      const h = hash01(k + sal, i);
      if (h < 0.34) continue; // nem toda posição acende a cada pulso
      const angulo = turn + ((i + (hash01(k + sal, i + 40) - 0.5) * 0.7) / SLOTS) * Math.PI * 2;
      const raio = FIRE_RING.radius * (0.9 + 0.17 * hash01(k + sal, i + 80));
      _at.set(mech.position.x + Math.cos(angulo) * raio, mech.position.y + 0.15 + 0.2 * hash01(k + sal, i + 120), mech.position.z + Math.sin(angulo) * raio);
      // Alta, média ou baixa: a metade são médias; as altas e as baixas se alternam no resto.
      const tipo = h > 0.88 ? TALL : h > 0.5 ? MEDIUM : LOW;
      this.particles.burst(_at, UP, tipo);
      n += tipo.count;
    }
    // Duas brasas dentro do círculo e uma fumaça no meio (a posição das brasas também varia).
    for (let b = 0; b < 2; b++) {
      const a = -turn * 1.7 + b * Math.PI + hash01(k + sal, 200 + b) * 1.2;
      const r = FIRE_RING.radius * (0.35 + 0.35 * hash01(k + sal, 220 + b));
      _at.set(mech.position.x + Math.cos(a) * r, mech.position.y + 0.3, mech.position.z + Math.sin(a) * r);
      this.particles.burst(_at, UP, EMBER);
      n += EMBER.count;
    }
    _at.set(mech.position.x, mech.position.y + 0.4, mech.position.z);
    this.particles.burst(_at, UP, SMOKE);
    n += SMOKE.count;
    // A névoa de calor: a cada dois pulsos (10 Hz), três plumas no aro e uma no meio, subindo mais alto que as chamas.
    if (this.haze && k % 2 === 0) {
      for (let p = 0; p < 3; p++) {
        const a = turn * 0.7 + ((p + hash01(k + sal, 300 + p)) / 3) * Math.PI * 2;
        const r = FIRE_RING.radius * (0.7 + 0.3 * hash01(k + sal, 320 + p));
        this.haze.emit(mech.position.x + Math.cos(a) * r, mech.position.y + 0.7, mech.position.z + Math.sin(a) * r, 3.1, 1.0, 0.95, 2.6);
      }
      this.haze.emit(mech.position.x, mech.position.y + 0.9, mech.position.z, FIRE_RING.radius * 0.95, 1.15, 0.65, 2.0);
    }
    return n;
  }
}
