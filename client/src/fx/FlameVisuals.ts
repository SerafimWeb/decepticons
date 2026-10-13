import * as THREE from 'three';
import type { MechBase } from '../entities/MechBase';
import { weaponAt } from '../combat/mounts';
import { weapon, type Tier, type WeaponStats } from '../combat/weapons';
import { hash01 } from './FireRingVisuals';
import type { HeatHaze } from './HeatHaze';
import type { BurstOptions, ParticleSystem } from './ParticleSystem';
import { SHAPE } from './particleShapes';

/**
 * O fluxo do lança-chamas, desenhado a partir da bandeira `status.flaming` do dono: o mesmo código serve ao jogador local, ao bot e ao
 * jogador remoto (o servidor só liga a bandeira; o dano do cone é dele, `Match.flameCone`). Uma língua de fogo que sai da boca, cresce e
 * sobe, com uma fumaça escura atrás. **30 Hz**, no pool que já existe (G5). Zero draw call novo.
 *
 * **Uma língua por mão que leva lança-chamas** (dono, 11/10: no Marauder "os tiros saíam só pela mão direita": o fluxo era desenhado sempre da direita,
 * mesmo com o fogo na esquerda também). O alcance visual é o da arma, no nível dela: 30 m no MK I, 39 no MK II e 48 no MK III (a língua anda 0,66 s,
 * então a velocidade vem do alcance). Custo: 9 a 11 partículas por pulso e por mão (270 a 330 por segundo), mais conforme o nível sobe.
 *
 * A chama nasce fina e **cresce com a distância** (perto da câmera ela ofuscava: o dono já reclamou de luz demais) e vai ficando larga e gorda.
 *
 * **13/10 (dono: "a arma de fogo está meio fraca, curta"; "tem que mostrar que está quente, como o calor que faz um golpe de vista no asfalto quente"):** o fluxo vive
 * mais (0,8 s, a língua chega ao alcance sem sumir antes), é mais cheio (6 a 8 línguas por pulso e um miolo claro maior) e solta **faíscas que passam do fim da chama**; e por cima
 * dele corre a **névoa de calor** (`HeatHaze`): duas plumas por pulso espalhadas ao longo do jato, que fazem o cenário tremer e subir sobre o fogo. Custo: 12 a 14 partículas por pulso
 * e por mão (360 a 420 por segundo) e 2 plumas de névoa (~34 vivas por mão).
 */
const FLAME_LIFE = 0.8;
const CORE_LIFE = 0.5;
const SMOKE_LIFE = 1.3;

interface FlameSet {
  flame: BurstOptions;
  core: BurstOptions;
  smoke: BurstOptions;
  mouth: BurstOptions;
  /** As faíscas que passam do fim da chama. */
  spark: BurstOptions;
  /** O alcance do nível (m): a névoa de calor se espalha até ele. */
  reach: number;
  /** Quantas partículas cada pulso solta deste conjunto. */
  perPulse: number;
}

/** O conjunto de partículas de cada nível: a língua vai até o alcance da arma, e as línguas são mais numerosas nos níveis altos (mais pressão). */
function setFor(w: WeaponStats): FlameSet {
  const reach = w.maxRange;
  const flame: BurstOptions = { count: 6 + w.tier, color: new THREE.Color(2.2, 0.85, 0.12), speed: reach / FLAME_LIFE, life: FLAME_LIFE, size: 2, expansion: 4, spread: 0.28, gravity: -1.5, shape: SHAPE.flame };
  const core: BurstOptions = { count: 3, color: new THREE.Color(2.1, 1.7, 0.8), speed: (reach * 0.55) / CORE_LIFE, life: CORE_LIFE, size: 1.5, expansion: 1.4, spread: 0.1, gravity: -0.5, shape: SHAPE.flame };
  const spark: BurstOptions = { count: 1, color: new THREE.Color(2.2, 1.2, 0.3), speed: (reach * 1.15) / 0.9, life: 0.9, size: 0.7, spread: 0.55, gravity: -0.8, shape: SHAPE.dot };
  const smoke: BurstOptions = { count: 1, color: new THREE.Color(0.24, 0.25, 0.25), speed: (reach * 0.45) / SMOKE_LIFE, life: SMOKE_LIFE, size: 2.2, expansion: 2.6, spread: 0.4, gravity: -2.5, shape: SHAPE.puff };
  const mouth: BurstOptions = { count: 1, color: new THREE.Color(1.9, 1.3, 0.45), speed: 0, life: 0.1, size: 1.8, expansion: 1, gravity: 0 };
  return { flame, core, smoke, mouth, spark, reach, perPulse: flame.count + core.count + smoke.count + mouth.count + spark.count };
}

/** Criados uma vez, na carga do módulo (G4): um conjunto por nível do lança-chamas. */
const SETS: Readonly<Record<Tier, FlameSet>> = { 0: setFor(weapon('flamer', 0)), 1: setFor(weapon('flamer', 1)), 2: setFor(weapon('flamer', 2)) };

const _origin = new THREE.Vector3();
/** As duas mãos de gatilho (o lança-chamas sai delas). */
const HAND_MOUNTS = ['rightHand', 'leftHand'] as const;
const _dir = new THREE.Vector3();

export class FlameVisuals {
  private timer = 0;
  private pulse = false;

  private n = 0;

  constructor(
    private readonly particles: Pick<ParticleSystem, 'burst'>,
    private readonly haze?: Pick<HeatHaze, 'emit'>,
  ) {}

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

  /** Quantas partículas este Mech solta neste pulso, somando as mãos que levam lança-chamas (para o teste e para o orçamento). */
  update(mech: MechBase): number {
    if (!this.pulse || !mech.status.flaming || !mech.alive || !mech.root.visible) return 0;
    const t = mech.triggers;
    let n = 0;
    // O lança-chamas de cada mão sai da mão dele, qualquer que seja o ataque que a aciona.
    for (const mount of HAND_MOUNTS) {
      if (!t.primary.includes(mount) && !t.secondary.includes(mount)) continue;
      const w = weaponAt(mech.loadout, mount);
      if (!w?.flame || (mount === 'leftHand' && mech.loadout.offhand === undefined)) continue;
      n += this.emit(mech, mount, SETS[w.tier]);
    }
    return n;
  }

  private emit(mech: MechBase, mount: Parameters<MechBase['mountWorldPosition']>[0], set: FlameSet): number {
    mech.mountWorldPosition(mount, _origin);
    const cp = Math.cos(mech.pitch);
    _dir.set(-Math.sin(mech.yaw) * cp, Math.sin(mech.pitch), -Math.cos(mech.yaw) * cp);
    this.particles.burst(_origin, _dir, set.flame);
    this.particles.burst(_origin, _dir, set.core);
    this.particles.burst(_origin, _dir, set.smoke);
    this.particles.burst(_origin, _dir, set.mouth);
    this.particles.burst(_origin, _dir, set.spark);
    // A névoa de calor: duas plumas por pulso ao longo do jato (a posição é função do contador, sem sorteio), mais largas quanto mais longe da boca.
    if (this.haze) {
      const k = this.n++;
      for (let p = 0; p < 2; p++) {
        const d = set.reach * (0.25 + 0.7 * hash01(k, p));
        const lado = (hash01(k + 9, p) - 0.5) * d * 0.32;
        this.haze.emit(_origin.x + _dir.x * d - _dir.z * lado, _origin.y + _dir.y * d + 0.35 + d * 0.035, _origin.z + _dir.z * d + _dir.x * lado, 1.3 + d * 0.17, 0.55, 0.85, 1.4);
      }
    }
    return set.perPulse;
  }
}
