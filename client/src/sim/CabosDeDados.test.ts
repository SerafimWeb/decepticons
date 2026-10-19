import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/rng';
import { PRAIA_CABOS_X } from '../environment/PraiaLayout';
import { caboDoPonto, CABOS, CabosDeDados, ehAndroide, PONTOS_DOS_CABOS, Z_DOS_PONTOS } from './CabosDeDados';

const DT = 1 / 60;
const NINGUEM = [0, 0, 0];

/** Roda `s` segundos com as entradas fixas (por cabo: andróides ligados, peso de depredadores, defensores). */
function rodar(c: CabosDeDados, s: number, ligados = NINGUEM, depredadores = NINGUEM, defensores = NINGUEM): void {
  for (let i = 0; i < Math.round(s / DT); i++) c.fixedUpdate(DT, ligados, depredadores, defensores);
}

describe('os CABOS DE DADOS (P162/P163): injeção, dano e reparo, uma regra pura e determinística', () => {
  it('há um ponto de conexão por cabo, no x do cabo da praia e no pátio da estação', () => {
    expect(PONTOS_DOS_CABOS).toHaveLength(3);
    PONTOS_DOS_CABOS.forEach((p, i) => {
      expect(p.x).toBe(PRAIA_CABOS_X[i]);
      expect(p.z).toBe(Z_DOS_PONTOS);
    });
    expect(Z_DOS_PONTOS).toBeGreaterThan(16); // além da escotilha (z 16)
    expect(Z_DOS_PONTOS).toBeLessThan(50); // antes da fachada da estação
  });

  it('começa inteiro e livre: nenhuma injeção, vida cheia, nada drenando', () => {
    const c = new CabosDeDados();
    for (let i = 0; i < 3; i++) {
      expect(c.estado(i)).toBe('livre');
      expect(c.fracaoDaVida(i)).toBe(1);
      expect(c.injecao[i]).toBe(0);
    }
    expect(c.drenoDaRedePorS).toBe(0);
    expect(c.perdidos).toBe(0);
  });

  it('um andróide ligado injeta: metade da barra em 20 s, o cabo é TOMADO em 40 s e passa a drenar a rede da estação', () => {
    const c = new CabosDeDados();
    rodar(c, 20, [1, 0, 0]);
    expect(c.injecao[0]).toBeCloseTo(0.5, 1);
    expect(c.estado(0)).toBe('injetando');
    expect(c.estado(1)).toBe('livre'); // os outros cabos não sentem
    rodar(c, 21, [1, 0, 0]);
    expect(c.estado(0)).toBe('tomado');
    expect(c.injecao[0]).toBe(1);
    expect(c.drenoDaRedePorS).toBe(CABOS.drenoTomadoPorS);
    expect(c.perdidos).toBe(1);
  });

  it('três andróides ligados juntos tomam o cabo três vezes mais rápido; o quarto só faz companhia (teto de três)', () => {
    const tres = new CabosDeDados();
    rodar(tres, 14, [3, 0, 0]);
    expect(tres.estado(0)).toBe('tomado'); // 40 / 3 = 13,3 s
    const quatro = new CabosDeDados();
    rodar(quatro, 12, [4, 0, 0]);
    const tresEm12 = new CabosDeDados();
    rodar(tresEm12, 12, [3, 0, 0]);
    expect(quatro.injecao[0]).toBeCloseTo(tresEm12.injecao[0]!, 6);
  });

  it('a injeção recua sozinha em 25 s sem andróide ligado, e três vezes mais rápido com um defensor perto', () => {
    const sozinho = new CabosDeDados();
    rodar(sozinho, 20, [1, 0, 0]); // 0,5
    rodar(sozinho, 12.5, NINGUEM);
    expect(sozinho.injecao[0]).toBeCloseTo(0, 1);
    const defendido = new CabosDeDados();
    rodar(defendido, 20, [1, 0, 0]);
    rodar(defendido, 4.5, NINGUEM, NINGUEM, [1, 0, 0]);
    expect(defendido.injecao[0]).toBe(0);
    expect(defendido.estado(0)).toBe('livre');
  });

  it('um cabo TOMADO não se libera sozinho: sem defensor ele fica tomado pelo tempo que for', () => {
    const c = new CabosDeDados();
    rodar(c, 41, [1, 0, 0]);
    expect(c.estado(0)).toBe('tomado');
    rodar(c, 300, NINGUEM); // cinco minutos sem ninguém
    expect(c.estado(0)).toBe('tomado');
    expect(c.injecao[0]).toBe(1);
  });

  it('um defensor libera o cabo tomado em ~12 s, dois em ~6 s; com andróide ainda ligado não libera (primeiro se tira o andróide)', () => {
    const um = new CabosDeDados();
    rodar(um, 41, [1, 0, 0]);
    rodar(um, 11, NINGUEM, NINGUEM, [1, 0, 0]);
    expect(um.estado(0)).toBe('tomado'); // ainda não
    rodar(um, 2, NINGUEM, NINGUEM, [1, 0, 0]);
    expect(um.estado(0)).toBe('livre');
    expect(um.drenoDaRedePorS).toBe(0);

    const dois = new CabosDeDados();
    rodar(dois, 41, [1, 0, 0]);
    rodar(dois, 7, NINGUEM, NINGUEM, [2, 0, 0]);
    expect(dois.estado(0)).toBe('livre');

    const bloqueado = new CabosDeDados();
    rodar(bloqueado, 41, [1, 0, 0]);
    rodar(bloqueado, 30, [1, 0, 0], NINGUEM, [2, 0, 0]); // o andróide continua ligado
    expect(bloqueado.estado(0)).toBe('tomado');
  });

  it('o depredador (peso 1) corta o cabo em ~67 s; cortado drena a rede, e o andróide ligado a um cabo cortado não injeta', () => {
    const c = new CabosDeDados();
    rodar(c, 60, NINGUEM, [1, 0, 0]);
    expect(c.estado(0)).not.toBe('cortado');
    expect(c.fracaoDaVida(0)).toBeLessThan(0.2);
    rodar(c, 10, NINGUEM, [1, 0, 0]);
    expect(c.estado(0)).toBe('cortado');
    expect(c.vida[0]).toBe(0);
    expect(c.drenoDaRedePorS).toBe(CABOS.drenoCortadoPorS);
    rodar(c, 60, [3, 0, 0], NINGUEM); // andróides ligados num cabo cortado
    expect(c.injecao[0]).toBe(0);
    expect(c.estado(0)).toBe('cortado');
  });

  it('o conserto: um defensor dá 10 de vida por segundo, dois dão 20 (o teto), e o cabo cortado volta aos 25%', () => {
    const c = new CabosDeDados();
    rodar(c, 70, NINGUEM, [1, 0, 0]);
    expect(c.estado(0)).toBe('cortado');
    rodar(c, 9, NINGUEM, NINGUEM, [1, 0, 0]); // 90 de 400
    expect(c.estado(0)).toBe('cortado');
    rodar(c, 1.5, NINGUEM, NINGUEM, [1, 0, 0]); // passou de 100
    expect(c.estado(0)).toBe('livre');
    // três defensores contam como dois
    const tres = new CabosDeDados();
    const dois = new CabosDeDados();
    rodar(tres, 70, NINGUEM, [1, 0, 0]);
    rodar(dois, 70, NINGUEM, [1, 0, 0]);
    rodar(tres, 5, NINGUEM, NINGUEM, [3, 0, 0]);
    rodar(dois, 5, NINGUEM, NINGUEM, [2, 0, 0]);
    expect(tres.vida[0]).toBeCloseTo(dois.vida[0]!, 6);
    // o conserto para na vida cheia
    rodar(tres, 60, NINGUEM, NINGUEM, [2, 0, 0]);
    expect(tres.vida[0]).toBe(CABOS.vidaMax);
  });

  it('com um depredador em cima ninguém conserta: o defensor só conserta quando o cabo está livre de quem o depreda', () => {
    const c = new CabosDeDados();
    rodar(c, 10, NINGUEM, [1, 0, 0]);
    const antes = c.vida[0]!;
    rodar(c, 5, NINGUEM, [1, 0, 0], [2, 0, 0]);
    expect(c.vida[0]).toBeLessThan(antes); // o dano segue, o conserto não acontece
  });

  it('cada cabo é independente e o dreno da rede soma os tomados e os cortados', () => {
    const c = new CabosDeDados();
    rodar(c, 41, [1, 0, 0]); // cabo 0 tomado
    rodar(c, 70, NINGUEM, [0, 1, 0]); // cabo 1 cortado (o 0 segue tomado: ninguém o liberou)
    expect(c.estado(0)).toBe('tomado');
    expect(c.estado(1)).toBe('cortado');
    expect(c.estado(2)).toBe('livre');
    expect(c.perdidos).toBe(2);
    expect(c.drenoDaRedePorS).toBe(CABOS.drenoTomadoPorS + CABOS.drenoCortadoPorS);
  });

  it('missão nova (reset): os três inteiros e livres de novo', () => {
    const c = new CabosDeDados();
    rodar(c, 41, [1, 0, 0]);
    rodar(c, 70, NINGUEM, [0, 1, 0]);
    c.reset();
    for (let i = 0; i < 3; i++) expect(c.estado(i)).toBe('livre');
    expect(c.drenoDaRedePorS).toBe(0);
    expect(c.fracaoDaVida(1)).toBe(1);
  });

  it('é determinística e mantém as invariantes sob qualquer sequência: vida em [0, 400], injeção em [0, 1], estado coerente', () => {
    const roda = () => {
      const c = new CabosDeDados();
      const r = mulberry32(2026);
      for (let t = 0; t < 60 * 600; t++) {
        const mudou = t % 90 === 0;
        if (mudou) {
          r(); // a sequência avança igual nas duas rodadas
        }
        const a = [Math.floor(r() * 5), Math.floor(r() * 5), Math.floor(r() * 5)];
        const d = [r() < 0.2 ? Math.floor(r() * 3) : 0, r() < 0.2 ? Math.floor(r() * 3) : 0, r() < 0.2 ? 1.5 : 0];
        const f = [Math.floor(r() * 4), Math.floor(r() * 4), Math.floor(r() * 4)];
        c.fixedUpdate(DT, t % 600 < 300 ? a : NINGUEM, d, f);
        for (let i = 0; i < 3; i++) {
          expect(c.vida[i]).toBeGreaterThanOrEqual(0);
          expect(c.vida[i]).toBeLessThanOrEqual(CABOS.vidaMax);
          expect(c.injecao[i]).toBeGreaterThanOrEqual(0);
          expect(c.injecao[i]).toBeLessThanOrEqual(1);
          if (c.estado(i) === 'tomado') expect(c.injecao[i]).toBeGreaterThan(0);
          if (c.estado(i) === 'livre') expect(c.injecao[i]).toBe(0);
        }
      }
      return JSON.stringify([c.vida, c.injecao, [0, 1, 2].map((i) => c.estado(i))]);
    };
    expect(roda()).toBe(roda());
    // 2 rodadas de 36 mil ticks com ~650 mil `expect`: ~15 s sozinho e mais de 50 s com o conjunto inteiro em paralelo (o push de 19/10 reprovou aqui aos 30 s do padrão).
  }, 120_000);
});

describe('quem está perto de qual ponto de conexão', () => {
  it('devolve o cabo do ponto mais perto dentro do raio, ou -1', () => {
    for (let i = 0; i < 3; i++) {
      const p = PONTOS_DOS_CABOS[i]!;
      expect(caboDoPonto(p.x, p.z, CABOS.raioDaConexao)).toBe(i);
      expect(caboDoPonto(p.x + 1, p.z - 1, CABOS.raioDaConexao)).toBe(i);
    }
    expect(caboDoPonto(0, 0, CABOS.raioDaConexao)).toBe(-1);
    expect(caboDoPonto(PONTOS_DOS_CABOS[1]!.x, Z_DOS_PONTOS + 30, CABOS.raioDeReparo)).toBe(-1);
  });

  it('entre dois cabos (6 m de distância) vale o mais perto, não o primeiro da lista', () => {
    expect(caboDoPonto(PONTOS_DOS_CABOS[1]!.x - 2, Z_DOS_PONTOS, CABOS.raioDeDano)).toBe(1);
    expect(caboDoPonto(PONTOS_DOS_CABOS[1]!.x + 2, Z_DOS_PONTOS, CABOS.raioDeDano)).toBe(1);
    expect(caboDoPonto(PONTOS_DOS_CABOS[1]!.x + 4, Z_DOS_PONTOS, CABOS.raioDeDano)).toBe(2);
  });

  it('num empate exato entre dois pontos (3 m de cada) vale o de menor índice, sempre o mesmo', () => {
    const meio = (PONTOS_DOS_CABOS[1]!.x + PONTOS_DOS_CABOS[2]!.x) / 2;
    expect(caboDoPonto(meio, Z_DOS_PONTOS, CABOS.raioDeReparo)).toBe(1);
    expect(caboDoPonto(meio, Z_DOS_PONTOS, CABOS.raioDeReparo)).toBe(1);
  });

  it('só o nome ANDR-… é andróide', () => {
    expect(ehAndroide('ANDR-07')).toBe(true);
    expect(ehAndroide('COLOSSUS-01')).toBe(false);
    expect(ehAndroide('VECTOR-09')).toBe(false);
  });
});
