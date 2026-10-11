import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParticleSystem, SHAPE } from './ParticleSystem';

/** O sistema desenha o atlas num canvas; no Node não há DOM, então entra um canvas de mentira (o que importa aqui são os atributos). */
beforeEach(() => {
  const ctx = new Proxy({}, { get: () => () => ({ addColorStop: () => {} }), set: () => true });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});
afterEach(() => vi.unstubAllGlobals());

const attr = (ps: ParticleSystem, nome: string) => ps.points.geometry.getAttribute(nome) as THREE.BufferAttribute;
const BRANCO = new THREE.Color(1, 1, 1);
const origem = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

describe('partículas com forma', () => {
  it('sem forma declarada, a partícula é o brilho redondo de sempre (célula 0)', () => {
    const ps = new ParticleSystem(8);
    ps.burst(origem, Y, { count: 3, color: BRANCO, speed: 1, life: 1 });
    expect(Array.from(attr(ps, 'particleShape').array.slice(0, 3))).toEqual([SHAPE.glow, SHAPE.glow, SHAPE.glow]);
  });

  it('a forma pedida vai para o atributo que o shader lê, só nas partículas daquela rajada', () => {
    const ps = new ParticleSystem(8);
    ps.burst(origem, Y, { count: 2, color: BRANCO, speed: 1, life: 1, shape: SHAPE.flake });
    ps.burst(origem, Y, { count: 1, color: BRANCO, speed: 1, life: 1, shape: SHAPE.ring });
    expect(Array.from(attr(ps, 'particleShape').array.slice(0, 3))).toEqual([SHAPE.flake, SHAPE.flake, SHAPE.ring]);
  });

  it('o floco gira enquanto vive (o giro sorteado fica entre -spin e +spin) e quem não pediu giro não gira', () => {
    const ps = new ParticleSystem(8);
    ps.burst(origem, Y, { count: 4, color: BRANCO, speed: 1, life: 5, spin: 6, shape: SHAPE.flake });
    ps.burst(origem, Y, { count: 1, color: BRANCO, speed: 1, life: 5, shape: SHAPE.shard });
    const antes = Array.from(attr(ps, 'particleAngle').array.slice(0, 5));
    ps.update(0.5);
    const depois = Array.from(attr(ps, 'particleAngle').array.slice(0, 5));
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(depois[i]! - antes[i]!)).toBeLessThanOrEqual(6 * 0.5 + 1e-6);
    }
    expect(depois.slice(0, 4).some((a, i) => a !== antes[i])).toBe(true);
    expect(depois[4]).toBe(antes[4]); // sem spin: o ângulo fica
  });

  it('a língua de fogo nasce com a ponta para cima (quase sem inclinação); as outras formas nascem em qualquer ângulo', () => {
    const ps = new ParticleSystem(64);
    ps.burst(origem, Y, { count: 30, color: BRANCO, speed: 1, life: 1, shape: SHAPE.flame });
    for (const a of attr(ps, 'particleAngle').array.slice(0, 30)) expect(Math.abs(a)).toBeLessThanOrEqual(0.26);
    const outro = new ParticleSystem(64);
    outro.burst(origem, Y, { count: 40, color: BRANCO, speed: 1, life: 1, shape: SHAPE.flake });
    const angulos = Array.from(outro.points.geometry.getAttribute('particleAngle').array.slice(0, 40));
    expect(Math.max(...angulos) - Math.min(...angulos)).toBeGreaterThan(3); // espalhadas pela volta toda
  });

  it('a faísca alongada aponta para onde anda: o shader lê a velocidade (o atributo é o mesmo vetor da simulação)', () => {
    const ps = new ParticleSystem(4);
    ps.burst(origem, new THREE.Vector3(1, 0, 0), { count: 1, color: BRANCO, speed: 10, life: 1, spread: 0, gravity: 0, shape: SHAPE.streak });
    const vel = attr(ps, 'particleVel');
    expect(vel.itemSize).toBe(3);
    expect(vel.array[0]).toBeGreaterThan(0); // vai para +x
    expect(vel.array[1]).toBeCloseTo(0, 5);
    ps.update(0.016);
    expect(attr(ps, 'particleVel').array[0]).toBeGreaterThan(0); // continua sendo a velocidade viva
  });

  it('o shader tem as duas formas orientadas pela velocidade (faísca e onda) e usa o atlas de 4 × 4', () => {
    const ps = new ParticleSystem(2);
    const material = ps.points.material as THREE.PointsMaterial;
    const shader = { vertexShader: '#include <common>\ngl_PointSize = size;', fragmentShader: '#include <common>\n#include <map_particle_fragment>' } as never;
    material.onBeforeCompile!(shader, null as never);
    const { vertexShader, fragmentShader } = shader as { vertexShader: string; fragmentShader: string };
    expect(vertexShader).toContain('attribute float particleShape');
    expect(vertexShader).toContain('attribute vec3 particleVel');
    expect(vertexShader).toMatch(/particleShape > 3\.5 && particleShape < 4\.5/); // faísca alongada
    expect(vertexShader).toMatch(/particleShape > 11\.5 && particleShape < 12\.5/); // onda sonora
    expect(fragmentShader).toContain('mod( vShape, 4.0 )');
    expect(fragmentShader).not.toContain('#include <map_particle_fragment>');
  });

  it('o teto do pool continua valendo: o cursor circular nunca passa do máximo', () => {
    const ps = new ParticleSystem(5);
    ps.burst(origem, Y, { count: 50, color: BRANCO, speed: 1, life: 1, shape: SHAPE.flake });
    expect(attr(ps, 'particleShape').count).toBe(5);
  });
});
