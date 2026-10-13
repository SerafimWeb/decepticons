import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FIRE_RING } from '../combat/EnergyShield';
import type { MechBase } from '../entities/MechBase';
import { FIRE_RING_MAX_PER_PULSE, FireRingVisuals, hash01 } from './FireRingVisuals';
import { ShieldVisuals } from './ShieldVisuals';
import type { BurstOptions } from './ParticleSystem';
import { SHAPE } from './particleShapes';

interface Chamada {
  at: THREE.Vector3;
  o: BurstOptions;
}
interface Pluma {
  at: THREE.Vector3;
  size: number;
  life: number;
  power: number;
  rise: number;
}
function palco() {
  const chamadas: Chamada[] = [];
  const plumas: Pluma[] = [];
  const particles = { burst: (at: THREE.Vector3, _n: THREE.Vector3, o: BurstOptions) => chamadas.push({ at: at.clone(), o }) };
  const haze = { emit: (x: number, y: number, z: number, size: number, life: number, power: number, rise: number) => plumas.push({ at: new THREE.Vector3(x, y, z), size, life, power, rise }) };
  const visuals = new FireRingVisuals(particles, haze);
  /** Um Mech de mentira: só o que o módulo lê. */
  const mech = (kind: 'fire' | 'frontal' | 'sphere' | null = 'fire', active = true, alive = true, visible = true, x = 10, z = -4) =>
    ({
      alive,
      root: { visible },
      position: new THREE.Vector3(x, 0, z),
      energyShield: { kind, active },
    }) as unknown as MechBase;
  const pulso = () => visuals.beginFrame(0.06, true);
  return { chamadas, plumas, visuals, mech, pulso };
}

describe('as chamas do anel de fogo (desenhadas pelo escudo ligado, para todos os jogadores)', () => {
  it('só desenha com o módulo de fogo ligado: sem módulo, com a barreira ou a esfera, ou desligado, nada sai', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    for (const m of [mech(null), mech('frontal'), mech('sphere'), mech('fire', false)]) expect(visuals.update(m)).toBe(0);
    expect(chamadas).toHaveLength(0);
  });

  it('só solta no pulso de 20 Hz: um quadro curto não abre o pulso', () => {
    const { chamadas, visuals, mech } = palco();
    visuals.beginFrame(0.01, true);
    expect(visuals.update(mech())).toBe(0);
    expect(chamadas).toHaveLength(0);
  });

  it('as línguas saem do aro (de 90% a 107% do raio de 7 m), em número e posição que variam de um pulso para o outro: nada de oito iguais igualmente espaçadas (dono, 13/10: "muito artificial")', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    const contagens = new Set<number>();
    const folgas = new Set<string>();
    for (let k = 0; k < 30; k++) {
      chamadas.length = 0;
      pulso();
      visuals.update(mech('fire', true, true, true, 10, -4));
      const linguas = chamadas.filter((c) => c.o.shape === SHAPE.flame);
      contagens.add(linguas.length);
      expect(linguas.length, `pulso ${k}`).toBeLessThanOrEqual(12);
      for (const l of linguas) {
        const d = Math.hypot(l.at.x - 10, l.at.z + 4);
        expect(d).toBeGreaterThanOrEqual(FIRE_RING.radius * 0.9 - 1e-6);
        expect(d).toBeLessThanOrEqual(FIRE_RING.radius * 1.07 + 1e-6);
      }
      const angulos = linguas.map((l) => Math.atan2(l.at.z + 4, l.at.x - 10)).sort((a, b) => a - b);
      for (let i = 1; i < angulos.length; i++) folgas.add((angulos[i]! - angulos[i - 1]!).toFixed(2));
    }
    expect(contagens.size, 'o número de línguas varia').toBeGreaterThanOrEqual(3);
    expect(folgas.size, 'os espaços entre as línguas variam (não são todos iguais)').toBeGreaterThan(10);
  });

  it('há línguas altas, médias e baixas (tamanhos diferentes) e a cor vai do vermelho ao amarelo', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    for (let k = 0; k < 40; k++) {
      pulso();
      visuals.update(mech());
    }
    const linguas = chamadas.filter((c) => c.o.shape === SHAPE.flame).map((c) => c.o);
    expect(new Set(linguas.map((l) => l.size)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(linguas.map((l) => l.color.g)).size).toBeGreaterThanOrEqual(3);
    expect(Math.max(...linguas.map((l) => l.speed))).toBeGreaterThan(Math.min(...linguas.map((l) => l.speed)) * 2); // as altas sobem bem mais
  });

  it('o desenho de cada anel é dele: dois Mechs de anel ligado lado a lado não acendem as mesmas posições', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech('fire', true, true, true, 0, 0));
    const a = chamadas.length;
    visuals.update(mech('fire', true, true, true, 31, 17));
    expect(chamadas.length).toBeGreaterThan(a);
    const doA = chamadas.slice(0, a).map((c) => c.o.size).join(',');
    const doB = chamadas.slice(a).map((c) => c.o.size).join(',');
    expect(doB).not.toBe(doA);
  });

  it('a névoa de calor: a cada dois pulsos (10 Hz) três plumas sobem do aro e uma do meio, largas e lentas, para o cenário tremer sobre o fogo', () => {
    const { plumas, visuals, mech, pulso } = palco();
    pulso(); // pulso 1: sem névoa
    visuals.update(mech('fire', true, true, true, 10, -4));
    expect(plumas).toHaveLength(0);
    pulso(); // pulso 2: três no aro e uma no meio
    visuals.update(mech('fire', true, true, true, 10, -4));
    expect(plumas).toHaveLength(4);
    const aro = plumas.slice(0, 3);
    for (const p of aro) {
      const d = Math.hypot(p.at.x - 10, p.at.z + 4);
      expect(d).toBeGreaterThanOrEqual(FIRE_RING.radius * 0.7 - 1e-6);
      expect(d).toBeLessThanOrEqual(FIRE_RING.radius + 1e-6);
      expect(p.rise).toBeGreaterThan(2); // sobe mais alto que as chamas
      expect(p.power).toBeGreaterThan(0.5);
    }
    const meio = plumas[3]!;
    expect(meio.at.x).toBeCloseTo(10, 5);
    expect(meio.at.z).toBeCloseTo(-4, 5);
    expect(meio.size).toBeGreaterThan(FIRE_RING.radius * 0.8); // cobre o círculo
    // Sem a névoa ligada (qualidade baixa) o anel só tem as partículas.
    const sem = new FireRingVisuals({ burst: () => {} });
    sem.beginFrame(0.06, true);
    sem.beginFrame(0.06, true);
    expect(sem.update(mech())).toBeGreaterThan(0);
  });

  it('o hash do desenho é puro: o mesmo par dá o mesmo número, entre 0 e 1', () => {
    expect(hash01(3, 7)).toBe(hash01(3, 7));
    expect(hash01(3, 7)).not.toBe(hash01(3, 8));
    for (let i = 0; i < 100; i++) {
      const h = hash01(i * 1.7, i);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it('o círculo gira a cada pulso (as línguas não repetem o lugar), sem sorteio: o mesmo pulso dá o mesmo desenho', () => {
    const a = palco();
    a.pulso();
    a.visuals.update(a.mech());
    a.pulso();
    a.chamadas.length = 0;
    a.visuals.update(a.mech());
    const segundoA = a.chamadas.map((c) => c.at.toArray());
    const b = palco();
    b.pulso();
    b.visuals.update(b.mech());
    b.pulso();
    b.chamadas.length = 0;
    b.visuals.update(b.mech());
    expect(b.chamadas.map((c) => c.at.toArray())).toEqual(segundoA); // determinístico

    const c = palco();
    c.pulso();
    c.visuals.update(c.mech());
    const primeiro = c.chamadas.filter((x) => x.o.shape === SHAPE.flame).map((x) => x.at.toArray());
    const segundo = a.chamadas.filter((x) => x.o.shape === SHAPE.flame).map((x) => x.at.toArray());
    expect(segundo).not.toEqual(primeiro); // girou
  });

  it('é fogo (vermelho e verde acima do azul, sobe), com brasas dentro do círculo e uma fumaça cinza no meio', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech('fire', true, true, true, 0, 0));
    const lingua = chamadas.find((c) => c.o.shape === SHAPE.flame)!.o;
    expect(lingua.color.r).toBeGreaterThan(lingua.color.b * 5);
    expect(lingua.gravity).toBeLessThan(0); // sobe
    const brasas = chamadas.filter((c) => c.o.shape === SHAPE.dot);
    expect(brasas).toHaveLength(2);
    for (const b of brasas) {
      const d = Math.hypot(b.at.x, b.at.z);
      expect(d).toBeGreaterThanOrEqual(FIRE_RING.radius * 0.35 - 1e-6);
      expect(d).toBeLessThanOrEqual(FIRE_RING.radius * 0.7 + 1e-6);
    }
    const fumaca = chamadas.find((c) => c.o.shape === SHAPE.puff)!;
    expect(fumaca.o.color.r).toBeLessThan(0.5);
    expect(fumaca.at.x).toBe(0);
  });

  it('o custo é pequeno e conhecido: no máximo 15 partículas por pulso a 20 Hz (300 por segundo no pior caso, ~11 em média) por anel ligado (o pool tem 3000)', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    let total = 0;
    for (let k = 0; k < 100; k++) {
      chamadas.length = 0;
      pulso();
      const n = visuals.update(mech());
      expect(chamadas.reduce((a, c) => a + c.o.count, 0)).toBe(n);
      expect(n).toBeLessThanOrEqual(FIRE_RING_MAX_PER_PULSE);
      total += n;
    }
    expect(FIRE_RING_MAX_PER_PULSE * 20).toBeLessThanOrEqual(300);
    expect(total / 100).toBeLessThanOrEqual(12.5); // na média, perto do que era (11)
  });

  it('o brilho não ofusca: nenhuma cor passa de 2,3', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech());
    for (const c of chamadas) expect(Math.max(c.o.color.r, c.o.color.g, c.o.color.b)).toBeLessThanOrEqual(2.3);
  });

  it('Mech morto, escondido ou com a partida parada (menu, Hangar) não solta nada', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech('fire', true, false));
    visuals.update(mech('fire', true, true, false));
    visuals.beginFrame(1, false);
    expect(visuals.update(mech())).toBe(0);
    expect(chamadas).toHaveLength(0);
  });
});

describe('o aro de brasa no chão (ShieldVisuals)', () => {
  const stub = (kind: 'fire' | 'frontal' | 'sphere', active = true) =>
    ({
      alive: true,
      position: new THREE.Vector3(3, 0, -2),
      yaw: 0,
      pitch: 0,
      stats: { radius: 1.3, height: 5.3 },
      energyShield: { kind, active },
    }) as unknown as MechBase;
  const contagens = (v: ShieldVisuals) => {
    const o = v as unknown as { fireRim: THREE.InstancedMesh; fireDisc: THREE.InstancedMesh; sphere: THREE.InstancedMesh; fill: THREE.InstancedMesh };
    return { aro: o.fireRim.count, disco: o.fireDisc.count, esfera: o.sphere.count, barreira: o.fill.count, o };
  };

  it('o anel de fogo ligado desenha o aro e o disco no chão, do raio do dano, e nada da barreira nem da esfera', () => {
    const v = new ShieldVisuals(new THREE.Scene());
    v.begin();
    v.update(stub('fire'));
    v.end();
    const c = contagens(v);
    expect([c.aro, c.disco, c.esfera, c.barreira]).toEqual([1, 1, 0, 0]);
    const m = new THREE.Matrix4();
    c.o.fireRim.getMatrixAt(0, m);
    const pos = new THREE.Vector3();
    const esc = new THREE.Vector3();
    m.decompose(pos, new THREE.Quaternion(), esc);
    expect(esc.x).toBeCloseTo(FIRE_RING.radius, 5);
    expect(pos.x).toBeCloseTo(3, 5);
    expect(pos.y).toBeGreaterThan(0);
    expect(pos.y).toBeLessThan(0.5); // no chão
  });

  it('a barreira e a esfera não desenham o aro, e o anel desligado não desenha nada', () => {
    const v = new ShieldVisuals(new THREE.Scene());
    v.begin();
    v.update(stub('frontal'));
    v.update(stub('sphere'));
    v.update(stub('fire', false));
    v.end();
    const c = contagens(v);
    expect([c.aro, c.disco, c.esfera, c.barreira]).toEqual([0, 0, 1, 1]);
  });

  it('o pool tem teto de 16 anéis (G5): o 17º não passa', () => {
    const v = new ShieldVisuals(new THREE.Scene());
    v.begin();
    for (let i = 0; i < 20; i++) v.update(stub('fire'));
    v.end();
    expect(contagens(v).aro).toBe(16);
  });
});
