import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { VECTOR09_STATS, Vector09 } from '../entities/Vector09';
import { MechBase } from '../entities/MechBase';
import { buildMechBlueprintRig, MEDIUM_MECH_BLUEPRINT } from '../entities/mechBlueprint';
import { PALETTE } from '../core/palette';
import { damagedPart, DamageVisuals, legDamageLean } from './DamageVisuals';

class BenchMech extends MechBase {
  constructor(heatVisual = true, baseRoll = 0) {
    const rig = buildMechBlueprintRig(MEDIUM_MECH_BLUEPRINT, { paint: PALETTE.playerPaint, visor: PALETTE.green });
    if (!heatVisual) rig.setHeatVisual = undefined;
    rig.pelvis.rotation.z = baseRoll;
    super(VECTOR09_STATS, rig);
  }
  get pose() { return this.rig; }
}

function bench() {
  const burst = vi.fn();
  return { burst, fx: new DamageVisuals({ burst }) };
}

describe('sinais de avaria, só no render', () => {
  it('só sinaliza partes ainda presentes com até metade da vida', () => {
    expect(damagedPart(50, 100)).toBe(true);
    expect(damagedPart(51, 100)).toBe(false);
    expect(damagedPart(0, 100)).toBe(false);
    expect(damagedPart(0, 0)).toBe(false);
  });

  it('não emite saudável, pausado, morto ou invisível; conserto interrompe a emissão', () => {
    const { fx, burst } = bench();
    const m = new Vector09();
    fx.beginFrame(0.1, true); fx.update(m);
    expect(burst).not.toHaveBeenCalled();
    m.modules.leftArm = 1;
    fx.beginFrame(0.1, false); fx.update(m);
    expect(burst).not.toHaveBeenCalled();
    fx.beginFrame(0.1, true); fx.update(m);
    expect(burst).toHaveBeenCalledTimes(2);
    m.modules.leftArm = m.stats.maxModuleHealth.leftArm;
    fx.beginFrame(0.1, true); fx.update(m);
    expect(burst).toHaveBeenCalledTimes(2);
    m.modules.leftArm = 1; m.root.visible = false;
    fx.beginFrame(0.1, true); fx.update(m);
    m.root.visible = true; m.modules.torso = 0;
    fx.beginFrame(0.1, true); fx.update(m);
    expect(burst).toHaveBeenCalledTimes(2);
  });

  it('o orçamento do pulso é de quem emite: 20 robôs saudáveis na frente não tiram a fumaça do avariado (esquadrão grande)', () => {
    const { fx, burst } = bench();
    const saudaveis = Array.from({ length: 20 }, () => new Vector09());
    const ferido = new Vector09();
    ferido.modules.leftArm = 1;
    fx.beginFrame(0.1, true);
    for (const m of saudaveis) fx.update(m);
    fx.update(ferido);
    expect(burst).toHaveBeenCalledTimes(2);
  });

  it('alterna partes avariadas e limita emissões mesmo após engasgo', () => {
    const { fx, burst } = bench();
    const m = new Vector09();
    for (const part of ['leftArm', 'rightArm'] as const) m.modules[part] = 1;
    const locate = vi.spyOn(m, 'partWorldPosition');
    for (let i = 0; i < 6; i++) { fx.beginFrame(0.1, true); fx.update(m); }
    expect(locate.mock.calls.some(([p]) => p === 'leftArm')).toBe(true);
    expect(locate.mock.calls.some(([p]) => p === 'rightArm')).toBe(true);
    expect(locate.mock.calls.every(([, , center]) => center === false)).toBe(true);
    burst.mockClear();
    fx.beginFrame(10, true);
    for (let i = 0; i < 30; i++) fx.update(m);
    expect(burst).toHaveBeenCalledTimes(24); // 12 unidades, uma parte cada
    fx.beginFrame(0, true); fx.update(m);
    expect(burst).toHaveBeenCalledTimes(24);
  });

  it('ventila rigs sem efeito de calor e não duplica a ventilação dos blueprints', () => {
    const { fx, burst } = bench();
    const a = new BenchMech(false); const b = new BenchMech();
    a.applyNetVitals({ torso: 1, head: 1, leftArm: 1, rightArm: 1, leftLeg: 1, rightLeg: 1 }, 0.9, true);
    b.applyNetVitals({ torso: 1, head: 1, leftArm: 1, rightArm: 1, leftLeg: 1, rightLeg: 1 }, 0.9, true);
    fx.beginFrame(0.1, true); fx.update(a); fx.update(b);
    expect(burst).toHaveBeenCalledTimes(1);
  });

  it('manca para a perna avariada, sem alterar vida ou boca de simulação; reparo restaura a pose', () => {
    const m = new BenchMech(true, 0.2);
    m.grounded = true; m.velocity.z = 4;
    const before = m.simMuzzle(new THREE.Vector3()).clone();
    m.modules.leftLeg = 1;
    expect(legDamageLean(m.modules, m.stats.maxModuleHealth)).toBeGreaterThan(0);
    m.render(0.1, 1);
    expect(m.pose.pelvis.rotation.z).toBeGreaterThan(0.2);
    expect(m.simMuzzle(new THREE.Vector3())).toEqual(before);
    expect(m.modules.leftLeg).toBe(1);
    m.modules.leftLeg = m.stats.maxModuleHealth.leftLeg;
    m.render(0.1, 1);
    expect(m.pose.pelvis.rotation.z).toBeCloseTo(0.2);
    m.modules.rightLeg = 1; m.render(0.1, 1);
    expect(m.pose.pelvis.rotation.z).toBeLessThan(0.2);
    m.grounded = false; m.render(0.1, 1);
    expect(m.pose.pelvis.rotation.z).toBeCloseTo(0.2);
  });
});
