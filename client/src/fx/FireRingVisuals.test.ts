import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FIRE_RING } from '../combat/EnergyShield';
import type { MechBase } from '../entities/MechBase';
import { FireRingVisuals } from './FireRingVisuals';
import { ShieldVisuals } from './ShieldVisuals';
import type { BurstOptions } from './ParticleSystem';
import { SHAPE } from './particleShapes';

interface Chamada {
  at: THREE.Vector3;
  o: BurstOptions;
}
function palco() {
  const chamadas: Chamada[] = [];
  const particles = { burst: (at: THREE.Vector3, _n: THREE.Vector3, o: BurstOptions) => chamadas.push({ at: at.clone(), o }) };
  const visuals = new FireRingVisuals(particles);
  /** Um Mech de mentira: só o que o módulo lê. */
  const mech = (kind: 'fire' | 'frontal' | 'sphere' | null = 'fire', active = true, alive = true, visible = true, x = 10, z = -4) =>
    ({
      alive,
      root: { visible },
      position: new THREE.Vector3(x, 0, z),
      energyShield: { kind, active },
    }) as unknown as MechBase;
  const pulso = () => visuals.beginFrame(0.06, true);
  return { chamadas, visuals, mech, pulso };
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

  it('as 8 línguas de fogo saem do aro, a 7 m do centro do Mech, igualmente espaçadas', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech('fire', true, true, true, 10, -4));
    const linguas = chamadas.filter((c) => c.o.shape === SHAPE.flame);
    expect(linguas).toHaveLength(8);
    for (const l of linguas) expect(Math.hypot(l.at.x - 10, l.at.z + 4)).toBeCloseTo(FIRE_RING.radius, 4);
    const angulos = linguas.map((l) => Math.atan2(l.at.z + 4, l.at.x - 10)).sort((a, b) => a - b);
    for (let i = 1; i < angulos.length; i++) expect(angulos[i]! - angulos[i - 1]!).toBeCloseTo((Math.PI * 2) / 8, 4);
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
    for (const b of brasas) expect(Math.hypot(b.at.x, b.at.z)).toBeCloseTo(FIRE_RING.radius * 0.5, 4);
    const fumaca = chamadas.find((c) => c.o.shape === SHAPE.puff)!;
    expect(fumaca.o.color.r).toBeLessThan(0.5);
    expect(fumaca.at.x).toBe(0);
  });

  it('o custo é pequeno e conhecido: 11 partículas por pulso a 20 Hz = 220 por segundo por anel ligado (o pool tem 3000)', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    const n = visuals.update(mech());
    expect(n).toBe(11);
    expect(chamadas.reduce((a, c) => a + c.o.count, 0)).toBe(11);
    expect(n * 20).toBeLessThanOrEqual(240);
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
