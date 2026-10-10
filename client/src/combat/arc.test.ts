import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MechInput } from '../entities/MechBase';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Armament, type ShotSink } from './Armament';
import { drill, sustainedDps, timeToKill } from './balance';
import { CombatSystem } from './CombatSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { STATUS } from './StatusEffects';
import { DAMAGE_TYPE, hitDamage, weapon, type WeaponStats } from './weapons';

const V = VECTOR09_STATS;
const TORSO = V.maxModuleHealth.torso;
const ARC = weapon('arc');
const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false, damageInRadius: () => {} } as unknown as Destructibles;
const ANDAR: MechInput = { moveX: 0, moveZ: 1, moveYaw: 0, yaw: 0, jump: false, dash: false };

describe('arma elétrica: números e equilíbrio', () => {
  it('é de energia, sem carregador, aplica choque e tem natureza elétrica; pesa 2,5 / 3,75 / 5 t e bate 7 / 8 / 10', () => {
    expect(ARC.kind).toBe('energy');
    expect(ARC.magazine).toBe(0);
    expect(ARC.inflicts).toBe('shock');
    expect(DAMAGE_TYPE.arc).toBe('eletrico');
    expect(([0, 1, 2] as const).map((t) => weapon('arc', t).mass)).toEqual([2.5, 3.75, 5]);
    expect(([0, 1, 2] as const).map((t) => weapon('arc', t).damage)).toEqual([7, 8, 10]);
    expect(([0, 1, 2] as const).every((t) => weapon('arc', t).inflicts === 'shock')).toBe(true);
  });

  it('é arma de apoio: sozinha, em nenhum nível derruba um torso em menos de 12 s (o plasma leva ~5,7 s)', () => {
    for (const t of [0, 1, 2] as const) expect(timeToKill([weapon('arc', t)], V, TORSO)).toBeGreaterThan(12);
    expect(timeToKill([ARC], V, TORSO)).toBeGreaterThan(timeToKill([weapon('plasma')], V, TORSO) * 2.5);
    expect(sustainedDps(ARC, V)).toBeLessThan(sustainedDps(weapon('plasma'), V) * 0.5);
  });

  it('com a outra mão, nenhum combo derruba em menos de 2,5 s: o estado não vira morte rápida', () => {
    for (const a of [0, 1, 2] as const) for (const r of [0, 1, 2] as const) {
      expect(timeToKill([weapon('arc', a), weapon('rockets', r)], V, TORSO)).toBeGreaterThan(2.5);
      expect(timeToKill([weapon('arc', a), weapon('plasma', r)], V, TORSO)).toBeGreaterThan(2.5);
    }
  });

  it('a cadência cabe na janela do tiro bem dado: três acertos seguidos levam menos que 1,4 s', () => {
    expect(ARC.fireInterval * (STATUS.comboHits - 1)).toBeLessThan(STATUS.comboWindow);
  });

  it('o calor não é o freio dela (é lenta): atirando sem parar por 30 s o Mech não ferve; o MK III também não', () => {
    for (const t of [0, 2] as const) expect(drill(V, { speed: 0, fire: [weapon('arc', t)] }, 30, Infinity).overheatAt).toBeNull();
  });

  it('o dano cai de 7 a 50 m para a metade a 130 m (alcance máximo)', () => {
    expect(hitDamage(ARC, 10)).toBe(7);
    expect(hitDamage(ARC, 50)).toBe(7);
    expect(hitDamage(ARC, ARC.maxRange)).toBe(Math.round(7 * ARC.minFactor));
  });

  it('é mais lenta que o plasma no projétil e na cadência, e pesa menos', () => {
    expect(ARC.speed).toBeLessThan(weapon('plasma').speed);
    expect(ARC.fireInterval).toBeGreaterThan(weapon('plasma').fireInterval);
    expect(ARC.mass).toBeLessThan(weapon('plasma').mass);
  });
});

describe('arma elétrica: o estado no combate de verdade (física, projétil e dano)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function arena(w: WeaponStats = ARC) {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(200, 2, 200));
    const combat = new CombatSystem(destructibles, debris, particles);
    const target = new Vector09();
    target.spawn(physics, new THREE.Vector3(0, 0, 0));
    target.applyFacing(0, 0); // olha para -Z, de frente para o atirador
    const shooter = new Vector09();
    shooter.spawn(physics, new THREE.Vector3(0, 0, -40));
    combat.register(target);
    combat.register(shooter);
    const projectiles = new ProjectileSystem(new THREE.Scene(), physics, particles);
    projectiles.onHit = (hit, dir, dmg, owner, hw, distance) => combat.onProjectileHit(hit, dir, dmg, owner, hw, distance);
    physics.step();
    const run = (seconds: number, input: MechInput | null = null) => {
      for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++) {
        combat.tickStatus(target, FIXED_DT);
        if (input) target.fixedUpdate(input, FIXED_DT);
        projectiles.fixedUpdate(FIXED_DT);
        physics.step();
      }
    };
    /** Um tiro da arma elétrica (corpo ~3,5 m de altura, cabeça ~4,9 m) e o tempo para chegar. */
    const shoot = (y = 3.5, weaponUsed: WeaponStats = w) => {
      projectiles.fire(new THREE.Vector3(0, y, -20), new THREE.Vector3(0, 0, 1), shooter.collider, true, weaponUsed);
      run(0.5);
    };
    const speed = () => Math.hypot(target.velocity.x, target.velocity.z);
    return { physics, combat, target, shooter, shoot, run, speed };
  }

  it('um acerto no corpo deixa chocado: 35% mais lento e perdendo vida aos poucos, sem atordoar', async () => {
    const { target, shoot, run, speed } = await arena();
    run(1, ANDAR);
    const normal = speed();
    const antes = target.modules.torso;
    shoot();
    expect(target.status.shocked).toBe(true);
    expect(target.status.stunned).toBe(false);
    // O tiro (7) e o pouco que o choque já tirou nos ~0,3 s entre o impacto e o fim do `shoot`.
    expect(antes - target.modules.torso).toBeGreaterThanOrEqual(hitDamage(ARC, 20));
    expect(antes - target.modules.torso).toBeLessThan(hitDamage(ARC, 20) + STATUS.shockDps);
    run(1, ANDAR);
    expect(speed()).toBeCloseTo(normal * STATUS.shockSpeed, 0);
    // O choque tira STATUS.shockDps por segundo por STATUS.shockTime s do torso, além do tiro.
    const depoisDoTiro = target.modules.torso;
    run(STATUS.shockTime + 0.5);
    expect(target.status.shocked).toBe(false);
    expect(depoisDoTiro - target.modules.torso).toBeGreaterThan(STATUS.shockDps * (STATUS.shockTime - 1.5) - 0.5);
    expect(depoisDoTiro - target.modules.torso).toBeLessThanOrEqual(STATUS.shockDps * STATUS.shockTime + 0.5);
  });

  it('o tiro na cabeça atordoa por 0,8 s: não anda e não atira; depois volta, e um segundo tiro na cabeça não atordoa de novo por 4 s', async () => {
    const { target, shoot, run, speed } = await arena();
    shoot(4.9);
    expect(target.status.stunned).toBe(true);
    expect(target.canFirePrimary).toBe(false);
    run(0.3, ANDAR);
    expect(speed()).toBeLessThan(0.01);
    run(STATUS.stunTime, ANDAR);
    expect(target.status.stunned).toBe(false);
    expect(target.canFirePrimary).toBe(true);
    shoot(4.9); // ainda na imunidade (conta do início do primeiro atordoamento)
    expect(target.status.stunned).toBe(false);
    expect(target.status.shocked).toBe(true); // mas o choque renova
    run(STATUS.stunImmune);
    shoot(4.9);
    expect(target.status.stunned).toBe(true); // passada a imunidade, atordoa de novo
  });

  it('três acertos no corpo no ritmo da arma atordoam; no mesmo número de acertos mais devagar que a janela, não', async () => {
    const rapido = await arena();
    for (let i = 0; i < STATUS.comboHits; i++) {
      rapido.shoot();
      expect(rapido.target.status.stunned).toBe(i === STATUS.comboHits - 1);
    }
    // Cada "shoot" gasta 0,5 s (voo e folga): os acertos caem a ~0,5 s um do outro, dentro da janela de 1,4 s.
    expect(rapido.target.status.stunned).toBe(true);

    const lento = await arena();
    for (let i = 0; i < STATUS.comboHits; i++) {
      lento.shoot();
      lento.run(STATUS.comboWindow + 0.2);
    }
    expect(lento.target.status.stunned).toBe(false); // cada acerto chegou depois da janela do anterior: a sequência recomeça
    expect(lento.target.status.shocked).toBe(true); // o choque (lentidão) vale em todo acerto
  });

  it('a chapa cerâmica levantada isola o choque; a de aço não; de costas para o tiro, nada isola', async () => {
    const arm = VECTOR09_STATS.maxModuleHealth.leftArm;
    const ceramica = await arena();
    ceramica.target.metalShield.equip({ id: 'refratario', tier: 0 }, arm);
    ceramica.target.guard(true);
    expect(ceramica.target.metalShield.raised).toBe(true);
    ceramica.shoot();
    expect(ceramica.target.status.active).toBe(false);
    expect(ceramica.target.metalShield.integrity).toBeLessThan(ceramica.target.metalShield.maxIntegrity); // a chapa levou o tiro

    const aco = await arena();
    aco.target.metalShield.equip({ id: 'muralha', tier: 0 }, arm);
    aco.target.guard(true);
    aco.shoot();
    expect(aco.target.status.shocked).toBe(true);

    const costas = await arena();
    costas.target.metalShield.equip({ id: 'refratario', tier: 0 }, arm);
    costas.target.applyFacing(Math.PI, 0);
    costas.target.guard(true);
    costas.shoot();
    expect(costas.target.status.shocked).toBe(true);

    const baixa = await arena();
    baixa.target.metalShield.equip({ id: 'refratario', tier: 0 }, arm);
    baixa.shoot(); // sem apertar o botão 2: a chapa não está erguida
    expect(baixa.target.status.shocked).toBe(true);
  });

  it('a mesma regra vale para o estado que vem de uma explosão: a chapa que segura mais da metade não deixa passar, a que segura menos deixa', async () => {
    const queima: WeaponStats = { ...weapon('rockets'), inflicts: 'burn' }; // não existe arma assim ainda: exercita o caminho da explosão
    const arm = VECTOR09_STATS.maxModuleHealth.leftArm;
    for (const [id, pega] of [['reativo', false], ['muralha', false], ['refratario', true]] as const) {
      const { combat, target, shooter } = await arena();
      target.metalShield.equip({ id, tier: 0 }, arm);
      target.guard(true);
      combat.explode(new THREE.Vector3(0, 2, -3), new THREE.Vector3(0, 0, 1), shooter.collider, queima);
      expect(target.status.active, id).toBe(pega);
    }
    const aberto = await arena();
    aberto.combat.explode(new THREE.Vector3(0, 2, -3), new THREE.Vector3(0, 0, 1), aberto.shooter.collider, queima);
    expect(aberto.target.status.active).toBe(true); // sem chapa nenhuma, a explosão acende
  });

  it('o campo de energia que segura o tiro quase todo também não deixa choque; sobrando muito, deixa', async () => {
    const forte = await arena();
    forte.target.energyShield.equip(true);
    forte.target.energyShield.step(FIXED_DT, true);
    forte.shoot();
    expect(forte.target.status.active).toBe(false);

    const fraco = await arena();
    fraco.target.energyShield.equip(true);
    fraco.target.energyShield.step(FIXED_DT, true);
    fraco.target.energyShield.energy = 2; // segura 2 dos 7: passam 5, mais da metade
    fraco.shoot();
    expect(fraco.target.status.shocked).toBe(true);
  });

  it('na mão esquerda (botão secundário) a elétrica atira como o plasma e leva o choque junto', () => {
    const mech = new Vector09({ loadout: { primary: weapon('plasma'), secondary: ARC } });
    const armament = new Armament(mech);
    const shots: Array<{ mount: string; w: WeaponStats }> = [];
    const sink: ShotSink = { projectile: (mount, w) => shots.push({ mount, w }), rocket: () => {}, melee: () => {} };
    for (let i = 0; i < 60; i++) armament.fixedUpdate(FIXED_DT, false, true, sink);
    expect(shots.length).toBeGreaterThanOrEqual(2);
    expect(shots.every((x) => x.mount === 'leftHand' && x.w.id === 'arc' && x.w.inflicts === 'shock')).toBe(true);
  });
});
