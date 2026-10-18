import { describe, expect, it } from 'vitest';
import { TORRES_DE_VIGIA, TorresDeVigia, type AlvoDaTorre } from './TorresDeVigia';

const DT = 1 / 60;
const alvo = (x: number, z: number, vivo = true): AlvoDaTorre => ({ simPosition: { x, y: 0, z }, alive: vivo });
const torres = (n = 1, seed = 1) => new TorresDeVigia(Array.from({ length: n }, (_, i) => ({ x: i * 100, y: 17, z: 0 })), seed);

/** Roda `s` segundos e devolve os tiros (torre, alvo, erros) e quantas vezes a visão foi consultada. */
function rodar(t: TorresDeVigia, alvos: readonly AlvoDaTorre[], s: number, vendo = true) {
  const tiros: { torre: number; alvo: number; ex: number; ey: number; em: number }[] = [];
  let consultas = 0;
  let tempo = 0;
  for (let k = 0; k < Math.round(s / DT); k++) {
    t.fixedUpdate(
      DT,
      alvos,
      () => {
        consultas++;
        return vendo;
      },
      (torre, a, ex, ey) => tiros.push({ torre, alvo: a, ex, ey, em: tempo }),
    );
    tempo += DT;
  }
  return { tiros, consultas };
}

describe('as torres de vigia armadas (P180, parte D2)', () => {
  it('uma torre com alguém ao alcance e à vista solta uma rajada de quatro tiros espaçados, e só depois espera a próxima', () => {
    const t = torres();
    const { tiros } = rodar(t, [alvo(100, 0)], 8);
    const primeira = tiros.slice(0, TORRES_DE_VIGIA.tirosPorRajada);
    expect(primeira).toHaveLength(4);
    for (let i = 1; i < primeira.length; i++) expect(primeira[i]!.em - primeira[i - 1]!.em).toBeCloseTo(TORRES_DE_VIGIA.entreTirosS, 1);
    // a segunda rajada só vem depois da espera
    const segunda = tiros[4]!;
    expect(segunda.em - primeira[3]!.em).toBeGreaterThanOrEqual(TORRES_DE_VIGIA.esperaS - 0.05);
    expect(tiros.every((x) => x.alvo === 0 && x.torre === 0)).toBe(true);
  });

  it('fora do alcance ou sem linha de visão a torre não atira (e a visão só é consultada quando ela está pronta e há alguém ao alcance)', () => {
    const longe = rodar(torres(), [alvo(TORRES_DE_VIGIA.alcanceM + 30, 0)], 6);
    expect(longe.tiros).toHaveLength(0);
    expect(longe.consultas, 'ninguém ao alcance: nenhum raio gasto').toBe(0);
    const atras = rodar(torres(), [alvo(80, 0)], 6, false);
    expect(atras.tiros).toHaveLength(0);
    expect(atras.consultas).toBeGreaterThan(0);
    expect(atras.consultas, 'sem visão ela olha de novo só a cada 0,4 s, não a cada tick').toBeLessThan(25);
  });

  it('com vários alvos a torre escolhe o mais perto à vista, e um alvo morto não é alvo', () => {
    const t = torres();
    const { tiros } = rodar(t, [alvo(150, 0), alvo(40, 0), alvo(10, 0, false)], 3);
    expect(tiros.length).toBeGreaterThan(0);
    expect(tiros.every((x) => x.alvo === 1)).toBe(true);
  });

  it('se o alvo morre no meio da rajada, ela para; a torre espera e volta ao próximo vivo', () => {
    const t = torres();
    const a = { simPosition: { x: 60, y: 0, z: 0 }, alive: true };
    const tiros: number[] = [];
    let tempo = 0;
    for (let k = 0; k < 60 * 4; k++) {
      t.fixedUpdate(DT, [a], () => true, () => tiros.push(tempo));
      if (tiros.length === 2) a.alive = false;
      tempo += DT;
    }
    expect(tiros).toHaveLength(2);
  });

  it('sem energia (o gerador da CERCA caiu) nenhuma torre atira, nem termina a rajada que começou', () => {
    const t = torres(3);
    const alvos = [alvo(100, 20)];
    let antes = rodar(t, alvos, 1).tiros.length;
    expect(antes).toBeGreaterThan(0);
    t.ativa = false;
    expect(rodar(t, alvos, 6).tiros).toHaveLength(0);
    t.ativa = true;
    antes = rodar(t, alvos, 4).tiros.length;
    expect(antes, 'com energia de novo elas voltam').toBeGreaterThan(0);
  });

  it('as torres não disparam juntas (cada uma começa com uma espera): no primeiro segundo a primeira rajada não é de todas', () => {
    const t = torres(8);
    const alvos = [alvo(350, 10)];
    const { tiros } = rodar(t, alvos, 1);
    const quem = new Set(tiros.map((x) => x.torre));
    expect(quem.size).toBeLessThan(8);
  });

  it('o erro de mira é determinístico (a mesma semente dá os mesmos tiros), espalhado e dentro do limite', () => {
    const a = rodar(torres(2, 7), [alvo(50, 0)], 10).tiros;
    const b = rodar(torres(2, 7), [alvo(50, 0)], 10).tiros;
    const c = rodar(torres(2, 8), [alvo(50, 0)], 10).tiros;
    expect(a).toEqual(b);
    expect(a.map((x) => x.ex)).not.toEqual(c.map((x) => x.ex));
    for (const x of a) {
      expect(Math.abs(x.ex)).toBeLessThanOrEqual(TORRES_DE_VIGIA.erroMaximoRad);
      expect(Math.abs(x.ey)).toBeLessThanOrEqual(TORRES_DE_VIGIA.erroMaximoRad);
    }
    expect(new Set(a.map((x) => x.ex.toFixed(4))).size, 'não é sempre o mesmo erro').toBeGreaterThan(a.length / 2);
  });
});
