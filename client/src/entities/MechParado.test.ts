import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { ARARA_B1_STATS, COLOSSUS_BOSS_STATS, ONCA_B2_STATS } from './chassis';
import type { MechBase, MechInput } from './MechBase';
import { Vector09 } from './Vector09';

/**
 * O Mech parado não afunda no chão (achado 29/09, corrigido em 10/10).
 *
 * A causa: a cada tick o Mech apoiado ainda somava a gravidade (−9 mm) ao movimento pedido ao character controller; dentro da margem
 * de 5 cm do chão o controller devolve esse movimento em vez de segurar a cápsula, e o Mech descia ~0,5 m/s parado (um Vector-09 chegou a
 * −69 m em 6 s e atravessou o chão; o Colossus perdia 2 m em 3 s). Agora, apoiado e sem velocidade para cima, o movimento vertical pedido
 * é zero e o `snapToGround` do controller mantém o contato (desce rampa e degrau do mesmo jeito).
 */
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Chão plano e uma plataforma de 6 m (topo em y = 6, de x −58 a −42 e de z 27 a 43), como na Arena. */
async function mundo() {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(v(0, -1, 0), v(800, 2, 800));
  physics.addStaticBox(v(-50, 3, 35), v(16, 6, 16));
  return physics;
}

interface Passo {
  y: number;
  vy: number;
  speed: number;
  grounded: boolean;
}

function rodar(physics: PhysicsWorld, mech: MechBase, ticks: number, input: (tick: number) => MechInput = () => IDLE): Passo[] {
  const out: Passo[] = [];
  for (let i = 0; i < ticks; i++) {
    mech.fixedUpdate(input(i), FIXED_DT);
    physics.step();
    out.push({ y: mech.simPosition.y, vy: mech.velocity.y, speed: Math.hypot(mech.velocity.x, mech.velocity.z), grounded: mech.grounded });
  }
  return out;
}

const CHASSIS = [
  ['Vector-09', {}],
  ['Arara-B1 (leve)', { stats: ARARA_B1_STATS }],
  ['Onça-B2 (pesado)', { stats: ONCA_B2_STATS }],
  ['Colossus-01 (escala 3)', { stats: COLOSSUS_BOSS_STATS }],
] as const;

describe('Mech parado: não afunda no chão', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  for (const [nome, opcoes] of CHASSIS) {
    it(`${nome}: parado no chão por 10 s, os pés ficam onde estão (sem descer mais que o assentamento inicial)`, async () => {
      const physics = await mundo();
      const mech = new Vector09(opcoes);
      mech.spawn(physics, v(0, 0, 0));
      const passos = rodar(physics, mech, 600);
      const ys = passos.map((p) => p.y);
      expect(Math.min(...ys), 'o ponto mais baixo').toBeGreaterThan(-0.06); // só o assentamento dos primeiros ticks
      // E não deriva: o último segundo é igual ao primeiro depois de assentar.
      expect(Math.abs(ys.at(-1)! - ys[60]!), 'deriva entre 1 s e 10 s').toBeLessThan(0.002);
      expect(passos.at(-1)!.grounded).toBe(true);
    });
  }

  it('parado em cima da plataforma de 6 m também não afunda', async () => {
    const physics = await mundo();
    const mech = new Vector09({ stats: COLOSSUS_BOSS_STATS });
    mech.spawn(physics, v(-50, 6, 35));
    const passos = rodar(physics, mech, 360);
    expect(Math.min(...passos.map((p) => p.y))).toBeGreaterThan(6 - 0.06);
    expect(Math.abs(passos.at(-1)!.y - passos[60]!.y)).toBeLessThan(0.002);
  });

  it('corre e depois para: no chão ele fica parado e firme (a transição andar → parar não afunda)', async () => {
    const physics = await mundo();
    const mech = new Vector09({});
    mech.spawn(physics, v(0, 0, 0));
    const correr: MechInput = { moveX: 0, moveZ: 1, moveYaw: 0.4, yaw: 0.4, jump: false, dash: false };
    const passos = rodar(physics, mech, 60 + 300, (i) => (i < 60 ? correr : IDLE));
    const parado = passos.slice(120); // já freou
    expect(parado[0]!.speed).toBeLessThan(0.05);
    expect(Math.min(...parado.map((p) => p.y))).toBeGreaterThan(-0.06);
    expect(Math.abs(parado.at(-1)!.y - parado[0]!.y)).toBeLessThan(0.002);
  });

  it('a gravidade continua valendo: quem sai da beira da plataforma cai e pousa no chão', async () => {
    const physics = await mundo();
    const mech = new Vector09({});
    mech.spawn(physics, v(-50, 6, 38));
    const norte: MechInput = { moveX: 0, moveZ: 1, moveYaw: Math.PI, yaw: Math.PI, jump: false, dash: false }; // anda para +Z, para fora da borda
    const passos = rodar(physics, mech, 240, () => norte);
    expect(Math.min(...passos.map((p) => p.vy)), 'caiu de verdade (velocidade para baixo)').toBeLessThan(-6);
    expect(passos.at(-1)!.y).toBeCloseTo(0, 1);
    expect(passos.at(-1)!.grounded).toBe(true);
  });

  it('o pulo sobe, cai e pousa no mesmo chão sem afundar', async () => {
    const physics = await mundo();
    const mech = new Vector09({});
    mech.spawn(physics, v(0, 0, 0));
    rodar(physics, mech, 30); // assenta
    const passos = rodar(physics, mech, 240, (i) => (i === 0 ? { ...IDLE, jump: true } : IDLE));
    expect(Math.max(...passos.map((p) => p.y)), 'altura do pulo').toBeGreaterThan(1.5);
    expect(passos.at(-1)!.y).toBeGreaterThan(-0.06);
    expect(passos.at(-1)!.y).toBeLessThan(0.06);
    expect(passos.at(-1)!.grounded).toBe(true);
  });

  it('é determinístico: parado, o mesmo mundo dá a mesma altura, tick a tick', async () => {
    const um = await mundo();
    const a = new Vector09({});
    a.spawn(um, v(0, 0, 0));
    const dois = await mundo();
    const b = new Vector09({});
    b.spawn(dois, v(0, 0, 0));
    expect(rodar(dois, b, 300).map((p) => p.y)).toEqual(rodar(um, a, 300).map((p) => p.y));
  });
});
