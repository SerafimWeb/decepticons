import type { MechBase } from '../entities/MechBase';
import { SHOVE_DECAY } from '../entities/MechBase';
import type { MountId } from './mounts';
import type { WeaponStats } from './weapons';

/**
 * Arpão magnético (ombro, Ataque 2): um cabo que **prende** o inimigo à vista e o **puxa** para o atirador (`MechBase.push`, o mesmo empurrão do canhão sônico e da
 * reação ao tiro, só que para dentro). Regra de simulação (G1/G14: a mesma offline e no servidor, só o tick fixo, sem sorteio e sem alocação por tick); este módulo é dado e
 * regra, sem 3D: o desenho do cabo é `fx/HookVisuals`.
 *
 * O cabo **solta** quando: passa o tempo (`Hook.hold`), o alvo chega perto (`Hook.arrive`), um dos dois morre, o alvo se afasta além de `SNAP_RANGE` do alcance, o alvo
 * **usa o dash** (o contra-ataque: ele corta o cabo), ou uma parede passa a ficar no meio. E **o robô mais leve nunca puxa o mais pesado** (dono, 17/10: o arpão só rende nas mãos de um robô grande e pesado, e com estratégia): o peso é o raio da cápsula (`stats.radius`, o mesmo que já decide quanto o empurrão pesa em cada robô); alvo de raio maior que o do atirador não é preso.
 * Dois ombros que prendem o mesmo alvo **dividem um cabo só** (o puxão não dobra; o desenho mostra os dois).
 */
export const HOOK_POOL = 8;

/** O peso do robô para o arpão: o raio da cápsula (um andróide 0,36 m, o Vector-09 1,3 m, a Onça 1,6 m, o Colossus-01 3,6 m, o V4 5 m). Igual puxa igual; o mais leve não puxa o mais pesado. */
export const pesoDe = (m: MechBase): number => m.stats.radius;
/** O cabo estoura se o alvo passa deste múltiplo do alcance da arma. */
export const SNAP_RANGE = 1.25;
/** De quantos em quantos ticks o cabo confere a parede no meio (um raycast é o custo caro). */
const SIGHT_EVERY = 6;

export interface Hook {
  active: boolean;
  owner: MechBase | null;
  target: MechBase | null;
  w: WeaponStats | null;
  /** Segundos que faltam para o cabo soltar. */
  left: number;
  /** De onde saem os cabos (até dois ombros). */
  mountA: MountId | null;
  mountB: MountId | null;
  ticks: number;
}

export type HookEnd = 'timeout' | 'arrived' | 'dead' | 'snapped' | 'dash' | 'wall';

export class HookSystem {
  readonly pool: Hook[] = Array.from({ length: HOOK_POOL }, () => ({ active: false, owner: null, target: null, w: null, left: 0, mountA: null, mountB: null, ticks: 0 }));
  /** Um cabo soltou (para o som e as faíscas do desenho). */
  onEnd?: (h: Readonly<Hook>, why: HookEnd) => void;
  /** Um cabo prendeu um alvo (a partida do cliente e o servidor avisam o desenho). */
  onAttach?: (h: Readonly<Hook>) => void;

  constructor(
    /** O alvo está à vista do atirador (sem parede no meio)? A partida confere com o raycast dela. */
    private readonly sight: (owner: MechBase, target: MechBase) => boolean,
    /** Só quem tem o dano ligado puxa de verdade (o cliente online só desenha o cabo). */
    private readonly canPull: () => boolean,
  ) {}

  /** Quantos cabos estão presos agora. */
  get count(): number {
    let n = 0;
    for (const h of this.pool) if (h.active) n++;
    return n;
  }

  /**
   * Prende `target` com o arpão `w` (`w.hook`), vindo do encaixe `mount` de `owner`. Devolve se prendeu: alvo mais pesado que o atirador (`pesoDe`), o mesmo alvo já preso por este dono (o segundo ombro
   * só acrescenta o cabo e renova o tempo) e o fim do pool.
   */
  attach(owner: MechBase, target: MechBase, w: WeaponStats, mount: MountId): boolean {
    const hook = w.hook;
    if (!hook || owner === target || !owner.alive || !target.alive) return false;
    if (pesoDe(target) > pesoDe(owner)) return false;
    for (const h of this.pool) {
      if (h.active && h.owner === owner && h.target === target) {
        h.left = hook.hold;
        if (h.mountA !== mount && h.mountB === null) h.mountB = mount;
        return true;
      }
    }
    const h = this.pool.find((x) => !x.active);
    if (!h) return false;
    h.active = true;
    h.owner = owner;
    h.target = target;
    h.w = w;
    h.left = hook.hold;
    h.mountA = mount;
    h.mountB = null;
    h.ticks = 0;
    this.onAttach?.(h);
    return true;
  }

  private release(h: Hook, why: HookEnd): void {
    this.onEnd?.(h, why);
    h.active = false;
    h.owner = null;
    h.target = null;
    h.w = null;
    h.mountA = h.mountB = null;
  }

  /** Um tick (60 Hz): o puxão, o tempo e as condições de soltar. */
  fixedUpdate(dt: number): void {
    const pull = this.canPull();
    for (const h of this.pool) {
      if (!h.active) continue;
      const owner = h.owner!;
      const target = h.target!;
      const hook = h.w!.hook!;
      if (!owner.alive || !target.alive) {
        this.release(h, 'dead');
        continue;
      }
      h.left -= dt;
      if (h.left <= 0) {
        this.release(h, 'timeout');
        continue;
      }
      if (target.isDashing) {
        this.release(h, 'dash');
        continue;
      }
      const a = owner.simPosition;
      const b = target.simPosition;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const gap = Math.hypot(dx, dz) - owner.stats.radius - target.stats.radius;
      if (gap <= hook.arrive) {
        this.release(h, 'arrived');
        continue;
      }
      if (gap > h.w!.maxRange * SNAP_RANGE) {
        this.release(h, 'snapped');
        continue;
      }
      if (++h.ticks % SIGHT_EVERY === 0 && !this.sight(owner, target)) {
        this.release(h, 'wall');
        continue;
      }
      // Para manter uma velocidade de puxão `pullSpeed`, soma por tick o que o decaimento do empurrão (`SHOVE_DECAY`, 1/s) come: velocidade × taxa × dt.
      if (pull) target.push(dx, dz, hook.pullSpeed * SHOVE_DECAY * dt);
    }
  }

  /** Solta todos os cabos sem aviso (rodada nova, restart). */
  clear(): void {
    for (const h of this.pool) {
      h.active = false;
      h.owner = null;
      h.target = null;
      h.w = null;
      h.mountA = h.mountB = null;
    }
  }
}
