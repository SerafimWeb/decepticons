import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { DebrisSystem } from './DebrisSystem';
import { BRILHO_DO_CONTORNO, BRILHO_DO_CONTORNO_DE_MAQUINA, Destructibles } from './Destructibles';

const particles = { burst: () => {} } as unknown as ParticleSystem;
const debris = { shatter: () => {} } as unknown as DebrisSystem;
const DIR = new THREE.Vector3(0, 0, 1);

describe('Destructibles: rodada nova', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('a quebrada volta, a inteira não duplica, e as duas voltam com a vida cheia', async () => {
    const physics = await PhysicsWorld.create();
    const d = new Destructibles(new THREE.Scene(), physics, debris, particles);
    d.add({ x: 0, z: -10, w: 4, d: 1, h: 2, accent: 0xff6a00, hp: 100 });
    d.add({ x: 20, z: -10, w: 4, d: 1, h: 2, accent: 0xff6a00, hp: 100 });
    physics.step();
    const hit = (x: number) => physics.raycast(new THREE.Vector3(x, 1, 0), new THREE.Vector3(0, 0, -1), 50);

    // Quebra a primeira; a segunda só toma dano.
    expect(d.damage(hit(0)!.collider, 100, DIR)).toBe(true);
    d.damage(hit(20)!.collider, 60, DIR);
    physics.step();
    expect(hit(0)).toBeNull();
    const before = physics.world.colliders.len();

    d.restoreAll();
    physics.step();
    expect(hit(0)).not.toBeNull();
    expect(physics.world.colliders.len()).toBe(before + 1); // só a quebrada foi recriada

    // Vida cheia: 99 de dano não quebra nenhuma das duas.
    d.damage(hit(0)!.collider, 99, DIR);
    d.damage(hit(20)!.collider, 99, DIR);
    physics.step();
    expect(hit(0)).not.toBeNull();
    expect(hit(20)).not.toBeNull();
  });
});

describe('Destructibles: alvos externos (os coqueiros da praia, P138)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  /** Um alvo falso de duas caixas (tronco e copa) que conta o que aconteceu com ele. */
  function alvoFalso(x: number, hp = 70) {
    const registro = { quebrou: 0, voltou: 0, acertos: [] as number[], caixa: -1 };
    const tronco = { center: new THREE.Vector3(x, 5, 0), size: new THREE.Vector3(1, 10, 1) };
    const copa = { center: new THREE.Vector3(x, 10, 0), size: new THREE.Vector3(8, 2, 8) };
    const alvo = {
      caixas: [tronco, copa],
      centro: new THREE.Vector3(x, 3, 0),
      hp,
      peso: 0.35,
      quebrou: () => { registro.quebrou++; },
      voltou: () => { registro.voltou++; },
      acertou: (_e: unknown, restante: number, caixa: { size: THREE.Vector3 }) => { registro.acertos.push(restante); registro.caixa = caixa.size.y; },
    };
    return { alvo, registro };
  }

  const tiro = (physics: PhysicsWorld, x: number, y: number) => physics.raycast(new THREE.Vector3(x, y, -20), new THREE.Vector3(0, 0, 1), 60, undefined, true);

  it('o tiro acerta o tronco e a copa (as duas caixas), e as duas tiram da MESMA vida', async () => {
    const physics = await PhysicsWorld.create();
    const d = new Destructibles(new THREE.Scene(), physics, debris, particles);
    const { alvo, registro } = alvoFalso(0);
    d.addExterno(alvo);
    physics.step();
    // (O raycast devolve sempre o mesmo objeto: guarda o colisor antes do próximo tiro.)
    const noTronco = tiro(physics, 0, 3)!.collider;
    const naCopa = tiro(physics, 3.5, 10)!.collider;
    expect(noTronco.handle).not.toBe(naCopa.handle);
    expect(d.damage(noTronco, 30, DIR)).toBe(true);
    expect(registro.acertos[0]).toBeCloseTo(40 / 70, 5);
    expect(registro.caixa, 'o acerto diz qual caixa levou').toBe(10);
    expect(d.damage(naCopa, 30, DIR)).toBe(true);
    expect(registro.acertos[1]).toBeCloseTo(10 / 70, 5);
    expect(registro.caixa).toBe(2);
    expect(registro.quebrou).toBe(0);
    d.damage(naCopa, 30, DIR);
    expect(registro.quebrou, 'quebrou uma vez só').toBe(1);
  });

  it('ao quebrar, tira as DUAS caixas do mundo e o tiro passa; o abalo chega com o peso do alvo, e a barricada não é avisada', async () => {
    const physics = await PhysicsWorld.create();
    const d = new Destructibles(new THREE.Scene(), physics, debris, particles);
    const abalos: number[] = [];
    let barricadas = 0;
    d.onAlvoQuebrado = (_c, peso) => abalos.push(peso);
    d.onBreak = () => { barricadas++; };
    const { alvo } = alvoFalso(0, 10);
    d.addExterno(alvo);
    physics.step();
    const antes = physics.world.colliders.len();
    d.damage(tiro(physics, 0, 3)!.collider, 99, DIR);
    physics.step();
    expect(physics.world.colliders.len()).toBe(antes - 2);
    expect(tiro(physics, 0, 3)).toBeNull();
    expect(tiro(physics, 3.5, 10)).toBeNull();
    expect(abalos).toEqual([0.35]);
    expect(barricadas, 'o evento de rede das barricadas não é do alvo externo').toBe(0);
  });

  it('a explosão tira vida pela caixa mais perto: perto da copa pega o coqueiro, longe não', async () => {
    const physics = await PhysicsWorld.create();
    const d = new Destructibles(new THREE.Scene(), physics, debris, particles);
    const { alvo, registro } = alvoFalso(0, 100);
    d.addExterno(alvo);
    physics.step();
    d.damageInRadius(new THREE.Vector3(0, 10, 12), 5, 100, DIR); // a 8 m da borda da copa (4 m de raio): fora
    expect(registro.acertos).toHaveLength(0);
    d.damageInRadius(new THREE.Vector3(0, 10, 7), 5, 100, DIR); // a 3 m da borda da copa
    expect(registro.acertos).toHaveLength(1);
    expect(registro.acertos[0]).toBeGreaterThan(0.3); // levou ~40 de 100
    expect(registro.acertos[0]).toBeLessThan(0.8);
  });

  it('o dash derruba (demolish) o coqueiro de uma vez', async () => {
    const physics = await PhysicsWorld.create();
    const d = new Destructibles(new THREE.Scene(), physics, debris, particles);
    const { alvo, registro } = alvoFalso(0);
    d.addExterno(alvo);
    physics.step();
    expect(d.demolish(tiro(physics, 0, 3)!.collider, DIR)).toBe(true);
    expect(registro.quebrou).toBe(1);
  });

  it('rodada nova: o quebrado volta (e o desenho é avisado), o inteiro volta à vida cheia, e nada duplica', async () => {
    const physics = await PhysicsWorld.create();
    const d = new Destructibles(new THREE.Scene(), physics, debris, particles);
    const a = alvoFalso(0, 50);
    const b = alvoFalso(30, 50);
    d.addExterno(a.alvo);
    d.addExterno(b.alvo);
    physics.step();
    d.damage(tiro(physics, 0, 3)!.collider, 99, DIR); // quebra A
    d.damage(tiro(physics, 30, 3)!.collider, 30, DIR); // fere B
    physics.step();
    const antes = physics.world.colliders.len();
    d.restoreAll();
    physics.step();
    expect(a.registro.voltou).toBe(1);
    expect(b.registro.voltou, 'o inteiro não é "devolvido"').toBe(0);
    expect(physics.world.colliders.len()).toBe(antes + 2); // só as duas caixas do quebrado
    expect(d.standingIds()).toEqual([0, 1]);
    // B voltou à vida cheia: 40 de dano não quebra (levaria 30 + 40 = 70 > 50 sem a restauração).
    d.damage(tiro(physics, 30, 3)!.collider, 40, DIR);
    expect(b.registro.quebrou).toBe(0);
  });

  it('barricada e alvo externo convivem: ids em sequência e cada um com o seu tipo de quebra', async () => {
    const physics = await PhysicsWorld.create();
    const d = new Destructibles(new THREE.Scene(), physics, debris, particles);
    d.add({ x: 50, z: 10, w: 4, d: 1, h: 2, accent: 0xff6a00, hp: 10 });
    const id = d.addExterno(alvoFalso(0).alvo);
    expect(id).toBe(1);
    expect(d.standingIds()).toEqual([0, 1]);
    d.breakById(0);
    expect(d.standingIds()).toEqual([1]);
  });
});

describe('Destructibles: o brilho do contorno (P277)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  const contorno = (d: Destructibles, id: number): number => (d as unknown as { byId: Map<number, { edgeMat: THREE.LineBasicMaterial }> }).byId.get(id)!.edgeMat.color.g;

  it('a caixa de sempre leva o contorno a ×3; a máquina estilizada, a ×1,5 (o halo de uma linha de 1 px a ×3 lavava o corpo e andava com a câmera), e volta ao ×3 se o estilo sai', async () => {
    const physics = await PhysicsWorld.create();
    const d = new Destructibles(new THREE.Scene(), physics, debris, particles);
    d.add({ x: 0, z: -10, w: 4, d: 1, h: 2, accent: 0x00ff00, hp: 100 });
    expect(contorno(d, 0)).toBeCloseTo(BRILHO_DO_CONTORNO, 5);
    d.estilizar(() => new THREE.Group());
    expect(contorno(d, 0)).toBeCloseTo(BRILHO_DO_CONTORNO_DE_MAQUINA, 5);
    d.estilizar(null);
    expect(contorno(d, 0)).toBeCloseTo(BRILHO_DO_CONTORNO, 5);
    expect(BRILHO_DO_CONTORNO_DE_MAQUINA).toBeLessThan(BRILHO_DO_CONTORNO);
  });

  it('a barricada que quebra e volta na rodada nova volta com o contorno da máquina, não com o ×3 de antes', async () => {
    const physics = await PhysicsWorld.create();
    const d = new Destructibles(new THREE.Scene(), physics, debris, particles);
    d.add({ x: 0, z: -10, w: 4, d: 1, h: 2, accent: 0x00ff00, hp: 100 });
    d.estilizar(() => new THREE.Group());
    d.breakById(0);
    d.restoreAll();
    expect(contorno(d, 0)).toBeCloseTo(BRILHO_DO_CONTORNO_DE_MAQUINA, 5);
  });
});
