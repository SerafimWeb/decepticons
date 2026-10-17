import { describe, expect, it } from 'vitest';
import { carregarMapaSeFor, exigirMapa, mapaCarregado } from './mapasSobDemanda';

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
