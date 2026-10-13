import { describe, expect, it } from 'vitest';
import { bootProgresso, DICAS_DO_BOOT, dicaDoBoot, progressoDoBoot, type FaseDoBoot } from './bootProgress';

const FASES: readonly FaseDoBoot[] = ['fisica', 'robos', 'jogo', 'graficos', 'hangar', 'pronto'];

describe('o progresso do carregamento', () => {
  it('começa em 0 e termina em 1, sempre subindo de fase em fase', () => {
    expect(progressoDoBoot('fisica')).toBe(0);
    expect(progressoDoBoot('pronto')).toBe(1);
    let anterior = -1;
    for (const f of FASES) {
      const p = progressoDoBoot(f);
      expect(p, f).toBeGreaterThanOrEqual(anterior);
      anterior = p;
    }
  });

  it('dentro da fase, feito/total anda de uma ponta da faixa à outra e nunca passa dela', () => {
    expect(progressoDoBoot('graficos', 0, 27)).toBeCloseTo(0.55);
    expect(progressoDoBoot('graficos', 27, 27)).toBeCloseTo(0.85);
    expect(progressoDoBoot('graficos', 13, 27)).toBeGreaterThan(0.55);
    expect(progressoDoBoot('graficos', 13, 27)).toBeLessThan(0.85);
    expect(progressoDoBoot('graficos', 99, 27)).toBeCloseTo(0.85);
    expect(progressoDoBoot('graficos', -5, 27)).toBeCloseTo(0.55);
    expect(progressoDoBoot('graficos', 5, 0)).toBeCloseTo(0.55); // sem total: início da faixa
  });

  it('o fim de uma fase coincide com o começo da seguinte (a barra nunca anda para trás)', () => {
    expect(progressoDoBoot('fisica', 1, 1)).toBeCloseTo(progressoDoBoot('robos'));
    expect(progressoDoBoot('robos', 1, 1)).toBeCloseTo(progressoDoBoot('jogo'));
    expect(progressoDoBoot('jogo', 1, 1)).toBeCloseTo(progressoDoBoot('graficos'));
    expect(progressoDoBoot('graficos', 1, 1)).toBeCloseTo(progressoDoBoot('hangar'));
    expect(progressoDoBoot('hangar', 1, 1)).toBeCloseTo(progressoDoBoot('pronto'));
  });
});

describe('as dicas da espera', () => {
  it('toda semente dá uma dica da lista; lixo vira a primeira', () => {
    for (const s of [0, 1, 7, 8, 1234.9, -3, NaN, Infinity]) expect(DICAS_DO_BOOT).toContain(dicaDoBoot(s));
    expect(dicaDoBoot(NaN)).toBe(DICAS_DO_BOOT[0]);
  });

  it('nenhuma dica fala de ferramenta de desenvolvedor, e todas são frases curtas', () => {
    for (const d of DICAS_DO_BOOT) {
      expect(d, d).not.toMatch(/\bF9\b|dev\b|desenvolvedor|debug|\?comandante/i);
      expect(d.length, d).toBeLessThanOrEqual(70);
      expect(d.endsWith('.'), d).toBe(true);
    }
  });

  it('sem a tela de carregamento (testes, outra página) pintar não faz nada nem falha', () => {
    expect(() => bootProgresso('graficos', 3, 27)).not.toThrow();
  });
});
