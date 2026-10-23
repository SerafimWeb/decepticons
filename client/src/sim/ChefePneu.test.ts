import { describe, expect, it } from 'vitest';
import { ChefePneu, type ConfigDoChefePneu } from './ChefePneu';

const CFG: ConfigDoChefePneu = { origem: { x: 0, z: 0 }, alvo: { x: 100, z: 0 }, velocidade: 10, vidaMax: 200 };

describe('o chefão pneu (P248): rola até o alvo, sem fase, só vida', () => {
  it('nasce na origem, cheio de vida, vivo', () => {
    const c = new ChefePneu(CFG);
    expect(c.x).toBe(0);
    expect(c.z).toBe(0);
    expect(c.vida).toBe(200);
    expect(c.morto).toBe(false);
    expect(c.chegou).toBe(false);
  });

  it('avança na direção do alvo, na velocidade configurada', () => {
    const c = new ChefePneu(CFG);
    c.avancar(1); // 1 s a 10 m/s = 10 m
    expect(c.x).toBeCloseTo(10, 5);
    expect(c.z).toBeCloseTo(0, 5);
    expect(c.distanciaRolada).toBeCloseTo(10, 5);
  });

  it('para exatamente no alvo (não ultrapassa) e marca chegou', () => {
    const c = new ChefePneu(CFG);
    for (let i = 0; i < 20; i++) c.avancar(1); // 20 s a 10 m/s = 200 m > 100 m de distância
    expect(c.x).toBeCloseTo(100, 5);
    expect(c.chegou).toBe(true);
    const antes = c.x;
    c.avancar(1); // não anda mais depois de chegar
    expect(c.x).toBe(antes);
  });

  it('rola na diagonal com a direção certa (vetor unitário)', () => {
    const c = new ChefePneu({ origem: { x: 0, z: 0 }, alvo: { x: 30, z: 40 }, velocidade: 5, vidaMax: 100 }); // 3-4-5
    c.avancar(1); // 5 m andados
    expect(c.x).toBeCloseTo(3, 5);
    expect(c.z).toBeCloseTo(4, 5);
  });

  it('o tiro de frente acerta e tira vida; o aviso de ferir dispara com a vida certa', () => {
    const c = new ChefePneu(CFG);
    const vidas: number[] = [];
    c.aoFerir = (v) => vidas.push(v);
    const acertou = c.atirar(-50, 1, 0, 1, 0, 0, 100, 40);
    expect(acertou).toBe(true);
    expect(c.vida).toBe(160);
    expect(vidas).toEqual([160]);
  });

  it('o tiro que passa longe (fora do raio) erra', () => {
    const c = new ChefePneu(CFG);
    const acertou = c.atirar(-50, 1, 50, 1, 0, 0, 100, 40); // reto, mas 50 m ao lado
    expect(acertou).toBe(false);
    expect(c.vida).toBe(200);
  });

  it('o tiro alto demais (acima da altura do pneu) erra', () => {
    const c = new ChefePneu(CFG);
    const acertou = c.atirar(-5, 50, 0, 1, 0, 0, 100, 40); // vindo de cima, raso (dy quase 0): y=50 nunca entra na faixa 0..8
    expect(acertou).toBe(false);
  });

  it('o tiro fora de alcance erra', () => {
    const c = new ChefePneu(CFG);
    const acertou = c.atirar(-200, 1, 0, 1, 0, 0, 50, 40); // alcance 50 m, o pneu está a 200 m
    expect(acertou).toBe(false);
  });

  it('a explosão perto acerta; longe erra', () => {
    const c = new ChefePneu(CFG);
    expect(c.explodir(2, 1, 0, 5, 30)).toBe(true);
    expect(c.vida).toBe(170);
    expect(c.explodir(500, 1, 0, 5, 30)).toBe(false);
    expect(c.vida).toBe(170);
  });

  it('a vida nunca fica negativa; morre exatamente quando chega a zero, e só uma vez', () => {
    const c = new ChefePneu({ ...CFG, vidaMax: 50 });
    let mortes = 0;
    c.aoMorrer = () => mortes++;
    c.atirar(-50, 1, 0, 1, 0, 0, 100, 80); // dano maior que a vida toda
    expect(c.vida).toBe(0);
    expect(c.morto).toBe(true);
    expect(mortes).toBe(1);
    // depois de morto, mais tiros não fazem nada (nem chamam aoFerir/aoMorrer de novo)
    const acertouDeNovo = c.atirar(-50, 1, 0, 1, 0, 0, 100, 10);
    expect(acertouDeNovo).toBe(false);
    expect(mortes).toBe(1);
  });

  it('morto, não avança mais', () => {
    const c = new ChefePneu(CFG);
    c.atirar(-50, 1, 0, 1, 0, 0, 100, 500); // mata de um tiro só
    expect(c.morto).toBe(true);
    c.avancar(5);
    expect(c.x).toBe(0); // não andou nada
  });

  it('reiniciar() volta ao estado de nascença, no mesmo objeto', () => {
    const c = new ChefePneu(CFG);
    c.avancar(5);
    c.atirar(-50, 1, 0, 1, 0, 0, 100, 80);
    expect(c.x).not.toBe(0);
    expect(c.vida).toBeLessThan(200);
    c.reiniciar();
    expect(c.x).toBe(0);
    expect(c.z).toBe(0);
    expect(c.vida).toBe(200);
    expect(c.distanciaRolada).toBe(0);
    expect(c.morto).toBe(false);
    expect(c.chegou).toBe(false);
    // continua funcionando normalmente depois de reiniciado
    c.avancar(1);
    expect(c.x).toBeCloseTo(10, 5);
  });

  it('é determinístico: duas instâncias com a mesma config e os mesmos tiros chegam ao mesmo estado', () => {
    const a = new ChefePneu(CFG);
    const b = new ChefePneu(CFG);
    for (let i = 0; i < 7; i++) {
      a.avancar(0.3);
      b.avancar(0.3);
    }
    a.atirar(-50, 1, 0, 1, 0, 0, 100, 25);
    b.atirar(-50, 1, 0, 1, 0, 0, 100, 25);
    expect(a.x).toBe(b.x);
    expect(a.vida).toBe(b.vida);
  });
});
