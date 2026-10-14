import { describe, expect, it } from 'vitest';
import { FAIXA_CURTA_ATE, FAIXA_LONGA_A_PARTIR, escolherRearguarda, faixaDaArma, papelTatico, REARGUARD_MIN_SQUAD } from './tatica';

describe('tática de esquadrão (P119): a faixa da arma e o papel do robô', () => {
  describe('faixaDaArma', () => {
    it('classifica pelas armas que existem: de perto, média e de linha', () => {
      expect(faixaDaArma(8)).toBe('curta'); // escopeta
      expect(faixaDaArma(1.2)).toBe('curta'); // motosserra
      expect(faixaDaArma(17)).toBe('curta'); // lança-chamas
      expect(faixaDaArma(35)).toBe('media'); // rotatória
      expect(faixaDaArma(45)).toBe('media'); // EMP
      expect(faixaDaArma(50)).toBe('media'); // automático
      expect(faixaDaArma(60)).toBe('media'); // plasma: o padrão do jogo é média, não de linha
      expect(faixaDaArma(90)).toBe('longa'); // canhão pesado
      expect(faixaDaArma(140)).toBe('longa'); // trilho e cerco
    });

    it('os cortes são inclusivos e o número inválido cai no mais conservador (de perto)', () => {
      expect(faixaDaArma(FAIXA_CURTA_ATE)).toBe('curta');
      expect(faixaDaArma(FAIXA_CURTA_ATE + 0.1)).toBe('media');
      expect(faixaDaArma(FAIXA_LONGA_A_PARTIR)).toBe('longa');
      expect(faixaDaArma(FAIXA_LONGA_A_PARTIR - 0.1)).toBe('media');
      expect(faixaDaArma(Number.NaN)).toBe('curta');
    });
  });

  describe('papelTatico', () => {
    it('corpo a corpo é sempre assalto (o andróide com a motosserra entra e fecha)', () => {
      expect(papelTatico(1.2, true)).toBe('assalto');
      expect(papelTatico(140, true)).toBe('assalto');
    });

    it('só a arma de linha vira apoio; a média e a de perto continuam assalto (o plasma do jogo de sempre inclusive)', () => {
      expect(papelTatico(140, false)).toBe('apoio'); // trilho
      expect(papelTatico(90, false)).toBe('apoio'); // canhão pesado
      expect(papelTatico(60, false)).toBe('assalto'); // plasma: o padrão do jogo NÃO vira apoio
      expect(papelTatico(50, false)).toBe('assalto'); // automático: média
      expect(papelTatico(8, false)).toBe('assalto'); // escopeta
    });

    it('a partir do corte (90) é apoio; o plasma (60), logo abaixo, fica assalto', () => {
      expect(papelTatico(FAIXA_LONGA_A_PARTIR, false)).toBe('apoio');
      expect(papelTatico(FAIXA_LONGA_A_PARTIR - 0.1, false)).toBe('assalto');
    });
  });

  describe('escolherRearguarda', () => {
    it('esquadrão pequeno não tem retaguarda (todos precisam atacar)', () => {
      expect(escolherRearguarda([])).toBe(-1);
      expect(escolherRearguarda(['assalto', 'apoio'])).toBe(-1);
      expect(escolherRearguarda(['assalto', 'assalto'])).toBe(-1);
    });

    it('com 3 ou mais, o primeiro apoio fica de guarda', () => {
      expect(escolherRearguarda(['assalto', 'apoio', 'assalto'])).toBe(1);
      expect(escolherRearguarda(['apoio', 'assalto', 'assalto'])).toBe(0);
      expect(escolherRearguarda(['assalto', 'assalto', 'assalto'])).toBe(-1); // ninguém tem arma de linha
    });

    it('esquadrão só de arma longa NÃO para: sem assalto, ninguém fica de guarda', () => {
      expect(escolherRearguarda(['apoio', 'apoio', 'apoio'])).toBe(-1);
      expect(escolherRearguarda(['apoio', 'apoio', 'apoio', 'apoio'])).toBe(-1);
    });

    it('o corte do tamanho do esquadrão é o declarado', () => {
      const papeis = Array<'assalto' | 'apoio'>(REARGUARD_MIN_SQUAD).fill('assalto');
      papeis[1] = 'apoio';
      expect(escolherRearguarda(papeis)).toBe(1);
      expect(escolherRearguarda(papeis.slice(0, REARGUARD_MIN_SQUAD - 1))).toBe(-1);
    });
  });
});
