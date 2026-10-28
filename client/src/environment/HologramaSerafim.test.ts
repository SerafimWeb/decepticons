import { describe, expect, it } from 'vitest';
import { fatiasPorDistancia, HOLOGRAMA } from './HologramaSerafim';

describe('as camadas do holograma pela distância da câmera (P266: o custo dele na GPU é de preenchimento)', () => {
  const { perto, longe, minimo } = HOLOGRAMA.lod;

  it('longe desenha todas as camadas, perto só o mínimo', () => {
    expect(fatiasPorDistancia(longe, true)).toBe(HOLOGRAMA.fatias);
    expect(fatiasPorDistancia(longe * 10, true)).toBe(HOLOGRAMA.fatias);
    expect(fatiasPorDistancia(Number.POSITIVE_INFINITY, true)).toBe(HOLOGRAMA.fatias);
    expect(fatiasPorDistancia(perto, true)).toBe(minimo);
    expect(fatiasPorDistancia(0, true)).toBe(minimo);
  });

  it('cresce com a distância, sem voltar atrás, e não passa do máximo nem fica abaixo do mínimo', () => {
    let anterior = 0;
    for (let d = 0; d <= longe + 50; d += 1) {
      const n = fatiasPorDistancia(d, true);
      expect(n, `a ${d} m`).toBeGreaterThanOrEqual(anterior);
      expect(n).toBeGreaterThanOrEqual(minimo);
      expect(n).toBeLessThanOrEqual(HOLOGRAMA.fatias);
      anterior = n;
    }
  });

  it('a qualidade baixa desenha no máximo metade, em qualquer distância', () => {
    const metade = Math.ceil(HOLOGRAMA.fatias / 2);
    for (let d = 0; d <= longe + 50; d += 5) {
      expect(fatiasPorDistancia(d, false), `a ${d} m`).toBeLessThanOrEqual(metade);
      expect(fatiasPorDistancia(d, false)).toBeLessThanOrEqual(fatiasPorDistancia(d, true));
    }
    expect(fatiasPorDistancia(longe, false)).toBe(metade);
  });

  it('sem distância conhecida, o máximo do nível de detalhe', () => {
    expect(fatiasPorDistancia(Number.NaN, true)).toBe(HOLOGRAMA.fatias);
    expect(fatiasPorDistancia(Number.NaN, false)).toBe(Math.ceil(HOLOGRAMA.fatias / 2));
  });

  it('de baixo do holograma, o ponto mais perto que o jogador alcança (e o que mais enche a tela), já são poucas camadas', () => {
    // A câmera do jogador, a ~4 m do chão e a 26 m do prédio, com o centro do holograma a ~76 m de altura.
    const debaixo = Math.hypot(0, HOLOGRAMA.y - 4, 26);
    expect(fatiasPorDistancia(debaixo, true)).toBeLessThanOrEqual(minimo + 3);
  });
});
