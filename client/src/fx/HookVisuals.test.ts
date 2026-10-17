import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HOOK_POOL, HookSystem } from '../combat/HookSystem';
import { weapon } from '../combat/weapons';
import type { MechBase } from '../entities/MechBase';
import { MAX_BEAMS, BeamVisuals } from './BeamVisuals';
import { HookVisuals, MAX_CABLES, hookRay } from './HookVisuals';

const W = weapon('harpoon');

function fake(x: number, z: number): MechBase {
  return {
    alive: true,
    isDashing: false,
    simPosition: new THREE.Vector3(x, 0, z),
    stats: { radius: 1.3, height: 4 },
    push: () => {},
    mountWorldPosition: (_m: string, out: THREE.Vector3) => out.set(x + (_m === 'leftShoulder' ? -1 : 1), 3, z),
  } as unknown as MechBase;
}

function cena() {
  const scene = new THREE.Scene();
  const visuals = new HookVisuals(scene);
  const hooks = new HookSystem(() => true, () => true);
  const mesh = scene.children[0] as THREE.InstancedMesh;
  return { scene, visuals, hooks, mesh };
}

describe('HookVisuals: o desenho do cabo preso', () => {
  it('uma chamada de desenho para todos os cabos (um InstancedMesh na cena) e nenhum cabo aceso de início', () => {
    const { scene, visuals } = cena();
    expect(scene.children).toHaveLength(1);
    expect(visuals.active).toBe(0);
  });

  it('cada ombro que prende desenha um cabo: um ombro = 1, dois ombros no mesmo alvo = 2', () => {
    const { visuals, hooks } = cena();
    const dono = fake(0, 0);
    const alvo = fake(0, -30);
    hooks.attach(dono, alvo, W, 'rightShoulder');
    visuals.update(hooks, dono, 1 / 60);
    expect(visuals.active).toBe(1);
    hooks.attach(dono, alvo, W, 'leftShoulder');
    visuals.update(hooks, dono, 1 / 60);
    expect(visuals.active).toBe(2);
  });

  it('o cabo vai da boca do ombro até o peito do alvo: a instância fica no meio e tem o comprimento do cabo', () => {
    const { visuals, hooks, mesh } = cena();
    const dono = fake(0, 0);
    const alvo = fake(0, -30);
    hooks.attach(dono, alvo, W, 'rightShoulder');
    visuals.update(hooks, dono, 1 / 60);
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0, m);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    m.decompose(p, new THREE.Quaternion(), s);
    // de (1, 3, 0) até o peito do alvo (0, 2, -30): o meio é (0,5, 2,5, -15) e o comprimento a distância
    expect(p.x).toBeCloseTo(0.5, 5);
    expect(p.y).toBeCloseTo(2.5, 5);
    expect(p.z).toBeCloseTo(-15, 5);
    expect(s.z).toBeCloseTo(new THREE.Vector3(1, 3, 0).distanceTo(new THREE.Vector3(0, 2, -30)), 5);
  });

  it('solta o cabo, some o desenho; o do jogador é ciano e o de outro piloto, vermelho', () => {
    const { visuals, hooks, mesh } = cena();
    const eu = fake(0, 0);
    const outro = fake(10, 0);
    hooks.attach(eu, fake(0, -30), W, 'rightShoulder');
    hooks.attach(outro, fake(10, -30), W, 'rightShoulder');
    visuals.update(hooks, eu, 1 / 60);
    expect(visuals.active).toBe(2);
    const a = new THREE.Color();
    const b = new THREE.Color();
    mesh.getColorAt(0, a);
    mesh.getColorAt(1, b);
    expect(a.b).toBeGreaterThan(a.r); // ciano: o azul passa o vermelho
    expect(b.r).toBeGreaterThan(b.b); // inimigo: o vermelho passa o azul
    hooks.clear();
    visuals.update(hooks, eu, 1 / 60);
    expect(visuals.active).toBe(0);
  });

  it('o pool cheio (8 cabos, 2 ombros cada) enche exatamente as instâncias, e as matrizes não têm NaN (um NaN vira tela preta pelo bloom)', () => {
    const { visuals, hooks, mesh } = cena();
    const dono = fake(0, 0);
    for (let i = 0; i < HOOK_POOL; i++) {
      const alvo = fake(i, -30);
      hooks.attach(dono, alvo, W, 'rightShoulder');
      hooks.attach(dono, alvo, W, 'leftShoulder');
    }
    visuals.update(hooks, dono, 1 / 60);
    expect(visuals.active).toBe(MAX_CABLES);
    for (let i = 0; i < visuals.active; i++) {
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(i, m);
      for (const v of m.elements) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('o dono em cima do alvo (comprimento zero) não vira NaN: a instância é pulada', () => {
    const { visuals, hooks } = cena();
    const dono = fake(0, 0);
    const alvo = {
      alive: true,
      isDashing: false,
      simPosition: new THREE.Vector3(1, 1, 0), // o peito (y + 2) cai exatamente na boca do ombro direito (1, 3, 0)
      stats: { radius: 1.3, height: 4 },
      push: () => {},
    } as unknown as MechBase;
    hooks.attach(dono, alvo, W, 'rightShoulder');
    expect(() => visuals.update(hooks, dono, 1 / 60)).not.toThrow();
    expect(visuals.active).toBe(0);
  });
});

describe('hookRay: o raio do disparo reaproveita o BeamVisuals', () => {
  it('acende um feixe de `from` a `to`, em ciano para o jogador e vermelho para o inimigo, e apaga sozinho', () => {
    const beams = new BeamVisuals(new THREE.Scene());
    hookRay(beams, new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 2, -30), false);
    expect(beams.active).toBe(1);
    hookRay(beams, new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 2, -30), true);
    expect(beams.active).toBe(2);
    for (let i = 0; i < 30; i++) beams.update(1 / 60);
    expect(beams.active).toBe(0); // 0,22 s de brilho
  });

  it('o pool do laser tem teto e o arpão não o esgota: um aperto (dois ombros) custa dois feixes de 40', () => {
    const beams = new BeamVisuals(new THREE.Scene());
    for (let i = 0; i < 2; i++) hookRay(beams, new THREE.Vector3(), new THREE.Vector3(0, 0, -10), false);
    expect(beams.active).toBe(2);
    expect(MAX_BEAMS).toBeGreaterThan(10);
  });
});
