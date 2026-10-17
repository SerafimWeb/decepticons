import { describe, expect, it } from 'vitest';
import { aderecosDaAmazonia, COR_DA_PECA, pontoDaTorre, TORRES_DA_MARGEM } from './AmazoniaAderecos';
import {
  AMAZONIA_ALDEIA,
  AMAZONIA_LIMITES,
  AMAZONIA_MARGEM,
  AMAZONIA_MINA,
  AMAZONIA_NASCIMENTO_JOGADOR,
  AMAZONIA_PLANTA,
  AMAZONIA_REJEITOS,
  AMAZONIA_SPAWNS,
  estaNoRio,
  larguraDoRio,
  NIVEL_DA_AGUA,
  rioEmX,
} from './AmazoniaLayout';
import { alturaDoTerreno } from './AmazoniaTerreno';

const pecas = aderecosDaAmazonia();

describe('as estruturas da Amazônia (P180, parte B): o catálogo em dado', () => {
  it('é determinístico e tem o que a ficha da missão pede: a aldeia, a planta, a margem fortificada com as torres, a cava e a lagoa', () => {
    expect(aderecosDaAmazonia()).toBe(pecas);
    expect(pecas.length).toBeGreaterThan(120);
    expect(pecas.length).toBeLessThan(400);
    const perto = (x: number, z: number, r: number): number => pecas.filter((p) => Math.hypot(p.x - x, p.z - z) < r).length;
    expect(perto(AMAZONIA_ALDEIA.x, AMAZONIA_ALDEIA.z, AMAZONIA_ALDEIA.raio * 1.2), 'a aldeia').toBeGreaterThan(20);
    expect(perto(AMAZONIA_PLANTA.x, AMAZONIA_PLANTA.z, AMAZONIA_PLANTA.comprimento / 2 + 120), 'a planta').toBeGreaterThan(20);
    expect(perto(AMAZONIA_MINA.x, AMAZONIA_MINA.z, AMAZONIA_MINA.raio * 1.4), 'a cava').toBeGreaterThan(5);
    expect(perto(AMAZONIA_REJEITOS.x - 90, AMAZONIA_REJEITOS.z, 130), 'a casa de bombas e o tubo (9 peças)').toBeGreaterThanOrEqual(9);
    expect(TORRES_DA_MARGEM.length).toBe(8);
  });

  it('nenhuma peça fica dentro do rio: nem as canoas (que ficam na beira, não na água)', () => {
    for (const p of pecas) {
      expect(estaNoRio(p.x, p.z), `${p.forma} ${p.cor} em ${p.x.toFixed(0)},${p.z.toFixed(0)}`).toBe(false);
    }
  });

  it('todas assentam em terra seca: a base de cada peça está acima da água e dentro do mapa', () => {
    for (const p of pecas) {
      expect(p.x).toBeGreaterThan(AMAZONIA_LIMITES.minX);
      expect(p.x).toBeLessThan(AMAZONIA_LIMITES.maxX);
      expect(p.z).toBeGreaterThan(AMAZONIA_LIMITES.minZ);
      expect(p.z).toBeLessThan(AMAZONIA_LIMITES.maxZ);
      expect(alturaDoTerreno(p.x, p.z), `chão sob ${p.cor} em ${p.x.toFixed(0)},${p.z.toFixed(0)}`).toBeGreaterThan(NIVEL_DA_AGUA);
      expect(p.h).toBeGreaterThan(0);
      expect(p.w).toBeGreaterThan(0);
      expect(p.d).toBeGreaterThan(0);
      expect(COR_DA_PECA[p.cor]).toBeDefined();
    }
  });

  it('as peças sólidas (as que viram colisor) são poucas: a conta da ficha é ≤ 400 colisores estáticos no mapa todo', () => {
    const solidas = pecas.filter((p) => p.solido);
    expect(solidas.length).toBeGreaterThan(30);
    expect(solidas.length).toBeLessThan(160);
  });

  it('as torres da margem ficam na margem NORTE (a do lado da planta e da cava), entre a cerca e a planta, uma a cada 100 m', () => {
    for (let i = 0; i < TORRES_DA_MARGEM.length; i++) {
      const { x, z } = pontoDaTorre(i);
      expect(z, `torre ${i}`).toBeGreaterThan(rioEmX(x) + larguraDoRio(x) / 2);
      expect(z - (rioEmX(x) + larguraDoRio(x) / 2)).toBeCloseTo(24, 6);
      expect(x).toBeGreaterThanOrEqual(AMAZONIA_MARGEM.minX);
      expect(x).toBeLessThanOrEqual(AMAZONIA_MARGEM.maxX);
      if (i > 0) expect(x - pontoDaTorre(i - 1).x).toBe(100);
      expect(estaNoRio(x, z)).toBe(false);
    }
  });

  it('a cerca acompanha a margem norte: um poste a cada 20 m, 14 m para fora da água', () => {
    const postes = pecas.filter((p) => p.forma === 'caixa' && p.cor === 'metal' && p.h > 5 && p.h < 5.5 && p.w < 1);
    expect(postes.length).toBe((AMAZONIA_MARGEM.maxX - AMAZONIA_MARGEM.minX) / 20 + 1);
    for (const p of postes) expect(p.z - (rioEmX(p.x) + larguraDoRio(p.x) / 2)).toBeCloseTo(14, 6);
  });

  it('a planta tem galpões, silos, tanques e a chaminé DENTRO do pátio plano (nada pendurado fora do pátio)', () => {
    const pl = AMAZONIA_PLANTA;
    const noPatio = (p: { x: number; z: number }): boolean => Math.abs(p.x - pl.x) <= pl.comprimento / 2 && Math.abs(p.z - pl.z) <= pl.largura / 2;
    const galpoes = pecas.filter((p) => p.forma === 'caixa' && p.cor === 'metal' && p.h === 10 && noPatio(p));
    expect(galpoes.length).toBe(3);
    const silos = pecas.filter((p) => p.forma === 'cilindro' && p.cor === 'concreto' && p.h === 26);
    expect(silos.length).toBe(2);
    for (const s of silos) expect(noPatio(s)).toBe(true);
    const tanques = pecas.filter((p) => p.forma === 'cilindro' && (p.cor === 'tanque' || p.cor === 'ferrugem') && p.h === 14);
    expect(tanques.length).toBe(6);
    const chamine = pecas.filter((p) => p.forma === 'cilindro' && p.h === 52);
    expect(chamine.length).toBe(1);
  });
});

describe('os nascimentos da Amazônia (P180, parte B): o jogador na aldeia e os outros ao longo da margem sul', () => {
  it('são 12 pontos: o primeiro é o do jogador e todos são distintos', () => {
    expect(AMAZONIA_SPAWNS.length).toBe(12);
    expect(AMAZONIA_SPAWNS[0]).toEqual([AMAZONIA_NASCIMENTO_JOGADOR.x, AMAZONIA_NASCIMENTO_JOGADOR.z]);
    expect(new Set(AMAZONIA_SPAWNS.map(([x, z]) => `${x},${z}`)).size).toBe(12);
  });

  it('todos em terra firme, secos, longe do rio (≥ 50 m da margem) e dentro do mapa', () => {
    for (const [x, z] of AMAZONIA_SPAWNS) {
      expect(estaNoRio(x, z)).toBe(false);
      expect(Math.abs(z - rioEmX(x)) - larguraDoRio(x) / 2, `ponto ${x.toFixed(0)},${z.toFixed(0)} da margem`).toBeGreaterThan(40);
      expect(alturaDoTerreno(x, z)).toBeGreaterThan(NIVEL_DA_AGUA + 1);
      expect(alturaDoTerreno(x, z)).toBeLessThan(8);
      expect(x).toBeGreaterThan(AMAZONIA_LIMITES.minX);
      expect(x).toBeLessThan(AMAZONIA_LIMITES.maxX);
      expect(z).toBeGreaterThan(AMAZONIA_LIMITES.minZ + 20);
    }
  });

  it('nenhum cai dentro de uma peça sólida (caixa ou cilindro): o robô não nasce entalado numa estrutura', () => {
    for (const [x, z] of AMAZONIA_SPAWNS) {
      for (const p of pecas.filter((q) => q.solido)) {
        const meia = Math.hypot(p.w, p.d) / 2 + 2; // a caixa, girada ou não, cabe nesse círculo
        const dentro = p.forma === 'caixa' ? Math.hypot(x - p.x, z - p.z) < meia : Math.hypot(x - p.x, z - p.z) < p.w + 2;
        expect(dentro, `${x.toFixed(0)},${z.toFixed(0)} em ${p.cor}`).toBe(false);
      }
    }
  });

  it('ficam espalhados: a distância entre pontos vizinhos é de pelo menos 150 m (a luta anda pelo mapa, não nasce em cima)', () => {
    for (let i = 2; i < AMAZONIA_SPAWNS.length; i++) {
      const [x0, z0] = AMAZONIA_SPAWNS[i - 1]!;
      const [x1, z1] = AMAZONIA_SPAWNS[i]!;
      expect(Math.hypot(x1 - x0, z1 - z0)).toBeGreaterThan(150);
    }
  });
});
