import { describe, expect, it } from 'vitest';
import { carregarChefeSeFor, carregarMapaSeFor, chefeCarregado, exigirChefe, exigirMapa, mapaCarregado } from './mapasSobDemanda';

describe('os mapas sob demanda (P180, parte B): o código do mapa grande só baixa para quem o escolhe', () => {
  // Este arquivo roda isolado (um módulo por arquivo de teste): a ordem abaixo é a de um jogo que abre.
  it('antes de carregar, o mapa não existe: pedir sem carregar dá um erro que diz o que fazer (não um undefined lá na frente)', () => {
    expect(mapaCarregado('amazonia')).toBeUndefined();
    expect(() => exigirMapa('amazonia')).toThrow(/carregarMapaSeFor\("amazonia"\)/);
  });

  it('os mapas que moram no pacote de partida não carregam nada (a Cidade Neon, o Bunker e a Praia não pagam pela Amazônia)', async () => {
    for (const id of ['arena', 'bunker', 'praia'] as const) {
      await carregarMapaSeFor(id);
      expect(mapaCarregado(id), id).toBeUndefined();
    }
    expect(mapaCarregado('amazonia')).toBeUndefined();
  });

  it('carregar a Amazônia a registra, com o que a Arena, o radar e o minimapa leem; e é idempotente', async () => {
    await carregarMapaSeFor('amazonia');
    const m = mapaCarregado('amazonia')!;
    expect(m).toBeDefined();
    expect(exigirMapa('amazonia')).toBe(m);
    expect(m.caixasDaPlanta().length).toBeGreaterThan(30);
    for (const c of m.caixasDaPlanta()) {
      expect(c.x1).toBeGreaterThan(c.x0);
      expect(c.z1).toBeGreaterThan(c.z0);
    }
    expect(m.rotulos.map((r) => r.texto)).toEqual(['ALDEIA', 'PLANTA', 'MINA', 'REJEITOS']);
    expect(m.meia).toEqual({ x: 1200, z: 450 });
    await carregarMapaSeFor('amazonia');
    expect(mapaCarregado('amazonia')).toBe(m);
  });

  it('os rótulos do radar ficam dentro do mapa (um rótulo fora da tela do radar não se vê)', async () => {
    await carregarMapaSeFor('amazonia');
    const m = exigirMapa('amazonia');
    for (const r of m.rotulos) {
      expect(Math.abs(r.x)).toBeLessThan(m.meia.x);
      expect(Math.abs(r.z)).toBeLessThan(m.meia.z);
    }
  });
});

describe('os chefes sob demanda (P180, parte C): o Draga só baixa para quem abre a missão', () => {
  it('antes de carregar, o chefe não existe: pedir sem carregar dá um erro que diz o que fazer', () => {
    expect(chefeCarregado('amazonia')).toBeUndefined();
    expect(() => exigirChefe('amazonia')).toThrow(/carregarChefeSeFor\("amazonia"\)/);
  });

  it('os mapas sem chefe não carregam nada (a Cidade Neon, o Bunker e a Praia não pagam pelo Draga)', async () => {
    for (const id of ['arena', 'bunker', 'praia'] as const) {
      await carregarChefeSeFor(id);
      expect(chefeCarregado(id), id).toBeUndefined();
    }
    expect(chefeCarregado('amazonia')).toBeUndefined();
  });

  it('carregar o chefe da Amazônia o registra, com o ponto de largada e o desenho sob demanda, e é idempotente', async () => {
    await carregarChefeSeFor('amazonia');
    const c = chefeCarregado('amazonia')!;
    expect(c).toBeDefined();
    expect(exigirChefe('amazonia')).toBe(c);
    expect(c.nascimento.x).toBe(700);
    expect(typeof c.criar).toBe('function');
    expect(typeof c.criarVisual).toBe('function');
    await carregarChefeSeFor('amazonia');
    expect(chefeCarregado('amazonia')).toBe(c);
  });
});
