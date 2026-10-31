import { describe, expect, it } from 'vitest';
import { CHASSIS, VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { triggersComBotoes, attackOf, MOUNTS, type TriggerLayout } from '../combat/mounts';
import { botoesDoPreset, encaixesDeArma, factorySpec, loadoutKey, parseLoadoutKey, validateLoadout, type LoadoutSpec } from './loadout';

/**
 * Os botões de cada encaixe (P301, fase 2): a montagem leva a escolha, a chave a carrega (versão 4), e quem não tem escolha segue igual.
 */

const VEC: LoadoutSpec = { v: 1, chassis: 'vector09', right: { id: 'plasma', tier: 0 }, left: { id: 'rockets', tier: 0 } };

describe('a chave com botões (versão 4)', () => {
  it('sem escolha, a chave é a de sempre (o link e a rede não mudam)', () => {
    expect(loadoutKey(VEC)).toBe('v1.vector09.plasma-0.rockets-0');
    expect(loadoutKey({ ...VEC, v: 4, botoes: {} } as LoadoutSpec)).toBe('v1.vector09.plasma-0.rockets-0');
  });

  it('com a mão esquerda no botão 1, a chave vai na versão 4 e volta igual', () => {
    const spec: LoadoutSpec = { ...VEC, v: 4, module: null, botoes: { leftHand: 1 } } as LoadoutSpec;
    const chave = loadoutKey(spec);
    expect(chave.startsWith('v4.vector09.plasma-0.rockets-0.')).toBe(true);
    expect(chave.endsWith('.Blh1')).toBe(true);
    const volta = parseLoadoutKey(chave);
    expect(volta?.botoes).toEqual({ leftHand: 1 });
    expect(loadoutKey(volta!)).toBe(chave);
  });

  it('o Colossus-01 com a chuva nas costas no botão 1 e os ombros no 2: ida e volta, na ordem canônica', () => {
    // Os ombros do Colossus de fábrica estão vazios: só a chuva das costas (que tem arma) pode ter botão.
    const spec: LoadoutSpec = { ...factorySpec('colossus01'), botoes: { back: 1 } } as LoadoutSpec;
    const chave = loadoutKey(spec);
    expect(chave.endsWith('.Bbk1')).toBe(true);
    expect(parseLoadoutKey(chave)?.botoes).toEqual({ back: 1 });
    // um ombro vazio com botão é recusado
    expect(validateLoadout({ ...factorySpec('colossus01'), v: 4, botoes: { rightShoulder: 2 } } as LoadoutSpec).ok).toBe(false);
  });

  it('recusa a chave com botão torto, encaixe sem arma, ou um código que não bate', () => {
    for (const ruim of ['v4.vector09.plasma-0.rockets-0.-.-.-.-.Blh3', 'v4.vector09.plasma-0.rockets-0.-.-.-.-.Brs1', 'v4.vector09.plasma-0.rockets-0.-.-.-.-.Blh1xx', 'v4.vector09.plasma-0.rockets-0.-.-.-.-.B']) {
      expect(parseLoadoutKey(ruim), ruim).toBeNull();
    }
  });

  it('a validação recusa botão para encaixe que não tem arma, e botão fora da versão 4', () => {
    expect(validateLoadout({ ...VEC, v: 4, module: null, botoes: { rightShoulder: 1 } } as LoadoutSpec).ok).toBe(false);
    expect(validateLoadout({ ...VEC, v: 3, module: null, botoes: { leftHand: 1 } } as LoadoutSpec).ok).toBe(false);
    expect(validateLoadout({ ...VEC, v: 4, module: null, botoes: { leftHand: 2 } } as LoadoutSpec).ok).toBe(true);
  });
});

describe('o layout que resulta da escolha (triggersComBotoes)', () => {
  const base: TriggerLayout = { primary: ['rightHand'], secondary: ['leftHand'] };

  it('sem escolha, devolve o próprio layout do chassi', () => {
    expect(triggersComBotoes(base)).toBe(base);
  });

  it('a escolha troca só o encaixe escolhido; os outros seguem o chassi', () => {
    const t = triggersComBotoes(base, { leftHand: 1 });
    expect(attackOf(t, 'leftHand')).toBe(1);
    expect(attackOf(t, 'rightHand')).toBe(1);
    const trocada = triggersComBotoes(base, { rightHand: 2 });
    expect(attackOf(trocada, 'rightHand')).toBe(2);
    expect(MOUNTS.every((m) => attackOf(t, m) === null || attackOf(t, m) === 1 || attackOf(t, m) === 2)).toBe(true);
  });
});

describe('o motor usa a escolha: a montagem com a mão esquerda no botão 1 dispara o foguete nele', () => {
  it('o Vector-09 com a esquerda no botão 1: o foguete sai no botão 1, e o plasma da direita no 2', () => {
    const spec: LoadoutSpec = { ...VEC, v: 4, module: null, botoes: { leftHand: 1, rightHand: 2 } } as LoadoutSpec;
    const r = validateLoadout(spec);
    if (!r.ok) throw new Error('a montagem tem que validar');
    const mech = new Vector09({ stats: { ...VECTOR09_STATS, loadout: r.loadout }, loadout: r.loadout });
    expect(attackOf(mech.triggers, 'leftHand')).toBe(1);
    expect(attackOf(mech.triggers, 'rightHand')).toBe(2);
  });

  it('o padrão do Vector-09 (sem escolha) segue com a mão direita no 1 e a esquerda no 2', () => {
    const r = validateLoadout(VEC);
    if (!r.ok) throw new Error('o Vector-09 de fábrica tem que validar');
    const mech = new Vector09({ stats: CHASSIS.vector09, loadout: r.loadout });
    expect(attackOf(mech.triggers, 'rightHand')).toBe(1);
    expect(attackOf(mech.triggers, 'leftHand')).toBe(2);
  });
});

describe('os presets de botão do Hangar (P301)', () => {
  const vec = { ...VEC, v: 1 as const };
  it('os encaixes que levam arma: a mão direita e a esquerda do Vector-09; a chuva e os ombros vazios não entram', () => {
    expect(encaixesDeArma(vec)).toEqual(['rightHand', 'leftHand']);
    expect(encaixesDeArma(factorySpec('colossus01'))).toEqual(['rightHand', 'back']);
  });

  it('padrão: sem botões (a chave é a de sempre)', () => {
    expect(botoesDoPreset(vec, 'padrao')).toBeUndefined();
  });

  it('mãos no 1, o resto no 2; e tudo no 1 com a principal no 2 (no Vector-09, a da mão direita)', () => {
    expect(botoesDoPreset(vec, 'maos1')).toEqual({ rightHand: 1, leftHand: 1 });
    expect(botoesDoPreset(vec, 'tudo1')).toEqual({ rightHand: 2, leftHand: 1 });
  });

  it('no Colossus, tudo no 1 põe a principal no 2 (a das costas, quando há)', () => {
    expect(botoesDoPreset(factorySpec('colossus01'), 'tudo1')).toEqual({ rightHand: 1, back: 2 });
  });
});
