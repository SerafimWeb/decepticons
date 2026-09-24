import { describe, expect, it } from 'vitest';
import { calculateDamageAngle } from './DamageIndicator';

describe('calculateDamageAngle', () => {
  const playerPos = { x: 0, y: 0, z: 0 };

  it('retorna ~0° para tiro vindo exatamente da frente', () => {
    // Com yaw = 0, a frente é (0, 0, -10)
    const shooterPos = { x: 0, y: 0, z: -10 };
    const angle = calculateDamageAngle(playerPos, shooterPos, 0);
    expect(angle).toBeCloseTo(0, 1);
  });

  it('retorna ~180° para tiro vindo exatamente de trás', () => {
    // Com yaw = 0, de trás é (0, 0, 10)
    const shooterPos = { x: 0, y: 0, z: 10 };
    const angle = calculateDamageAngle(playerPos, shooterPos, 0);
    expect(angle).toBeCloseTo(180, 1);
  });

  it('retorna ~90° para tiro vindo da direita', () => {
    // Com yaw = 0, da direita é (10, 0, 0)
    const shooterPos = { x: 10, y: 0, z: 0 };
    const angle = calculateDamageAngle(playerPos, shooterPos, 0);
    expect(angle).toBeCloseTo(90, 1);
  });

  it('retorna ~270° para tiro vindo da esquerda', () => {
    // Com yaw = 0, da esquerda é (-10, 0, 0)
    const shooterPos = { x: -10, y: 0, z: 0 };
    const angle = calculateDamageAngle(playerPos, shooterPos, 0);
    expect(angle).toBeCloseTo(270, 1);
  });

  it('respeita a rotação da câmera, com a frente e a direita do próprio jogo', () => {
    // Mesma conta do PlayerController: frente = (-sin yaw, 0, -cos yaw); direita = (cos yaw, 0, -sin yaw).
    for (const yaw of [0, 0.7, Math.PI / 2, 2.5, -1.2]) {
      const front = { x: -Math.sin(yaw) * 10, y: 0, z: -Math.cos(yaw) * 10 };
      const right = { x: Math.cos(yaw) * 10, y: 0, z: -Math.sin(yaw) * 10 };
      const back = { x: -front.x, y: 0, z: -front.z };
      const left = { x: -right.x, y: 0, z: -right.z };
      const deg = (p: { x: number; y: number; z: number }) => calculateDamageAngle(playerPos, p, yaw);
      expect(Math.min(deg(front), 360 - deg(front))).toBeCloseTo(0, 1);
      expect(deg(right)).toBeCloseTo(90, 1);
      expect(deg(back)).toBeCloseTo(180, 1);
      expect(deg(left)).toBeCloseTo(270, 1);
    }
  });

  it('yaw = 90° olha para -X (não +X): tiro de +X vem de trás', () => {
    expect(calculateDamageAngle(playerPos, { x: -10, y: 0, z: 0 }, Math.PI / 2)).toBeCloseTo(0, 1);
    expect(calculateDamageAngle(playerPos, { x: 10, y: 0, z: 0 }, Math.PI / 2)).toBeCloseTo(180, 1);
  });
});
