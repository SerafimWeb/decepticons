import { describe, expect, it } from 'vitest';
import {
  advancePhase,
  GAIT,
  LEG_IDS,
  LEG_LENGTH_M,
  LEG_OFFSET,
  legSwing,
  newWalkerPose,
  speedForCycle,
  STRIDE_M,
  WALKER_HEIGHT_M,
  WALKER_SCALE,
  walkerPose,
  type LegId,
} from './walkerGait';

const NENHUMA: Record<LegId, number> = { fl: 0, fr: 0, rl: 0, rr: 0 };
const passos = (n: number): number[] => Array.from({ length: n }, (_, i) => i / n);

describe('as medidas do Draga-01 (P180): 38 m, tamanho 5', () => {
  it('a escala leva a altura do arquivo (0,9839) a 38 m, e a perna e o passo são metros de máquina grande', () => {
    expect(WALKER_HEIGHT_M).toBe(38);
    expect(0.9839 * WALKER_SCALE).toBeCloseTo(38, 9);
    expect(LEG_LENGTH_M).toBeGreaterThan(10);
    expect(LEG_LENGTH_M).toBeLessThan(13);
    expect(STRIDE_M).toBeGreaterThan(3);
    expect(STRIDE_M).toBeLessThan(5);
  });
});

describe('a marcha em quatro tempos (P180): sempre três pés no chão', () => {
  it('a ordem dos passos é dianteira esquerda, traseira direita, dianteira direita, traseira esquerda (um quarto de ciclo entre eles)', () => {
    expect(LEG_OFFSET.fl).toBe(0);
    expect(LEG_OFFSET.rr).toBe(0.25);
    expect(LEG_OFFSET.fr).toBe(0.5);
    expect(LEG_OFFSET.rl).toBe(0.75);
    // o balanço de cada perna começa em sequência: quem balança primeiro, em cada fase
    const quemBalanca = (fase: number): LegId[] => LEG_IDS.filter((id) => legSwing(fase, id).swinging);
    expect(quemBalanca(0.8)).toEqual(['fl']); // fl: t = 0,8 > 0,75
    expect(quemBalanca(0.55)).toEqual(['rr']); // rr: t = 0,80
    expect(quemBalanca(0.3)).toEqual(['fr']); // fr: t = 0,80
    expect(quemBalanca(0.05)).toEqual(['rl']); // rl: t = 0,80
  });

  it('em NENHUMA fase há mais de uma perna no ar (pisada de 75%): o Draga nunca tira dois pés do chão', () => {
    for (const fase of passos(400)) {
      const noAr = LEG_IDS.filter((id) => legSwing(fase, id).swinging).length;
      expect(noAr, `fase ${fase}`).toBeLessThanOrEqual(1);
    }
  });

  it('cada pé fica no ar exatamente 25% do ciclo', () => {
    for (const id of LEG_IDS) {
      const n = passos(1000).filter((f) => legSwing(f, id).swinging).length;
      expect(n / 1000).toBeCloseTo(1 - GAIT.duty, 2);
    }
  });

  it('o quadril e o joelho são contínuos: não dá salto na troca de pisada para balanço nem na volta do ciclo, e o quadril fica em ±hipAmp', () => {
    for (const id of LEG_IDS) {
      let anterior = legSwing(0, id);
      for (const f of passos(2000).slice(1).concat(1)) {
        const s = legSwing(f, id);
        expect(Math.abs(s.hip - anterior.hip), `quadril ${id} em ${f}`).toBeLessThan(0.01);
        expect(Math.abs(s.lift - anterior.lift), `joelho ${id} em ${f}`).toBeLessThan(0.01);
        expect(Math.abs(s.hip)).toBeLessThanOrEqual(GAIT.hipAmp + 1e-9);
        anterior = { ...s };
      }
    }
  });

  it('o pé sai do chão e pousa devagar: o joelho começa e termina o balanço sem dobra (o pé levanta e desce, não salta)', () => {
    const inicio = legSwing(GAIT.duty + 1e-6, 'fl');
    const fim = legSwing(1 - 1e-6, 'fl');
    expect(inicio.swinging).toBe(true);
    expect(inicio.lift).toBeLessThan(0.001);
    expect(fim.lift).toBeLessThan(0.001);
    // e sobe e desce em curva: no primeiro e no último quarto do balanço o pé está mais baixo que no meio
    const alturaEm = (frac: number): number => legSwing(GAIT.duty + (1 - GAIT.duty) * frac, 'fl').lift;
    expect(alturaEm(0.25)).toBeGreaterThan(alturaEm(0.05));
    expect(alturaEm(0.5)).toBeGreaterThan(alturaEm(0.25));
    expect(alturaEm(0.75)).toBeLessThan(alturaEm(0.5));
    expect(alturaEm(0.75)).toBeCloseTo(alturaEm(0.25), 6);
  });

  it('na pisada o quadril anda de +amp (perna à frente) a -amp (perna atrás); no balanço volta, com o joelho levantando o pé', () => {
    const inicio = legSwing(0, 'fl');
    expect(inicio.hip).toBeCloseTo(GAIT.hipAmp, 9);
    const fimDaPisada = legSwing(GAIT.duty - 1e-9, 'fl');
    expect(fimDaPisada.hip).toBeCloseTo(-GAIT.hipAmp, 5);
    const meioDoBalanco = legSwing(GAIT.duty + (1 - GAIT.duty) / 2, 'fl');
    expect(meioDoBalanco.lift).toBeCloseTo(GAIT.kneeLift, 6);
    expect(meioDoBalanco.hip).toBeCloseTo(0, 6); // a meio caminho da volta
    // na pisada o pé nunca levanta
    for (const f of passos(300).filter((x) => x < GAIT.duty)) expect(legSwing(f, 'fl').lift).toBe(0);
  });

  it('parado (moving = 0) a perna fica no repouso, sem passada nem dobra', () => {
    for (const id of LEG_IDS) for (const f of passos(50)) {
      const s = legSwing(f, id, 0);
      expect(s.hip).toBeCloseTo(0, 12);
      expect(s.lift).toBeCloseTo(0, 12);
    }
  });

  it('a fase anda com a velocidade e o pé não escorrega: a distância do casco em um ciclo é o passo dividido pela pisada', () => {
    const v = 3;
    let fase = 0;
    let andou = 0;
    const dt = 1 / 60;
    let voltas = 0;
    for (let i = 0; i < 6000; i++) {
      const nova = advancePhase(fase, v, dt);
      if (nova < fase) voltas++;
      fase = nova;
      andou += v * dt;
      if (voltas === 3) break;
    }
    expect(voltas).toBe(3);
    // 3 ciclos completos: o casco andou 3 × STRIDE_M / duty
    expect(andou / 3).toBeCloseTo(STRIDE_M / GAIT.duty, 0);
    expect(speedForCycle(2)).toBeCloseTo(STRIDE_M / (GAIT.duty * 2), 9);
  });

  it('velocidade torta (parado, negativa, NaN) não faz a fase andar nem estourar', () => {
    for (const v of [0, -3, NaN]) expect(advancePhase(0.3, v, 1 / 60)).toBeCloseTo(0.3, 12);
    expect(advancePhase(0.3, 3, 0)).toBeCloseTo(0.3, 12);
    expect(advancePhase(1.7, 0, 1)).toBeCloseTo(0.7, 9); // sempre em [0, 1)
  });
});

describe('a pose inteira (P180)', () => {
  it('reaproveita o mesmo objeto (G4: nada novo por quadro) e é determinística', () => {
    const out = newWalkerPose();
    const a = walkerPose(0.3, 1, NENHUMA, 0.2, 5, out);
    expect(a).toBe(out);
    const copia = JSON.parse(JSON.stringify(out));
    const b = walkerPose(0.3, 1, NENHUMA, 0.2, 5, newWalkerPose());
    expect(JSON.parse(JSON.stringify(b))).toEqual(copia);
  });

  it('o casco desce com o balanço (quatro passos por ciclo) e fica quieto, sem descer, parado', () => {
    const parado = walkerPose(0.3, 0, NENHUMA, 0, 0);
    expect(parado.bodyDrop).toBe(0);
    expect(parado.pitch).toBeCloseTo(0, 12);
    expect(parado.roll).toBeCloseTo(0, 12);
    const quedas = passos(100).map((f) => walkerPose(f, 1, NENHUMA, 0, 0).bodyDrop);
    expect(Math.min(...quedas)).toBeGreaterThan(0);
    expect(Math.max(...quedas)).toBeLessThan(0.6); // meio metro num casco de 38 m
    expect(walkerPose(0, 1, NENHUMA, 0, 0).bodyDrop).toBeCloseTo(walkerPose(0.25, 1, NENHUMA, 0, 0).bodyDrop, 9); // a mesma altura a cada passo
  });

  it('o convés gira para onde mandam, e os guindastes e o radar andam com o tempo', () => {
    expect(walkerPose(0, 0, NENHUMA, 1.1, 0).deckYaw).toBe(1.1);
    const t0 = walkerPose(0, 0, NENHUMA, 0, 0);
    const t1 = walkerPose(0, 0, NENHUMA, 0, 2);
    expect(t1.radar).toBeGreaterThan(t0.radar);
    expect(t1.craneLeft).not.toBe(t0.craneLeft);
    expect(Math.abs(t1.craneLeft)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(t1.craneRight)).toBeLessThanOrEqual(0.3);
  });

  it('perna caída: a perna não anda, o joelho dobra, o casco afunda e inclina para o lado dela', () => {
    const inteira = walkerPose(0.1, 1, NENHUMA, 0, 0);
    const caida = walkerPose(0.1, 1, { ...NENHUMA, fl: 1 }, 0, 0);
    expect(caida.legs.fl.lift).toBe(0);
    expect(caida.legs.fl.fold).toBeCloseTo(GAIT.collapseFold, 9);
    expect(inteira.legs.fl.fold).toBe(0);
    expect(caida.bodyDrop).toBeGreaterThan(inteira.bodyDrop + 1.5);
    expect(caida.pitch, 'a frente cai: nariz para baixo').toBeGreaterThan(inteira.pitch);
    expect(caida.roll, 'a esquerda cai: o lado esquerdo desce').toBeGreaterThan(inteira.roll);
    // a perna traseira direita caída inclina o contrário
    const outra = walkerPose(0.1, 1, { ...NENHUMA, rr: 1 }, 0, 0);
    expect(outra.pitch).toBeLessThan(inteira.pitch);
    expect(outra.roll).toBeLessThan(inteira.roll);
    // as quatro caídas: o casco no chão e nivelado
    const todas = walkerPose(0.1, 1, { fl: 1, fr: 1, rl: 1, rr: 1 }, 0, 0);
    expect(todas.bodyDrop).toBeGreaterThan(8);
    expect(todas.pitch).toBeCloseTo(0, 6);
    expect(todas.roll).toBeCloseTo(0, 6);
  });

  it('queda fora de 0 a 1 é limitada (nunca dobra além da perna caída nem desce mais que as quatro), e dado torto (NaN) nunca estoura a pose', () => {
    const p = walkerPose(0, 1, { fl: 7, fr: -3, rl: NaN, rr: 1 } as unknown as Record<LegId, number>, 0, 0);
    expect(p.legs.fl.fold).toBeCloseTo(GAIT.collapseFold, 9);
    expect(p.legs.fr.fold).toBe(0);
    expect(p.legs.rl.fold, 'NaN vira perna de pé').toBe(0);
    const numeros = [p.bodyDrop, p.pitch, p.roll, ...LEG_IDS.flatMap((id) => [p.legs[id].hip, p.legs[id].lift, p.legs[id].fold])];
    for (const n of numeros) expect(Number.isFinite(n)).toBe(true);
    // velocidade torta (NaN, negativa, enorme) também não estoura
    for (const m of [NaN, -5, 1e9]) {
      const q = walkerPose(0.4, m, NENHUMA, 0, 0);
      for (const id of LEG_IDS) expect(Math.abs(q.legs[id].hip)).toBeLessThanOrEqual(GAIT.hipAmp + 1e-9);
    }
  });

  it('a perna caída se abre para o lado dela: a da frente com o quadril para a frente, a de trás para trás', () => {
    const p = walkerPose(0.1, 0, { fl: 1, fr: 0, rl: 0, rr: 1 }, 0, 0);
    expect(p.legs.fl.hip).toBeGreaterThan(0.1);
    expect(p.legs.rr.hip).toBeLessThan(-0.1);
    expect(p.legs.fr.hip).toBeCloseTo(0, 9);
  });
});
