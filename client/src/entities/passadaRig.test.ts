import { describe, expect, it } from 'vitest';
import { buildMechBlueprintRig, LIGHT_MECH_BLUEPRINT, MEDIUM_MECH_BLUEPRINT } from './mechBlueprint';
import { medirGeometriaDaPerna } from './passadaRig';

// A medida lê as posições do rig de verdade: confere com a conta feita à mão a partir das dimensões do blueprint.
describe('medição da perna no rig (passadaRig)', () => {
  it('o Vector-09 (médio) mede coxa 1,15 m, canela 1,35 m e o quadril a 2,5 m do chão, sem joelho deslocado', () => {
    const g = medirGeometriaDaPerna(buildMechBlueprintRig(MEDIUM_MECH_BLUEPRINT));
    expect(g).not.toBeNull();
    if (!g) return;
    expect(g.ue).toBeCloseTo(MEDIUM_MECH_BLUEPRINT.legs.upperLength, 2);
    expect(g.w).toBeCloseTo(MEDIUM_MECH_BLUEPRINT.legs.lowerLength + 0.2, 2);
    expect(g.dRest).toBeCloseTo(g.ue + g.w, 2);
    expect(g.peFrente).toBeCloseTo(MEDIUM_MECH_BLUEPRINT.legs.footLength * 0.62, 6);
    expect(g.peTras).toBeCloseTo(MEDIUM_MECH_BLUEPRINT.legs.footLength * 0.38, 6);
    expect(Math.abs(g.eps)).toBeLessThan(1e-3);
    expect(Math.abs(g.f0)).toBeLessThan(1e-3);
  });

  it('o rig que não informa o pé (o .glb) não é medido: devolve nulo e o Mech anda como antes', () => {
    const rig = buildMechBlueprintRig(MEDIUM_MECH_BLUEPRINT);
    expect(medirGeometriaDaPerna({ ...rig, pe: undefined })).toBeNull();
  });

  it('o Ferret (leve, digitígrado) mede o joelho deslocado para a frente pelo valor do blueprint', () => {
    const g = medirGeometriaDaPerna(buildMechBlueprintRig(LIGHT_MECH_BLUEPRINT));
    expect(g).not.toBeNull();
    if (!g) return;
    expect(g.f0).toBeCloseTo(LIGHT_MECH_BLUEPRINT.legs.digitigrade, 2);
    expect(g.ue).toBeCloseTo(Math.hypot(LIGHT_MECH_BLUEPRINT.legs.digitigrade, LIGHT_MECH_BLUEPRINT.legs.upperLength), 2);
  });
});
