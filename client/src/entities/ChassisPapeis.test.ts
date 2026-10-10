import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { CHASSIS, CHASSIS_PAPEL, VECTOR09_STATS, type ChassisId } from './chassis';
import type { MechStats } from './MechBase';
import { Vector09 } from './Vector09';

/**
 * Cada chassi tem um papel (10/10, pedido do dono: "formatos e identidade diferentes, não praticamente idênticos"; antes, seis dos dez
 * tinham exatamente os números do Vector-09). Os números são uma proposta e moram em `chassis.ts`; o que este teste trava é a ideia:
 * papéis distintos, nenhum melhor que outro em tudo, e a carga, o calor e o tamanho intactos.
 */
const vidaTotal = (s: MechStats) => Object.values(s.maxModuleHealth).reduce((a, b) => a + b, 0);
const IDS = Object.keys(CHASSIS) as ChassisId[];
/** Os Mechs do Hangar (o andróide é de outra classe: pequeno, e a Arara o supera nos três números sem ser "melhor", pois é outro bicho). */
const MECHS = IDS.filter((id) => id !== 'android');
/** Os médios que herdavam o Vector-09: agora cada um com o seu. */
const MEDIOS = ['vector09', 'genesis01', 'lancerL1', 'lr7lBastion', 'quadraV2', 'marauder'] as const;

describe('chassis: cada um com o seu papel', () => {
  it('todo chassi tem um papel escrito, e nenhum papel se repete', () => {
    const papeis = IDS.map((id) => CHASSIS_PAPEL[id]);
    expect(papeis.every((p) => p.length > 20)).toBe(true);
    expect(new Set(papeis).size).toBe(IDS.length);
  });

  it('nenhum par de chassis tem os mesmos números (antes, 6 de 10 eram idênticos ao Vector-09)', () => {
    const assinatura = (s: MechStats) => [s.moveSpeed, s.groundAccel, s.airAccel, s.dashSpeed, s.dashCooldown, s.jumpVelocity, ...Object.values(s.maxModuleHealth)].join('|');
    const vistas = new Map<string, ChassisId>();
    for (const id of IDS) {
      const a = assinatura(CHASSIS[id]);
      expect(vistas.get(a), `${id} tem os mesmos números de ${vistas.get(a)}`).toBeUndefined();
      vistas.set(a, id);
    }
  });

  it('nenhum Mech é melhor que outro em tudo: velocidade, vida total e carga de armas (sempre há uma troca)', () => {
    for (const a of MECHS) {
      for (const b of MECHS) {
        if (a === b) continue;
        const A = CHASSIS[a];
        const B = CHASSIS[b];
        const domina =
          A.moveSpeed >= B.moveSpeed && vidaTotal(A) >= vidaTotal(B) && A.weaponCapacity >= B.weaponCapacity &&
          (A.moveSpeed > B.moveSpeed || vidaTotal(A) > vidaTotal(B) || A.weaponCapacity > B.weaponCapacity);
        expect(domina, `${a} domina ${b} nos três números`).toBe(false);
      }
    }
  });

  it('a ordem dos papéis: o escaramuçador é o mais rápido dos médios e o tanque o mais resistente; velocidade e vida andam em sentidos opostos', () => {
    const rapidez = [...MEDIOS].sort((x, y) => CHASSIS[y].moveSpeed - CHASSIS[x].moveSpeed);
    expect(rapidez).toEqual(['quadraV2', 'lancerL1', 'vector09', 'genesis01', 'marauder', 'lr7lBastion']);
    const resistencia = [...MEDIOS].sort((x, y) => vidaTotal(CHASSIS[y]) - vidaTotal(CHASSIS[x]));
    expect(resistencia).toEqual(['lr7lBastion', 'marauder', 'genesis01', 'vector09', 'lancerL1', 'quadraV2']);
    // O tanque tem o maior tronco, o escaramuçador o menor; o dash do rápido volta antes e o do pesado, depois.
    expect(CHASSIS.lr7lBastion.maxModuleHealth.torso).toBeGreaterThan(CHASSIS.marauder.maxModuleHealth.torso);
    expect(CHASSIS.quadraV2.maxModuleHealth.torso).toBeLessThan(CHASSIS.lancerL1.maxModuleHealth.torso);
    expect(CHASSIS.quadraV2.dashCooldown).toBeLessThan(CHASSIS.vector09.dashCooldown);
    expect(CHASSIS.lr7lBastion.dashCooldown).toBeGreaterThan(CHASSIS.vector09.dashCooldown);
  });

  it('o duelista leva o escudo no braço mais forte (o esquerdo), e o Marauder (4 canos) tem mais vida que o médio de referência', () => {
    const l = CHASSIS.lancerL1.maxModuleHealth;
    expect(l.leftArm).toBeGreaterThan(l.rightArm);
    expect(l.leftArm).toBeGreaterThan(VECTOR09_STATS.maxModuleHealth.leftArm);
    expect(vidaTotal(CHASSIS.marauder)).toBeGreaterThan(vidaTotal(VECTOR09_STATS));
  });

  it('o que NÃO muda nos médios: carga, calor e tamanho do corpo (as metas de equilíbrio das armas e as bocas medidas dependem disto)', () => {
    for (const id of MEDIOS) {
      const s = CHASSIS[id];
      for (const campo of ['weaponCapacity', 'heatCooling', 'heatCoolDelay', 'heatRecover', 'heatIdleCooling', 'heatRun', 'heatJump', 'heatDash', 'heatPerDamage', 'radius', 'height', 'stepHeight', 'maxJumps'] as const) {
        expect(s[campo], `${id}.${campo}`).toBe(VECTOR09_STATS[campo]);
      }
    }
  });
});

describe('chassis: os números valem de verdade no jogo (simulação)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  /** Velocidade que o chassi alcança correndo em linha reta no chão plano (m/s, depois de acelerar). */
  async function velocidadeMaxima(id: ChassisId): Promise<number> {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(800, 2, 800));
    const mech = new Vector09({ stats: CHASSIS[id] });
    mech.spawn(physics, new THREE.Vector3(0, 0, 0));
    let v = 0;
    for (let i = 0; i < 120; i++) {
      mech.fixedUpdate({ moveX: 0, moveZ: 1, moveYaw: 0, yaw: 0, jump: false, dash: false }, FIXED_DT);
      physics.step();
      v = Math.hypot(mech.velocity.x, mech.velocity.z);
    }
    return v;
  }

  it('cada médio corre na velocidade do seu papel, e a ordem de quem chega primeiro é a ordem dos papéis', async () => {
    const medido: Record<string, number> = {};
    for (const id of MEDIOS) {
      medido[id] = await velocidadeMaxima(id);
      expect(Math.abs(medido[id]! - CHASSIS[id].moveSpeed), `${id}: ${medido[id]!.toFixed(2)} m/s`).toBeLessThan(CHASSIS[id].moveSpeed * 0.04);
    }
    expect(medido.quadraV2!).toBeGreaterThan(medido.lancerL1!);
    expect(medido.lancerL1!).toBeGreaterThan(medido.vector09!);
    expect(medido.vector09!).toBeGreaterThan(medido.genesis01!);
    expect(medido.genesis01!).toBeGreaterThan(medido.marauder!);
    expect(medido.marauder!).toBeGreaterThan(medido.lr7lBastion!);
  });

  it('a vida de cada papel é a que o corpo carrega: o tanque leva mais tiros no tronco que o escaramuçador antes de cair', async () => {
    const physics = await PhysicsWorld.create();
    const tiros = (id: ChassisId) => {
      const mech = new Vector09({ stats: CHASSIS[id] });
      mech.spawn(physics, new THREE.Vector3(0, 0, 0));
      let n = 0;
      while (mech.modules.torso > 0 && n < 1000) {
        mech.damagePart('torso', 25);
        n++;
      }
      return n;
    };
    expect(tiros('lr7lBastion')).toBe(Math.ceil(460 / 25));
    expect(tiros('quadraV2')).toBe(Math.ceil(210 / 25));
    expect(tiros('lr7lBastion')).toBeGreaterThan(tiros('vector09'));
    expect(tiros('vector09')).toBeGreaterThan(tiros('quadraV2'));
  });
});
