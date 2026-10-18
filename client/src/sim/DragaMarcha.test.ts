import { describe, expect, it } from 'vitest';
import { MOBILIDADE_RASTEJANDO } from '../entities/MechBase';
import { AMAZONIA_ALDEIA, AMAZONIA_DRAGA_INICIO_X, larguraDoRio, rioEmX } from '../environment/AmazoniaLayout';
import {
  AVISOS_DA_MARCHA_M,
  avisoDaMarcha,
  chegouAAldeia,
  DISTANCIA_DA_MARCHA_M,
  distanciaAteAAldeia,
  escalaDaMarcha,
  LINHA_DA_ALDEIA_X,
  marchaFromSearch,
  MARCHA_INICIAL_MAXIMA,
  posicaoNaMarcha,
  MIRA_NO_RIO_M,
  pernasCaidas,
  type PernasCaidas,
  pontoDoRio,
  progressoDaMarcha,
  rumoPara,
  tempoAteAAldeiaS,
  VELOCIDADE_DA_MARCHA_MS,
} from './DragaMarcha';

describe('a marcha do Draga-01 (P180, parte C): a linha da aldeia e a distância', () => {
  it('a linha fica a 90 m das últimas casas da aldeia (a maloca grande está a 70 m do centro), e o Draga tem 1.550 m de rio pela frente', () => {
    expect(LINHA_DA_ALDEIA_X).toBe(AMAZONIA_ALDEIA.x + AMAZONIA_ALDEIA.raio + 90);
    expect(LINHA_DA_ALDEIA_X).toBeGreaterThan(AMAZONIA_ALDEIA.x + AMAZONIA_ALDEIA.raio);
    expect(DISTANCIA_DA_MARCHA_M).toBe(AMAZONIA_DRAGA_INICIO_X - LINHA_DA_ALDEIA_X);
    expect(DISTANCIA_DA_MARCHA_M).toBe(1550);
  });

  it('a missão dura uns 10 minutos de pernas inteiras (nem curta demais para a luta, nem longa demais para a fase)', () => {
    const minutos = DISTANCIA_DA_MARCHA_M / VELOCIDADE_DA_MARCHA_MS / 60;
    expect(minutos).toBeGreaterThan(8);
    expect(minutos).toBeLessThan(12);
    expect(tempoAteAAldeiaS(AMAZONIA_DRAGA_INICIO_X, true, true, true)).toBeCloseTo(DISTANCIA_DA_MARCHA_M / VELOCIDADE_DA_MARCHA_MS, 9);
  });

  it('a distância até a aldeia cai a cada metro andado, nunca fica negativa, e número torto conta como a marcha toda', () => {
    expect(distanciaAteAAldeia(AMAZONIA_DRAGA_INICIO_X)).toBe(DISTANCIA_DA_MARCHA_M);
    expect(distanciaAteAAldeia(AMAZONIA_DRAGA_INICIO_X - 100)).toBe(DISTANCIA_DA_MARCHA_M - 100);
    expect(distanciaAteAAldeia(LINHA_DA_ALDEIA_X)).toBe(0);
    expect(distanciaAteAAldeia(LINHA_DA_ALDEIA_X - 500)).toBe(0);
    expect(distanciaAteAAldeia(NaN)).toBe(DISTANCIA_DA_MARCHA_M);
    expect(distanciaAteAAldeia(Infinity)).toBe(DISTANCIA_DA_MARCHA_M);
  });

  it('o progresso vai de 0 na largada a 1 na linha, e passar da linha não passa de 1; antes da largada não passa de 0', () => {
    expect(progressoDaMarcha(AMAZONIA_DRAGA_INICIO_X)).toBe(0);
    expect(progressoDaMarcha(AMAZONIA_DRAGA_INICIO_X + 400)).toBe(0);
    expect(progressoDaMarcha(LINHA_DA_ALDEIA_X)).toBe(1);
    expect(progressoDaMarcha(LINHA_DA_ALDEIA_X - 300)).toBe(1);
    expect(progressoDaMarcha((AMAZONIA_DRAGA_INICIO_X + LINHA_DA_ALDEIA_X) / 2)).toBeCloseTo(0.5, 9);
    let anterior = -1;
    for (let x = AMAZONIA_DRAGA_INICIO_X; x >= LINHA_DA_ALDEIA_X; x -= 50) {
      const p = progressoDaMarcha(x);
      expect(p).toBeGreaterThanOrEqual(anterior);
      anterior = p;
    }
  });

  it('chegar é cruzar a linha (x menor ou igual), e NaN nunca chega (um número torto não perde a missão)', () => {
    expect(chegouAAldeia(LINHA_DA_ALDEIA_X + 0.01)).toBe(false);
    expect(chegouAAldeia(LINHA_DA_ALDEIA_X)).toBe(true);
    expect(chegouAAldeia(LINHA_DA_ALDEIA_X - 5)).toBe(true);
    expect(chegouAAldeia(NaN)).toBe(false);
    expect(chegouAAldeia(Infinity)).toBe(false);
    expect(chegouAAldeia(-Infinity)).toBe(false);
  });
});

describe('a marcha do Draga-01 (P180, parte C): para onde ele olha', () => {
  it('o ponto do rio fica 70 m rio acima (x menor), exatamente sobre o eixo do rio, e dentro da água', () => {
    const p = { x: 0, z: 0 };
    for (let x = AMAZONIA_DRAGA_INICIO_X; x > LINHA_DA_ALDEIA_X; x -= 53) {
      pontoDoRio(x, p);
      expect(p.x).toBe(x - MIRA_NO_RIO_M);
      expect(p.z).toBe(rioEmX(p.x));
      expect(Math.abs(p.z - rioEmX(p.x))).toBeLessThan(larguraDoRio(p.x) / 2);
    }
  });

  it('escreve no objeto que recebe e o devolve (G4: sem alocar por tick)', () => {
    const out = { x: 0, z: 0 };
    expect(pontoDoRio(100, out)).toBe(out);
  });

  it('o rumo segue a convenção do Mech: olhar para -Z é 0, para -X (rio acima, oeste) é +π/2, para +X é -π/2, para +Z é ±π', () => {
    expect(rumoPara(0, -1)).toBeCloseTo(0, 12);
    expect(rumoPara(-1, 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(rumoPara(1, 0)).toBeCloseTo(-Math.PI / 2, 12);
    expect(Math.abs(rumoPara(0, 1))).toBeCloseTo(Math.PI, 12);
    expect(rumoPara(0, 0)).toBe(0);
    expect(rumoPara(-30, -30)).toBeCloseTo(Math.PI / 4, 12);
  });

  it('descer o rio de verdade leva o Draga para o oeste: o rumo para o ponto do rio fica perto de +π/2 (a favor da correnteza ele andaria para -π/2)', () => {
    const p = { x: 0, z: 0 };
    for (let x = AMAZONIA_DRAGA_INICIO_X; x > LINHA_DA_ALDEIA_X + 100; x -= 41) {
      pontoDoRio(x, p);
      const r = rumoPara(p.x - x, p.z - rioEmX(x));
      expect(r).toBeGreaterThan(Math.PI / 2 - 0.9);
      expect(r).toBeLessThan(Math.PI / 2 + 0.9);
    }
  });
});

describe('a marcha do Draga-01 (P180, parte C): a velocidade com as pernas caídas', () => {
  it('é a mesma regra do MechBase.mobility: inteiro 1, manco 0,5 (de qualquer lado), parado 0 e rastejando 30%', () => {
    expect(escalaDaMarcha(true, true, true)).toBe(1);
    expect(escalaDaMarcha(true, false, true)).toBe(0.5);
    expect(escalaDaMarcha(false, true, true)).toBe(0.5);
    expect(escalaDaMarcha(false, false, false)).toBe(0);
    expect(escalaDaMarcha(false, false, true)).toBe(MOBILIDADE_RASTEJANDO);
    expect(MOBILIDADE_RASTEJANDO).toBe(0.3);
  });

  it('o tempo até a aldeia cresce a cada perna caída (dobra com uma, passa de três vezes com as duas) e fica infinito se ele não anda', () => {
    const x = AMAZONIA_DRAGA_INICIO_X;
    const inteiro = tempoAteAAldeiaS(x, true, true, true);
    const manco = tempoAteAAldeiaS(x, true, false, true);
    const rasteja = tempoAteAAldeiaS(x, false, false, true);
    expect(manco).toBeCloseTo(inteiro * 2, 9);
    expect(rasteja).toBeCloseTo(inteiro / 0.3, 9);
    expect(rasteja).toBeGreaterThan(manco);
    expect(tempoAteAAldeiaS(x, false, false, false)).toBe(Infinity);
    expect(tempoAteAAldeiaS(LINHA_DA_ALDEIA_X, true, true, true)).toBe(0);
  });
});

describe('a marcha do Draga-01 (P180, parte C): as quatro pernas do desenho a partir dos dois módulos da regra', () => {
  const o: PernasCaidas = { fl: 0, fr: 0, rl: 0, rr: 0 };

  it('de pé (vida cheia nos dois lados) nenhuma perna está caída, e com os dois módulos zerados as quatro estão', () => {
    expect(pernasCaidas(1, 1, o)).toEqual({ fl: 0, fr: 0, rl: 0, rr: 0 });
    expect(pernasCaidas(0, 0, o)).toEqual({ fl: 1, fr: 1, rl: 1, rr: 1 });
  });

  it('a perna da FRENTE cai primeiro: com o módulo na metade a dianteira já está caída e a traseira ainda de pé', () => {
    pernasCaidas(0.5, 1, o);
    expect(o.fl).toBe(1);
    expect(o.rl).toBe(0);
    expect(o.fr).toBe(0);
    expect(o.rr).toBe(0);
    pernasCaidas(0.75, 1, o);
    expect(o.fl).toBeCloseTo(0.5, 12);
    expect(o.rl).toBe(0);
  });

  it('cada lado é independente: a esquerda é fl e rl, a direita é fr e rr', () => {
    pernasCaidas(0.25, 1, o);
    expect(o.fl).toBe(1);
    expect(o.rl).toBeCloseTo(0.5, 12);
    expect(o.fr + o.rr).toBe(0);
    pernasCaidas(1, 0.25, o);
    expect(o.fr).toBe(1);
    expect(o.rr).toBeCloseTo(0.5, 12);
    expect(o.fl + o.rl).toBe(0);
  });

  it('é monótona (mais dano, mais caída), fica entre 0 e 1, e dado torto (NaN, fora de 0 a 1) não envenena o desenho', () => {
    let a = -1;
    let b = -1;
    for (let v = 1; v >= 0; v -= 0.05) {
      pernasCaidas(v, v, o);
      expect(o.fl).toBeGreaterThanOrEqual(a);
      expect(o.rl).toBeGreaterThanOrEqual(b);
      a = o.fl;
      b = o.rl;
      for (const n of [o.fl, o.fr, o.rl, o.rr]) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
    pernasCaidas(NaN, 2, o);
    for (const n of [o.fl, o.fr, o.rl, o.rr]) expect(Number.isFinite(n)).toBe(true);
    expect(pernasCaidas(-5, 7, o)).toEqual({ fl: 1, rl: 1, fr: 0, rr: 0 });
  });

  it('escreve no objeto que recebe e o devolve (G4)', () => {
    expect(pernasCaidas(1, 1, o)).toBe(o);
  });
});

describe('a marcha do Draga-01 (P180, parte C): os avisos de aproximação', () => {
  it('avisa ao cruzar 1.000, 500, 250 e 100 m da aldeia, e só ao aproximar; antes da primeira distância e depois de cruzada, nada', () => {
    expect([...AVISOS_DA_MARCHA_M]).toEqual([1000, 500, 250, 100]);
    expect(avisoDaMarcha(1001, 999)).toBe('O DRAGA ESTÁ A 1000 m DA ALDEIA');
    expect(avisoDaMarcha(501, 500)).toBe('O DRAGA ESTÁ A 500 m DA ALDEIA');
    expect(avisoDaMarcha(251, 250)).toBe('O DRAGA ESTÁ A 250 m DA ALDEIA');
    expect(avisoDaMarcha(101, 100)).toBe('O DRAGA ESTÁ ÀS PORTAS DA ALDEIA');
    expect(avisoDaMarcha(1500, 1400)).toBeNull();
    expect(avisoDaMarcha(999, 998)).toBeNull(); // já tinha cruzado
    expect(avisoDaMarcha(999, 1001)).toBeNull(); // voltar não avisa
    expect(avisoDaMarcha(1000, 1000)).toBeNull();
  });

  it('num salto que cruza mais de uma distância vale a mais grave (a menor), e dado torto nunca avisa', () => {
    expect(avisoDaMarcha(1200, 400)).toBe('O DRAGA ESTÁ A 500 m DA ALDEIA');
    expect(avisoDaMarcha(1200, 50)).toBe('O DRAGA ESTÁ ÀS PORTAS DA ALDEIA');
    expect(avisoDaMarcha(NaN, 300)).toBeNull();
    expect(avisoDaMarcha(600, NaN)).toBeNull();
    expect(avisoDaMarcha(Infinity, 600)).toBeNull();
  });

  it('ao andar a marcha toda dá os quatro avisos, uma vez cada, em ordem', () => {
    const ouvidos: string[] = [];
    let antes = DISTANCIA_DA_MARCHA_M;
    for (let x = AMAZONIA_DRAGA_INICIO_X; x >= LINHA_DA_ALDEIA_X; x -= 2.6 / 60) {
      const d = distanciaAteAAldeia(x);
      const a = avisoDaMarcha(antes, d);
      if (a) ouvidos.push(a);
      antes = d;
    }
    expect(ouvidos).toEqual(['O DRAGA ESTÁ A 1000 m DA ALDEIA', 'O DRAGA ESTÁ A 500 m DA ALDEIA', 'O DRAGA ESTÁ A 250 m DA ALDEIA', 'O DRAGA ESTÁ ÀS PORTAS DA ALDEIA']);
  });
});

describe('a marcha do Draga-01 (P180, parte C): ?marcha= começa a missão com o Draga já andado', () => {
  it('a posição vai da largada (0) até a linha da aldeia (1), e o teto de 95% nunca o põe na linha', () => {
    expect(posicaoNaMarcha(0)).toBe(AMAZONIA_DRAGA_INICIO_X);
    expect(posicaoNaMarcha(0.5)).toBeCloseTo((AMAZONIA_DRAGA_INICIO_X + LINHA_DA_ALDEIA_X) / 2, 9);
    expect(posicaoNaMarcha(MARCHA_INICIAL_MAXIMA)).toBeCloseTo(AMAZONIA_DRAGA_INICIO_X - 0.95 * DISTANCIA_DA_MARCHA_M, 9);
    expect(posicaoNaMarcha(1)).toBe(posicaoNaMarcha(MARCHA_INICIAL_MAXIMA));
    expect(posicaoNaMarcha(7)).toBe(posicaoNaMarcha(MARCHA_INICIAL_MAXIMA));
    expect(chegouAAldeia(posicaoNaMarcha(1))).toBe(false); // nasce ainda longe (77 m) da linha: dá para jogar
    expect(posicaoNaMarcha(-0.3)).toBe(AMAZONIA_DRAGA_INICIO_X);
    expect(posicaoNaMarcha(NaN)).toBe(AMAZONIA_DRAGA_INICIO_X);
    expect(posicaoNaMarcha(Infinity)).toBe(AMAZONIA_DRAGA_INICIO_X);
  });

  it('o ?marcha= do link vale de 0 a 0,95; sem ele, vazio ou com lixo, é a largada', () => {
    expect(marchaFromSearch('')).toBe(0);
    expect(marchaFromSearch('?mapa=amazonia&modo=survival')).toBe(0);
    expect(marchaFromSearch('?marcha=0.8')).toBe(0.8);
    expect(marchaFromSearch('?modo=survival&marcha=0.25&mapa=amazonia')).toBe(0.25);
    expect(marchaFromSearch('?marcha=2')).toBe(MARCHA_INICIAL_MAXIMA);
    expect(marchaFromSearch('?marcha=-1')).toBe(0);
    for (const ruim of ['?marcha=', '?marcha=%20', '?marcha=abc', '?marcha=NaN', '?marcha=Infinity']) expect(marchaFromSearch(ruim), ruim).toBe(0);
  });
});
