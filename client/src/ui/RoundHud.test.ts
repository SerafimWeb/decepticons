import { describe, expect, it } from 'vitest';
import type { Standing } from '../combat/Round';
import type { MechBase } from '../entities/MechBase';
import { linhasDoPlacar, PLACAR_LINHAS } from './RoundHud';

const pilotos = (n: number): Standing[] => Array.from({ length: n }, (_, i) => ({ mech: { id: i } as unknown as MechBase, name: `P${i + 1}`, kills: n - i, deaths: 0 }));

describe('placar da rodada (esquadrão grande, P91)', () => {
  it('cabendo, mostra todo mundo, com a posição de cada um', () => {
    const p = pilotos(7);
    const linhas = linhasDoPlacar(p, p[3]!.mech);
    expect(linhas.map((l) => l.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(linhasDoPlacar(pilotos(PLACAR_LINHAS), pilotos(1)[0]!.mech)).toHaveLength(PLACAR_LINHAS);
  });

  it('com 33 pilotos, mostra os primeiros e, na última linha, quem joga com a posição de verdade dele', () => {
    const p = pilotos(33);
    const eu = p[27]!.mech;
    const linhas = linhasDoPlacar(p, eu);
    expect(linhas).toHaveLength(PLACAR_LINHAS);
    expect(linhas.slice(0, PLACAR_LINHAS - 1).map((l) => l.rank)).toEqual(Array.from({ length: PLACAR_LINHAS - 1 }, (_, i) => i + 1));
    expect(linhas[PLACAR_LINHAS - 1]).toMatchObject({ rank: 28, row: { name: 'P28' } });
  });

  it('quem joga entre os primeiros não é repetido; sem a linha dele (espectador), só os primeiros', () => {
    const p = pilotos(33);
    const dentro = linhasDoPlacar(p, p[4]!.mech);
    expect(dentro.map((l) => l.rank)).toEqual(Array.from({ length: PLACAR_LINHAS }, (_, i) => i + 1));
    const ultimaPosicaoDosPrimeiros = linhasDoPlacar(p, p[PLACAR_LINHAS - 2]!.mech);
    expect(ultimaPosicaoDosPrimeiros.map((l) => l.rank)).toEqual(Array.from({ length: PLACAR_LINHAS }, (_, i) => i + 1));
    expect(linhasDoPlacar(p, { id: 'ninguém' } as unknown as MechBase)).toHaveLength(PLACAR_LINHAS);
  });
});
