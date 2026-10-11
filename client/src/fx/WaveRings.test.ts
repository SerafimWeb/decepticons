import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { weapon } from '../combat/weapons';
import { FrameCopyPass } from './FrameCopyPass';
import { RING_GAP_S, RING_LIFE_S, RINGS_PER_WAVE, WAVE_RING_CAP, WaveRings } from './WaveRings';

const SONIC = weapon('sonic');
const ORIGEM = new THREE.Vector3(1, 4, 2);
const FRENTE = new THREE.Vector3(0, 0, -1);
const TOTAL_S = RING_LIFE_S + (RINGS_PER_WAVE - 1) * RING_GAP_S;

/** Anda o tempo todo em passos de um tick (60 Hz). */
const anda = (r: WaveRings, s: number): void => {
  for (let t = 0; t < s - 1e-9; t += 1 / 60) r.update(Math.min(1 / 60, s - t));
};

/** O anel `i` desenhado: posição, eixo (a normal do anel) e raio externo da malha. */
function anel(r: WaveRings, i: number): { pos: THREE.Vector3; eixo: THREE.Vector3; escala: number } {
  const m = new THREE.Matrix4();
  r.mesh.getMatrixAt(i, m);
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  m.decompose(pos, q, s);
  return { pos, eixo: new THREE.Vector3(0, 0, 1).applyQuaternion(q), escala: s.x };
}

describe('anéis da onda sônica (fx/WaveRings): a onda é o ar distorcido, em anéis que correm pelo cone', () => {
  it('arma sem onda não solta nada; o canhão sônico solta uma fila de anéis por boca, que esperam a vez um atrás do outro', () => {
    const r = new WaveRings();
    r.spawn(ORIGEM, FRENTE, weapon('plasma'));
    expect(r.active).toBe(false);
    r.spawn(ORIGEM, FRENTE, SONIC);
    expect(r.active).toBe(true);
    r.update(0);
    expect(r.visibleCount).toBe(1); // só o primeiro saiu; os outros esperam o intervalo
    anda(r, RING_GAP_S * 3 + 0.01);
    expect(r.visibleCount).toBe(4);
    anda(r, RING_GAP_S * 3);
    expect(r.visibleCount).toBe(RINGS_PER_WAVE);
  });

  it('o anel corre na direção do tiro, com o eixo apontado para ela, e a frente chega ao alcance da arma (22 m no nível I)', () => {
    const r = new WaveRings();
    r.spawn(ORIGEM, FRENTE, SONIC);
    anda(r, 0.2);
    const a = anel(r, 0);
    const u = 0.2 / RING_LIFE_S;
    const { dist } = WaveRings.along(u, SONIC.maxRange, Math.tan(SONIC.wave!.halfAngle));
    expect(a.pos.x).toBeCloseTo(1, 4);
    expect(a.pos.y).toBeCloseTo(4, 4);
    expect(a.pos.z).toBeCloseTo(2 - dist, 3);
    expect(a.eixo.dot(FRENTE)).toBeCloseTo(1, 5);
    expect(WaveRings.along(1, SONIC.maxRange, 0.5).dist).toBeCloseTo(22, 6);
    expect(WaveRings.along(0, SONIC.maxRange, 0.5).dist).toBe(0);
    // Mais nível, mais alcance: o anel vai mais longe no mesmo instante.
    expect(WaveRings.along(0.5, weapon('sonic', 2).maxRange, 0.5).dist).toBeGreaterThan(WaveRings.along(0.5, SONIC.maxRange, 0.5).dist);
  });

  it('o anel se abre junto com o cone da arma: o raio é a distância vezes a tangente do meio ângulo, com um mínimo junto da boca', () => {
    const tan = Math.tan(SONIC.wave!.halfAngle);
    const a = WaveRings.along(0.5, SONIC.maxRange, tan);
    expect(a.radius).toBeCloseTo(a.dist * tan, 6);
    expect(WaveRings.along(0, SONIC.maxRange, tan).radius).toBeGreaterThan(0.2); // não nasce com raio zero
    expect(WaveRings.along(1, SONIC.maxRange, tan).radius).toBeGreaterThan(WaveRings.along(0.5, SONIC.maxRange, tan).radius);
    // E a malha leva isso na escala (a frente de onda cai a 70% do raio externo, que vale 0,5 na escala 1).
    const r = new WaveRings();
    r.spawn(ORIGEM, FRENTE, SONIC);
    anda(r, 0.3);
    const { radius } = WaveRings.along(0.3 / RING_LIFE_S, SONIC.maxRange, tan);
    expect(anel(r, 0).escala).toBeCloseTo(radius / (0.7 * 0.5), 3);
  });

  it('a força do anel sobe depressa, passa do meio e some ao fim: nunca aparece de repente nem fica depois da vida', () => {
    expect(WaveRings.strength(0)).toBe(0);
    expect(WaveRings.strength(1)).toBeCloseTo(0, 9);
    expect(WaveRings.strength(0.06)).toBeGreaterThan(0.7);
    expect(WaveRings.strength(0.3)).toBeGreaterThan(WaveRings.strength(0.7));
    for (let u = 0.1; u < 0.99; u += 0.1) expect(WaveRings.strength(u), String(u)).toBeGreaterThan(WaveRings.strength(u + 0.1));
    for (let u = 0; u <= 1; u += 0.05) expect(WaveRings.strength(u)).toBeLessThanOrEqual(1);
  });

  it('cada anel vive RING_LIFE_S e a onda inteira acaba depois da fila: nada fica vivo nem desenhado', () => {
    const r = new WaveRings();
    r.spawn(ORIGEM, FRENTE, SONIC);
    anda(r, TOTAL_S - 0.05);
    expect(r.active).toBe(true);
    anda(r, 0.1);
    expect(r.active).toBe(false);
    expect(r.visibleCount).toBe(0);
    expect(r.mesh.visible).toBe(false);
    expect(r.mesh.count).toBe(0);
  });

  it('as duas bocas dos ombros somam: 12 anéis por aperto; uma segunda onda antes de acabar a primeira convive com ela', () => {
    const r = new WaveRings();
    r.spawn(new THREE.Vector3(-1, 4, 0), FRENTE, SONIC);
    r.spawn(new THREE.Vector3(1, 4, 0), FRENTE, SONIC);
    anda(r, 0.3);
    expect(r.visibleCount).toBe(RINGS_PER_WAVE * 2);
    anda(r, 0.2);
    r.spawn(ORIGEM, FRENTE, SONIC);
    anda(r, 0.01);
    expect(r.visibleCount).toBeGreaterThan(RINGS_PER_WAVE * 2 - 4);
  });

  it(`o teto é de ${WAVE_RING_CAP} anéis: ondas demais sobrescrevem as mais velhas, sem estourar nem crescer`, () => {
    const r = new WaveRings();
    for (let i = 0; i < 20; i++) r.spawn(ORIGEM, FRENTE, SONIC);
    anda(r, 0.3);
    expect(r.visibleCount).toBeLessThanOrEqual(WAVE_RING_CAP);
    expect(r.mesh.count).toBeLessThanOrEqual(WAVE_RING_CAP);
    anda(r, TOTAL_S + 0.2);
    expect(r.active).toBe(false);
  });

  it('é determinístico: a mesma sequência dá as mesmas matrizes (sem sorteio, G1/G2)', () => {
    const faz = () => {
      const r = new WaveRings();
      r.spawn(ORIGEM, new THREE.Vector3(0.3, 0.1, -1), SONIC);
      anda(r, 0.27);
      return Array.from(r.mesh.instanceMatrix.array.slice(0, 16 * r.visibleCount));
    };
    expect(faz()).toEqual(faz());
  });

  it('tiro para cima ou para baixo não dá matriz inválida (o eixo vertical não pode zerar a base do anel)', () => {
    for (const d of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0.99, 0.14)]) {
      const r = new WaveRings();
      r.spawn(ORIGEM, d, SONIC);
      anda(r, 0.2);
      for (const v of r.mesh.instanceMatrix.array.slice(0, 16)) expect(Number.isFinite(v)).toBe(true);
      expect(anel(r, 0).eixo.dot(d.clone().normalize())).toBeCloseTo(1, 4);
    }
  });

  it('sem cópia do quadro (qualidade baixa, ou o primeiro quadro) o anel usa o brilho fraco; com a cópia pronta, lê a imagem de verdade', () => {
    const r = new WaveRings();
    const u = (r.mesh.material as THREE.ShaderMaterial).uniforms;
    r.setFrame(null);
    expect(u.uReady!.value).toBe(0);
    const copia = new FrameCopyPass();
    copia.setSize(1280, 720);
    r.setFrame(copia);
    expect(u.uReady!.value).toBe(0); // a cópia existe, mas ainda não tem imagem
    copia.ready = true;
    r.setFrame(copia);
    expect(u.uReady!.value).toBe(1);
    expect(u.tFrame!.value).toBe(copia.texture);
    expect((u.uRes!.value as THREE.Vector2).toArray()).toEqual([1280, 720]);
    r.setFrame(null);
    expect(u.uReady!.value).toBe(0);
  });

  it('o anel é transparente, não escreve profundidade e se esconde atrás das paredes (testa a profundidade)', () => {
    const m = new WaveRings().mesh.material as THREE.ShaderMaterial;
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.depthTest).toBe(true);
    expect(m.side).toBe(THREE.DoubleSide);
  });

  it('clear apaga tudo de uma vez', () => {
    const r = new WaveRings();
    r.spawn(ORIGEM, FRENTE, SONIC);
    anda(r, 0.2);
    r.clear();
    expect(r.active).toBe(false);
    expect(r.mesh.visible).toBe(false);
    expect(r.visibleCount).toBe(0);
  });
});

describe('a cópia do quadro (fx/FrameCopyPass): só roda quando há onda no ar', () => {
  it('nasce desligada, não troca os buffers do compositor e só liga sob demanda', () => {
    const p = new FrameCopyPass();
    expect(p.enabled).toBe(false);
    expect(p.needsSwap).toBe(false);
    p.setActive(true);
    expect(p.enabled).toBe(true);
  });

  it('desligar apaga o "pronto" (a próxima vez recomeça de uma cópia nova); mudar o tamanho também', () => {
    const p = new FrameCopyPass();
    p.setSize(800, 600);
    p.setActive(true);
    p.ready = true;
    p.setSize(1024, 768);
    expect(p.ready).toBe(false);
    expect([p.width, p.height]).toEqual([1024, 768]);
    p.ready = true;
    p.setActive(false);
    expect(p.ready).toBe(false);
  });

  it('a textura da cópia é a do alvo (sem MSAA, meia precisão, sem profundidade)', () => {
    const p = new FrameCopyPass();
    expect(p.texture).toBe(p.target.texture);
    expect(p.target.samples).toBe(0);
    expect(p.target.depthBuffer).toBe(false);
    expect(p.target.texture.type).toBe(THREE.HalfFloatType);
  });
});
