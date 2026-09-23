import { describe, expect, it } from 'vitest';
import type { MechModules } from '../entities/MechBase';
import { VECTOR09_STATS } from '../entities/Vector09';
import { applyDamage, partAt } from './damage';

const H = VECTOR09_STATS.height;
const R = VECTOR09_STATS.radius;
const fresh = (): MechModules => ({ ...VECTOR09_STATS.maxModuleHealth });

describe('partAt: parte pelo ponto de impacto', () => {
  it('pernas abaixo do quadril, pelo lado', () => {
    expect(partAt(-0.5, 1.0, H, R)).toBe('leftLeg');
    expect(partAt(0.5, 1.0, H, R)).toBe('rightLeg');
  });

  it('torso no meio do casco', () => {
    expect(partAt(0, 3.5, H, R)).toBe('torso');
    expect(partAt(0.9, 3.5, H, R)).toBe('torso');
  });

  it('braços nas laterais, na altura do torso', () => {
    expect(partAt(-1.2, 3.5, H, R)).toBe('leftArm');
    expect(partAt(1.2, 3.5, H, R)).toBe('rightArm');
  });

  it('cabeça no topo', () => {
    expect(partAt(0, 5.0, H, R)).toBe('head');
  });
});

describe('applyDamage', () => {
  it('tira vida da parte atingida', () => {
    const m = fresh();
    const r = applyDamage(m, 'leftLeg', 25);
    expect(r).toEqual({ part: 'leftLeg', applied: 25, partDestroyed: false, killed: false });
    expect(m.leftLeg).toBe(VECTOR09_STATS.maxModuleHealth.leftLeg - 25);
  });

  it('avisa quando a parte é destruída e não deixa vida negativa', () => {
    const m = fresh();
    m.rightArm = 10;
    const r = applyDamage(m, 'rightArm', 25);
    expect(r.partDestroyed).toBe(true);
    expect(r.applied).toBe(10);
    expect(m.rightArm).toBe(0);
  });

  it('dano em parte já destruída vai para o torso', () => {
    const m = fresh();
    m.leftArm = 0;
    const r = applyDamage(m, 'leftArm', 25);
    expect(r.part).toBe('torso');
    expect(m.torso).toBe(VECTOR09_STATS.maxModuleHealth.torso - 25);
  });

  it('torso zerado mata; morto não recebe mais dano', () => {
    const m = fresh();
    m.torso = 20;
    expect(applyDamage(m, 'torso', 25).killed).toBe(true);
    m.head = 100;
    expect(applyDamage(m, 'head', 25).applied).toBe(0);
    expect(m.head).toBe(100);
  });

  it('cabeça destruída não mata (vira Blind Mode)', () => {
    const m = fresh();
    const r = applyDamage(m, 'head', 1000);
    expect(r.partDestroyed).toBe(true);
    expect(r.killed).toBe(false);
  });
});
