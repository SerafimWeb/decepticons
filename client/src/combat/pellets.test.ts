import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { ProjectileSystem } from './ProjectileSystem';
import { hitDamage, weapon } from './weapons';

/**
 * Os balins da escopeta (P160, parte 2): o disparo sai como nove projéteis num cone fixo, de dentro do `ProjectileSystem.fire` — então valem para o
 * jogador, os bots, o servidor e o desenho do tiro de outro jogador, todos a partir de **um** evento de tiro e sem sorteio.
 */

const S = weapon('shotgun');
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;

describe('balins: o desenho do disparo', () => {
  /** Um mundo falso que só anota a direção de cada raio (um por projétil vivo por tick). */
  function bancada() {
    const dirs: THREE.Vector3[] = [];
    const physics = { raycast: (_p: THREE.Vector3, d: THREE.Vector3) => (dirs.push(d.clone()), null) };
    const p = new ProjectileSystem(new THREE.Scene(), physics as never, NO_FX, 64);
    return { p, dirs };
  }

  it('um disparo = nove projéteis, um só evento de tiro e um só clarão; o primeiro balin vai no centro da mira', () => {
    const { p, dirs } = bancada();
    let eventos = 0;
    let claroes = 0;
    p.onFired = () => eventos++;
    p.fx = { fired: () => (claroes++, -1), flying: () => {}, impact: () => {}, landed: () => {}, trail: () => -1 };
    const mira = new THREE.Vector3(0.2, -0.1, -1).normalize();
    p.fire(new THREE.Vector3(), mira, undefined, false, S);
    p.fixedUpdate(FIXED_DT);
    expect(dirs).toHaveLength(9);
    expect(eventos).toBe(1);
    expect(claroes).toBe(1);
    expect(dirs[0]!.angleTo(mira)).toBeLessThan(1e-6);
  });

  it('todos dentro do cone, espalhados (nenhum repetido, a maioria longe do centro) e o mesmo desenho a cada disparo (sem sorteio)', () => {
    const { p, dirs } = bancada();
    const mira = new THREE.Vector3(0, 0, -1);
    p.fire(new THREE.Vector3(), mira, undefined, false, S);
    p.fixedUpdate(FIXED_DT);
    const primeiro = dirs.map((d) => d.clone());
    for (const d of primeiro) expect(d.angleTo(mira)).toBeLessThanOrEqual(S.pellets!.cone + 1e-6);
    expect(primeiro.filter((d) => d.angleTo(mira) > S.pellets!.cone * 0.4).length).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < primeiro.length; i++) for (let j = i + 1; j < primeiro.length; j++) expect(primeiro[i]!.angleTo(primeiro[j]!)).toBeGreaterThan(0.005);
    p.clear();
    dirs.length = 0;
    p.fire(new THREE.Vector3(), mira, undefined, false, S);
    p.fixedUpdate(FIXED_DT);
    for (let i = 0; i < 9; i++) expect(dirs[i]!.angleTo(primeiro[i]!)).toBeLessThan(1e-9);
  });

  it('a arma sem balins sai num projétil só, como sempre', () => {
    const { p, dirs } = bancada();
    p.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, weapon('plasma'));
    p.fixedUpdate(FIXED_DT);
    expect(dirs).toHaveLength(1);
  });

  it('pool quase cheio: saem os balins que cabem, sem quebrar', () => {
    const physics = { raycast: () => null };
    const p = new ProjectileSystem(new THREE.Scene(), physics as never, NO_FX, 4);
    expect(() => p.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, S)).not.toThrow();
  });
});

describe('balins com física de verdade: de perto todos pegam, de longe o cone passa da largura do Mech', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function disparo(dist: number) {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false });
    const atirador = new Vector09();
    match.addPlayer(atirador, 'Atirador');
    atirador.respawn(new THREE.Vector3(0, 0, 55));
    const alvo = new Vector09();
    match.addPlayer(alvo, 'Alvo');
    alvo.respawn(new THREE.Vector3(0, 0, 55 - dist));
    physics.step();
    physics.step();
    let acertos = 0;
    let dano = 0;
    match.onMechHit = (e) => {
      if (e.mech !== alvo) return;
      acertos++;
      dano += e.result.applied;
    };
    const origem = new THREE.Vector3(0, 2.6, 54);
    const mira = new THREE.Vector3(0, 2.6, 55 - dist).sub(origem).normalize();
    match.projectiles.fire(origem, mira, atirador.collider, false, S);
    for (let i = 0; i < 40; i++) match.projectiles.fixedUpdate(FIXED_DT);
    return { acertos, dano };
  }

  it('a 6 m os nove balins pegam: o disparo inteiro bate 9 × o dano de um balin', async () => {
    const { acertos, dano } = await disparo(6);
    expect(acertos).toBe(9);
    expect(dano).toBeGreaterThanOrEqual(9 * hitDamage(S, 6) * 0.75); // a defesa da natureza do dano pode segurar uma parte
  });

  it('a 40 m o cone (4,8 m) passa da largura do Mech: no máximo metade dos balins pega', async () => {
    const { acertos } = await disparo(40);
    expect(acertos).toBeGreaterThan(0);
    expect(acertos).toBeLessThanOrEqual(5);
  });
});
