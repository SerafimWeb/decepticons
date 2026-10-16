import { describe, expect, it } from 'vitest';
import { weapon } from '../combat/weapons';
import { pipFills, ROCKET_PIPS } from '../ui/rocketPips';
import { EXPLOSION_HEARING_M, EXPLOSION_REFERENCE_M, explosionScale, explosionSoundDistance } from './explosionScale';

describe('o tamanho do estouro desenhado escala com o raio da explosão da arma (P152)', () => {
  it('o foguete (6 m) é a medida: escala 1', () => {
    expect(EXPLOSION_REFERENCE_M).toBe(weapon('rockets').blastRadius);
    expect(explosionScale(weapon('rockets').blastRadius)).toBe(1);
  });

  it('o míssil leve (2,2 m) estoura com ~37% do foguete e o cruzador (9 m) com 150%: o pequeno não enche a tela nem o limite de partículas', () => {
    expect(explosionScale(weapon('swarm').blastRadius)).toBeCloseTo(2.2 / 6, 9);
    expect(explosionScale(weapon('cruise').blastRadius)).toBeCloseTo(1.5, 9);
    // uma salva inteira de 32 mísseis leves solta bem menos partículas que 32 foguetes (70 + 24 cada)
    const por = (k: number): number => Math.round(70 * k) + Math.round(24 * k);
    expect(32 * por(explosionScale(weapon('swarm').blastRadius))).toBeLessThan(1200);
    expect(32 * por(1)).toBeGreaterThan(3000);
  });

  it('tem piso (0,25) e teto (1,8): nenhuma explosão some nem passa de quase o dobro', () => {
    expect(explosionScale(0)).toBe(0.25);
    expect(explosionScale(0.5)).toBe(0.25);
    expect(explosionScale(60)).toBe(1.8);
  });
});

describe('o som do estouro recebe a distância normalizada (0 a 1), não metros (R17, P152)', () => {
  it('colado e do tamanho do foguete: 0 (volume cheio); a 60 m ou mais: 1 (o piso); o meio do caminho, o meio', () => {
    expect(explosionSoundDistance(0, 1)).toBe(0);
    expect(explosionSoundDistance(EXPLOSION_HEARING_M, 1)).toBe(1);
    expect(explosionSoundDistance(EXPLOSION_HEARING_M * 3, 1)).toBe(1);
    expect(explosionSoundDistance(EXPLOSION_HEARING_M / 2, 1)).toBeCloseTo(0.5, 9);
  });

  it('antes a conta passava metros: a 20 m caía no piso de 5% do volume; agora a 20 m ainda soa a 2/3 do volume', () => {
    const vol = (d: number): number => Math.max(0.05, 1 - d); // a conta do AudioSystem.playExplosion
    expect(vol(20)).toBe(0.05); // o que o jogo fazia
    expect(vol(explosionSoundDistance(20, 1))).toBeCloseTo(1 - 20 / 60, 9);
  });

  it('o míssil leve estoura mais baixo que o foguete na mesma distância e o cruzador, igual ao foguete (a escala maior que 1 não passa do volume cheio)', () => {
    const leve = explosionScale(weapon('swarm').blastRadius);
    expect(explosionSoundDistance(0, leve)).toBeCloseTo(0.25, 2);
    expect(explosionSoundDistance(10, leve)).toBeGreaterThan(explosionSoundDistance(10, 1));
    expect(explosionSoundDistance(10, explosionScale(weapon('cruise').blastRadius))).toBe(explosionSoundDistance(10, 1));
  });

  it('nunca sai de 0 a 1, e cresce com a distância', () => {
    let antes = -1;
    for (let d = 0; d <= 100; d += 5) {
      const x = explosionSoundDistance(d, 0.4);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(x).toBeGreaterThanOrEqual(antes);
      antes = x;
    }
  });
});

describe('os marcadores do carregador no HUD (pipFills)', () => {
  it('até quatro tiros: um marcador por tiro, e o próximo enche com a recarga', () => {
    expect(pipFills(4, 1, 4)).toEqual([1, 1, 1, 1]);
    expect(pipFills(2, 0.5, 4)).toEqual([1, 1, 0.5, 0]);
    expect(pipFills(0, 0.3, 4)).toEqual([0.3, 0, 0, 0]);
    expect(pipFills(2, 1, 2)).toEqual([1, 1, 1, 0]); // a chuva e o guiado (2 no carregador): o terceiro marcador mostra o progresso (1 = cheio)
  });

  it('o lançador leve (8, 16, 32): cada marcador é um quarto do lançador e a conta é a fração cheia', () => {
    expect(pipFills(32, 1, 32)).toEqual([1, 1, 1, 1]);
    expect(pipFills(16, 0, 32)).toEqual([1, 1, 0, 0]);
    expect(pipFills(8, 0, 32)).toEqual([1, 0, 0, 0]);
    expect(pipFills(4, 0, 32)).toEqual([0.5, 0, 0, 0]);
    expect(pipFills(0, 0, 8)).toEqual([0, 0, 0, 0]);
    expect(pipFills(6, 0, 8)).toEqual([1, 1, 1, 0]);
    expect(pipFills(7, 0, 8)).toEqual([1, 1, 1, 0.5]); // 7 de 8 tubos: três marcadores e meio
  });

  it('sempre quatro marcadores, nenhum fora de 0 a 1, e a soma cresce com o carregador', () => {
    for (const magazine of [1, 2, 4, 8, 16, 32]) {
      let anterior = -1;
      for (let ammo = 0; ammo <= magazine; ammo++) {
        const f = pipFills(ammo, 0, magazine);
        expect(f).toHaveLength(ROCKET_PIPS);
        for (const x of f) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(1);
        }
        const soma = f.reduce((a, b) => a + b, 0);
        expect(soma).toBeGreaterThanOrEqual(anterior);
        anterior = soma;
      }
    }
  });
});
