import { describe, expect, it } from 'vitest';
import { MOBILIDADE_RASTEJANDO } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { PONTOS_DOS_CABOS } from './CabosDeDados';
import { alvoDoChefe, avisoDoChefe, CODIGO_DA_FASE, faseDoChefe, regraDaFase, TEXTOS_DA_FASE, VELOCIDADE_DO_RASTEJO } from './FasesDoChefe';

describe('as FASES DO CHEFE (P165, parte D): anda, manca, rasteja', () => {
  it('a fase vem das pernas: as duas de pé anda; uma caída manca; as duas caídas rasteja; o tronco zerado é o fim', () => {
    expect(faseDoChefe({ torso: 1200, leftLeg: 450, rightLeg: 450 })).toBe('anda');
    expect(faseDoChefe({ torso: 1200, leftLeg: 0, rightLeg: 450 })).toBe('manca');
    expect(faseDoChefe({ torso: 1200, leftLeg: 450, rightLeg: 0 })).toBe('manca');
    expect(faseDoChefe({ torso: 1200, leftLeg: 0, rightLeg: 0 })).toBe('rasteja');
    expect(faseDoChefe({ torso: 0, leftLeg: 450, rightLeg: 450 })).toBe('caido');
    expect(faseDoChefe({ torso: 0, leftLeg: 0, rightLeg: 0 })).toBe('caido'); // o tronco manda sobre as pernas
  });

  it('a vida das pernas conta de verdade: uma perna ferida mas de pé não muda a fase', () => {
    expect(faseDoChefe({ torso: 900, leftLeg: 1, rightLeg: 450 })).toBe('anda');
  });

  it('os códigos do HUD e os textos: cada fase tem o rótulo e a regra dita numa linha, o jogador entende o problema', () => {
    expect(CODIGO_DA_FASE).toEqual({ caido: 0, anda: 1, manca: 2, rasteja: 3 });
    for (const fase of ['anda', 'manca', 'rasteja'] as const) {
      const t = TEXTOS_DA_FASE[fase];
      expect(t.rotulo).toBe(t.rotulo.toUpperCase());
      expect(t.regra.length).toBeGreaterThan(10);
      expect(t.regra.length).toBeLessThan(70); // uma linha
    }
    expect(TEXTOS_DA_FASE.anda.regra).toContain('cabos');
    expect(TEXTOS_DA_FASE.anda.regra).toContain('pernas');
  });

  it('a regra dita muda com o alvo do mapa: nos cabos da praia fala de cabos; no transformador da Cidade Neon fala do transformador (e nunca de cabo)', () => {
    for (const fase of ['anda', 'manca', 'rasteja'] as const) {
      expect(regraDaFase(fase), `${fase} sem alvo = os cabos`).toBe(TEXTOS_DA_FASE[fase].regra);
      expect(regraDaFase(fase, 'cabos')).toBe(TEXTOS_DA_FASE[fase].regra);
      const t = regraDaFase(fase, 'transformador');
      expect(t.length, `${fase} no transformador`).toBeGreaterThan(10);
      expect(t.length).toBeLessThan(70); // uma linha
      expect(t.toLowerCase()).not.toContain('cabo');
    }
    expect(regraDaFase('anda', 'transformador')).toContain('transformador');
    expect(regraDaFase('anda', 'transformador')).toContain('pernas');
    expect(regraDaFase('rasteja', 'transformador')).toContain('transformador');
    expect(regraDaFase('manca', 'transformador'), 'a fase que manca diz o mesmo nos dois mapas').toBe(regraDaFase('manca', 'cabos'));
    expect(regraDaFase('caido', 'transformador')).toBe('');
  });

  it('a velocidade de rastejo é a do corpo (30%), e o titã a usa com as duas pernas caídas, onde um Mech comum fica imóvel', () => {
    expect(VELOCIDADE_DO_RASTEJO).toBe(MOBILIDADE_RASTEJANDO);
    expect(MOBILIDADE_RASTEJANDO).toBeCloseTo(0.3, 6);
    expect(MOBILIDADE_RASTEJANDO).toBeLessThan(0.5); // mais lento que mancar
    const comum = new Vector09();
    const titã = new Vector09();
    titã.crawls = true;
    for (const m of [comum, titã]) {
      expect(m.mobility).toBe(1);
      m.damagePart('leftLeg', 1e6);
      expect(m.mobility, 'uma perna: metade').toBe(0.5);
      m.damagePart('rightLeg', 1e6);
    }
    expect(comum.mobility, 'o Mech comum com as duas pernas caídas é uma torre imóvel').toBe(0);
    expect(titã.mobility, 'o chefe rasteja').toBe(MOBILIDADE_RASTEJANDO);
  });
});

describe('para onde o titã vai: o cabo mais perto que ainda não caiu', () => {
  const livres = [0, 0, 0];

  it('escolhe o cabo mais perto de onde ele está; num empate, o de menor índice', () => {
    expect(alvoDoChefe(PONTOS_DOS_CABOS[0]!.x - 100, 27, livres)).toBe(0);
    expect(alvoDoChefe(PONTOS_DOS_CABOS[2]!.x + 100, 27, livres)).toBe(2);
    expect(alvoDoChefe(PONTOS_DOS_CABOS[1]!.x, PONTOS_DOS_CABOS[1]!.z, livres)).toBe(1);
    const meio = (PONTOS_DOS_CABOS[0]!.x + PONTOS_DOS_CABOS[1]!.x) / 2;
    expect(alvoDoChefe(meio, PONTOS_DOS_CABOS[0]!.z, livres)).toBe(0);
  });

  it('pula o cabo já cortado (código 3) e segue para o próximo; injetado ou tomado ainda é alvo', () => {
    expect(alvoDoChefe(PONTOS_DOS_CABOS[0]!.x, PONTOS_DOS_CABOS[0]!.z, [3, 0, 0])).toBe(1);
    expect(alvoDoChefe(PONTOS_DOS_CABOS[0]!.x, PONTOS_DOS_CABOS[0]!.z, [3, 3, 0])).toBe(2);
    expect(alvoDoChefe(PONTOS_DOS_CABOS[0]!.x, PONTOS_DOS_CABOS[0]!.z, [1, 0, 0])).toBe(0); // injetando: ainda é o mais perto
    expect(alvoDoChefe(PONTOS_DOS_CABOS[0]!.x, PONTOS_DOS_CABOS[0]!.z, [2, 0, 0])).toBe(0);
  });

  it('com os três cortados não há cabo: devolve -1 (aí ele vai à porta principal do prédio)', () => {
    expect(alvoDoChefe(0, 0, [3, 3, 3])).toBe(-1);
  });
});

describe('os avisos do topo da tela quando a fase do chefe muda', () => {
  it('perna que cai, rastejo e queda têm a sua linha; nada mudou, ou a entrada do chefe, não avisa', () => {
    expect(avisoDoChefe(1, 1)).toBeNull();
    expect(avisoDoChefe(0, 1)).toBeNull(); // o chefe entrou em campo
    expect(avisoDoChefe(1, 2)).toBe('COLOSSUS-01 · UMA PERNA CAIU · ELE MANCA');
    expect(avisoDoChefe(2, 3)).toBe('COLOSSUS-01 RASTEJA · ACABE COM ELE');
    expect(avisoDoChefe(1, 3)).toBe('COLOSSUS-01 RASTEJA · ACABE COM ELE'); // as duas de uma vez
    expect(avisoDoChefe(3, 0)).toBe('COLOSSUS-01 CAIU');
    expect(avisoDoChefe(1, 0)).toBe('COLOSSUS-01 CAIU');
  });
});
