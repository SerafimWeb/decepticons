import { describe, expect, it } from 'vitest';
import { precoDaPintura } from '../../../shared/pinturas';
import { DailyChallenges } from './DailyChallenges';

// O ambiente de teste é o Node (sem localStorage nem DOM): o piloto começa como um piloto novo, com 500 ₵.
describe('DailyChallenges: as cores do casco (P305)', () => {
  it('um piloto novo tem a de fábrica, nenhuma cor comprada e 500 ₵ (o começo do jogo)', () => {
    const dc = new DailyChallenges();
    expect(dc.pinturas).toBe(0);
    expect(dc.possuiPintura(0)).toBe(true);
    expect(dc.possuiPintura(1)).toBe(false);
    expect(dc.credits).toBe(500);
  });

  it('comprar debita o preço, liga a cor e grava a conta (onSave avisa)', () => {
    const dc = new DailyChallenges();
    let gravou = 0;
    dc.onSave = () => gravou++;
    expect(dc.comprarPintura(1)).toBe(true);
    expect(dc.possuiPintura(1)).toBe(true);
    expect(dc.credits).toBe(500 - precoDaPintura(1));
    expect(gravou).toBe(1);
  });

  it('sem Créditos bastantes, não compra e não mexe em nada (nem nos Créditos, nem na conta)', () => {
    const dc = new DailyChallenges();
    dc.restore({ nivel: 1, xp: 0, creditos: precoDaPintura(1) - 1 });
    let gravou = 0;
    dc.onSave = () => gravou++;
    expect(dc.comprarPintura(1)).toBe(false);
    expect(dc.possuiPintura(1)).toBe(false);
    expect(dc.credits).toBe(precoDaPintura(1) - 1);
    expect(gravou).toBe(0);
  });

  it('não compra duas vezes a mesma cor: a segunda tentativa não cobra', () => {
    const dc = new DailyChallenges();
    dc.comprarPintura(1);
    const depois = dc.credits;
    expect(dc.comprarPintura(1)).toBe(false);
    expect(dc.credits).toBe(depois);
  });

  it('a de fábrica e índices que não existem não se compram', () => {
    const dc = new DailyChallenges();
    expect(dc.comprarPintura(0)).toBe(false);
    expect(dc.comprarPintura(99)).toBe(false);
    expect(dc.credits).toBe(500);
  });

  it('a posse é a união: o que chega da conta soma ao que o navegador já comprou (não há reembolso)', () => {
    const dc = new DailyChallenges();
    dc.comprarPintura(1);
    dc.restore({ nivel: 1, xp: 0, creditos: 500, pinturas: 0b100 });
    expect(dc.possuiPintura(1)).toBe(true);
    expect(dc.possuiPintura(2)).toBe(true);
  });

  it('o snapshot leva a posse (é o que a conta guarda) e reaplicado é o mesmo', () => {
    const dc = new DailyChallenges();
    dc.comprarPintura(2);
    const foto = dc.snapshot();
    expect(foto.pinturas).toBe(0b100);
    const outro = new DailyChallenges();
    outro.restore(foto);
    expect(outro.possuiPintura(2)).toBe(true);
  });
});
