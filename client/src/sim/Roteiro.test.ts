import { describe, expect, it } from 'vitest';
import { esquadraoPadrao } from './esquadrao';
import {
  chaveDoRoteiro,
  lerChaveDoRoteiro,
  LIMITES_DO_ROTEIRO,
  PARAM_DO_ROTEIRO,
  roteiroDoLink,
  roteiroPadrao,
  ROTEIRO_VERSAO,
  RoteiroStepper,
  sanearBatida,
  sanearRoteiro,
  type BeatDoRoteiro,
  type RoteiroSpec,
} from './Roteiro';

const batida = (tick: number, extra: Partial<BeatDoRoteiro> = {}): BeatDoRoteiro => ({ tick, ...extra });

describe('RoteiroStepper (G4/G5: zero alocação fora das batidas de verdade)', () => {
  it('não dispara nada antes do tick certo, e dispara na hora', () => {
    const stepper = new RoteiroStepper([batida(10), batida(20)]);
    for (let n = 0; n < 10; n++) expect(stepper.tick(n)).toEqual([]);
    expect(stepper.tick(10).map((b) => b.tick)).toEqual([10]);
    for (let n = 11; n < 20; n++) expect(stepper.tick(n)).toEqual([]);
    expect(stepper.tick(20).map((b) => b.tick)).toEqual([20]);
    expect(stepper.tick(21)).toEqual([]);
  });

  it('dispara cada batida uma vez só, mesmo chamando o mesmo tick de novo por engano', () => {
    const stepper = new RoteiroStepper([batida(5)]);
    expect(stepper.tick(5).length).toBe(1);
    expect(stepper.tick(5)).toEqual([]); // já passou do cursor
    expect(stepper.tick(6)).toEqual([]);
  });

  it('várias batidas no mesmo tick disparam juntas, em ordem', () => {
    const stepper = new RoteiroStepper([batida(3, { legenda: { texto: 'A', duracaoS: 2 } }), batida(3, { legenda: { texto: 'B', duracaoS: 2 } })]);
    const disparadas = stepper.tick(3);
    expect(disparadas.map((b) => b.legenda?.texto)).toEqual(['A', 'B']);
  });

  it('a lista não precisa vir ordenada: o stepper ordena por tick', () => {
    const stepper = new RoteiroStepper([batida(20), batida(10)]);
    expect(stepper.tick(10).map((b) => b.tick)).toEqual([10]);
    expect(stepper.tick(20).map((b) => b.tick)).toEqual([20]);
  });

  it('devolve a MESMA referência vazia quando não há batida (zero alocação por tick)', () => {
    const stepper = new RoteiroStepper([batida(5)]);
    const a = stepper.tick(0);
    const b = stepper.tick(1);
    expect(a).toBe(b);
  });

  it('sem nenhuma batida, nunca dispara nada', () => {
    const stepper = new RoteiroStepper([]);
    expect(stepper.tick(0)).toEqual([]);
    expect(stepper.tick(1000)).toEqual([]);
  });
});

describe('sanearBatida', () => {
  it('recusa o que não é objeto, ou sem tick válido', () => {
    expect(sanearBatida(null)).toBeNull();
    expect(sanearBatida('x')).toBeNull();
    expect(sanearBatida({})).toBeNull();
    expect(sanearBatida({ tick: -1 })).toBeNull();
    expect(sanearBatida({ tick: NaN })).toBeNull();
  });

  it('uma batida só com tick, sem ordem/legenda/câmera, não serve para nada: vira null', () => {
    expect(sanearBatida({ tick: 10 })).toBeNull();
  });

  it('ordem sem lado (ou lado sem ordem) some dos dois: a ordem não se aplica a ninguém sozinha', () => {
    expect(sanearBatida({ tick: 10, ordem: { tipo: 'hold', ponto: { x: 1, z: 2 } } })?.ordem).toBeUndefined();
    expect(sanearBatida({ tick: 10, lado: 'inimigo' })?.lado).toBeUndefined();
  });

  it('lado + ordem válidos sobrevivem, com o ponto arredondado a 1 casa', () => {
    const b = sanearBatida({ tick: 10, lado: 'aliado', ordem: { tipo: 'follow', ponto: { x: 1.23456, z: -8.01 } } });
    expect(b).toEqual({ tick: 10, lado: 'aliado', ordem: { tipo: 'follow', ponto: { x: 1.2, z: -8 } } });
  });

  it('ordem com tipo inválido, ou ponto fora do quadrado, é recusada', () => {
    expect(sanearBatida({ tick: 10, lado: 'inimigo', ordem: { tipo: 'charge', ponto: { x: 0, z: 0 } } })?.ordem).toBeUndefined();
    expect(sanearBatida({ tick: 10, lado: 'inimigo', ordem: { tipo: 'hold', ponto: { x: 9999, z: 0 } } })?.ordem).toBeUndefined();
  });

  it('legenda: corta no tamanho, remove tags, e a duração entra nos limites', () => {
    const longa = 'x'.repeat(300);
    const b = sanearBatida({ tick: 0, legenda: { texto: `<b>${longa}</b>`, duracaoS: 999 } });
    expect(b?.legenda?.texto.length).toBeLessThanOrEqual(140);
    expect(b?.legenda?.texto).not.toContain('<');
    expect(b?.legenda?.duracaoS).toBe(LIMITES_DO_ROTEIRO.duracaoMax);
  });

  it('câmera fixa ou de Mech, cada uma com os campos certos', () => {
    expect(sanearBatida({ tick: 0, camera: { modo: 'fixa', indice: 2 } })?.camera).toEqual({ modo: 'fixa', indice: 2 });
    expect(sanearBatida({ tick: 0, camera: { modo: 'mech', lado: 'inimigo', ordinal: 1 } })?.camera).toEqual({ modo: 'mech', lado: 'inimigo', ordinal: 1 });
    expect(sanearBatida({ tick: 0, camera: { modo: 'mech', lado: 'x', ordinal: 1 } })?.camera).toBeUndefined();
  });
});

describe('sanearRoteiro', () => {
  it('o que não é roteiro (versão errada, mapa inválido) vira o padrão', () => {
    expect(sanearRoteiro(null)).toEqual(roteiroPadrao());
    expect(sanearRoteiro({ v: 2 })).toEqual(roteiroPadrao());
    expect(sanearRoteiro({ v: ROTEIRO_VERSAO, mapa: 'lua' })).toEqual(roteiroPadrao());
  });

  it('as batidas saem ordenadas por tick, e o excesso é cortado do fim', () => {
    const beats = Array.from({ length: LIMITES_DO_ROTEIRO.beats + 5 }, (_, i) => batida(LIMITES_DO_ROTEIRO.beats - i, { legenda: { texto: String(i), duracaoS: 1 } }));
    const r = sanearRoteiro({ v: ROTEIRO_VERSAO, mapa: 'arena', esquadrao: esquadraoPadrao(), beats });
    expect(r.beats.length).toBe(LIMITES_DO_ROTEIRO.beats);
    expect(r.beats.map((b) => b.tick)).toEqual([...r.beats].sort((a, b) => a.tick - b.tick).map((b) => b.tick));
  });

  it('batidas inválidas são descartadas, não travam o roteiro inteiro', () => {
    const r = sanearRoteiro({ v: ROTEIRO_VERSAO, mapa: 'arena', esquadrao: esquadraoPadrao(), beats: [null, { tick: 5, legenda: { texto: 'ok', duracaoS: 2 } }, 'lixo'] });
    expect(r.beats).toEqual([{ tick: 5, legenda: { texto: 'ok', duracaoS: 2 } }]);
  });
});

describe('o link ?wargame=', () => {
  it('ida e volta: um roteiro com batidas de cada tipo sobrevive ao link', () => {
    const spec: RoteiroSpec = {
      v: ROTEIRO_VERSAO,
      nome: 'EPISÓDIO 1',
      mapa: 'arena',
      esquadrao: esquadraoPadrao(),
      beats: [
        { tick: 0, lado: 'inimigo', ordem: { tipo: 'hold', ponto: { x: -12, z: 8.5 } } },
        { tick: 0, lado: 'aliado', ordem: { tipo: 'follow', ponto: { x: 0, z: 0 } } },
        { tick: 120, legenda: { texto: 'O ataque começa', duracaoS: 4 } },
        { tick: 120, camera: { modo: 'fixa', indice: 1 } },
        { tick: 600, camera: { modo: 'mech', lado: 'aliado', ordinal: 2 } },
      ],
    };
    const chave = chaveDoRoteiro(spec);
    expect(lerChaveDoRoteiro(chave)).toEqual(sanearRoteiro(spec));
  });

  it('texto que não é um roteiro (versão errada, pedaço faltando, esquadrão torto) vira null — nada pela metade', () => {
    expect(lerChaveDoRoteiro('lixo')).toBeNull();
    expect(lerChaveDoRoteiro('w1~a~-')).toBeNull(); // falta o esquadrão
    expect(lerChaveDoRoteiro('w2~a~-~q1.-.-')).toBeNull(); // versão errada
    expect(lerChaveDoRoteiro(`w${ROTEIRO_VERSAO}~a~-~lixo`)).toBeNull(); // esquadrão inválido
  });

  it('roteiroDoLink lê o parâmetro da URL, e null sem ele', () => {
    const chave = chaveDoRoteiro(roteiroPadrao());
    expect(roteiroDoLink(`?${PARAM_DO_ROTEIRO}=${encodeURIComponent(chave)}`)).toEqual(roteiroPadrao());
    expect(roteiroDoLink('?nada=1')).toBeNull();
  });

  it('o roteiro padrão (sem batida) também faz ida e volta pelo link', () => {
    const chave = chaveDoRoteiro(roteiroPadrao());
    expect(lerChaveDoRoteiro(chave)).toEqual(roteiroPadrao());
  });
});
