import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { timeToKill } from './balance';
import { GrenadeSystem, MAX_GRENADES } from './GrenadeSystem';
import { lobAngleDirection, lobDirection, lobFlightTime, lobMaxRange, lobPoint, lobSpeedFor } from './lob';
import { DAMAGE_TYPE, rangeBandOf, weapon, WEAPON_IDS } from './weapons';

/**
 * O lança-granadas (P160 parte 2b): o primeiro tiro do arsenal com gravidade. A conta do arco (`combat/lob.ts`), a granada com física de verdade
 * (cai perto da mira, sobe por cima do muro, explode no robô, tabela na parede, crava no chão) e a regra no equilíbrio.
 */

const G = weapon('grenade');
const LOB = G.lob!;
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;

describe('o arco (combat/lob): sai de um ponto e cai no outro', () => {
  const de = new THREE.Vector3(0, 3, 0);
  it('o arco baixo e o alto caem no alvo (no plano, acima e abaixo), e o alto é mais íngreme', () => {
    for (const [d, h] of [[20, 0], [40, 0], [60, 0], [40, 5], [35, -3]] as const) {
      const alvo = new THREE.Vector3(0, 3 + h, -d);
      const baixo = new THREE.Vector3();
      const alto = new THREE.Vector3();
      expect(lobDirection(de, alvo, G.speed, LOB.gravity, false, baixo)).toBe(true);
      expect(lobDirection(de, alvo, G.speed, LOB.gravity, true, alto)).toBe(true);
      for (const dir of [baixo, alto]) {
        expect(dir.length()).toBeCloseTo(1, 6);
        const p = lobPoint(de, dir, G.speed, LOB.gravity, lobFlightTime(de, alvo, dir, G.speed), new THREE.Vector3());
        expect(p.distanceTo(alvo), `${d} m, ${h} m`).toBeLessThan(0.01);
      }
      expect(alto.y).toBeGreaterThan(baixo.y);
    }
  });

  it('a carga (a velocidade) para uma elevação dada também cai no alvo; elevação que não chega lá não tem carga', () => {
    const alvo = new THREE.Vector3(10, 0, -28);
    for (const graus of [35, 45, 60, 75]) {
      const ang = (graus * Math.PI) / 180;
      const v = lobSpeedFor(de, alvo, ang, LOB.gravity);
      const dir = lobAngleDirection(de, alvo, ang, new THREE.Vector3());
      const p = lobPoint(de, dir, v, LOB.gravity, lobFlightTime(de, alvo, dir, v), new THREE.Vector3());
      expect(p.distanceTo(alvo), `${graus}°`).toBeLessThan(0.01);
    }
    expect(lobSpeedFor(de, new THREE.Vector3(0, 40, -10), (20 * Math.PI) / 180, LOB.gravity)).toBeNaN();
  });

  it('fora do alcance (80 m no plano) sai o tiro de 45° na direção do alvo; alvo bem embaixo, sai reto para baixo', () => {
    expect(lobMaxRange(G.speed, LOB.gravity)).toBeCloseTo(80.2, 1);
    const dir = new THREE.Vector3();
    expect(lobDirection(de, new THREE.Vector3(100, 3, 0), G.speed, LOB.gravity, false, dir)).toBe(false);
    expect(dir.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(dir.y).toBeCloseTo(Math.SQRT1_2, 6);
    lobDirection(de, new THREE.Vector3(0, -5, 0), G.speed, LOB.gravity, false, dir);
    expect(dir.y).toBe(-1);
  });
});

describe('a arma: dados, regra e equilíbrio', () => {
  it('é munição, explosiva, de faixa média, a única com gravidade, e cabe no braço e nos ombros do Marauder', () => {
    expect(G.kind).toBe('ammo');
    expect(DAMAGE_TYPE.grenade).toBe('explosivo');
    expect(rangeBandOf(G)).toBe('medio');
    for (const id of WEAPON_IDS) expect(weapon(id).lob !== undefined, id).toBe(id === 'grenade');
  });

  it('sozinha leva mais de 4,5 s para derrubar um torso em todo nível (a regra do Comandante, P111): o carregador esvazia e a recarga segura', () => {
    const V = VECTOR09_STATS;
    for (const t of [0, 1, 2] as const) expect(timeToKill([weapon('grenade', t)], V, V.maxModuleHealth.torso)).toBeGreaterThan(4.5);
  });
});

describe('a granada com física de verdade', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function mundo() {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(400, 2, 400));
    physics.step();
    const g = new GrenadeSystem(new THREE.Scene(), physics);
    const estouros: THREE.Vector3[] = [];
    g.onExplode = (at) => estouros.push(at.clone());
    const ate = (s: number) => {
      for (let i = 0; i < Math.round(s / FIXED_DT) && g.active > 0; i++) g.fixedUpdate(FIXED_DT);
    };
    return { physics, g, estouros, ate };
  }

  it('no chão plano cai perto da mira: crava e estoura a menos de 3 m do ponto marcado (20, 40 e 60 m)', async () => {
    for (const d of [20, 40, 60]) {
      const { g, estouros, ate } = await mundo();
      g.fire(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 0, -d), undefined, G);
      ate(6);
      expect(estouros, `${d} m`).toHaveLength(1);
      expect(Math.hypot(estouros[0]!.x, estouros[0]!.z + d), `${d} m`).toBeLessThan(3);
      expect(estouros[0]!.y).toBeLessThan(1);
    }
  });

  it('um muro no caminho do arco baixo: sai a menor elevação que passa por cima, com a carga reduzida (sem virar morteiro de 40 m), e estoura atrás do muro', async () => {
    const { physics, g, estouros, ate } = await mundo();
    physics.addStaticBox(new THREE.Vector3(0, 4, -20), new THREE.Vector3(30, 8, 1));
    physics.step();
    const de = new THREE.Vector3(0, 3, 0);
    const alvo = new THREE.Vector3(0, 0, -35);
    const baixo = new THREE.Vector3();
    lobDirection(de, alvo, G.speed, LOB.gravity, false, baixo);
    expect(g.clearance(de, baixo, G.speed, alvo, undefined, G)).toBeLessThan(0.9); // o arco baixo bate no muro
    const escolhido = new THREE.Vector3();
    const carga = g.aimArc(de, alvo, undefined, G, escolhido);
    expect(escolhido.y).toBeGreaterThan(baixo.y + 0.2);
    expect(carga).toBeLessThan(G.speed);
    expect(g.clearance(de, escolhido, carga, alvo, undefined, G)).toBeGreaterThanOrEqual(0.9);
    const apice = de.y + (carga * escolhido.y) ** 2 / (2 * LOB.gravity);
    expect(apice).toBeLessThan(25); // o arco alto de carga cheia subiria ~38 m e levaria ~4 s
    expect(lobFlightTime(de, alvo, escolhido, carga)).toBeLessThan(2.6);
    g.fire(de, alvo, undefined, G);
    ate(8);
    expect(estouros).toHaveLength(1);
    expect(estouros[0]!.z).toBeLessThan(-25);
    expect(Math.hypot(estouros[0]!.x, estouros[0]!.z + 35)).toBeLessThan(3);
  });

  it('na parede tabela (volta e cai do lado de cá); no chão crava; a espoleta só corre depois do chão', async () => {
    const { physics, g, estouros, ate } = await mundo();
    physics.addStaticBox(new THREE.Vector3(0, 10, -15), new THREE.Vector3(30, 20, 1));
    physics.step();
    // Reto contra a parede, sem arco: bate, volta e cai antes dela.
    g.launch(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 0.15, -1).normalize(), undefined, G);
    ate(8);
    expect(estouros).toHaveLength(1);
    expect(estouros[0]!.z).toBeGreaterThan(-14.5);
    expect(estouros[0]!.z).toBeLessThan(0);
    expect(estouros[0]!.y).toBeLessThan(1); // estourou no chão: a espoleta não correu na parede
  });

  it('o mesmo tiro dá o mesmo estouro (sem sorteio: servidor e cliente iguais)', async () => {
    const a = await mundo();
    const b = await mundo();
    for (const m of [a, b]) {
      m.g.fire(new THREE.Vector3(1, 3, 2), new THREE.Vector3(-12, 0, -44), undefined, G);
      m.ate(6);
    }
    expect(a.estouros[0]!.distanceTo(b.estouros[0]!)).toBe(0);
  });

  it('pool cheio: a granada mais velha estoura no lugar para a nova sair', async () => {
    const { g, estouros } = await mundo();
    for (let i = 0; i <= MAX_GRENADES; i++) g.fire(new THREE.Vector3(i, 3, 0), new THREE.Vector3(i, 0, -40), undefined, G);
    expect(g.active).toBe(MAX_GRENADES);
    expect(estouros).toHaveLength(1);
  });

  it('acerto direto num Mech: explode no contato, antes de tocar o chão, e o dano em área sai pela partida', async () => {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false });
    const atirador = new Vector09();
    match.addPlayer(atirador, 'Atirador');
    atirador.respawn(new THREE.Vector3(0, 0, 40));
    const alvo = new Vector09();
    match.addPlayer(alvo, 'Alvo');
    alvo.respawn(new THREE.Vector3(0, 0, 10));
    physics.step();
    physics.step();
    const estouros: THREE.Vector3[] = [];
    match.onExplosion = (at, w) => { if (w.id === 'grenade') estouros.push(at.clone()); };
    const vida = (m: Vector09) => m.modules.torso + m.modules.head + m.modules.leftArm + m.modules.rightArm + m.modules.leftLeg + m.modules.rightLeg;
    const antes = vida(alvo);
    match.grenades.fire(new THREE.Vector3(0, 4, 38.5), new THREE.Vector3(0, 2.5, 10), atirador.collider, G);
    for (let i = 0; i < 180 && match.grenades.active > 0; i++) match.grenades.fixedUpdate(FIXED_DT);
    expect(estouros).toHaveLength(1);
    expect(estouros[0]!.y).toBeGreaterThan(0.8); // no corpo, não no chão
    expect(Math.abs(estouros[0]!.z - 10)).toBeLessThan(2);
    expect(antes - vida(alvo)).toBeGreaterThan(G.damage * 0.5);
  });
});
