import { describe, expect, it } from 'vitest';
import { FUNDURA_QUE_FREIA, FATOR_MINIMO, danoDeAfogamento, fatorDeVelocidade, fundoParaAfogar, funduraEm, passoDoAfogamento, type Agua } from './Agua';

const MAR: Agua = { minX: -260, maxX: -60, minZ: -70, maxZ: 70, superficie: 0, afogarS: 3, danoPorSegundo: 8 };
const DT = 1 / 60;

describe('a água da praia (P126)', () => {
  describe('funduraEm', () => {
    it('fora do retângulo é seco, por mais baixo que o Mech esteja', () => {
      expect(funduraEm(MAR, 0, 0, -5)).toBe(0); // na areia (fora da água)
      expect(funduraEm(MAR, -300, 0, -5)).toBe(0); // além dos limites
    });

    it('dentro do retângulo, a fundura é a distância da superfície aos pés', () => {
      expect(funduraEm(MAR, -160, 0, 0)).toBe(0); // na linha da água
      expect(funduraEm(MAR, -160, 0, -1.5)).toBe(1.5);
      expect(funduraEm(MAR, -160, 0, 5)).toBe(0); // acima da superfície: seco
    });
  });

  describe('fatorDeVelocidade', () => {
    it('no seco anda cheio; na água freia, e freia mais fundo (até o mínimo)', () => {
      expect(fatorDeVelocidade(0)).toBe(1);
      expect(fatorDeVelocidade(-3)).toBe(1); // fundura negativa conta como seco
      expect(fatorDeVelocidade(FUNDURA_QUE_FREIA / 2)).toBeCloseTo(1 - (1 - FATOR_MINIMO) / 2);
      expect(fatorDeVelocidade(FUNDURA_QUE_FREIA)).toBe(FATOR_MINIMO);
      expect(fatorDeVelocidade(1e3)).toBe(FATOR_MINIMO); // não passa do mínimo
    });
  });

  describe('vadear não afoga (P127)', () => {
    it('sem `afogaDesde`, qualquer água que molha já conta (o comportamento do passo 1)', () => {
      expect(fundoParaAfogar(MAR, 0.04)).toBe(false); // úmido, não é água
      expect(fundoParaAfogar(MAR, 0.06)).toBe(true);
    });

    it('com `afogaDesde`, o raso só freia e o fundo afoga', () => {
      const praia: Agua = { ...MAR, afogaDesde: 1.4 };
      expect(fundoParaAfogar(praia, 0.8)).toBe(false); // vadeando: freia (o fator vale), mas não afoga
      expect(fatorDeVelocidade(0.8)).toBeLessThan(1);
      expect(fundoParaAfogar(praia, 1.4)).toBe(true);
      expect(fundoParaAfogar(praia, 5)).toBe(true);
    });
  });

  describe('o afogamento', () => {
    it('acumula dentro da água e zera ao sair', () => {
      let t = 0;
      for (let i = 0; i < 60; i++) t = passoDoAfogamento(t, DT, true);
      expect(t).toBeCloseTo(1);
      expect(passoDoAfogamento(t, DT, false)).toBe(0);
    });

    it('não dói antes de `afogarS`; depois, dói por segundo', () => {
      expect(danoDeAfogamento(MAR, 0, DT)).toBe(0);
      expect(danoDeAfogamento(MAR, 3, DT)).toBe(0); // no limite ainda não
      expect(danoDeAfogamento(MAR, 3.001, 1)).toBe(8); // um segundo depois de afogar
      expect(danoDeAfogamento(MAR, 10, 0.5)).toBe(4);
    });
  });
});
