import { describe, expect, it } from 'vitest';
import { BANDA_DA_FRENTE, frenteDepoisDeCurar, limpezaDoRio, rioTodoLimpo } from './AmazoniaRio';

describe('a limpeza do rio (P180, parte B): o termômetro da fase', () => {
  it('a montante da frente o rio é limpo (1) e a jusante é morto (0): o veneno desce com a correnteza', () => {
    const frente = 700;
    expect(limpezaDoRio(frente - 500, frente)).toBe(1);
    expect(limpezaDoRio(frente + 500, frente)).toBe(0);
    expect(limpezaDoRio(frente - BANDA_DA_FRENTE, frente)).toBe(1);
    expect(limpezaDoRio(frente + BANDA_DA_FRENTE, frente)).toBe(0);
  });

  it('na frente o rio está a meio caminho, e a mistura é uma curva suave e monótona (nunca sobe rio abaixo)', () => {
    const frente = 100;
    expect(limpezaDoRio(frente, frente)).toBeCloseTo(0.5, 9);
    let anterior = 1;
    for (let x = frente - 200; x <= frente + 200; x += 2) {
      const l = limpezaDoRio(x, frente);
      expect(l).toBeLessThanOrEqual(anterior + 1e-12);
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
      anterior = l;
    }
  });

  it('a faixa de mistura é a banda de cada lado: 2 × BANDA_DA_FRENTE, e uma banda própria também vale', () => {
    expect(limpezaDoRio(100 - BANDA_DA_FRENTE * 0.5, 100)).toBeGreaterThan(0.5);
    expect(limpezaDoRio(100 + BANDA_DA_FRENTE * 0.5, 100)).toBeLessThan(0.5);
    expect(limpezaDoRio(130, 100, 10)).toBe(0); // banda estreita: 30 m a jusante já é morto
    expect(limpezaDoRio(70, 100, 10)).toBe(1);
  });

  it('o veneno não é uma parede: 50 m a montante da frente o rio já começa a sujar, e 50 m a jusante ainda tem um resto de vida (a banda é larga)', () => {
    expect(limpezaDoRio(-50, 0)).toBeLessThan(0.99);
    expect(limpezaDoRio(-50, 0)).toBeGreaterThan(0.9);
    expect(limpezaDoRio(50, 0)).toBeGreaterThan(0.01);
    expect(limpezaDoRio(50, 0)).toBeLessThan(0.1);
  });

  it('número torto (NaN, infinito) conta como limpo: um dado ruim nunca pinta o rio de veneno', () => {
    expect(limpezaDoRio(NaN, 100)).toBe(1);
    expect(limpezaDoRio(50, NaN)).toBe(1);
    expect(limpezaDoRio(Infinity, 100)).toBe(1);
  });

  it('curar anda a frente rio abaixo: só avança, nunca recua, e para no fim do rio', () => {
    expect(frenteDepoisDeCurar(700, 50, 1200)).toBe(750);
    expect(frenteDepoisDeCurar(700, 0, 1200)).toBe(700);
    expect(frenteDepoisDeCurar(700, -80, 1200)).toBe(700); // curar negativo não envenena de novo
    expect(frenteDepoisDeCurar(1190, 100, 1200)).toBe(1200); // para no fim
    expect(frenteDepoisDeCurar(1300, 10, 1200)).toBe(1200);
    expect(frenteDepoisDeCurar(NaN, 10, 1200)).toBe(1200);
  });

  it('o rio todo está limpo só quando a frente passou do fim com a banda: no meio da mistura ainda não', () => {
    expect(rioTodoLimpo(700, 1200)).toBe(false);
    expect(rioTodoLimpo(1200, 1200)).toBe(false);
    expect(rioTodoLimpo(1200 + BANDA_DA_FRENTE - 1, 1200)).toBe(false);
    expect(rioTodoLimpo(1200 + BANDA_DA_FRENTE, 1200)).toBe(true);
    expect(rioTodoLimpo(NaN, 1200)).toBe(false);
    // e nesse ponto o fim do rio está de fato limpo
    expect(limpezaDoRio(1200, 1200 + BANDA_DA_FRENTE)).toBe(1);
  });

  it('curar em passos até o fim cura o rio inteiro, em número finito de passos', () => {
    let frente = 700;
    let passos = 0;
    while (!rioTodoLimpo(frente, 1200) && passos < 1000) {
      frente = frenteDepoisDeCurar(frente, 60, 1200 + BANDA_DA_FRENTE);
      passos++;
    }
    expect(rioTodoLimpo(frente, 1200)).toBe(true);
    expect(passos).toBeLessThan(20);
  });
});
