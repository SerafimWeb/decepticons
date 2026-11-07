import { describe, expect, it } from 'vitest';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import { aplicarPreset, copySpec, encaixeComArma, escolherBotao, normalizar, trocarArma, trocarLayout, trocarModulo, trocarNivel } from './edicao';
import { armOptions, BOTAO_SLOTS, botoesDoPreset, encaixesDeArma, extrasDoChassi, factorySpec, hasShoulderSlot, loadoutKey, parseLoadoutKey, validateLoadout, type ArmSlot, type LoadoutSpec } from './loadout';

/**
 * As edições do rascunho do Hangar (P319, passo 1, achados 1, 3 e 7): a cópia não perde campo, nenhuma edição deixa o APLICAR recusar por uma regra que o jogador não viu, e o
 * botão de um encaixe que esvaziou sai junto com a arma.
 */

const VEC: LoadoutSpec = { v: 1, chassis: 'vector09', right: { id: 'plasma', tier: 0 }, left: { id: 'rockets', tier: 0 } };
const MARAUDER: LoadoutSpec = { v: 2, chassis: 'marauder', right: { id: 'blaster', tier: 0 }, left: { id: 'plasma', tier: 0 }, shoulders: { id: 'sonic', tier: 0 }, module: null };

describe('copySpec (achado 1: a cor comprada sumia ao reabrir o Hangar)', () => {
  it('copia todos os campos, a cor do casco inclusive, sem dividir objeto com o original', () => {
    const cheio: LoadoutSpec = {
      v: 4, chassis: 'colossus01', right: { id: 'cannon', tier: 1 }, left: { id: 'barrage', tier: 0 }, shoulders: { id: 'rockets', tier: 2 }, module: 'fire', layout: 1, pintura: 3,
      botoes: { rightHand: 2, back: 1 }, back: { id: 'barrage', tier: 0 }, rightShoulder: { id: 'rockets', tier: 0 }, leftShoulder: null,
    };
    const copia = copySpec(cheio);
    expect(copia).toEqual(cheio);
    expect(copia.pintura).toBe(3);
    expect(copia.right).not.toBe(cheio.right);
    expect(copia.botoes).not.toBe(cheio.botoes);
    copia.right.tier = 0;
    expect(cheio.right.tier).toBe(1);
  });

  it('a cor comprada sobrevive a qualquer edição do rascunho', () => {
    let s: LoadoutSpec = { ...VEC, pintura: 6 };
    s = trocarArma(s, 'right', { id: 'blaster', tier: 0 });
    s = trocarNivel(s, 'left', 1);
    s = trocarModulo(s, 'fire');
    s = escolherBotao(s, 'left', 1);
    s = aplicarPreset(s, 'padrao');
    expect(s.pintura).toBe(6);
  });
});

describe('normalizar (achado 3: editar numa certa ordem travava o APLICAR)', () => {
  it('BOTÃO 2 no braço direito e depois trocar o módulo: a montagem segue válida, com o botão e o módulo', () => {
    const comBotao = escolherBotao(VEC, 'right', 2);
    expect(comBotao.v).toBe(4);
    expect(comBotao.botoes).toEqual({ rightHand: 2 });
    // o que a tela fazia antes: rebaixar para a versão 2 e a validação recusava
    expect(validateLoadout({ ...comBotao, v: 2 })).toMatchObject({ ok: false });
    const comModulo = trocarModulo(comBotao, 'fire');
    expect(comModulo).toMatchObject({ v: 4, module: 'fire', botoes: { rightHand: 2 } });
    expect(validateLoadout(comModulo).ok).toBe(true);
  });

  it('o layout do Marauder com botão escolhido: troca e volta ao padrão sem quebrar', () => {
    const comBotao = escolherBotao(MARAUDER, 'left', 1);
    const layout1 = trocarLayout(comBotao, 1);
    expect(layout1).toMatchObject({ v: 4, layout: 1, module: null, botoes: { leftHand: 1 } });
    expect(validateLoadout(layout1).ok).toBe(true);
    const padrao = trocarLayout(layout1, 0);
    expect('layout' in padrao).toBe(false);
    expect(validateLoadout(padrao).ok).toBe(true);
  });

  it('esvaziar um encaixe leva o botão dele junto (não fica botão órfão)', () => {
    let s = escolherBotao(escolherBotao(VEC, 'right', 2), 'left', 1);
    expect(s.botoes).toEqual({ rightHand: 2, leftHand: 1 });
    s = trocarArma(s, 'left', null);
    expect(s.botoes).toEqual({ rightHand: 2 });
    expect(validateLoadout(s).ok).toBe(true);
  });

  it('o botão só vale para encaixe com arma: a chapa de escudo e o ombro que o chassi não tem ficam de fora', () => {
    const lancer = factorySpec('lancerL1'); // a mão esquerda leva a chapa Muralha, não uma arma
    expect(escolherBotao(lancer, 'left', 1).botoes).toBeUndefined();
    expect(escolherBotao(VEC, 'shoulders', 1).botoes).toBeUndefined(); // o Vector-09 não tem ombros
  });

  it('sem botão nenhum a chave deixa de ser a versão 4 e o módulo atravessa a chave (o "PADRÃO DO CHASSI" perdia o escudo)', () => {
    const s = aplicarPreset(trocarModulo(escolherBotao(VEC, 'right', 2), 'fire'), 'padrao');
    expect(s.botoes).toBeUndefined();
    expect(s.v).toBe(2);
    expect(parseLoadoutKey(loadoutKey(s))).toMatchObject({ module: 'fire' });
  });

  it('é idempotente e nunca inventa campo: a montagem de fábrica de cada chassi volta igual', () => {
    for (const id of Object.keys(CHASSIS) as ChassisId[]) {
      const base = factorySpec(id);
      expect(normalizar(base), id).toEqual(base);
      expect(normalizar(normalizar(base)), id).toEqual(normalizar(base));
    }
  });
});

describe('encaixeComArma: o mesmo critério que a validação, lido da montagem', () => {
  it('bate com `encaixesDeArma` em cada chassi, de fábrica e com cada encaixe trocado ou esvaziado', () => {
    let validas = 0;
    for (const id of Object.keys(CHASSIS) as ChassisId[]) {
      const slots: ArmSlot[] = ['right', 'left', ...(hasShoulderSlot(id) ? (['shoulders'] as const) : []), ...extrasDoChassi(id)];
      const base = factorySpec(id);
      const variantes: LoadoutSpec[] = [base];
      for (const slot of slots) {
        const primeira = armOptions(slot, id)[0];
        if (primeira) variantes.push({ ...base, [slot]: { id: primeira, tier: 0 } });
        if (slot !== 'right') variantes.push({ ...base, [slot]: null });
      }
      for (const v of variantes) {
        if (!validateLoadout(v).ok) continue;
        validas++;
        expect(BOTAO_SLOTS.filter((s) => encaixeComArma(v, s)), `${id} ${loadoutKey(v)}`).toEqual(encaixesDeArma(v));
        // o ponto de tudo: escolhendo botão em todos os encaixes, o que sobra da `normalizar` é sempre uma montagem válida
        const todos = Object.fromEntries(BOTAO_SLOTS.map((s) => [s, 1 as const]));
        expect(validateLoadout(normalizar({ ...v, v: 4, module: v.module ?? null, botoes: todos })).ok, `${id} ${loadoutKey(v)}`).toBe(true);
      }
    }
    expect(validas).toBeGreaterThan(30);
  });
});

describe('os presets de botão (achado 7: "TUDO NO 1" com uma arma só deixava o botão 1 vazio)', () => {
  it('uma arma só fica no botão 1 (o Lancer-L1 de fábrica só tem a da mão direita)', () => {
    const lancer = factorySpec('lancerL1');
    expect(encaixesDeArma(lancer)).toEqual(['rightHand']);
    expect(botoesDoPreset(lancer, 'tudo1')).toEqual({ rightHand: 1 });
    expect(botoesDoPreset(lancer, 'maos1')).toEqual({ rightHand: 1 });
    const aplicada = aplicarPreset(lancer, 'tudo1');
    expect(aplicada.botoes).toEqual({ rightHand: 1 });
    expect(validateLoadout(aplicada).ok).toBe(true);
  });

  it('com mais de uma arma, a principal continua no botão 2', () => {
    expect(botoesDoPreset(VEC, 'tudo1')).toEqual({ rightHand: 2, leftHand: 1 });
    expect(botoesDoPreset(factorySpec('colossus01'), 'tudo1')).toEqual({ rightHand: 1, back: 2 });
  });
});
