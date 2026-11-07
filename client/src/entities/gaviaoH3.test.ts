import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { blueprintDoGaviao, DESENHO_SALVO, GAVIAO_H3_BLUEPRINT } from './gaviaoH3';
import { buildMechBlueprintRig } from './mechBlueprint';
import { fasePorSegundo, parametrosDaPassada, passoNaVelocidade, poseDaPassada, type PassadaMutavel, type PoseDaPassada } from './passadaGen3';
import { medirGeometriaDaPerna } from './passadaRig';

const montar = () => buildMechBlueprintRig(GAVIAO_H3_BLUEPRINT);

const malhasDoLote = (no: THREE.Object3D): THREE.Mesh[] => {
  const malhas: THREE.Mesh[] = [];
  no.traverse((o) => {
    if (o instanceof THREE.Mesh && (o.geometry as THREE.BufferGeometry).getAttribute('mechHull')) malhas.push(o);
  });
  return malhas;
};

const triangulos = (g: THREE.BufferGeometry): number => (g.index?.count ?? g.getAttribute('position').count) / 3;

describe('o Gavião-H3, o primeiro robô da geração 3 (gaviaoH3)', () => {
  it('monta um rig completo, com tornozelo e pé medido: a geração 3 do movimento vale para ele', () => {
    const r = montar();
    expect(r.model.name).toBe('mech-gaviao');
    expect(r.setFootPitch).toBeTypeOf('function');
    expect(r.leftLeg.ankle).toBeDefined();
    expect(r.rightLeg.ankle).toBeDefined();
    expect(r.mountWeapons).toBeTypeOf('function');
    const geo = medirGeometriaDaPerna(r);
    expect(geo).not.toBeNull();
    expect(geo?.tornozelo).toBeCloseTo(0.1, 6);
    expect(geo?.peFrente).toBeCloseTo(GAVIAO_H3_BLUEPRINT.legs.footLength * 0.62, 6);
  });

  it('o orçamento: no máximo 10 malhas (um draw call por pivô) e 6 mil triângulos no corpo todo', () => {
    const malhas = malhasDoLote(montar().model);
    expect(malhas.length).toBeLessThanOrEqual(10);
    const total = malhas.reduce((soma, m) => soma + triangulos(m.geometry as THREE.BufferGeometry), 0);
    expect(total).toBeLessThan(6000);
    expect(total).toBeGreaterThan(500);
  });

  it('a sola pisa o chão e a cabeça fecha a altura de referência (4,5 m, com folga de 0,3 m): nada flutua, nada afunda', () => {
    const r = montar();
    r.model.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(r.model);
    expect(caixa.min.y).toBeGreaterThan(-0.03);
    expect(caixa.min.y).toBeLessThan(0.03);
    expect(Math.abs(caixa.max.y - GAVIAO_H3_BLUEPRINT.referenceHeight)).toBeLessThan(0.3);
  });

  it('é simétrico: o joelho esquerdo e o direito são espelhos em x, e as peças não ficam fora do corpo', () => {
    const r = montar();
    r.model.updateMatrixWorld(true);
    const caixaDe = (no: unknown): THREE.Box3 => new THREE.Box3().setFromObject(no as THREE.Object3D);
    const e = caixaDe(r.leftLeg.knee);
    const d = caixaDe(r.rightLeg.knee);
    expect(e.max.x).toBeCloseTo(-d.min.x, 3);
    expect(e.min.x).toBeCloseTo(-d.max.x, 3);
    expect(e.max.y).toBeCloseTo(d.max.y, 3);
    const corpo = new THREE.Box3().setFromObject(r.model);
    expect(corpo.max.x).toBeCloseTo(-corpo.min.x, 1);
    expect(corpo.max.x).toBeLessThan(1.5);
  });

  it('só os pés giram no tornozelo (os vértices marcados), um por perna, e mais nada do corpo', () => {
    const r = montar();
    let esquerdo = 0;
    let direito = 0;
    let outros = 0;
    for (const m of malhasDoLote(r.model)) {
      const marca = (m.geometry as THREE.BufferGeometry).getAttribute('mechFoot');
      for (let i = 0; i < marca.count; i++) {
        const v = marca.getX(i);
        if (v < 0) esquerdo++;
        else if (v > 0) direito++;
        else outros++;
      }
    }
    expect(esquerdo).toBeGreaterThan(0);
    expect(esquerdo).toBe(direito);
    expect(outros).toBeGreaterThan(esquerdo);
  });

  it('sem o corpo registrado, o mesmo blueprint monta o corpo de blocos (nunca quebra a partida por isso)', () => {
    const r = buildMechBlueprintRig({ ...GAVIAO_H3_BLUEPRINT, corpo: 'nunca-registrado' });
    expect(r.model.name).toBe('mech-gaviao');
    expect(medirGeometriaDaPerna(r)).not.toBeNull();
  });

  it('a boca do braço direito sai à frente do antebraço, como a de todo Mech de código', () => {
    const r = montar();
    expect(r.muzzle.position.z).toBeLessThan(-GAVIAO_H3_BLUEPRINT.arms.forearmDepth);
  });

  it('com a geração 3 ele anda de pé: o joelho do apoio até 50° e a pelve média a 93% do repouso ou mais, de marcha e na corrida', () => {
    const geo = medirGeometriaDaPerna(montar());
    expect(geo).not.toBeNull();
    if (!geo) return;
    const base = parametrosDaPassada(geo, 0.7);
    const p: PassadaMutavel = { ...base };
    const vTopo = 9;
    for (const fracao of [0.3, 1]) {
      const v = fracao * vTopo;
      const pose: PoseDaPassada = { hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, dPelvis: 0, phiL: 0, phiR: 0 };
      let fase = 0;
      let soma = 0;
      let n = 0;
      let joelhoNoApoio = 0;
      for (let i = 0; i < 360; i++) {
        passoNaVelocidade(base, v, vTopo, p);
        fase += (fasePorSegundo(p, v) * 1) / 60;
        poseDaPassada(fase, 1, geo, p, pose);
        if (i < 60) continue;
        soma += pose.dPelvis / geo.dRest;
        n++;
        if (((fase / (Math.PI * 2)) % 1) < p.fracaoDeApoio) joelhoNoApoio = Math.max(joelhoNoApoio, -pose.kneeL);
      }
      expect(soma / n).toBeGreaterThan(0.93);
      expect(joelhoNoApoio).toBeLessThan((50 * Math.PI) / 180);
    }
  });
  it('as chaves de montagem (peitoDeFora, cabecaDeFora, ombreiraDeFora) deixam as peças do kit de fora para a peça do Blender ocupar o lugar: menos triângulos, o mesmo rig e as mesmas pernas', () => {
    const inteiro = montar();
    const vazado = buildMechBlueprintRig(blueprintDoGaviao(DESENHO_SALVO, { peitoDeFora: 1, cabecaDeFora: 1, ombreiraDeFora: 1 }));
    const tris = (r: ReturnType<typeof montar>): number => malhasDoLote(r.model).reduce((soma, m) => soma + triangulos(m.geometry as THREE.BufferGeometry), 0);
    expect(tris(vazado)).toBeLessThan(tris(inteiro) - 800);
    expect(medirGeometriaDaPerna(vazado)).not.toBeNull();
    expect(vazado.muzzle.position.z).toBeLessThan(-GAVIAO_H3_BLUEPRINT.arms.forearmDepth);
    // a cabeça fica sem malha (o capacete é a peça do Blender): o pivô existe e gira, sem desenho próprio
    expect(malhasDoLote(vazado.head as unknown as THREE.Object3D).length).toBe(0);
  });
});
