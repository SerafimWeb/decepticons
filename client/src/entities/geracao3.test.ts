import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { definirAjustesGen3, PADRAO_GEN3 } from './ajustesGen3';
import { CHASSIS } from './chassis';
import { GERACAO3 } from './geracao3';
import type { MechRig } from './MechBase';
import { carregarGeracao3, setMovimentoGen3 } from './movimentoGen3';
import { Vector09 } from './Vector09';

const DT = 1 / 60;
const V = CHASSIS.vector09.moveSpeed;
const rigDe = (m: Vector09): MechRig => (m as unknown as { rig: MechRig }).rig;
const faseDe = (m: Vector09): number => (m as unknown as { walkPhase: number }).walkPhase;

/** Anda `quadros` quadros na velocidade `v` (m/s para -Z), no chão. Sem física: o mesmo que a bancada e o Hangar fazem. */
function andar(m: Vector09, quadros: number, v: number): void {
  for (let i = 0; i < quadros; i++) {
    m.velocity.set(0, 0, -v);
    m.grounded = true;
    m.applyFacing(0, 0);
    m.render(DT, 1);
  }
}

describe('a geração 3 no MechBase de verdade', () => {
  beforeAll(async () => {
    await carregarGeracao3();
  });
  afterEach(() => {
    setMovimentoGen3(false);
    definirAjustesGen3(PADRAO_GEN3);
  });

  it('desligada, o Mech anda pela fórmula de hoje (a geração 2 está intacta)', () => {
    setMovimentoGen3(false);
    const m = new Vector09();
    andar(m, 60, V);
    const rig = rigDe(m);
    // A pelve de hoje: o balanço do quadril é |sen(fase)|·0,12·amt (sem avaria nas pernas, `lean` = 0; correndo a toda, amt = 1).
    expect(rig.pelvis.position.y).toBeCloseTo(rig.hipHeight - Math.abs(Math.sin(faseDe(m))) * 0.12, 9);
    expect(rig.torso.rotation.x).toBeCloseTo(0, 9);
  });

  it('ligada, o Mech corre com o quadril um pouco mais baixo (não agachado) e o tronco inclina ao arrancar', () => {
    setMovimentoGen3(true);
    const m = new Vector09();
    andar(m, 10, 0); // arranca do repouso, como no jogo (a velocidade suavizada parte da de agora: sem aceleração não há inclinação)
    let troncoMin = 0;
    for (let i = 0; i < 90; i++) {
      andar(m, 1, V);
      troncoMin = Math.min(troncoMin, rigDe(m).torso.rotation.x);
    }
    const rig = rigDe(m);
    // Corre com o quadril abaixo do repouso, mas de pé: entre 0,02 m e 8% da altura do quadril abaixo dele (antes, 12,5% fixos e o robô andava agachado).
    expect(rig.pelvis.position.y).toBeLessThan(rig.hipHeight - 0.02);
    expect(rig.pelvis.position.y).toBeGreaterThan(rig.hipHeight * 0.92);
    expect(troncoMin).toBeLessThan(-0.02);
  });

  it('ligada, o pé fica plano no apoio: o ângulo do tornozelo cancela a inclinação da canela, e desligada o pé não gira', () => {
    setMovimentoGen3(true);
    const m = new Vector09();
    const par = rigDe(m).hullMaterials[0]?.userData.footPitch as { x: number; y: number };
    let girou = false;
    let planoNoApoio = false;
    for (let i = 0; i < 120; i++) {
      andar(m, 1, V);
      const r = rigDe(m);
      if (Math.abs(par.x) > 0.05) girou = true;
      // O pé no chão (ângulo do tornozelo + canela = 0): o pé esquerdo fica plano em relação ao chão.
      const mundo = par.x + r.leftLeg.hip.rotation.x + r.leftLeg.knee.rotation.x;
      if (i > 60 && Math.abs(mundo) < 1e-6) planoNoApoio = true;
    }
    expect(girou).toBe(true);
    expect(planoNoApoio).toBe(true);
    setMovimentoGen3(false);
    const velho = new Vector09();
    const parVelho = rigDe(velho).hullMaterials[0]?.userData.footPitch as { x: number; y: number };
    andar(velho, 60, V);
    expect(parVelho.x).toBe(0);
    expect(parVelho.y).toBe(0);
  });
  it('ligada e parada, volta ao repouso sem restos: pernas esticadas e pelve na altura de hoje', () => {
    setMovimentoGen3(true);
    const m = new Vector09();
    andar(m, 90, V);
    andar(m, 240, 0);
    const rig = rigDe(m);
    expect(Math.abs(rig.leftLeg.hip.rotation.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.leftLeg.knee.rotation.x)).toBeLessThan(0.01);
    expect(rig.pelvis.position.y).toBeCloseTo(rig.hipHeight, 2);
    expect(Math.abs(rig.torso.rotation.x)).toBeLessThan(0.002);
  });

  it('o rig que não informa o pé (o .glb) fica na passada de hoje, mesmo com a geração 3 ligada', () => {
    setMovimentoGen3(true);
    const m = new Vector09();
    const rig = rigDe(m);
    rig.pe = undefined;
    andar(m, 60, V);
    expect(rig.pelvis.position.y).toBeCloseTo(rig.hipHeight - Math.abs(Math.sin(faseDe(m))) * 0.12, 9);
  });

  it('criarEstado devolve nulo para o rig sem o pé e um estado completo para o procedural', () => {
    const m = new Vector09();
    const rig = rigDe(m);
    expect(GERACAO3.criarEstado(rig, 0.7, 5.3, 9)).not.toBeNull();
    const semPe = { ...rig, pe: undefined } as MechRig;
    expect(GERACAO3.criarEstado(semPe, 0.7, 5.3, 9)).toBeNull();
  });

  it('ligada, o coice vira uma mola: o braço não segue a queda reta de hoje', () => {
    const serie = (ligada: boolean): number[] => {
      setMovimentoGen3(ligada);
      const m = new Vector09();
      andar(m, 5, 0);
      const base = rigDe(m).rightArm.position.z;
      (m as unknown as { recoil: number }).recoil = 1;
      const z: number[] = [];
      for (let i = 0; i < 40; i++) {
        andar(m, 1, 0);
        z.push(rigDe(m).rightArm.position.z - base);
      }
      return z;
    };
    const hoje = serie(false);
    const mola = serie(true);
    const maiorDiferenca = Math.max(...hoje.map((v, i) => Math.abs(v - mola[i])));
    expect(maiorDiferenca).toBeGreaterThan(1e-3);
    expect(mola.every(Number.isFinite)).toBe(true);
  });
});
