import { describe, expect, it } from 'vitest';
import { PRACA_PREDIOS } from '../environment/PracaLayout';
import {
  DESGASTE_DA_FACHADA_S,
  DESGASTE_DA_MESA_S,
  DURACAO_DA_MISSAO_TICKS,
  FAXINEIROS_POR_PREDIO,
  GRACA_TICKS,
  INTEGRIDADE_MAX,
  MissaoJaneiro,
  PERCENTUAL_DE_SUJEIRA,
  sorteioDoFigurante,
  TEMPO_DE_LIMPEZA_S,
  type ResultadoDaMissaoJaneiro,
  type SituacaoDaPraca,
} from './MissaoJaneiro';

const MESAS = PRACA_PREDIOS.map((p) => p.saguao.mesas.length);
const DT = 1 / 60;

const nova = () => {
  const fins: { sobreviveu: boolean; r: ResultadoDaMissaoJaneiro }[] = [];
  const m = new MissaoJaneiro(MESAS, (sobreviveu, r) => fins.push({ sobreviveu, r }));
  return { m, fins };
};
const praca = (o: Partial<SituacaoDaPraca> = {}): SituacaoDaPraca => ({ naFachada: [0, 0, 0], faltamChegar: 100, presentes: 10, eliminados: 0, rebeldesEliminados: 0, ...o });
/** Um figurante `i` que sempre sujaria uma mesa (e outro que nunca). */
const quemSuja = (): number => { let i = 0; while (sorteioDoFigurante(i) >= PERCENTUAL_DE_SUJEIRA) i++; return i; };
const quemNaoSuja = (): number => { let i = 0; while (sorteioDoFigurante(i) < PERCENTUAL_DE_SUJEIRA) i++; return i; };

describe('a missão do 8 de janeiro (P217, passo 5): como a fase acaba', () => {
  it('começa em curso, com os três prédios inteiros, as mesas limpas e o relógio zerado; sem ninguém na fachada nada muda', () => {
    const { m, fins } = nova();
    expect(m.fase).toBe('em-curso');
    expect(m.predios).toBe(3);
    expect([...m.integridade]).toEqual([INTEGRIDADE_MAX, INTEGRIDADE_MAX, INTEGRIDADE_MAX]);
    m.fixedUpdate(1, 60, praca());
    expect(m.fase).toBe('em-curso');
    expect(m.tempoS).toBe(1);
    expect([...m.integridade]).toEqual([INTEGRIDADE_MAX, INTEGRIDADE_MAX, INTEGRIDADE_MAX]);
    expect(fins).toEqual([]);
  });

  it('a fachada desgasta só o prédio onde há gente, na conta: figurantes × desgaste × segundo', () => {
    const { m } = nova();
    m.fixedUpdate(2, 120, praca({ naFachada: [10, 0, 3] }));
    expect(m.integridade[0]).toBeCloseTo(INTEGRIDADE_MAX - 10 * DESGASTE_DA_FACHADA_S * 2, 6);
    expect(m.integridade[1]).toBe(INTEGRIDADE_MAX);
    expect(m.integridade[2]).toBeCloseTo(INTEGRIDADE_MAX - 3 * DESGASTE_DA_FACHADA_S * 2, 6);
  });

  it('DERROTA: um prédio chegar a zero perde a missão, uma vez só, com a causa e o placar do momento', () => {
    const { m, fins } = nova();
    m.registrarExpulso();
    m.fixedUpdate(1, 60, praca({ eliminados: 4 }));
    m.fixedUpdate(INTEGRIDADE_MAX / DESGASTE_DA_FACHADA_S + 1, 120, praca({ naFachada: [0, 1, 0], eliminados: 9 }));
    expect(m.fase).toBe('derrota');
    expect(m.causa).toBe('predio');
    expect(m.integridade[1]).toBe(0);
    m.fixedUpdate(1, 180, praca({ naFachada: [0, 1, 0], eliminados: 99 }));
    expect(fins).toHaveLength(1);
    expect(fins[0]!.sobreviveu).toBe(false);
    expect(fins[0]!.r.eliminados).toBe(9);
    expect(fins[0]!.r.expulsos).toBe(1);
  });

  it('VITÓRIA: a cota acabar e a Praça esvaziar com os três prédios de pé; faltar chegar ou haver gente na Praça não vence', () => {
    const { m, fins } = nova();
    m.fixedUpdate(DT, 1, praca({ faltamChegar: 0, presentes: 3 }));
    m.fixedUpdate(DT, 2, praca({ faltamChegar: 5, presentes: 0 }));
    expect(m.fase).toBe('em-curso');
    m.fixedUpdate(DT, 3, praca({ faltamChegar: 0, presentes: 0, eliminados: 7 }));
    expect(m.fase).toBe('vitoria');
    expect(fins).toHaveLength(1);
    expect(fins[0]!.sobreviveu).toBe(true);
    expect(fins[0]!.r.eliminados).toBe(7);
    expect(fins[0]!.r.causa).toBeNull();
  });

  it('os androides rebeldes entram na conta da Praça: por chegar ou vivos, seguram a vitória; os derrubados vão para o placar, e não para a nota não letal', () => {
    const { m, fins } = nova();
    for (let k = 0; k < 5; k++) m.registrarExpulso();
    m.fixedUpdate(DT, 1, praca({ faltamChegar: 2, presentes: 0 })); // dois rebeldes ainda por chegar
    m.fixedUpdate(DT, 2, praca({ faltamChegar: 0, presentes: 1 })); // um em campo
    expect(m.fase).toBe('em-curso');
    m.fixedUpdate(DT, 3, praca({ faltamChegar: 0, presentes: 0, rebeldesEliminados: 2, eliminados: 5 }));
    expect(m.fase).toBe('vitoria');
    expect(fins[0]!.r.rebeldes).toBe(2);
    expect(fins[0]!.r.naoLetal).toBeCloseTo(0.5, 6); // 5 expulsos entre 5 + 5 tirados da Praça: os 2 rebeldes derrubados ficam de fora da conta
  });

  it('se um prédio cai no mesmo tick em que a Praça esvazia, vale a derrota (a missão é mantê-los de pé)', () => {
    const { m } = nova();
    m.fixedUpdate(INTEGRIDADE_MAX / DESGASTE_DA_FACHADA_S + 1, 10, praca({ naFachada: [1, 0, 0], faltamChegar: 0, presentes: 0 }));
    expect(m.fase).toBe('derrota');
    expect(m.causa).toBe('predio');
  });

  it('DERROTA POR TEMPO: passada a última chegada mais a graça, gente na Praça perde; sem gente, vence', () => {
    const limite = DURACAO_DA_MISSAO_TICKS + GRACA_TICKS;
    const a = nova().m;
    a.fixedUpdate(DT, limite, praca({ faltamChegar: 0, presentes: 2 }));
    expect(a.fase).toBe('em-curso');
    a.fixedUpdate(DT, limite + 1, praca({ faltamChegar: 0, presentes: 2 }));
    expect(a.fase).toBe('derrota');
    expect(a.causa).toBe('tempo');
    const b = nova().m;
    b.fixedUpdate(DT, limite + 1, praca({ faltamChegar: 0, presentes: 0 }));
    expect(b.fase).toBe('vitoria');
  });

  it('a nota não letal: expulsos entre os que a missão tirou da Praça (1 quando ninguém foi eliminado)', () => {
    const { m } = nova();
    expect(m.resultado().naoLetal).toBe(1);
    for (let k = 0; k < 3; k++) m.registrarExpulso();
    m.fixedUpdate(DT, 1, praca({ eliminados: 1 }));
    expect(m.resultado().naoLetal).toBeCloseTo(0.75, 6);
  });
});

describe('a sujeira nas mesas e a faxina (P217): o que desgasta e o que limpa', () => {
  it('quem chega à fachada suja uma mesa limpa só no percentual combinado, sempre a mesma para o mesmo figurante (G2: sem sorteio ao vivo)', () => {
    const a = nova().m;
    const b = nova().m;
    expect(a.aoChegar(quemNaoSuja(), 0)).toBe(-1);
    const mesa = a.aoChegar(quemSuja(), 0);
    expect(mesa).toBeGreaterThanOrEqual(0);
    expect(b.aoChegar(quemSuja(), 0)).toBe(mesa);
    expect(a.mesaSuja(0, mesa)).toBe(true);
    expect(a.mesasSujas(0)).toBe(1);
    expect(a.mesasSujas(1)).toBe(0);
  });

  it('o percentual de sujeira aparece na conta: de 1.000 chegadas, perto de PERCENTUAL_DE_SUJEIRA % sujariam', () => {
    let sujariam = 0;
    for (let i = 0; i < 1000; i++) if (sorteioDoFigurante(i) < PERCENTUAL_DE_SUJEIRA) sujariam++;
    expect(sujariam).toBeGreaterThan(PERCENTUAL_DE_SUJEIRA * 10 * 0.7);
    expect(sujariam).toBeLessThan(PERCENTUAL_DE_SUJEIRA * 10 * 1.3);
  });

  it('nunca suja uma mesa já suja nem passa do total do saguão', () => {
    const { m } = nova();
    const donas = new Set<number>();
    let i = 0;
    for (let tentativas = 0; tentativas < 5000; tentativas++, i++) {
      const mesa = m.aoChegar(i, 2);
      if (mesa >= 0) {
        expect(donas.has(mesa)).toBe(false);
        donas.add(mesa);
      }
    }
    expect(donas.size).toBe(MESAS[2]);
    expect(m.mesasSujas(2)).toBe(MESAS[2]);
  });

  it('cada mesa suja desgasta o prédio, e os faxineiros a limpam no ritmo combinado (dois juntos: metade do tempo)', () => {
    const { m } = nova();
    const mesa = m.aoChegar(quemSuja(), 1);
    expect(mesa).toBeGreaterThanOrEqual(0);
    // uma mesa só: um faxineiro trabalha (o outro não tem mesa), então leva TEMPO_DE_LIMPEZA_S
    m.fixedUpdate(TEMPO_DE_LIMPEZA_S - 0.5, 1, praca());
    expect(m.mesaSuja(1, mesa)).toBe(true);
    expect(m.integridade[1]).toBeCloseTo(INTEGRIDADE_MAX - (TEMPO_DE_LIMPEZA_S - 0.5) * DESGASTE_DA_MESA_S, 6);
    m.fixedUpdate(0.5, 2, praca());
    expect(m.mesaSuja(1, mesa)).toBe(false);
    expect(m.mesasLimpas).toBe(1);
    expect(m.mesasSujas(1)).toBe(0);
    // com duas sujas os FAXINEIROS_POR_PREDIO trabalham juntos e limpam uma a cada TEMPO/FAXINEIROS
    let i = 0;
    let sujas = 0;
    while (sujas < FAXINEIROS_POR_PREDIO) if (m.aoChegar(i++, 1) >= 0) sujas++;
    m.fixedUpdate(TEMPO_DE_LIMPEZA_S / FAXINEIROS_POR_PREDIO, 3, praca());
    expect(m.mesasSujas(1)).toBe(FAXINEIROS_POR_PREDIO - 1);
    expect(m.mesasLimpas).toBe(2);
  });

  it('mesa suja desgasta o prédio mesmo sem ninguém na fachada, e só o prédio dela', () => {
    const { m } = nova();
    const sujas = new Set<number>();
    for (let i = 0; sujas.size < MESAS[0]!; i++) {
      const mesa = m.aoChegar(i, 0);
      if (mesa >= 0) sujas.add(mesa);
    }
    // as oito mesas sujas de uma vez: os faxineiros limpam uma a cada TEMPO/FAXINEIROS, e nesse meio-tempo o prédio apanha
    for (let t = 0; t < 60 * 20; t++) m.fixedUpdate(DT, t, praca());
    expect(m.integridade[0]).toBeLessThan(INTEGRIDADE_MAX);
    expect(m.integridade[1]).toBe(INTEGRIDADE_MAX);
  });

  it('depois do fim, nada mais muda (a sujeira, a faxina e o relógio param) e o reset recomeça tudo', () => {
    const { m, fins } = nova();
    m.aoChegar(quemSuja(), 0);
    m.fixedUpdate(DT, 1, praca({ faltamChegar: 0, presentes: 0 }));
    expect(m.terminou).toBe(true);
    const t = m.tempoS;
    const antes = [...m.integridade];
    expect(m.aoChegar(quemSuja() + 1000, 1)).toBe(-1);
    m.fixedUpdate(5, 2, praca({ naFachada: [50, 50, 50] }));
    expect(m.tempoS).toBe(t);
    expect([...m.integridade]).toEqual(antes);
    m.reset();
    expect(m.fase).toBe('em-curso');
    expect(m.tempoS).toBe(0);
    expect(m.mesasSujas(0)).toBe(0);
    expect(m.mesasLimpas).toBe(0);
    m.fixedUpdate(DT, 1, praca({ faltamChegar: 0, presentes: 0 }));
    expect(fins).toHaveLength(2);
  });
});
