import * as THREE from 'three';
import type { MechBase } from '../entities/MechBase';
import { weapon, type Tier, type WeaponStats } from '../combat/weapons';
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
 */
const FLAME_LIFE = 0.66;
const CORE_LIFE = 0.34;
const SMOKE_LIFE = 1.3;

interface FlameSet {
  flame: BurstOptions;
  core: BurstOptions;
  smoke: BurstOptions;
  mouth: BurstOptions;
  /** Quantas partículas cada pulso solta deste conjunto. */
  perPulse: number;
}

/** O conjunto de partículas de cada nível: a língua vai até o alcance da arma, e as línguas são mais numerosas nos níveis altos (mais pressão). */
function setFor(w: WeaponStats): FlameSet {
  const reach = w.maxRange;
  const flame: BurstOptions = { count: 5 + w.tier, color: new THREE.Color(2.0, 0.8, 0.12), speed: reach / FLAME_LIFE, life: FLAME_LIFE, size: 1.7, expansion: 3, spread: 0.26, gravity: -1.5, shape: SHAPE.flame };
  const core: BurstOptions = { count: 2, color: new THREE.Color(1.9, 1.5, 0.65), speed: (reach * 0.4) / CORE_LIFE, life: CORE_LIFE, size: 1.2, expansion: 1, spread: 0.1, gravity: -0.5, shape: SHAPE.flame };
  const smoke: BurstOptions = { count: 1, color: new THREE.Color(0.24, 0.25, 0.25), speed: (reach * 0.45) / SMOKE_LIFE, life: SMOKE_LIFE, size: 2.2, expansion: 2.6, spread: 0.4, gravity: -2.5, shape: SHAPE.puff };
  const mouth: BurstOptions = { count: 1, color: new THREE.Color(1.9, 1.3, 0.45), speed: 0, life: 0.1, size: 1.8, expansion: 1, gravity: 0 };
  return { flame, core, smoke, mouth, perPulse: flame.count + core.count + smoke.count + mouth.count };
}

/** Criados uma vez, na carga do módulo (G4): um conjunto por nível do lança-chamas. */
const SETS: Readonly<Record<Tier, FlameSet>> = { 0: setFor(weapon('flamer', 0)), 1: setFor(weapon('flamer', 1)), 2: setFor(weapon('flamer', 2)) };

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

  /** Quantas partículas este Mech solta neste pulso, somando as mãos que levam lança-chamas (para o teste e para o orçamento). */
  update(mech: MechBase): number {
    if (!this.pulse || !mech.status.flaming || !mech.alive || !mech.root.visible) return 0;
    const mounts = mech.triggers.primary;
    let n = 0;
    for (let i = 0; i < mounts.length; i++) {
      const w = i === 0 ? mech.loadout.primary : mech.loadout.offhand;
      if (!w?.flame) continue;
      n += this.emit(mech, mounts[i]!, SETS[w.tier]);
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
    return set.perPulse;
  }
}
