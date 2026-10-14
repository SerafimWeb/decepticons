import { describe, expect, it } from 'vitest';
import type { DominioLado } from './Dominio';
import { HISTERESE_M, atribuirPontos, type PontoLido, type SoldadoLido } from './DominioObjetivos';

const ponto = (x: number, z: number, dono: DominioLado | null = null): PontoLido => ({ def: { x, z }, dono });
const soldado = (x: number, z: number, alive = true): SoldadoLido => ({ alive, simPosition: { x, z } });

/** O mapa de cinco pontos da Arena, de A (a base azul) a E (a base vermelha). */
const MAPA = (donos: (DominioLado | null)[] = [null, null, null, null, null]): PontoLido[] =>
  [
    [-65, 60],
    [-55, -30],
    [0, 0],
    [55, 30],
    [65, -60],
  ].map(([x, z], i) => ponto(x!, z!, donos[i]!));

function rodar(pontos: readonly PontoLido[], lado: DominioLado, soldados: readonly SoldadoLido[], atual: number[] = []): number[] {
  const saida: number[] = new Array(soldados.length).fill(-1);
  atribuirPontos(pontos, lado, soldados, atual, saida, new Array(pontos.length).fill(0));
  return saida;
}

describe('Domínio: para onde cada bot vai', () => {
  it('o esquadrão se espalha: cinco soldados saindo da base azul não vão todos ao ponto mais perto', () => {
    const base = [soldado(-70, 66), soldado(-66, 70), soldado(-62, 66), soldado(-70, 74), soldado(-60, 72)];
    const alvo = rodar(MAPA(), 'blue', base);
    expect(new Set(alvo).size).toBeGreaterThanOrEqual(4);
  });

  it('quem está mais perto de um ponto vai a ele', () => {
    const alvo = rodar(MAPA(), 'blue', [soldado(-60, 55), soldado(60, -55)]);
    expect(alvo).toEqual([0, 4]);
  });

  it('um ponto meu sem guarda atrai um soldado, mas o segundo ao lado dele segue adiante', () => {
    const meu = MAPA(['blue', null, null, null, null]);
    // Dois soldados em cima do A (que já é azul): um fica de guarda, o outro vai tomar o B (o mais perto que não é meu).
    const alvo = rodar(meu, 'blue', [soldado(-64, 60), soldado(-66, 58)]);
    expect(alvo.filter((p) => p === 0)).toHaveLength(1);
    expect(alvo.some((p) => p !== 0)).toBe(true);
  });

  it('com todos os pontos meus, cada soldado fica de guarda num ponto diferente', () => {
    const tudo = MAPA(['blue', 'blue', 'blue', 'blue', 'blue']);
    const alvo = rodar(tudo, 'blue', [soldado(-64, 60), soldado(-54, -28), soldado(2, 2), soldado(54, 30), soldado(64, -58)]);
    expect(alvo).toEqual([0, 1, 2, 3, 4]);
  });

  it('com quatro pontos meus e um do inimigo, cinco soldados no centro guardam os quatro e um vai tomar o do inimigo', () => {
    const mapa = MAPA(['blue', 'blue', 'blue', 'blue', 'red']);
    const alvo = rodar(mapa, 'blue', Array.from({ length: 5 }, () => soldado(0, 0)));
    expect([...alvo].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('um soldado só num mapa em que quase tudo é meu guarda o ponto mais perto, em vez de largar tudo para atacar', () => {
    const mapa = MAPA(['blue', 'blue', 'blue', 'blue', 'red']);
    expect(rodar(mapa, 'blue', [soldado(0, 0)])).toEqual([2]);
  });

  it('soldado morto fica sem ponto (-1) e não ocupa vaga', () => {
    const alvo = rodar(MAPA(), 'blue', [soldado(-60, 55, false), soldado(-60, 55)]);
    expect(alvo[0]).toBe(-1);
    expect(alvo[1]).toBe(0);
  });

  describe('histerese: não ir e voltar', () => {
    it('um ponto só um pouco melhor não tira o soldado do que ele já tinha', () => {
      // Soldado entre o B (1) e o C (2), já indo ao B; o C é melhor por menos que a histerese.
      const s = [soldado(-27, -15)];
      const sem = rodar(MAPA(), 'blue', s);
      const outro = sem[0] === 1 ? 2 : 1;
      const com = rodar(MAPA(), 'blue', s, [outro]);
      expect(com[0]).toBe(outro);
    });

    it('um ponto muito melhor tira o soldado do que ele tinha', () => {
      // Ele "tinha" o E, mas está em cima do A: o A é melhor por muito mais que a histerese.
      const com = rodar(MAPA(), 'blue', [soldado(-64, 60)], [4]);
      expect(com[0]).toBe(0);
      expect(HISTERESE_M).toBeLessThan(40);
    });
  });

  it('é determinística: a mesma entrada dá a mesma saída', () => {
    const s = [soldado(-70, 66), soldado(10, 10), soldado(40, 20), soldado(-20, -20)];
    expect(rodar(MAPA(), 'red', s)).toEqual(rodar(MAPA(), 'red', s));
  });

  it('usa os rascunhos que recebe (nada alocado): o de carga volta zerado a cada chamada', () => {
    const carga = [9, 9, 9, 9, 9, 9];
    const saida = [0, 0];
    atribuirPontos(MAPA(), 'blue', [soldado(0, 0), soldado(1, 1)], [], saida, carga);
    const total = carga.slice(0, 5).reduce((a, b) => a + b, 0);
    expect(total).toBe(2);
    expect(carga[5]).toBe(9); // só mexe nos pontos que existem
  });
});
