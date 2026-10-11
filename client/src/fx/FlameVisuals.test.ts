import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { StatusSet } from '../combat/StatusEffects';
import type { MechBase } from '../entities/MechBase';
import { FlameVisuals } from './FlameVisuals';
import { SHAPE } from './particleShapes';
import type { BurstOptions } from './ParticleSystem';

interface Chamada {
  at: THREE.Vector3;
  normal: THREE.Vector3;
  o: BurstOptions;
}
function palco() {
  const chamadas: Chamada[] = [];
  const particles = { burst: (at: THREE.Vector3, normal: THREE.Vector3, o: BurstOptions) => chamadas.push({ at: at.clone(), normal: normal.clone(), o }) };
  const visuals = new FlameVisuals(particles);
  /** Um Mech de mentira: só o que o módulo lê. */
  const mech = (flaming: boolean, yaw = 0, pitch = 0, alive = true, visible = true) => {
    const status = new StatusSet();
    status.flaming = flaming;
    return {
      alive,
      root: { visible },
      status,
      yaw,
      pitch,
      mountWorldPosition: (_m: string, t: THREE.Vector3) => t.set(1, 3, 2),
    } as unknown as MechBase;
  };
  return { chamadas, visuals, mech, pulso: () => visuals.beginFrame(0.04, true) };
}

describe('o fluxo visível do lança-chamas (desenhado pela bandeira, para todos os jogadores)', () => {
  it('sem a bandeira de chama acesa, nada sai', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    expect(visuals.update(mech(false))).toBe(0);
    expect(chamadas).toHaveLength(0);
  });

  it('só solta no pulso de 30 Hz: um quadro curto não abre o pulso', () => {
    const { chamadas, visuals, mech } = palco();
    visuals.beginFrame(0.01, true);
    expect(visuals.update(mech(true))).toBe(0);
    expect(chamadas).toHaveLength(0);
  });

  it('sai da boca da mão e vai na direção do Mech: reto à frente (yaw 0) e para o lado (yaw 90°)', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true, 0, 0));
    expect(chamadas[0]!.at.toArray()).toEqual([1, 3, 2]);
    expect(chamadas[0]!.normal.x).toBeCloseTo(0, 5);
    expect(chamadas[0]!.normal.z).toBeCloseTo(-1, 5);
    chamadas.length = 0;
    pulso();
    visuals.update(mech(true, Math.PI / 2, 0));
    expect(chamadas[0]!.normal.x).toBeCloseTo(-1, 5);
    expect(chamadas[0]!.normal.z).toBeCloseTo(0, 5);
  });

  it('é fogo (vermelho e verde acima do azul, sobe) com uma fumaça cinza atrás; o alcance visual cobre o cone de 20 m', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true));
    const [chama, miolo, fumaca] = chamadas.map((c) => c.o);
    expect(chama!.color.r).toBeGreaterThan(chama!.color.b * 5);
    expect(chama!.gravity).toBeLessThan(0); // sobe
    expect(miolo!.color.g).toBeGreaterThan(chama!.color.g); // o miolo é mais claro
    expect(fumaca!.color.r).toBeLessThan(0.5);
    expect(chama!.speed * chama!.life).toBeGreaterThan(19); // ~20 m de língua de fogo (o cone de dano vai a 20 m)
    // Gorda ao longe (cresce: 1,7 x (1 + 3) = 6,8 no fim) e fina na boca, para não ofuscar a câmera (dono, 11/10: "fraco e curto" e, antes, "luz demais").
    expect(chama!.size! * (1 + chama!.expansion!)).toBeGreaterThanOrEqual(6);
    expect(chama!.size!).toBeLessThanOrEqual(2);
  });

  it('o fogo tem forma de língua de fogo (o miolo também) e a fumaça é uma nuvem', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true));
    const [chama, miolo, fumaca] = chamadas.map((c) => c.o);
    expect(chama!.shape).toBe(SHAPE.flame);
    expect(miolo!.shape).toBe(SHAPE.flame);
    expect(fumaca!.shape).toBe(SHAPE.puff);
  });

  it('o custo é pequeno e conhecido: 9 partículas por pulso a 30 Hz = 270 por segundo por lança-chamas aceso (o pool tem 3000)', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    const n = visuals.update(mech(true));
    expect(n).toBe(9);
    expect(chamadas.reduce((a, c) => a + c.o.count, 0)).toBe(9);
    expect(n * 30).toBeLessThanOrEqual(300);
  });

  it('a boca fica acesa: um clarão curto, parado e brilhante onde o fogo sai (a 4ª rajada do pulso)', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true));
    const boca = chamadas[3]!.o;
    expect(boca.speed).toBe(0);
    expect(boca.life).toBeLessThanOrEqual(0.15);
    expect(boca.color.r).toBeGreaterThan(boca.color.b * 3); // alaranjado
    expect(chamadas[3]!.at.toArray()).toEqual([1, 3, 2]); // na boca da mão
  });

  it('Mech morto, escondido ou com a partida parada (menu, Hangar) não solta nada', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true, 0, 0, false));
    visuals.update(mech(true, 0, 0, true, false));
    visuals.beginFrame(1, false);
    expect(visuals.update(mech(true))).toBe(0);
    expect(chamadas).toHaveLength(0);
  });
});
