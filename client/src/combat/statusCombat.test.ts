import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { ANDROID_STATS, COLOSSUS_BOSS_STATS } from '../entities/chassis';
import type { MechBase, MechInput } from '../entities/MechBase';
import { VECTOR09_STATS, Vector09 } from '../entities/Vector09';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { CombatSystem } from './CombatSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { STATUS, type StatusInflict } from './StatusEffects';
import { weapon, type WeaponStats } from './weapons';

const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false, damageInRadius: () => {} } as unknown as Destructibles;
const ANDAR: MechInput = { moveX: 0, moveZ: 1, moveYaw: 0, yaw: 0, jump: false, dash: false };

/** Uma arma de teste: o plasma com o estado que o acerto aplica (as armas de verdade chegam depois deste contrato). */
const comEstado = (inflicts: StatusInflict, damage = 7): WeaponStats => ({ ...weapon('plasma'), damage, inflicts });

async function arena() {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(200, 2, 200));
  const combat = new CombatSystem(destructibles, debris, particles);
  const mortes: Array<{ mech: MechBase; killer?: MechBase }> = [];
  combat.onMechKilled = (mech, _at, killer) => mortes.push({ mech, killer });
  const target = new Vector09();
  target.spawn(physics, new THREE.Vector3(0, 0, 0));
  target.applyFacing(0, 0);
  const shooter = new Vector09();
  shooter.spawn(physics, new THREE.Vector3(0, 0, -40));
  combat.register(target);
  combat.register(shooter);
  const projectiles = new ProjectileSystem(new THREE.Scene(), physics, particles);
  projectiles.onHit = (hit, dir, dmg, owner, w, distance) => combat.onProjectileHit(hit, dir, dmg, owner, w, distance);
  physics.step();
  /** Atira do atirador contra o alvo, na altura `y` (corpo ~3,5 m; cabeça ~4,9 m). */
  const shoot = (w: WeaponStats, y = 3.5) => {
    projectiles.fire(new THREE.Vector3(0, y, -20), new THREE.Vector3(0, 0, 1), shooter.collider, true, w);
    for (let i = 0; i < 30; i++) {
      projectiles.fixedUpdate(FIXED_DT);
      physics.step();
    }
  };
  /** Passa `seconds` como o Match faz: os estados primeiro, depois o movimento do alvo. */
  const run = (seconds: number, input: MechInput | null = null) => {
    for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++) {
      combat.tickStatus(target, FIXED_DT);
      if (input) target.fixedUpdate(input, FIXED_DT);
      physics.step();
    }
  };
  const speed = () => Math.hypot(target.velocity.x, target.velocity.z);
  return { physics, combat, target, shooter, shoot, run, speed, mortes };
}

describe('estados no combate: choque e atordoamento', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('um acerto elétrico no corpo deixa chocado (35% mais lento), sem atordoar', async () => {
    const { target, shoot, run, speed } = await arena();
    run(1, ANDAR);
    const normal = speed();
    expect(normal).toBeGreaterThan(8);
    shoot(comEstado('shock'));
    expect(target.status.shocked).toBe(true);
    expect(target.status.stunned).toBe(false);
    run(1, ANDAR);
    expect(speed()).toBeCloseTo(normal * STATUS.shockSpeed, 0);
  });

  it('o tiro na cabeça atordoa: não anda, não pula, não dá dash e não atira, até o tempo acabar', async () => {
    const { target, shoot, run, speed } = await arena();
    shoot(comEstado('shock'), 4.9);
    expect(target.status.stunned).toBe(true);
    expect(target.canFirePrimary).toBe(false);
    expect(target.canFireSecondary).toBe(false);
    expect(target.canFireMount('rightHand')).toBe(false);
    run(0.4, { ...ANDAR, jump: true, dash: true });
    expect(speed()).toBeLessThan(0.01);
    run(STATUS.stunTime, ANDAR);
    expect(target.status.stunned).toBe(false);
    expect(target.canFirePrimary).toBe(true);
  });

  it('três acertos no corpo em sequência também atordoam', async () => {
    const { target, shoot, run } = await arena();
    shoot(comEstado('shock'));
    run(0.4);
    shoot(comEstado('shock'));
    expect(target.status.stunned).toBe(false);
    run(0.4);
    shoot(comEstado('shock'));
    expect(target.status.stunned).toBe(true);
  });

  it('um acerto que não chega ao corpo (dano zero, como um escudo que absorveu tudo) não deixa estado', async () => {
    const { target, shoot } = await arena();
    shoot(comEstado('shock', 0));
    expect(target.status.active).toBe(false);
  });
});

describe('estados no combate: gelo', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('três acertos de gelo congelam: o congelado não anda, mas atira, e leva 20% mais dano', async () => {
    const { target, shoot, run, speed } = await arena();
    for (let i = 0; i < 3; i++) shoot(comEstado('chill', 1));
    expect(target.status.isFrozen).toBe(true);
    expect(target.canFirePrimary).toBe(true);
    run(0.5, ANDAR);
    expect(speed()).toBeLessThan(0.01);
    const antes = target.modules.torso;
    shoot(weapon('plasma'));
    expect(antes - target.modules.torso).toBeCloseTo(weapon('plasma').damage * STATUS.frozenDamage, 5);
  });

  it('cada acúmulo segura mais a velocidade', async () => {
    const { target, shoot, run, speed } = await arena();
    run(1, ANDAR);
    const normal = speed();
    shoot(comEstado('chill', 1));
    run(1, ANDAR);
    expect(target.status.stacks).toBe(1);
    expect(speed()).toBeCloseTo(normal * (1 - STATUS.chillStep), 0);
  });
});

describe('estados no combate: fogo', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('queimando tira vida do torso por segundo e esquenta o Mech, sem marcar acerto a cada tick', async () => {
    const { combat, target, shoot, run } = await arena();
    let marcas = 0;
    combat.onMechHit = () => marcas++;
    shoot(comEstado('burn', 1));
    const depoisDoTiro = target.modules.torso;
    const calor = target.heat;
    marcas = 0;
    run(2);
    expect(depoisDoTiro - target.modules.torso).toBeCloseTo(STATUS.burnDps * 2, 0);
    expect(target.heat).toBeGreaterThan(calor);
    expect(marcas).toBe(0);
  });

  it('o gelo apaga o fogo (e o dano por segundo para)', async () => {
    const { target, shoot, run } = await arena();
    shoot(comEstado('burn', 1));
    shoot(comEstado('chill', 1));
    expect(target.status.burning).toBe(false);
    const torso = target.modules.torso;
    run(1);
    expect(target.modules.torso).toBe(torso);
  });

  it('quem morre queimando conta como abate de quem acendeu o fogo', async () => {
    const { target, shooter, shoot, run, mortes } = await arena();
    target.modules.torso = 6;
    shoot(comEstado('burn', 1));
    expect(target.alive).toBe(true);
    run(3);
    expect(target.alive).toBe(false);
    expect(mortes).toHaveLength(1);
    expect(mortes[0]!.mech).toBe(target);
    expect(mortes[0]!.killer).toBe(shooter);
  });

  it('morrer e renascer limpa todos os estados', async () => {
    const { target, shoot } = await arena();
    shoot(comEstado('burn', 1));
    shoot(comEstado('shock', 1), 4.9);
    expect(target.status.active).toBe(true);
    target.respawn(new THREE.Vector3(0, 0, 0));
    expect(target.status.active).toBe(false);
    expect(target.status.bits).toBe(0);
  });
});

describe('estados no combate: o chassi decide quanto dura', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('o dado do chassi chega ao Mech: o Colossus resiste (metade), o andróide sofre mais (uma vez e meia)', () => {
    expect(COLOSSUS_BOSS_STATS.statusResist).toBe(0.5);
    expect(ANDROID_STATS.statusResist).toBe(1.5);
    expect(VECTOR09_STATS.statusResist).toBeUndefined();
    const grande = new Vector09({ stats: COLOSSUS_BOSS_STATS });
    const comum = new Vector09();
    grande.status.burnUp();
    comum.status.burnUp();
    expect(grande.status.burn).toBeCloseTo(comum.status.burn * 0.5, 5);
  });
});

describe('estados no Match: o tempo corre no passo fixo, antes dos pilotos', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('o dano por segundo sai sozinho a cada passo do Match, e o jogador que queima morre com crédito a quem acendeu', async () => {
    const physics = await PhysicsWorld.create();
    const match = new Match({
      physics,
      scene: new THREE.Scene(),
      particles,
      foes: { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false },
      debris: false,
      roundS: Number.POSITIVE_INFINITY,
    });
    const me = new Vector09();
    match.addPlayer(me, 'VOCÊ');
    match.respawner.untrack(me);
    const origem = new Vector09();
    match.addPlayer(origem, 'ORIGEM');
    match.respawner.untrack(origem);
    const mortes: Array<MechBase | undefined> = [];
    match.combat.onMechKilled = (_m, _at, killer) => mortes.push(killer);
    me.status.burnUp(origem);
    const torso0 = me.modules.torso;
    for (let i = 0; i < 60; i++) match.step(FIXED_DT);
    expect(torso0 - me.modules.torso).toBeCloseTo(STATUS.burnDps, 0);
    me.modules.torso = 1;
    for (let i = 0; i < 60; i++) match.step(FIXED_DT);
    expect(me.alive).toBe(false);
    expect(mortes).toEqual([origem]);
  });
});
