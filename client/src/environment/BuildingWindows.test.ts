import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../core/palette';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Arena } from './Arena';
import { patchWindowShader, WINDOWS, windowedBuildingMaterial } from './BuildingWindows';
import { Destructibles } from './Destructibles';

const standard = (): { vertexShader: string; fragmentShader: string } => ({
  vertexShader: THREE.ShaderLib.standard.vertexShader,
  fragmentShader: THREE.ShaderLib.standard.fragmentShader,
});

const balanced = (src: string, open: string, close: string): boolean => src.split(open).length === src.split(close).length;

describe('medidas da grade de janelas', () => {
  it('a janela cabe dentro da célula, sobra parede, e as frações são de verdade', () => {
    expect(WINDOWS.width).toBeGreaterThan(0);
    expect(WINDOWS.width).toBeLessThan(WINDOWS.pitch); // sobra parede entre as janelas
    expect(WINDOWS.bottom).toBeGreaterThan(0);
    expect(WINDOWS.bottom + WINDOWS.height).toBeLessThan(WINDOWS.floor); // a janela não encosta nas faixas neon
    expect(WINDOWS.litShare).toBeGreaterThan(0);
    expect(WINDOWS.litShare).toBeLessThan(1);
    expect(WINDOWS.sodiumShare).toBeGreaterThanOrEqual(0);
    expect(WINDOWS.sodiumShare).toBeLessThanOrEqual(1);
    // Acende o bloom sem estourar a fachada.
    expect(WINDOWS.intensity).toBeGreaterThan(0.5);
    expect(WINDOWS.intensity).toBeLessThan(2);
  });
});

describe('remendo do shader', () => {
  it('encaixa nos trechos do material padrão do three atual (se uma atualização renomear um, este teste avisa)', () => {
    const original = standard();
    const shader = standard();
    patchWindowShader(shader);
    expect(shader.vertexShader).not.toBe(original.vertexShader);
    expect(shader.fragmentShader).not.toBe(original.fragmentShader);
    // A posição e a normal da face saem do vértice (P255: a normal do vértice, não mais das derivadas de tela) e chegam ao fragmento.
    expect(shader.vertexShader).toContain('varying vec3 vWindowPos;');
    expect(shader.vertexShader).toContain('vWindowPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    expect(shader.vertexShader).toContain('varying vec3 vWindowNormal;');
    expect(shader.vertexShader).toContain('vWindowNormal = normalize(mat3(modelMatrix) * normal);');
    expect(shader.fragmentShader).toContain('varying vec3 vWindowPos;');
    expect(shader.fragmentShader).toContain('varying vec3 vWindowNormal;');
    expect(shader.fragmentShader).not.toContain('dFdx'); // a versão antiga, instável em coordenadas grandes do mundo
    expect(shader.fragmentShader).toContain('uniform vec3 windowColor;');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance +=');
    // Os trechos do three continuam lá: o remendo acrescenta, não substitui.
    for (const token of ['#include <common>', '#include <begin_vertex>']) expect(shader.vertexShader).toContain(token);
    for (const token of ['#include <common>', '#include <emissivemap_fragment>']) expect(shader.fragmentShader).toContain(token);
  });

  it('o GLSL gerado não tem número quebrado nem chave ou parêntese desbalanceado', () => {
    const shader = standard();
    patchWindowShader(shader);
    for (const src of [shader.vertexShader, shader.fragmentShader]) {
      expect(src).not.toMatch(/NaN|undefined|Infinity/);
      expect(balanced(src, '{', '}')).toBe(true);
      expect(balanced(src, '(', ')')).toBe(true);
    }
    // As medidas do TypeScript são as que chegam ao shader (uma fonte só).
    expect(shader.fragmentShader).toContain(WINDOWS.pitch.toFixed(4));
    expect(shader.fragmentShader).toContain(WINDOWS.floor.toFixed(4));
    expect(shader.fragmentShader).toContain(WINDOWS.litShare.toFixed(4));
  });
});

describe('windowedBuildingMaterial', () => {
  const run = (m: THREE.MeshStandardMaterial): { uniforms: Record<string, { value: THREE.Color }>; vertexShader: string; fragmentShader: string } => {
    const shader = { uniforms: {} as Record<string, { value: THREE.Color }>, ...standard() };
    (m.onBeforeCompile as (s: typeof shader, r: unknown) => void)(shader, null);
    return shader;
  };

  it('cada prédio acende na cor do seu letreiro, e a de sódio é compartilhada em valor', () => {
    const cyan = windowedBuildingMaterial(new THREE.MeshStandardMaterial(), PALETTE.cyan);
    const pink = windowedBuildingMaterial(new THREE.MeshStandardMaterial(), PALETTE.pink);
    const a = run(cyan);
    const b = run(pink);
    expect(a.uniforms.windowColor!.value.equals(new THREE.Color(PALETTE.cyan).multiplyScalar(WINDOWS.intensity))).toBe(true);
    expect(b.uniforms.windowColor!.value.equals(new THREE.Color(PALETTE.pink).multiplyScalar(WINDOWS.intensity))).toBe(true);
    expect(a.uniforms.windowColor!.value.equals(b.uniforms.windowColor!.value)).toBe(false);
    expect(a.uniforms.windowSodium!.value.equals(new THREE.Color(PALETTE.sodium).multiplyScalar(WINDOWS.intensity))).toBe(true);
    // Mexer na cor de um não muda a do outro (objetos distintos).
    expect(a.uniforms.windowColor).not.toBe(b.uniforms.windowColor);
  });

  it('devolve o mesmo material (sem trocar a identidade que a câmera usa para torná-lo translúcido)', () => {
    const m = new THREE.MeshStandardMaterial();
    expect(windowedBuildingMaterial(m, PALETTE.fluo)).toBe(m);
    expect(m.customProgramCacheKey()).toBe('cybermech-building-windows-v1');
  });
});

describe('os prédios da Arena', () => {
  it('os três prédios têm janelas e continuam translúcidos para a câmera; o resto da arena não muda', async () => {
    const physics = await PhysicsWorld.create();
    const scene = new THREE.Scene();
    const particles = { burst: () => {} } as never;
    const debris = { shatter: () => {} } as never;
    const arena = new Arena(scene, physics, new Destructibles(scene, physics, debris, particles));
    const windowed = arena.occluders.filter((o) => o.material.customProgramCacheKey() === 'cybermech-building-windows-v1');
    expect(windowed).toHaveLength(3); // os três prédios; o Prédio Serafim tem material próprio
    for (const o of windowed) {
      expect(o.material.transparent).toBe(true); // a câmera tática ainda o apaga atrás do Mech
      expect(o.material.opacity).toBe(1);
    }
    const others = arena.occluders.filter((o) => !windowed.includes(o));
    expect(others.length).toBeGreaterThanOrEqual(1);
    for (const o of others) expect(o.material.customProgramCacheKey()).not.toBe('cybermech-building-windows-v1');
  });
});
