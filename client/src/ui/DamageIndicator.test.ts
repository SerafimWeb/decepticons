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

  it('respeita a rotação da câmera (cameraYaw)', () => {
    // Se o jogador estiver olhando para a direita (yaw = Math.PI / 2, ou seja, para +X),
    // um tiro em (10, 0, 0) está vindo de FRENTE para ele (deve ser ~0°)
    const shooterPos = { x: 10, y: 0, z: 0 };
    const cameraYaw = Math.PI / 2;
    const angle = calculateDamageAngle(playerPos, shooterPos, cameraYaw);
    expect(angle).toBeCloseTo(0, 1);
  });
});
