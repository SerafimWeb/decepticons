import { describe, expect, it } from 'vitest';
import { AIM_TIME_LINHA, AIM_TIME_MEDIA, AIM_TIME_PERTO, aimSpreadOf, aimTimeOf, settleSpread, settleStep } from './aim';
import { weapon } from './weapons';

describe('perfil de mira por arma (P121)', () => {
  describe('aimTimeOf (o tempo de assentar de cada arma)', () => {
    it('a faixa pelo alcance: a de linha assenta devagar, a de perto quase na hora', () => {
      expect(aimTimeOf(weapon('railgun'))).toBe(AIM_TIME_LINHA); // 140 m
      expect(aimTimeOf(weapon('cannon'))).toBe(AIM_TIME_LINHA); // 90 m
      expect(aimTimeOf(weapon('plasma'))).toBe(AIM_TIME_MEDIA); // 60 m
      expect(aimTimeOf(weapon('emp'))).toBe(AIM_TIME_MEDIA); // 45 m
      expect(aimTimeOf(weapon('shotgun'))).toBe(AIM_TIME_PERTO); // 8 m
      expect(aimTimeOf(weapon('blaster'))).toBe(AIM_TIME_PERTO); // 25 m
    });

    it('quem não assenta fica em 0: o corte, a chama e o giro de cano', () => {
      expect(aimTimeOf(weapon('chainsaw'))).toBe(0); // corpo a corpo
      expect(aimTimeOf(weapon('flamer'))).toBe(0); // fluxo contínuo
      expect(aimTimeOf(weapon('rotary'))).toBe(0); // já tem o tempo no giro do cano
    });

    it('a arma pode declarar o seu tempo, que manda sobre a faixa', () => {
      const w = { ...weapon('plasma'), aimTime: 0.9 };
      expect(aimTimeOf(w)).toBe(0.9);
      expect(aimTimeOf({ ...weapon('plasma'), aimTime: -1 })).toBe(0);
    });
  });

  describe('aimSpreadOf (a amplitude) — hoje em ZERO: o acerto validado não muda', () => {
    it('nenhuma arma declara amplitude; todas fecham a zero', () => {
      for (const id of ['plasma', 'railgun', 'siege', 'shotgun', 'cannon'] as const) {
        expect(aimSpreadOf(weapon(id)), id).toBe(0);
      }
      expect(aimSpreadOf({ ...weapon('plasma'), aimSpread: 0.02 })).toBe(0.02);
      expect(aimSpreadOf({ ...weapon('plasma'), aimSpread: -1 })).toBe(0);
    });
  });

  describe('settleStep (o assentar)', () => {
    it('arma sem tempo de mira está sempre firme', () => {
      expect(settleStep(0, 1 / 60, false, 0)).toBe(1);
      expect(settleStep(0.3, 1 / 60, true, 0)).toBe(1);
    });

    it('sobe segurando o gatilho e chega a 1 no tempo da arma', () => {
      let n = 0;
      for (let i = 0; i < Math.ceil(AIM_TIME_MEDIA * 60); i++) n = settleStep(n, 1 / 60, true, AIM_TIME_MEDIA);
      expect(n).toBe(1);
      // Antes do tempo, ainda não fechou.
      expect(settleStep(0.9, 1 / 60, true, AIM_TIME_MEDIA)).toBeLessThan(1);
    });

    it('soltar desassenta mais rápido do que assenta (na metade do tempo) e não passa dos limites', () => {
      expect(settleStep(1, AIM_TIME_MEDIA / 2, false, AIM_TIME_MEDIA)).toBe(0);
      expect(settleStep(0, 10, false, AIM_TIME_MEDIA)).toBe(0); // não vai a negativo
      expect(settleStep(1, 10, true, AIM_TIME_MEDIA)).toBe(1); // nem passa de 1
    });
  });

  describe('settleSpread', () => {
    it('a amplitude cheia com a mira aberta, zero com a mira firme', () => {
      expect(settleSpread(0.02, 0)).toBe(0.02);
      expect(settleSpread(0.02, 1)).toBe(0);
      expect(settleSpread(0.02, 0.5)).toBeCloseTo(0.01);
      expect(settleSpread(0.02, 2)).toBe(0); // corta acima de 1
      expect(settleSpread(0.02, -1)).toBe(0.02); // e abaixo de 0
    });
  });
});
