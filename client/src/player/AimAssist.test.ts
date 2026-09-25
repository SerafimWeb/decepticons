import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type AimError, aimErrorTo, FRICTION_CONE, FRICTION_MIN, frictionFor, leadPoint, movingAway, PULL_CONE, pullStep } from './AimAssist';

const err = (): AimError => ({ dYaw: 0, dPitch: 0, angle: 0, dist: 0 });
const cam = new THREE.Vector3(0, 5, 0);

describe('mira assistida: erro até o alvo', () => {
  it('alvo na frente da câmera (mesma convenção do jogo): erro zero', () => {
    for (const yaw of [0, 1, -2.4, Math.PI / 2]) {
      // frente = (-sin yaw, 0, -cos yaw)
      const e = aimErrorTo(cam, yaw, 0, -Math.sin(yaw) * 50, 5, -Math.cos(yaw) * 50, err());
      expect(e.angle).toBeCloseTo(0, 5);
      expect(e.dist).toBeCloseTo(50, 5);
    }
  });

  it('alvo à direita pede yaw negativo (o mouse para a direita diminui o yaw); acima pede pitch positivo', () => {
    const right = aimErrorTo(cam, 0, 0, 10, 5, -10, err());
    expect(right.dYaw).toBeCloseTo(-Math.PI / 4, 5);
    const up = aimErrorTo(cam, 0, 0, 0, 15, -10, err());
    expect(up.dPitch).toBeCloseTo(Math.PI / 4, 5);
  });

  it('o erro de yaw dá a volta pelo lado mais curto', () => {
    // Olhando quase para trás (yaw ~ π), alvo logo à esquerda do "atrás": giro curto, não 2π.
    const e = aimErrorTo(cam, Math.PI - 0.05, 0, 0.1, 5, 10, err());
    expect(Math.abs(e.dYaw)).toBeLessThan(0.1);
  });
});

describe('mira assistida: antecipação', () => {
  it('alvo parado: o ponto é o próprio alvo', () => {
    const p = leadPoint(cam, new THREE.Vector3(0, 5, -70), 0, 0, 140, new THREE.Vector3());
    expect(p.z).toBeCloseTo(-70);
    expect(p.x).toBeCloseTo(0);
  });

  it('alvo andando de lado: o ponto vai à frente o quanto ele anda no voo do plasma', () => {
    // 70 m a 140 m/s = 0,5 s de voo; andando a 16 m/s para +X, o ponto fica 8 m à frente.
    const p = leadPoint(cam, new THREE.Vector3(0, 5, -70), 16, 0, 140, new THREE.Vector3());
    expect(p.x).toBeCloseTo(8, 5);
    expect(p.y).toBeCloseTo(5);
  });
});

describe('mira assistida: soltar o alvo', () => {
  it('puxar o dedo para longe do alvo solta a ajuda; para perto ou parado, não', () => {
    // Alvo à esquerda (erro de yaw positivo): girar para a direita (yaw diminui) é puxar para longe.
    expect(movingAway(-0.01, 0, 0.03, 0)).toBe(true);
    expect(movingAway(0.01, 0, 0.03, 0)).toBe(false);
    expect(movingAway(0, 0, 0.03, 0)).toBe(false);
    // Tremida mínima do dedo não conta.
    expect(movingAway(-0.001, 0, 0.03, 0)).toBe(false);
    // Vertical também: alvo acima, dedo descendo a mira.
    expect(movingAway(0, -0.01, 0, 0.05)).toBe(true);
  });
});

describe('mira assistida: fricção e puxão', () => {
  it('fricção: normal fora do cone, mínima no centro, contínua na borda', () => {
    expect(frictionFor(FRICTION_CONE * 2)).toBe(1);
    expect(frictionFor(0)).toBeCloseTo(FRICTION_MIN);
    expect(frictionFor(FRICTION_CONE * 0.999)).toBeCloseTo(1, 2);
    expect(frictionFor(FRICTION_CONE / 2)).toBeGreaterThan(FRICTION_MIN);
  });

  it('puxão: vai na direção do erro, é gentil e tem teto por quadro', () => {
    const dt = 1 / 60;
    const small = pullStep(0.02, dt);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(0.02); // não corrige tudo num quadro
    expect(pullStep(-0.02, dt)).toBeCloseTo(-small);
    // Erro na borda do cone: o teto (~23°/s) segura o puxão.
    expect(Math.abs(pullStep(PULL_CONE, dt))).toBeLessThanOrEqual(0.4 * dt + 1e-9);
  });

  it('puxão converge: em meio segundo agindo, a mira chega perto do alvo sem passar dele', () => {
    let e = PULL_CONE * 0.9;
    for (let i = 0; i < 30; i++) e -= pullStep(e, 1 / 60);
    expect(e).toBeGreaterThan(0);
    expect(e).toBeLessThan(PULL_CONE * 0.9 * 0.4);
  });
});
