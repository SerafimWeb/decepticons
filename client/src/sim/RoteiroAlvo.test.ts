import { describe, expect, it } from 'vitest';
import { type BotSpec, ESQUADRAO_VERSAO, type EsquadraoSpec } from './esquadrao';
import { chaveDoRoteiro, lerChaveDoRoteiro, posicaoNoSistema, ROTEIRO_VERSAO, sanearBatida, sanearRoteiro, type RoteiroSpec } from './Roteiro';

/**
 * A ordem de UM robô (P290, ordem do Comandante em 30/10: "o menu do wargame tá muito cru, não sei qual mech vai em cada ponto"): a batida pode dizer qual robô do lado recebe a ordem (a posição dele na lista
 * da tela ESQUADRÃO), em vez do lado inteiro. O contrato: saneamento, link, e a conta de onde o robô fica no sistema de bots.
 */

const mech = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'mech', ...extra });
const esq = (inimigos: BotSpec[], aliados: BotSpec[] = []): EsquadraoSpec => ({ v: ESQUADRAO_VERSAO, inimigos, aliados });
const ordem = { tipo: 'hold', ponto: { x: 10, z: -20 } } as const;
const roteiro = (esquadrao: EsquadraoSpec, beats: RoteiroSpec['beats']): RoteiroSpec => ({ v: ROTEIRO_VERSAO, mapa: 'arena', esquadrao, beats });

describe('posicaoNoSistema: onde o robô da lista fica em BotSystem.mechs (Mechs, andróides, técnicos)', () => {
  const lista = [{ papel: 'android' } as BotSpec, mech(), { papel: 'technician' } as BotSpec, mech({ chassi: 'onca' }), { papel: 'android' } as BotSpec];

  it('os Mechs vêm primeiro (na ordem da lista), depois os andróides: a ordem da lista não é a do sistema', () => {
    expect(posicaoNoSistema(lista, 1)).toBe(0); // o 1º Mech
    expect(posicaoNoSistema(lista, 3)).toBe(1); // o 2º Mech
    expect(posicaoNoSistema(lista, 0)).toBe(2); // o 1º andróide, depois dos 2 Mechs
    expect(posicaoNoSistema(lista, 4)).toBe(3); // o 2º andróide
  });

  it('o técnico não recebe ordem, e um índice fora da lista não existe', () => {
    expect(posicaoNoSistema(lista, 2)).toBeNull();
    expect(posicaoNoSistema(lista, 5)).toBeNull();
    expect(posicaoNoSistema(lista, -1)).toBeNull();
  });
});

describe('a batida com alvo', () => {
  it('guarda o alvo junto de lado e ordem; sem lado e ordem, o alvo não existe (nada a mirar)', () => {
    expect(sanearBatida({ tick: 0, lado: 'inimigo', alvo: 2, ordem })?.alvo).toBe(2);
    expect(sanearBatida({ tick: 0, alvo: 2, legenda: { texto: 'oi', duracaoS: 2 } })?.alvo).toBeUndefined();
  });

  it('recusa o que não é um índice (negativo, quebrado, texto, enorme)', () => {
    for (const ruim of [-1, 1.5, '2', NaN, 64, 9e9, null]) expect(sanearBatida({ tick: 0, lado: 'inimigo', alvo: ruim, ordem })?.alvo, String(ruim)).toBeUndefined();
  });
});

describe('o roteiro com alvos', () => {
  it('o alvo que existe e pode receber ordem fica; o que não existe, ou é técnico, volta a valer para o lado inteiro', () => {
    const e = esq([mech(), mech(), { papel: 'technician' }], [mech()]);
    const r = sanearRoteiro(
      roteiro(e, [
        { tick: 0, lado: 'inimigo', alvo: 1, ordem },
        { tick: 60, lado: 'inimigo', alvo: 2, ordem }, // técnico
        { tick: 120, lado: 'inimigo', alvo: 7, ordem }, // não existe
        { tick: 180, lado: 'aliado', alvo: 0, ordem },
        { tick: 240, lado: 'aliado', alvo: 1, ordem }, // o aliado só tem 1
      ]),
    );
    expect(r.beats.map((b) => b.alvo)).toEqual([1, undefined, undefined, 0, undefined]);
    expect(r.beats.every((b) => b.lado && b.ordem)).toBe(true); // as ordens continuam
  });

  it('ida e volta pelo link: o alvo sai igual e o link antigo (sem alvo) segue igual', () => {
    const e = esq([mech(), mech({ chassi: 'onca' })], [mech()]);
    const r = roteiro(e, [
      { tick: 0, lado: 'inimigo', alvo: 1, ordem },
      { tick: 60, lado: 'aliado', ordem: { tipo: 'follow', ponto: { x: -5, z: 5 } } },
    ]);
    const chave = chaveDoRoteiro(r);
    expect(chave).toMatch(/t0:li:a1:oh10,-20/);
    expect(chave).toMatch(/t60:la:of-5,5/); // sem alvo, sem letra nova
    expect(lerChaveDoRoteiro(chave)).toEqual(r);
  });

  it('o link recusa o texto inteiro com um alvo torto', () => {
    const e = esq([mech()]);
    const chave = chaveDoRoteiro(roteiro(e, [{ tick: 0, lado: 'inimigo', alvo: 0, ordem }]));
    expect(lerChaveDoRoteiro(chave)).not.toBeNull();
    for (const ruim of [chave.replace(':a0:', ':a-1:'), chave.replace(':a0:', ':ax:'), chave.replace(':a0:', ':a1.5:'), chave.replace(':a0:', ':a99:')]) {
      expect(lerChaveDoRoteiro(ruim), ruim).toBeNull();
    }
  });

  it('um link com alvo que o esquadrão do link não tem não deixa a batida sem dono: vira a ordem do lado', () => {
    const e = esq([mech()]);
    const chave = chaveDoRoteiro(roteiro(e, [{ tick: 0, lado: 'inimigo', alvo: 0, ordem }])).replace(':a0:', ':a5:');
    expect(lerChaveDoRoteiro(chave)?.beats[0]).toEqual({ tick: 0, lado: 'inimigo', ordem });
  });
});
