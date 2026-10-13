import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HAZE_CAP, HeatHaze } from './HeatHaze';

const quadro = (ready: boolean) => ({ texture: new THREE.Texture(), width: 1280, height: 720, ready });

describe('a névoa de calor (HeatHaze)', () => {
  it('uma pluma nasce, vive o tempo dela subindo e some; sem pluma viva, nada é desenhado e a cópia do quadro pode ficar desligada', () => {
    const h = new HeatHaze();
    expect(h.active).toBe(false);
    h.update(0.1);
    expect(h.mesh.visible).toBe(false);
    h.emit(1, 2, 3, 2, 1, 0.8, 3);
    expect(h.active).toBe(true);
    h.update(0.5);
    expect(h.visibleCount).toBe(1);
    expect(h.mesh.visible).toBe(true);
    // Metade da vida: subiu metade da altura e já está um pouco maior que o tamanho de partida.
    const pos = (h.mesh.geometry.getAttribute('iPos') as THREE.InstancedBufferAttribute).array as Float32Array;
    const par = (h.mesh.geometry.getAttribute('iPar') as THREE.InstancedBufferAttribute).array as Float32Array;
    expect([pos[0], pos[1], pos[2]]).toEqual([1, 3.5, 3]);
    expect(par[1]).toBeCloseTo(0.5, 5); // idade de 0 a 1
    expect(par[0]).toBeGreaterThan(2 * 0.8);
    expect(par[2]).toBeCloseTo(0.8, 5);
    h.update(0.6);
    expect(h.visibleCount).toBe(0);
    expect(h.active).toBe(false);
    expect(h.mesh.visible).toBe(false);
  });

  it('desligada (qualidade baixa), não emite nada e não custa nada', () => {
    const h = new HeatHaze();
    h.enabled = false;
    h.emit(0, 0, 0, 2, 1, 1, 1);
    h.update(0.1);
    expect(h.active).toBe(false);
    expect(h.mesh.visible).toBe(false);
  });

  it('o teto é do pool (G5): passar dele troca as plumas mais velhas, e nunca mais que HAZE_CAP são desenhadas', () => {
    const h = new HeatHaze();
    for (let i = 0; i < HAZE_CAP + 40; i++) h.emit(i, 0, 0, 1, 5, 1, 1);
    h.update(0.01);
    expect(h.visibleCount).toBe(HAZE_CAP);
    // As mais novas ficaram (a mais velha, a de x = 0, foi trocada).
    const pos = (h.mesh.geometry.getAttribute('iPos') as THREE.InstancedBufferAttribute).array as Float32Array;
    const xs = new Set<number>();
    for (let i = 0; i < HAZE_CAP; i++) xs.add(pos[i * 3]!);
    expect(xs.has(HAZE_CAP + 39)).toBe(true);
    expect(xs.has(0)).toBe(false);
  });

  it('vida zero ou negativa não emite; cada pluma tem uma semente diferente (o ruído não se repete de uma para outra)', () => {
    const h = new HeatHaze();
    h.emit(0, 0, 0, 1, 0, 1, 1);
    h.emit(0, 0, 0, 1, -1, 1, 1);
    h.update(0.01);
    expect(h.visibleCount).toBe(0);
    for (let i = 0; i < 6; i++) h.emit(i, 0, 0, 1, 2, 1, 1);
    h.update(0.01);
    const par = (h.mesh.geometry.getAttribute('iPar') as THREE.InstancedBufferAttribute).array as Float32Array;
    expect(new Set([0, 1, 2, 3, 4, 5].map((i) => par[i * 4 + 3])).size).toBe(6);
  });

  it('a cópia do quadro só vale quando já tem imagem: sem ela a pluma cai no brilho fraco (uReady 0), com ela distorce', () => {
    const h = new HeatHaze();
    const mat = (h.mesh.material as THREE.ShaderMaterial).uniforms;
    h.setFrame(null);
    expect(mat.uReady!.value).toBe(0);
    h.setFrame(quadro(false));
    expect(mat.uReady!.value).toBe(0);
    h.setFrame(quadro(true));
    expect(mat.uReady!.value).toBe(1);
    expect((mat.uRes!.value as THREE.Vector2).toArray()).toEqual([1280, 720]);
  });

  it('o tempo do ruído anda com o update (as listras sobem) e clear() apaga tudo', () => {
    const h = new HeatHaze();
    const uTime = (h.mesh.material as THREE.ShaderMaterial).uniforms.uTime!;
    h.update(0.25);
    h.update(0.25);
    expect(uTime.value).toBeCloseTo(0.5, 5);
    h.emit(0, 0, 0, 1, 3, 1, 1);
    h.update(0.1);
    h.clear();
    expect(h.active).toBe(false);
    expect(h.visibleCount).toBe(0);
    expect(h.mesh.visible).toBe(false);
  });

  it('o desenho é uma draw call só, depois das partículas (renderOrder), sem escrever profundidade e com a pluma sempre de frente', () => {
    const h = new HeatHaze();
    const m = h.mesh.material as THREE.ShaderMaterial;
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(h.mesh.renderOrder).toBeGreaterThanOrEqual(6);
    expect(m.vertexShader).toContain('mv.xy += position.xy'); // billboard na cena da câmera
    expect(m.fragmentShader).toContain('texture2D(tFrame');
  });
});
