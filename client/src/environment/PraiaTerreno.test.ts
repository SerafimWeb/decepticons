import RAPIER from '@dimforge/rapier3d-simd-compat';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import {
  alturaDasDunas,
  alturaDoChao,
  corDoChao,
  costaEm,
  faixaEm,
  funduraDoMarEm,
  gradeDoTerreno,
  NIVEL_DO_MAR,
  PRAIA_CELULA,
  PRAIA_DUNAS,
  PRAIA_EXTENSAO,
  PRAIA_FUNDURA_MAXIMA,
  PRAIA_LIMITES,
} from './PraiaTerreno';

describe('o terreno da PRAIA DOS CABOS (P127): a praia ao longo do mapa', () => {
  it('o mapa é comprido e a costa corre ao longo dele: a linha d’água ondula, mas fica sempre na faixa da praia', () => {
    expect(PRAIA_EXTENSAO.comprimento).toBe(640);
    expect(PRAIA_EXTENSAO.comprimento).toBeGreaterThan(200 * 3); // mais que o triplo da Arena
    let min = Infinity;
    let max = -Infinity;
    for (let x = PRAIA_LIMITES.minX; x <= PRAIA_LIMITES.maxX; x += 2) {
      const c = costaEm(x);
      min = Math.min(min, c);
      max = Math.max(max, c);
    }
    expect(min).toBeGreaterThan(-52); // sobra mar atrás dela
    expect(max).toBeLessThan(-20); // e sobra praia entre ela e o calçadão
    expect(max - min, 'a costa não é uma reta: tem baías').toBeGreaterThan(8);
  });

  it('em todo o comprimento: mar de um lado (fundo) e terra firme do outro (chão em 0)', () => {
    for (let x = PRAIA_LIMITES.minX; x <= PRAIA_LIMITES.maxX; x += 16) {
      expect(alturaDoChao(x, PRAIA_LIMITES.minZ), `fundo em x=${x}`).toBeLessThan(-10);
      expect(alturaDoChao(x, 60), `terra em x=${x}`).toBeCloseTo(0, 6); // a cidade: chão plano
      expect(faixaEm(x, PRAIA_LIMITES.minZ)).toBe('mar');
      expect(faixaEm(x, costaEm(x) + 5)).toBe('praia');
    }
  });

  it('a linha d’água é onde o chão cruza o nível do mar, e o fundo desce sem nunca subir (a rampa que afunda o Mech)', () => {
    for (let x = -300; x <= 300; x += 25) {
      expect(alturaDoChao(x, costaEm(x))).toBeCloseTo(NIVEL_DO_MAR, 6);
      let anterior = alturaDoChao(x, costaEm(x));
      for (let s = 0.5; s <= 90; s += 0.5) {
        const y = alturaDoChao(x, costaEm(x) - s);
        expect(y, `x=${x} s=${s}`).toBeLessThanOrEqual(anterior + 1e-9);
        anterior = y;
      }
      expect(funduraDoMarEm(x, costaEm(x) - 90)).toBeGreaterThan(PRAIA_FUNDURA_MAXIMA - 1.5);
      expect(funduraDoMarEm(x, costaEm(x) + 3)).toBe(0); // na areia, sem água
    }
  });

  it('nenhuma ladeira passa de 22° (o character controller sobe até 50°; o folgado evita o Mech patinar no fundo do mar)', () => {
    const e = 0.5;
    let pior = 0;
    for (let x = PRAIA_LIMITES.minX + 1; x < PRAIA_LIMITES.maxX; x += 3) {
      for (let z = PRAIA_LIMITES.minZ + 1; z < 20; z += 1.5) {
        const gx = (alturaDoChao(x + e, z) - alturaDoChao(x - e, z)) / (2 * e);
        const gz = (alturaDoChao(x, z + e) - alturaDoChao(x, z - e)) / (2 * e);
        pior = Math.max(pior, Math.hypot(gx, gz));
      }
    }
    expect(Math.atan(pior) * (180 / Math.PI)).toBeLessThan(22);
  });

  it('as dunas são baixas, ficam longe da água e são só areia (nada passa de 2 m de altura)', () => {
    expect(PRAIA_DUNAS.length).toBeGreaterThanOrEqual(8);
    for (const d of PRAIA_DUNAS) {
      expect(d.h, 'duna baixa').toBeLessThanOrEqual(1.7);
      expect(alturaDasDunas(d.x, d.z), `duna em ${d.x},${d.z} tem de aparecer`).toBeGreaterThan(d.h * 0.45);
      expect(d.z - costaEm(d.x), 'longe da água').toBeGreaterThan(8);
    }
    let alto = 0;
    for (let x = -320; x <= 320; x += 2) for (let z = -50; z <= 4; z += 2) alto = Math.max(alto, alturaDoChao(x, z));
    expect(alto).toBeLessThan(2);
    // Na beira d’água não há duna.
    for (let x = -300; x <= 300; x += 30) expect(alturaDasDunas(x, costaEm(x) + 2)).toBe(0);
  });

  it('a cor do chão: areia branca em terra, faixa molhada junto da água e fundo que escurece no fundo do mar', () => {
    const luz = (c: readonly number[]): number => (c[0]! + c[1]! + c[2]!) / 3;
    const x = -150;
    const seca = corDoChao(x, costaEm(x) + 18);
    const molhada = corDoChao(x, costaEm(x) + 1);
    const rasa = corDoChao(x, costaEm(x) - 4);
    const funda = corDoChao(x, costaEm(x) - 80);
    expect(luz(seca)).toBeGreaterThan(0.8); // branquinha
    expect(luz(molhada)).toBeLessThan(luz(seca)); // a faixa que a onda molha é mais escura
    expect(luz(funda)).toBeLessThan(luz(rasa)); // o fundo escurece
    for (const c of [seca, molhada, rasa, funda]) for (const v of c) expect(v >= 0 && v <= 1).toBe(true);
  });

  it('a grade do terreno tem uma altura por vértice, no formato do colisor (coluna = X, linha = Z)', () => {
    const g = gradeDoTerreno(-40, 40, -60, 20);
    expect(g.celulasX).toBe(80 / PRAIA_CELULA);
    expect(g.celulasZ).toBe(80 / PRAIA_CELULA);
    expect(g.alturas.length).toBe((g.celulasX + 1) * (g.celulasZ + 1));
    // O vértice (ix, iz) guarda a altura de (minX + ix·c, minZ + iz·c).
    expect(g.alturas[3 * (g.celulasZ + 1) + 5]).toBeCloseTo(alturaDoChao(-40 + 3 * PRAIA_CELULA, -60 + 5 * PRAIA_CELULA), 5);
    expect(g.alturas[(g.celulasX) * (g.celulasZ + 1) + g.celulasZ]).toBeCloseTo(alturaDoChao(40, 20), 5);
  });
});

describe('o colisor de altura da praia é o mesmo chão que a função desenha (G14)', () => {
  const abertas: PhysicsWorld[] = [];
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('o raio para baixo acha o chão onde a função diz, no mar, na praia e na duna (pelas duas pontas do mapa)', async () => {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const { minX, maxX, minZ, maxZ } = PRAIA_LIMITES;
    const g = gradeDoTerreno(minX, maxX, minZ, maxZ);
    physics.addStaticHeightfield(g.celulasX, g.celulasZ, g.alturas, { x: maxX - minX, z: maxZ - minZ }, { x: 0, z: 0 });
    physics.step(); // o Rapier só atualiza as consultas depois do primeiro passo
    // Posições fora das linhas da grade (o raio exatamente na aresta pode passar entre dois triângulos).
    const amostras: [number, number][] = [
      [-310.3, -100.7], [-120.7, -80.3], [10.3, -60.7], [250.7, -45.3], [-96.3, -6.7], [32.7, -3.3], [140.3, -4.1], [300.3, 80.7], [-250.6, 30.2],
    ];
    for (const [x, z] of amostras) {
      const y = physics.terrainY(x, z, 40, 120);
      expect(y, `sem chão em ${x},${z}`).not.toBeNull();
      // A malha de triângulos corta a curva por dentro: alguns centímetros de folga bastam.
      expect(Math.abs(y! - alturaDoChao(x, z)), `chão em ${x},${z}`).toBeLessThan(0.25);
    }
  });
});
