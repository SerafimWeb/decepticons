import { describe, expect, it } from 'vitest';
import { armasDoExtraDoBot, type BotSpec, ESQUADRAO_VERSAO, type EsquadraoSpec, limitesDoMapa, resumoDoEsquadrao } from '../sim/esquadrao';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { descreverBot, EsquadraoEditor, nomeDaArma } from './esquadraoEditor';

/**
 * O editor do esquadrão com os encaixes extras e o corpo único (P288): a ficha do robô oferece os mesmos chassis do Hangar (e o andróide e o técnico na mesma lista) e os mesmos encaixes de arma
 * (costas e ombros), e cada troca passa pelo contrato.
 */

const mech = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'mech', ...extra });
const esq = (inimigos: BotSpec[], aliados: BotSpec[] = []): EsquadraoSpec => ({ v: ESQUADRAO_VERSAO, inimigos, aliados });
const ARMA = armasDoExtraDoBot('onca', 'rightShoulder')[0]!;
const OUTRA = armasDoExtraDoBot('onca', 'rightShoulder').at(-1)!;

describe('editor do esquadrão: encaixes extras', () => {
  it('põe a arma no ombro do Onça com o nível 0, troca o nível sem mudar a arma e esvazia o encaixe', () => {
    const e = new EsquadraoEditor(esq([mech({ chassi: 'onca' })]));
    e.editarExtra('inimigo', 0, 'rightShoulder', ARMA);
    expect(e.lista('inimigo')[0]!.extras).toEqual({ rightShoulder: { id: ARMA, tier: 0 } });
    e.editarNivelExtra('inimigo', 0, 'rightShoulder', 2);
    expect(e.lista('inimigo')[0]!.extras).toEqual({ rightShoulder: { id: ARMA, tier: 2 } });
    e.editarExtra('inimigo', 0, 'rightShoulder', OUTRA); // outra arma no mesmo encaixe: o nível fica
    expect(e.lista('inimigo')[0]!.extras).toEqual({ rightShoulder: { id: OUTRA, tier: 2 } });
    e.editarExtra('inimigo', 0, 'rightShoulder', null);
    expect(e.lista('inimigo')[0]!.extras).toBeUndefined();
  });

  it('um encaixe que o chassi não tem é recusado pelo contrato (costas no Onça, ombro no Vector-09)', () => {
    const e = new EsquadraoEditor(esq([mech({ chassi: 'onca' }), mech()]));
    e.editarExtra('inimigo', 0, 'back', ARMA);
    e.editarExtra('inimigo', 1, 'rightShoulder', ARMA);
    expect(e.lista('inimigo')[0]!.extras).toBeUndefined();
    expect(e.lista('inimigo')[1]!.extras).toBeUndefined();
  });

  it('trocar o chassi larga os extras que o novo não tem, e o esquadrão devolvido é uma cópia funda', () => {
    const e = new EsquadraoEditor(esq([mech({ chassi: 'onca', extras: { rightShoulder: { id: ARMA, tier: 1 } } })]));
    const copia = e.esquadrao;
    copia.inimigos[0]!.extras!.rightShoulder!.tier = 0; // mexer na cópia não mexe no editor
    expect(e.lista('inimigo')[0]!.extras!.rightShoulder!.tier).toBe(1);
    expect(e.trocarCorpo('inimigo', 0, 'vector09')).toBeNull();
    expect(e.lista('inimigo')[0]!.extras).toBeUndefined();
  });

  it('a linha da lista diz a arma de cada encaixe extra (ombro D, ombro E, costas)', () => {
    const bot = mech({ chassi: 'onca', extras: { rightShoulder: { id: ARMA, tier: 2 }, leftShoulder: { id: OUTRA, tier: 0 } } });
    const { linha } = descreverBot(bot, 'inimigo', 0, DEFAULT_SETTINGS.names);
    expect(linha).toContain(`ombro D ${nomeDaArma(ARMA, 2)}`);
    expect(linha).toContain(`ombro E ${nomeDaArma(OUTRA, 0)}`);
    expect(descreverBot(mech({ chassi: 'onca' }), 'inimigo', 0, DEFAULT_SETTINGS.names).linha).not.toContain('ombro');
  });

  it('duplicar leva os extras do robô (e a cópia não divide objeto com ele)', () => {
    const e = new EsquadraoEditor(esq([mech({ chassi: 'onca', extras: { leftShoulder: { id: ARMA, tier: 1 } } })]));
    expect(e.duplicar('inimigo', 0)).toBe(1);
    e.editarNivelExtra('inimigo', 1, 'leftShoulder', 2);
    expect(e.lista('inimigo')[0]!.extras!.leftShoulder!.tier).toBe(1);
    expect(e.lista('inimigo')[1]!.extras!.leftShoulder!.tier).toBe(2);
  });
});

describe('editor do esquadrão: o corpo (chassi, andróide ou técnico) numa lista só', () => {
  it('Mech vira andróide e técnico e volta, guardando o apelido e a dificuldade, e largando o resto', () => {
    const e = new EsquadraoEditor(esq([mech({ nome: 'ZEUS', dificuldade: 'dificil', persona: 'brabo', chassi: 'onca' })]));
    expect(e.trocarCorpo('inimigo', 0, 'android')).toBeNull();
    expect(e.lista('inimigo')[0]).toEqual({ papel: 'android', nome: 'ZEUS', dificuldade: 'dificil' });
    expect(e.trocarCorpo('inimigo', 0, 'technician')).toBeNull();
    expect(e.lista('inimigo')[0]).toEqual({ papel: 'technician', nome: 'ZEUS' }); // o técnico não tem dificuldade
    expect(e.trocarCorpo('inimigo', 0, 'marauder')).toBeNull();
    expect(e.lista('inimigo')[0]).toEqual({ papel: 'mech', nome: 'ZEUS', chassi: 'marauder' });
  });

  it('o aliado não tem técnico: a troca é recusada e o robô fica como estava', () => {
    const e = new EsquadraoEditor(esq([], [mech()]));
    const antes = e.esquadrao;
    expect(e.trocarCorpo('aliado', 0, 'technician')).toBe('o aliado não tem técnico');
    expect(e.esquadrao).toEqual(antes);
  });

  it('respeita o teto do técnico (como se ele fosse posto agora) e deixa trocar o único que já é técnico', () => {
    const teto = limitesDoMapa('arena').tecnicos;
    const e = new EsquadraoEditor(esq([...Array.from({ length: teto }, () => ({ papel: 'technician' as const })), mech()]));
    expect(e.trocarCorpo('inimigo', teto, 'technician')).toMatch(/no máximo \d+ técnicos/);
    expect(e.lista('inimigo')[teto]!.papel).toBe('mech');
    expect(e.trocarCorpo('inimigo', 0, 'android')).toBeNull(); // sair da vaga de técnico libera
    expect(e.trocarCorpo('inimigo', teto, 'technician')).toBeNull(); // e agora cabe
    expect(resumoDoEsquadrao(e.esquadrao).tecnicos).toBe(teto);
  });

  it('online o teto por papel vale na troca (6 Mechs, 6 andróides, 1 técnico)', () => {
    const e = new EsquadraoEditor(esq([...Array.from({ length: 6 }, () => ({ papel: 'android' as const })), mech()]), 'arena', undefined, true);
    expect(e.trocarCorpo('inimigo', 6, 'android')).toMatch(/no máximo 6 andróides/);
    expect(e.trocarCorpo('inimigo', 0, 'technician')).toBeNull(); // o técnico único cabe
    expect(e.trocarCorpo('inimigo', 1, 'technician')).toMatch(/no máximo 1 técnico/);
  });

  it('o titã segue com as suas regras: sem vaga no Bunker, e a recusa não deixa o robô pela metade', () => {
    const e = new EsquadraoEditor(esq([{ papel: 'android', nome: 'ANDR' }]), 'bunker');
    const antes = e.esquadrao;
    expect(e.trocarCorpo('inimigo', 0, 'colossus01')).toMatch(/não comporta titãs/);
    expect(e.esquadrao).toEqual(antes);
    const arena = new EsquadraoEditor(esq([{ papel: 'android' }]), 'arena');
    expect(arena.trocarCorpo('inimigo', 0, 'colossus01')).toBeNull();
    expect(arena.lista('inimigo')[0]).toEqual({ papel: 'mech', chassi: 'colossus01' });
  });
});
