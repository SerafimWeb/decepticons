import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { weapon } from '../combat/weapons';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { TEST_SHOTS, TestShots, testShotPoint } from './TestShots';
import { testAt, testFire } from './testFire';
import { VECTOR09_STATS } from '../entities/chassis';

/**
 * O "Testar" do Hangar com a cara do jogo (P160 parte 3): cada tiro do teste passa pela camada de efeitos do jogo, com a trajetória da família. Sem a
 * cena: as partículas entram de mentira (as de verdade pedem o `document`).
 */

const PARTICULAS = { burst: () => {}, update: () => {}, points: new THREE.Object3D() } as unknown as ParticleSystem;
const DE = new THREE.Vector3(0, 4, 0);
const ALVO = new THREE.Vector3(15, 6, -9);

function bancada() {
  const cam = new THREE.PerspectiveCamera(40, 1.6, 0.1, 200);
  cam.position.set(0, 6, 20);
  cam.updateMatrixWorld();
  const t = new TestShots(new THREE.Scene(), cam, 0, PARTICULAS);
  let acertos = 0;
  t.onHit = () => acertos++;
  const anda = (s: number) => {
    for (let i = 0; i < Math.round(s * 60); i++) t.update(1 / 60);
  };
  return { t, anda, acertos: () => acertos };
}

describe('as trajetórias do teste', () => {
  it('o arco da granada começa na boca e termina no alvo, passando acima da reta', () => {
    const { t } = bancada();
    t.fire(DE, ALVO, weapon('grenade'), 0);
    const s = (t as unknown as { pool: Array<{ live: boolean; dur: number }> }).pool.find((q) => q.live)! as never;
    const dur = (s as { dur: number }).dur;
    expect(testShotPoint(s, 0, new THREE.Vector3()).distanceTo(DE)).toBeLessThan(1e-6);
    expect(testShotPoint(s, dur, new THREE.Vector3()).distanceTo(ALVO)).toBeLessThan(0.05);
    const meio = testShotPoint(s, dur / 2, new THREE.Vector3());
    expect(meio.y).toBeGreaterThan((DE.y + ALVO.y) / 2 + 0.2);
  });

  it('o cruzador sobe em arco; o tiro comum vai reto', () => {
    const { t } = bancada();
    t.fire(DE, ALVO, weapon('cruise'), 0);
    t.fire(DE, ALVO, weapon('plasma'), 0);
    const vivos = (t as unknown as { pool: Array<{ live: boolean; dur: number; path: string }> }).pool.filter((q) => q.live);
    const cruzador = vivos.find((q) => q.path === 'cruise')!;
    const plasma = vivos.find((q) => q.path === 'line')!;
    expect(testShotPoint(cruzador as never, cruzador.dur / 2, new THREE.Vector3()).y).toBeGreaterThan(8);
    expect(testShotPoint(plasma as never, plasma.dur / 2, new THREE.Vector3()).distanceTo(new THREE.Vector3().lerpVectors(DE, ALVO, 0.5))).toBeLessThan(1e-6);
  });
});

describe('cada família com a cara dela', () => {
  it('a escopeta solta os nove balins juntos, em cone (pontos de chegada diferentes)', () => {
    const { t } = bancada();
    t.fire(DE, ALVO, weapon('shotgun'), 0);
    expect(t.active).toBe(9);
    const chegadas = (t as unknown as { pool: Array<{ live: boolean; to: THREE.Vector3 }> }).pool.filter((q) => q.live).map((q) => q.to.clone());
    for (let i = 0; i < chegadas.length; i++) for (let j = i + 1; j < chegadas.length; j++) expect(chegadas[i]!.distanceTo(chegadas[j]!)).toBeGreaterThan(0.05);
  });

  it('o laser acende o feixe na hora (nenhum tiro voando) e acerta o alvo', () => {
    const { t, acertos } = bancada();
    t.fire(DE, ALVO, weapon('laser'), 0);
    expect(t.active).toBe(0);
    expect(t.beams.active).toBe(1);
    expect(acertos()).toBe(1);
  });

  it('o foguete voa com rastro, chega e explode com corpo; o plasma chega sem explosão', () => {
    const { t, anda, acertos } = bancada();
    t.fire(DE, ALVO, weapon('rockets'), 0);
    t.update(1 / 60);
    expect(t.fx.trails.active).toBeGreaterThan(0);
    anda(0.5);
    expect(acertos()).toBe(1);
    expect(t.fx.explosions.active).toBeGreaterThan(0);
    const b = bancada();
    b.t.fire(DE, ALVO, weapon('plasma'), 0);
    b.anda(0.5);
    expect(b.acertos()).toBe(1);
    expect(b.t.fx.explosions.active).toBe(0);
  });

  it('a salva do lançador leve espalha: cada míssil chega num ponto (o desvio sai do número do tiro)', () => {
    const { t } = bancada();
    for (let k = 0; k < 8; k++) t.fire(DE, ALVO, weapon('swarm'), k);
    const chegadas = (t as unknown as { pool: Array<{ live: boolean; to: THREE.Vector3 }> }).pool.filter((q) => q.live).map((q) => q.to.clone());
    expect(chegadas).toHaveLength(8);
    expect(new Set(chegadas.map((p) => p.toArray().map((v) => v.toFixed(2)).join())).size).toBe(8);
  });

  it('o pool tem teto e tudo termina; teste novo limpa o que estava no ar', () => {
    const { t, anda } = bancada();
    for (let k = 0; k < TEST_SHOTS + 40; k++) t.fire(DE, ALVO, weapon('seeker'), k);
    expect(t.active).toBe(TEST_SHOTS);
    t.clear();
    expect(t.active).toBe(0);
    t.fire(DE, ALVO, weapon('cruise'), 0);
    anda(4);
    expect(t.active).toBe(0);
  });
});

describe('a conta do teste (testFire)', () => {
  it('a escopeta conta os nove balins no dano do teste (era um por disparo)', () => {
    const w = weapon('shotgun');
    const data = testFire(VECTOR09_STATS, w);
    const at = testAt(data, data.seconds);
    expect(at.damage).toBe(at.shots * w.damage * w.pellets!.count);
    expect(data.damage).toBe(at.damage);
  });
});
