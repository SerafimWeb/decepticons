import { describe, expect, it } from 'vitest';
import { PRAIA_COMPLEXO, PRAIA_ESTACAO } from '../environment/PraiaLayout';
import { dentroDoComplexo, NUCLEO, NucleoDaEstacao, pesoDoInvasor } from './NucleoDaEstacao';

const DT = 1 / 60;
const roda = (n: NucleoDaEstacao, segundos: number, peso: number): void => {
  for (let i = 0; i < Math.round(segundos / DT); i++) n.fixedUpdate(DT, peso);
};

describe('o núcleo da estação (a integridade da rede que a missão defende)', () => {
  it('nasce inteiro, e sem invasor nada o machuca', () => {
    const n = new NucleoDaEstacao();
    expect(n.fracao).toBe(1);
    roda(n, 30, 0);
    expect(n.vida).toBe(NUCLEO.vidaMax);
    expect(n.caiu).toBe(false);
  });

  it('o invasor drena a vida na proporção do peso: o dobro de peso, o dobro de dano', () => {
    const a = new NucleoDaEstacao();
    const b = new NucleoDaEstacao();
    roda(a, 5, 1);
    roda(b, 5, 2);
    expect(NUCLEO.vidaMax - a.vida).toBeCloseTo(5 * NUCLEO.danoPorPesoPorS, 4);
    expect(NUCLEO.vidaMax - b.vida).toBeCloseTo(2 * (NUCLEO.vidaMax - a.vida), 4);
    expect(a.pressao).toBe(1);
  });

  it('três Mechs derrubam a estação em cerca de 48 s, e o Colossus sozinho em 36 s: o jogador precisa expulsar quem entrou', () => {
    const tres = new NucleoDaEstacao();
    roda(tres, 47, 3);
    expect(tres.caiu).toBe(false);
    roda(tres, 3, 3);
    expect(tres.caiu).toBe(true);
    const tita = new NucleoDaEstacao();
    roda(tita, 36.5, pesoDoInvasor('COLOSSUS-01'));
    expect(tita.caiu).toBe(true);
  });

  it('a rede só se recompõe depois da espera sem invasor, e devagar', () => {
    const n = new NucleoDaEstacao();
    roda(n, 10, 1); // perde 70
    const depois = n.vida;
    roda(n, NUCLEO.esperaDaRegenS - 0.5, 0); // ainda esperando
    expect(n.vida).toBe(depois);
    roda(n, 1.5, 0); // passou da espera: recompõe
    expect(n.vida).toBeGreaterThan(depois);
    roda(n, 60, 0);
    expect(n.vida).toBe(NUCLEO.vidaMax); // nunca passa do máximo
  });

  it('um invasor que volta zera a espera: a recomposição recomeça do zero', () => {
    const n = new NucleoDaEstacao();
    roda(n, 4, 1);
    roda(n, NUCLEO.esperaDaRegenS + 1, 0);
    const recomposta = n.vida;
    roda(n, 0.2, 1); // entrou outro
    roda(n, NUCLEO.esperaDaRegenS - 1, 0); // não chegou à espera inteira
    expect(n.vida).toBeLessThan(recomposta);
  });

  it('cada onda eliminada devolve vida de uma vez, sem passar do máximo', () => {
    const n = new NucleoDaEstacao();
    roda(n, 20, 2); // perde 280
    const antes = n.vida;
    n.curar(NUCLEO.curaPorOnda);
    expect(n.vida).toBe(antes + NUCLEO.curaPorOnda);
    n.curar(10_000);
    expect(n.vida).toBe(NUCLEO.vidaMax);
  });

  it('quando cai, cai de vez: não ressuscita por cura nem por recomposição', () => {
    const n = new NucleoDaEstacao();
    roda(n, 200, 3);
    expect(n.caiu).toBe(true);
    expect(n.vida).toBe(0);
    n.curar(500);
    roda(n, 60, 0);
    expect(n.vida).toBe(0);
    n.reset(); // só uma missão nova a levanta
    expect(n.caiu).toBe(false);
    expect(n.fracao).toBe(1);
  });

  it('o dreno dos cabos (P162) machuca a rede mesmo sem invasor, soma ao do invasor, impede a recomposição e acende a pressão do alerta', () => {
    const n = new NucleoDaEstacao();
    for (let i = 0; i < 60 * 10; i++) n.fixedUpdate(DT, 0, 20); // dez segundos de dois cabos tomados e nenhum invasor
    expect(n.vida).toBeCloseTo(NUCLEO.vidaMax - 200, 0);
    expect(n.pressao).toBeCloseTo(20 / NUCLEO.danoPorPesoPorS, 6); // o HUD acende o alerta com o peso equivalente
    // com invasor E cabos o dano soma
    const soma = new NucleoDaEstacao();
    for (let i = 0; i < 60 * 10; i++) soma.fixedUpdate(DT, 1, 20);
    expect(soma.vida).toBeCloseTo(NUCLEO.vidaMax - (NUCLEO.danoPorPesoPorS + 20) * 10, 0);
    // a rede não se recompõe enquanto há dreno, por mais que passe a espera
    const sem = new NucleoDaEstacao();
    sem.vida = 500;
    for (let i = 0; i < 60 * 30; i++) sem.fixedUpdate(DT, 0, 1);
    expect(sem.vida).toBeLessThan(500);
    // sem dreno e sem invasor, recompõe como sempre
    const livre = new NucleoDaEstacao();
    livre.vida = 500;
    for (let i = 0; i < 60 * 30; i++) livre.fixedUpdate(DT, 0);
    expect(livre.vida).toBeGreaterThan(500);
  });

  it('o peso do invasor: Mech 1, andróide 0,5, manifestante 0,4, Colossus 4', () => {
    expect(pesoDoInvasor('MANIFESTANTE 2')).toBe(0.4);
    expect(pesoDoInvasor('VECTOR-09')).toBe(1);
    expect(pesoDoInvasor('ANDRÓIDE A-1')).toBe(0.5);
    expect(pesoDoInvasor('COLOSSUS-01')).toBe(4);
  });

  it('invade quem está dentro dos muros da estação: o prédio, o pátio, o portão — e não a areia nem a avenida', () => {
    expect(dentroDoComplexo(PRAIA_ESTACAO.x, PRAIA_ESTACAO.z)).toBe(true);
    expect(dentroDoComplexo(262, 16)).toBe(true); // a escotilha
    expect(dentroDoComplexo(PRAIA_COMPLEXO.minX + 1, 27)).toBe(true); // logo depois do portão da avenida
    expect(dentroDoComplexo(PRAIA_COMPLEXO.minX - 5, 27)).toBe(false); // ainda na avenida
    expect(dentroDoComplexo(258, PRAIA_COMPLEXO.minZ - 5)).toBe(false); // ainda na praia
    expect(dentroDoComplexo(100, 20)).toBe(false);
  });
});
