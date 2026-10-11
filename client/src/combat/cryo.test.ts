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
const CRYO = weapon('cryo');
const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const destructibles = { damage: () => false, damageInRadius: () => {} } as unknown as Destructibles;
const ANDAR: MechInput = { moveX: 0, moveZ: 1, moveYaw: 0, yaw: 0, jump: false, dash: false };

describe('arma de gelo: números e equilíbrio', () => {
  it('é de energia, sem carregador, aplica gelado e tem natureza criogênica; pesa 3 / 4,5 / 6 t e bate 5 / 6 / 7', () => {
    expect(CRYO.kind).toBe('energy');
    expect(CRYO.magazine).toBe(0);
    expect(CRYO.inflicts).toBe('chill');
    expect(CRYO.tracer).toBe('ice');
    expect(DAMAGE_TYPE.cryo).toBe('criogenico');
    expect(([0, 1, 2] as const).map((t) => weapon('cryo', t).mass)).toEqual([3, 4.5, 6]);
    expect(([0, 1, 2] as const).map((t) => weapon('cryo', t).damage)).toEqual([5, 6, 7]);
    expect(([0, 1, 2] as const).every((t) => weapon('cryo', t).inflicts === 'chill')).toBe(true);
  });

  it('é arma de apoio: sozinha, em nenhum nível derruba um torso em menos de 20 s (o plasma leva ~5,7 s)', () => {
    for (const t of [0, 1, 2] as const) expect(timeToKill([weapon('cryo', t)], V, TORSO)).toBeGreaterThan(20);
    expect(timeToKill([CRYO], V, TORSO)).toBeGreaterThan(timeToKill([weapon('plasma')], V, TORSO) * 3);
    expect(sustainedDps(CRYO, V)).toBeLessThan(sustainedDps(weapon('plasma'), V) * 0.4);
  });

  it('com a outra mão, nenhum combo derruba em menos de 2,5 s: o estado não vira morte rápida', () => {
    for (const a of [0, 1, 2] as const) for (const r of [0, 1, 2] as const) {
      expect(timeToKill([weapon('cryo', a), weapon('rockets', r)], V, TORSO)).toBeGreaterThan(2.5);
      expect(timeToKill([weapon('cryo', a), weapon('plasma', r)], V, TORSO)).toBeGreaterThan(2.5);
    }
  });

  it('o congelamento cabe na cadência, e o controle não vira permanente', () => {
    // Três acertos no ritmo da arma levam 1,2 s: dentro dos 4 s em que os acúmulos de gelado duram.
    expect(CRYO.fireInterval * (STATUS.chillMax - 1)).toBeLessThan(STATUS.chillTime);
    // O alvo congelado fica 1,5 s parado, e só pode congelar de novo 5 s depois do início: no máximo ~30% do tempo travado.
    expect(STATUS.freezeTime).toBeLessThan(STATUS.freezeImmune);
    expect(STATUS.freezeTime / STATUS.freezeImmune).toBeLessThan(0.35);
  });

  it('o calor não é o freio dela (é lenta): atirando sem parar por 30 s o Mech não ferve; o MK III também não', () => {
    for (const t of [0, 2] as const) expect(drill(V, { speed: 0, fire: [weapon('cryo', t)] }, 30, Infinity).overheatAt).toBeNull();
  });

  it('o gelo é de curto e médio alcance (dono, 11/10: "está indo muito longe"): cheio até 20 m e some aos 55 m, pela metade', () => {
    expect(CRYO.optimalRange).toBe(20);
    expect(CRYO.maxRange).toBe(55);
    expect(hitDamage(CRYO, 10)).toBe(5);
    expect(hitDamage(CRYO, 20)).toBe(5);
    expect(hitDamage(CRYO, CRYO.maxRange)).toBe(Math.round(5 * CRYO.minFactor));
  });

  it('alcança menos que todas as armas de projétil que não são de curto alcance (plasma, elétrica, EMP, trilho, automático): o frio é arma de perto', () => {
    for (const id of ['plasma', 'arc', 'emp', 'railgun', 'autocannon', 'cannon'] as const) expect(CRYO.maxRange, id).toBeLessThan(weapon(id).maxRange);
    expect(CRYO.maxRange).toBeLessThanOrEqual(60);
  });

  it('o projétil é mais lento que o da elétrica e o do plasma, e a cadência é a mais lenta das três', () => {
    expect(CRYO.speed).toBe(70);
    expect(CRYO.speed).toBeLessThan(weapon('arc').speed);
    expect(CRYO.speed).toBeLessThan(weapon('plasma').speed);
    expect(CRYO.fireInterval).toBeGreaterThan(weapon('arc').fireInterval);
    expect(CRYO.fireInterval).toBeGreaterThan(weapon('plasma').fireInterval);
  });
});

describe('arma de gelo: o estado no combate de verdade (física, projétil e dano)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function arena(w: WeaponStats = CRYO) {
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
    /** Um tiro da arma de gelo no corpo (altura ~3,5 m) e o tempo para chegar (70 m/s: ~0,3 s a 20 m). */
    const shoot = (y = 3.5, weaponUsed: WeaponStats = w) => {
      projectiles.fire(new THREE.Vector3(0, y, -20), new THREE.Vector3(0, 0, 1), shooter.collider, true, weaponUsed);
      run(0.5);
    };
    const speed = () => Math.hypot(target.velocity.x, target.velocity.z);
    return { physics, combat, target, shooter, shoot, run, speed };
  }

  it('um acerto no corpo deixa gelado com um acúmulo: 15% mais lento, sem congelar nem tirar vida aos poucos; o estado passa sozinho', async () => {
    const { target, shoot, run, speed } = await arena();
    run(1, ANDAR);
    const normal = speed();
    const antes = target.modules.torso;
    shoot();
    expect(target.status.stacks).toBe(1);
    expect(target.status.isFrozen).toBe(false);
    expect(target.status.burning || target.status.shocked || target.status.stunned).toBe(false);
    expect(antes - target.modules.torso).toBe(hitDamage(CRYO, 20)); // só o tiro: o gelo não causa dano por segundo
    run(1, ANDAR);
    expect(speed()).toBeCloseTo(normal * (1 - STATUS.chillStep), 0);
    const depois = target.modules.torso;
    run(STATUS.chillTime + 0.5);
    expect(target.status.stacks).toBe(0);
    expect(target.status.active).toBe(false);
    expect(target.modules.torso).toBe(depois); // nenhum dano a mais enquanto o gelo passava
  });

  it('três acertos seguidos congelam: o alvo para, leva 20% a mais de dano e, passados 1,5 s, volta a andar (mais lento)', async () => {
    const { target, shoot, run, speed } = await arena();
    run(1, ANDAR);
    const normal = speed();
    shoot();
    shoot();
    expect(target.status.stacks).toBe(2);
    expect(target.status.isFrozen).toBe(false);
    run(0.3, ANDAR);
    expect(speed()).toBeCloseTo(normal * (1 - 2 * STATUS.chillStep), 0);
    shoot(); // o terceiro acúmulo
    expect(target.status.isFrozen).toBe(true);
    expect(target.status.stacks).toBe(0);
    run(0.3, ANDAR);
    expect(speed()).toBeLessThan(0.01); // congelado: nem anda
    expect(target.canFirePrimary).toBe(true); // o congelado ainda mira e atira: quem trava é o movimento
    // O congelado quebra mais fácil: o mesmo tiro tira 20% a mais.
    const antes = target.modules.torso;
    shoot();
    expect(STATUS.frozenDamage).toBe(1.2); // o número do pedido do dono (ARMAS_ELEMENTAIS.md): +20% de dano no congelado
    expect(antes - target.modules.torso).toBeCloseTo(hitDamage(CRYO, 20) * 1.2, 5);
    run(STATUS.freezeTime + 0.2);
    expect(target.status.isFrozen).toBe(false);
  });

  it('depois de congelar, o alvo fica imune ao congelamento por 5 s (continua gelado e lento, sem encadear); passada a imunidade, congela de novo', async () => {
    const { target, shoot, run } = await arena();
    for (let i = 0; i < STATUS.chillMax; i++) shoot();
    expect(target.status.isFrozen).toBe(true);
    run(STATUS.freezeTime + 0.1);
    expect(target.status.isFrozen).toBe(false);
    // Ainda dentro dos 5 s de imunidade (contados do início do congelamento): três acertos não congelam, mas deixam o gelado no máximo.
    for (let i = 0; i < STATUS.chillMax; i++) shoot(3.5, CRYO);
    expect(target.status.isFrozen).toBe(false);
    expect(target.status.stacks).toBe(STATUS.chillMax);
    run(STATUS.freezeImmune);
    target.status.stacks = 0; // recomeça a contar do zero: o interesse aqui é só a imunidade ter passado
    for (let i = 0; i < STATUS.chillMax; i++) shoot();
    expect(target.status.isFrozen).toBe(true);
  });

  it('fogo e gelo se anulam: o gelo apaga a chama, e a chama derrete o gelo e o congelamento', async () => {
    const { target, shoot } = await arena();
    target.status.burnUp();
    expect(target.status.burning).toBe(true);
    shoot();
    expect(target.status.burning).toBe(false);
    expect(target.status.stacks).toBe(1);
    target.status.burnUp();
    expect(target.status.stacks).toBe(0);
    expect(target.status.isFrozen).toBe(false);
    const congelado = await arena();
    for (let i = 0; i < STATUS.chillMax; i++) congelado.shoot();
    expect(congelado.target.status.isFrozen).toBe(true);
    congelado.target.status.burnUp();
    expect(congelado.target.status.isFrozen).toBe(false);
  });

  it('a chapa cerâmica levantada isola o frio; a de aço, a reativa e a malha não; de costas para o tiro, nada isola', async () => {
    const arm = VECTOR09_STATS.maxModuleHealth.leftArm;
    const ceramica = await arena();
    ceramica.target.metalShield.equip({ id: 'refratario', tier: 0 }, arm);
    ceramica.target.guard(true);
    expect(ceramica.target.metalShield.raised).toBe(true);
    ceramica.shoot();
    expect(ceramica.target.status.active).toBe(false);
    expect(ceramica.target.metalShield.integrity).toBeLessThan(ceramica.target.metalShield.maxIntegrity); // a chapa levou o tiro

    for (const id of ['muralha', 'reativo', 'amortecedor'] as const) {
      const outra = await arena();
      outra.target.metalShield.equip({ id, tier: 0 }, arm);
      outra.target.guard(true);
      outra.shoot();
      expect(outra.target.status.stacks, id).toBe(1);
    }

    const costas = await arena();
    costas.target.metalShield.equip({ id: 'refratario', tier: 0 }, arm);
    costas.target.applyFacing(Math.PI, 0);
    costas.target.guard(true);
    costas.shoot();
    expect(costas.target.status.stacks).toBe(1);

    const baixa = await arena();
    baixa.target.metalShield.equip({ id: 'refratario', tier: 0 }, arm);
    baixa.shoot(); // sem apertar o botão 2: a chapa não está erguida
    expect(baixa.target.status.stacks).toBe(1);
  });

  it('o campo de energia que segura o tiro quase todo também não deixa gelo; sobrando muito, deixa', async () => {
    const forte = await arena();
    forte.target.energyShield.equip(true);
    forte.target.energyShield.step(FIXED_DT, true);
    forte.shoot();
    expect(forte.target.status.active).toBe(false);

    const fraco = await arena();
    fraco.target.energyShield.equip(true);
    fraco.target.energyShield.step(FIXED_DT, true);
    fraco.target.energyShield.energy = 1; // segura 1 dos 5: passam 4, mais da metade
    fraco.shoot();
    expect(fraco.target.status.stacks).toBe(1);
  });

  it('Mech grande resiste: o mesmo congelamento dura menos no Colossus do que no Vector-09 (a duração escala pelo `resist`)', async () => {
    const pequeno = await arena();
    const grande = await arena();
    grande.target.status.resist = 0.5;
    for (let i = 0; i < STATUS.chillMax; i++) {
      pequeno.shoot();
      grande.shoot();
    }
    expect(pequeno.target.status.frozen).toBeGreaterThan(grande.target.status.frozen);
    expect(grande.target.status.frozen).toBeLessThanOrEqual(STATUS.freezeTime * 0.5);
  });

  it('na mão esquerda (botão secundário) a de gelo atira como o plasma e leva o gelo junto', () => {
    const mech = new Vector09({ loadout: { primary: weapon('plasma'), secondary: CRYO } });
    const armament = new Armament(mech);
    const shots: Array<{ mount: string; w: WeaponStats }> = [];
    const sink: ShotSink = { projectile: (mount, w) => shots.push({ mount, w }), rocket: () => {}, melee: () => {}, flame: () => {}, wave: () => {} };
    for (let i = 0; i < 60; i++) armament.fixedUpdate(FIXED_DT, false, true, sink);
    expect(shots.length).toBeGreaterThanOrEqual(2);
    expect(shots.every((x) => x.mount === 'leftHand' && x.w.id === 'cryo' && x.w.inflicts === 'chill')).toBe(true);
  });
});
