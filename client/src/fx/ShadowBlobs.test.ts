import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildShadowTexture,
  type ShadowCaster,
  ShadowBlobs,
  SHADOW_CAPACITY,
  SHADOW_LIFT,
  SHADOW_SHIFT_X,
  SHADOW_SHIFT_Z,
  SHADOW_SPREAD,
  shadowFalloff,
  shadowScale,
  terrainGround,
} from './ShadowBlobs';

function unit(x: number, y: number, z: number, o: Partial<{ radius: number; grounded: boolean; alive: boolean; visible: boolean }> = {}): ShadowCaster {
  const root = new THREE.Object3D();
  root.position.set(x, y, z);
  root.visible = o.visible ?? true;
  return { root, stats: { radius: o.radius ?? 1.3 }, grounded: o.grounded ?? true, alive: o.alive ?? true };
}

/** Lê a posição e a escala da instância `i` (a sombra deitada: escala em x e z = diâmetro). */
function instance(shadows: ShadowBlobs, i: number): { pos: THREE.Vector3; diameter: number } {
  const m = new THREE.Matrix4();
  shadows.mesh.getMatrixAt(i, m);
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  m.decompose(pos, new THREE.Quaternion(), scale);
  expect(scale.x).toBeCloseTo(scale.z, 6);
  return { pos, diameter: scale.x };
}

const FLAT_GROUND = (): number | null => 0;

describe('regra do tamanho e da orla', () => {
  it('a sombra tem o tamanho cheio no chão e encolhe com a altura até um mínimo', () => {
    expect(shadowScale(0)).toBe(1);
    expect(shadowScale(-3)).toBe(1); // abaixo do chão (rampa, interpolação) não incha
    let previous = 1;
    for (let h = 0; h <= 20; h += 1) {
      const s = shadowScale(h);
      expect(s).toBeLessThanOrEqual(previous + 1e-12);
      previous = s;
    }
    expect(shadowScale(1000)).toBeCloseTo(0.35, 6);
    expect(shadowScale(1000)).toBeGreaterThan(0.2); // nunca some: o jogador ainda lê onde vai pousar
  });

  it('a orla do disco é escura no centro e some na borda, só diminuindo', () => {
    expect(shadowFalloff(0)).toBeGreaterThan(0.8);
    expect(shadowFalloff(1)).toBe(0);
    expect(shadowFalloff(1.7)).toBe(0); // fora do disco
    let previous = Infinity;
    for (let r = 0; r <= 1; r += 0.05) {
      const a = shadowFalloff(r);
      expect(a).toBeLessThanOrEqual(previous + 1e-12);
      previous = a;
    }
  });

  it('a textura é preta com alfa em queda radial: o canto é transparente e o centro, opaco', () => {
    const tex = buildShadowTexture(32);
    const { data, width } = tex.image as { data: Uint8Array; width: number };
    const alpha = (x: number, y: number): number => data[(y * width + x) * 4 + 3]!;
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(16, 16)).toBeGreaterThan(200);
    for (let i = 0; i < data.length; i += 4) expect(data[i]! + data[i + 1]! + data[i + 2]!).toBe(0); // só preto
  });
});

describe('ShadowBlobs', () => {
  it('põe a sombra nos pés de quem está no chão, sem procurar o chão (rampa e plataforma contam)', () => {
    let lookups = 0;
    const shadows = new ShadowBlobs(new THREE.Scene(), () => { lookups++; return 0; });
    shadows.begin();
    shadows.add(unit(10, 6, -4)); // em cima da plataforma, a 6 m
    shadows.end();
    expect(lookups).toBe(0);
    expect(shadows.drawn).toBe(1);
    expect(shadows.mesh.count).toBe(1);
    const { pos, diameter } = instance(shadows, 0);
    const r = 1.3 * SHADOW_SPREAD;
    // Deslocada para longe da luz principal, proporcional ao raio do disco.
    expect(pos.x).toBeCloseTo(10 + r * SHADOW_SHIFT_X, 5);
    expect(pos.z).toBeCloseTo(-4 + r * SHADOW_SHIFT_Z, 5);
    expect(pos.y).toBeCloseTo(6 + SHADOW_LIFT, 5);
    expect(diameter).toBeCloseTo(r * 2, 5);
  });

  it('no ar, a sombra fica no chão embaixo e encolhe com a altura do pulo', () => {
    const lookedFrom: number[] = [];
    const shadows = new ShadowBlobs(new THREE.Scene(), (_x, _z, fromY) => {
      lookedFrom.push(fromY);
      return 2; // o chão sob o robô está a 2 m
    });
    shadows.begin();
    shadows.add(unit(0, 9, 0, { grounded: false })); // 7 m acima do chão
    shadows.add(unit(5, 2, 0, { grounded: false })); // rente ao chão, ainda sem tocar
    shadows.end();
    expect(lookedFrom).toEqual([9.5, 2.5]); // procura de meio metro acima dos pés para baixo
    const high = instance(shadows, 0);
    const low = instance(shadows, 1);
    expect(high.pos.y).toBeCloseTo(2 + SHADOW_LIFT, 5);
    expect(high.diameter).toBeLessThan(low.diameter);
    expect(low.diameter).toBeCloseTo(1.3 * SHADOW_SPREAD * 2, 5);
  });

  it('sem chão embaixo (vazio), usa o nível 0 em vez de sumir', () => {
    const shadows = new ShadowBlobs(new THREE.Scene(), () => null);
    shadows.begin();
    shadows.add(unit(0, 3, 0, { grounded: false }));
    shadows.end();
    expect(shadows.drawn).toBe(1);
    expect(instance(shadows, 0).pos.y).toBeCloseTo(SHADOW_LIFT, 5);
  });

  it('o tamanho segue o raio de cada robô (andróide pequeno, Colossus grande)', () => {
    const shadows = new ShadowBlobs(new THREE.Scene(), FLAT_GROUND);
    shadows.begin();
    shadows.add(unit(0, 0, 0, { radius: 0.36 }));
    shadows.add(unit(3, 0, 0, { radius: 3.6 }));
    shadows.end();
    expect(instance(shadows, 1).diameter / instance(shadows, 0).diameter).toBeCloseTo(10, 5);
  });

  it('não desenha quem morreu nem quem está escondido, e a contagem acompanha o quadro', () => {
    const shadows = new ShadowBlobs(new THREE.Scene(), FLAT_GROUND);
    shadows.begin();
    shadows.add(unit(0, 0, 0));
    shadows.add(unit(1, 0, 0, { alive: false }));
    shadows.add(unit(2, 0, 0, { visible: false }));
    shadows.end();
    expect(shadows.mesh.count).toBe(1);
    // O quadro seguinte recomeça do zero: nada sobra do anterior.
    shadows.begin();
    shadows.end();
    expect(shadows.mesh.count).toBe(0);
  });

  it('respeita a capacidade sem estourar o buffer', () => {
    const shadows = new ShadowBlobs(new THREE.Scene(), FLAT_GROUND, 4);
    shadows.begin();
    for (let i = 0; i < 10; i++) shadows.add(unit(i, 0, 0));
    shadows.end();
    expect(shadows.mesh.count).toBe(4);
    expect(SHADOW_CAPACITY).toBeGreaterThanOrEqual(16); // a partida cheia cabe com folga
  });

  it('é um desenho só (um InstancedMesh) e nunca é cortado pelo volume da geometria base', () => {
    const scene = new THREE.Scene();
    const shadows = new ShadowBlobs(scene, FLAT_GROUND);
    expect(scene.children.filter((c) => c === shadows.mesh)).toHaveLength(1);
    expect(shadows.mesh.frustumCulled).toBe(false);
    const mat = shadows.mesh.material as THREE.MeshBasicMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false); // a sombra não esconde nada atrás dela
  });

  it('o chão vem da física pelo terreno estático, olhando 80 m para baixo', () => {
    const calls: number[][] = [];
    const ground = terrainGround({ terrainY: (x, z, fromY, maxDist) => { calls.push([x, z, fromY, maxDist]); return 1.5; } });
    expect(ground(3, 4, 10)).toBe(1.5);
    expect(calls).toEqual([[3, 4, 10, 80]]);
  });
});
