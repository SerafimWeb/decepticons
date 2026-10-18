import { describe, expect, it } from 'vitest';
import { AMAZONIA_DRAGA_INICIO_X } from '../environment/AmazoniaLayout';
import { LINHA_DA_ALDEIA_X } from './DragaMarcha';
import { MissaoDoRio, type ResultadoDaMissaoDoRio } from './MissaoDoRio';

const nova = () => {
  const fins: { sobreviveu: boolean; r: ResultadoDaMissaoDoRio }[] = [];
  const m = new MissaoDoRio((sobreviveu, r) => fins.push({ sobreviveu, r }));
  return { m, fins };
};

describe('a missão do rio (P180, parte C): como a fase acaba', () => {
  it('começa em marcha, com o relógio e o placar zerados, e o Draga longe da aldeia não muda nada', () => {
    const { m, fins } = nova();
    expect(m.fase).toBe('marcha');
    expect(m.terminou).toBe(false);
    m.fixedUpdate(1, AMAZONIA_DRAGA_INICIO_X);
    m.fixedUpdate(1, 0);
    expect(m.fase).toBe('marcha');
    expect(m.tempoS).toBe(2);
    expect(fins).toEqual([]);
  });

  it('VITÓRIA: o Draga cair (chefe nulo) vence a missão, uma vez só, com o placar do momento', () => {
    const { m, fins } = nova();
    m.fixedUpdate(0.5, 300);
    m.registrarAbate();
    m.registrarDano(120);
    m.fixedUpdate(0.5, null);
    expect(m.fase).toBe('vitoria');
    expect(m.terminou).toBe(true);
    expect(fins).toHaveLength(1);
    expect(fins[0]).toEqual({ sobreviveu: true, r: { abates: 1, danoCausado: 120, segundos: 1 } });
    m.fixedUpdate(5, null);
    m.fixedUpdate(5, LINHA_DA_ALDEIA_X - 10);
    expect(fins).toHaveLength(1);
    expect(m.tempoS).toBe(1); // o relógio para no fim
  });

  it('DERROTA: o Draga cruzar a linha da aldeia perde a missão, uma vez só', () => {
    const { m, fins } = nova();
    m.fixedUpdate(1, LINHA_DA_ALDEIA_X + 1);
    expect(m.fase).toBe('marcha');
    m.fixedUpdate(1, LINHA_DA_ALDEIA_X);
    expect(m.fase).toBe('derrota');
    expect(fins).toEqual([{ sobreviveu: false, r: { abates: 0, danoCausado: 0, segundos: 2 } }]);
    m.fixedUpdate(1, null);
    expect(m.fase).toBe('derrota');
    expect(fins).toHaveLength(1);
  });

  it('o jogador morrer não é problema da missão (ela só olha o Draga): quem perde é o rio', () => {
    const { m } = nova();
    for (let i = 0; i < 100; i++) m.fixedUpdate(1, AMAZONIA_DRAGA_INICIO_X - i);
    expect(m.fase).toBe('marcha');
  });

  it('se o Draga cai no mesmo tick em que cruza a linha, vale a vitória (o tiro chegou antes do pé)', () => {
    const { m } = nova();
    m.fixedUpdate(1, null);
    expect(m.fase).toBe('vitoria');
  });

  it('abate e dano só contam durante a marcha; dano zero, negativo ou torto não entra', () => {
    const { m } = nova();
    m.registrarDano(0);
    m.registrarDano(-5);
    m.registrarDano(NaN);
    m.registrarDano(40);
    m.registrarAbate();
    m.registrarAbate();
    expect(m.resultado).toEqual({ abates: 2, danoCausado: 40, segundos: 0 });
    m.fixedUpdate(1, null);
    m.registrarAbate();
    m.registrarDano(999);
    expect(m.resultado).toEqual({ abates: 2, danoCausado: 40, segundos: 1 });
  });

  it('reset recomeça a missão do zero, e ela pode terminar de novo', () => {
    const { m, fins } = nova();
    m.registrarAbate();
    m.fixedUpdate(2, null);
    m.reset();
    expect(m.fase).toBe('marcha');
    expect(m.resultado).toEqual({ abates: 0, danoCausado: 0, segundos: 0 });
    m.fixedUpdate(1, LINHA_DA_ALDEIA_X);
    expect(fins).toHaveLength(2);
    expect(fins[1]!.sobreviveu).toBe(false);
  });

  it('funciona sem ninguém ouvindo o fim (o teste e o servidor não ligam o aviso)', () => {
    const m = new MissaoDoRio();
    expect(() => m.fixedUpdate(1, null)).not.toThrow();
    expect(m.fase).toBe('vitoria');
  });
});
