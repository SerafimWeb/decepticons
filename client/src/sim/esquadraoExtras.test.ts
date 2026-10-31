import { describe, expect, it } from 'vitest';
import { EXTRA_SLOTS } from '../combat/encaixesExtras';
import { weapon } from '../combat/weapons';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { ARM_SLOTS, ehTita, type ChassisId } from '../entities/chassis';
import { montagemDoBot } from './esquadraoOnline';
import { validateLoadout } from '../hangar/loadout';
import {
  armaServeAoBot,
  armasDoExtraDoBot,
  type BotSpec,
  CHASSIS_DOS_BOTS,
  chaveDoEsquadrao,
  ESQUADRAO_VERSAO,
  type EsquadraoSpec,
  lerChaveDoEsquadrao,
  planejarEsquadrao,
  sanearBot,
} from './esquadrao';

/**
 * Os encaixes extras no esquadrão (P288, ordem do Comandante em 30/10: a ficha do robô só dava a arma direita e a esquerda, e o Hangar já tem costas e ombros). O contrato: cada encaixe com a sua
 * arma e o seu nível, só nos chassis que o têm e só com o que o bot sabe atirar; o link o leva; a partida o recebe.
 */

const onca = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'mech', chassi: 'onca', ...extra });
const esq = (inimigos: BotSpec[], aliados: BotSpec[] = []): EsquadraoSpec => ({ v: ESQUADRAO_VERSAO, inimigos, aliados });
const ombro = armasDoExtraDoBot('onca', 'rightShoulder')[0]!;
const outra = armasDoExtraDoBot('onca', 'leftShoulder').at(-1)!;

describe('os encaixes extras do bot: quais armas, em quais chassis', () => {
  it('o Onça tem os dois ombros (e não as costas); só energia de tiro simples, que o bot sabe atirar', () => {
    expect(armasDoExtraDoBot('onca', 'rightShoulder').length).toBeGreaterThan(0);
    expect(armasDoExtraDoBot('onca', 'leftShoulder')).toEqual(armasDoExtraDoBot('onca', 'rightShoulder'));
    expect(armasDoExtraDoBot('onca', 'back')).toEqual([]);
    for (const id of armasDoExtraDoBot('onca', 'rightShoulder')) expect(armaServeAoBot(id), id).toBe(true);
  });

  it('o titã luta com a arma de fábrica (como chefe): o Colossus-01 tem os encaixes no Hangar e nenhum para o bot', () => {
    expect(ARM_SLOTS.colossus01.back).toBeDefined();
    for (const slot of EXTRA_SLOTS) expect(armasDoExtraDoBot('colossus01', slot), slot).toEqual([]);
  });

  it('só quem tem o encaixe no Hangar o oferece ao bot (nunca um encaixe que o chassi não tem)', () => {
    for (const c of CHASSIS_DOS_BOTS) {
      for (const slot of EXTRA_SLOTS) {
        if (ARM_SLOTS[c][slot] === undefined) expect(armasDoExtraDoBot(c, slot), `${c} ${slot}`).toEqual([]);
        else if (!ehTita(c)) expect(armasDoExtraDoBot(c, slot).length, `${c} ${slot}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('sanearBot com encaixes extras', () => {
  it('guarda a arma e o nível de cada ombro do Onça, e nada mais', () => {
    const b = sanearBot(onca({ extras: { rightShoulder: { id: ombro, tier: 2 }, leftShoulder: { id: outra, tier: 0 } } }));
    expect(b?.extras).toEqual({ rightShoulder: { id: ombro, tier: 2 }, leftShoulder: { id: outra, tier: 0 } });
  });

  it('descarta o que o chassi não tem (costas no Onça, ombro no Vector-09, qualquer encaixe no titã) e o que o bot não atira', () => {
    expect(sanearBot(onca({ extras: { back: { id: ombro, tier: 0 } } }))?.extras).toBeUndefined();
    expect(sanearBot({ papel: 'mech', extras: { rightShoulder: { id: ombro, tier: 0 } } })?.extras).toBeUndefined();
    expect(sanearBot({ papel: 'mech', chassi: 'colossus01', extras: { back: { id: 'plasma', tier: 0 } } })?.extras).toBeUndefined();
    // foguetes (munição) e rotatória (gira o cano) não cabem num encaixe extra
    expect(sanearBot(onca({ extras: { rightShoulder: { id: 'rockets', tier: 0 }, leftShoulder: { id: 'rotary', tier: 0 } } }))?.extras).toBeUndefined();
    // um nível que não existe
    expect(sanearBot(onca({ extras: { rightShoulder: { id: ombro, tier: 3 as never } } }))?.extras).toBeUndefined();
  });

  it('o andróide e o técnico não levam encaixes extras, e trocar o chassi larga o que o novo não tem', () => {
    expect(sanearBot({ papel: 'android', extras: { rightShoulder: { id: ombro, tier: 0 } } } as never)).toEqual({ papel: 'android' });
    const comExtras = onca({ extras: { rightShoulder: { id: ombro, tier: 0 } } });
    expect(sanearBot({ ...comExtras, chassi: 'vector09' })?.extras).toBeUndefined();
  });

  it('ficar com um só ombro é válido (o outro fica vazio)', () => {
    expect(sanearBot(onca({ extras: { leftShoulder: { id: ombro, tier: 1 } } }))?.extras).toEqual({ leftShoulder: { id: ombro, tier: 1 } });
  });
});

describe('o link do esquadrão leva os encaixes extras', () => {
  it('ida e volta: o esquadrão sai igual, na ordem canônica (costas, ombro direito, ombro esquerdo)', () => {
    const e = esq([onca({ extras: { leftShoulder: { id: outra, tier: 1 }, rightShoulder: { id: ombro, tier: 2 } } }), { papel: 'mech' }]);
    const chave = chaveDoEsquadrao(e);
    expect(chave).toMatch(/:r[a-z]+-2:l[a-z]+-1/);
    const volta = lerChaveDoEsquadrao(chave);
    expect(volta).toEqual(esq([onca({ extras: { rightShoulder: { id: ombro, tier: 2 }, leftShoulder: { id: outra, tier: 1 } } }), { papel: 'mech' }]));
    expect(chaveDoEsquadrao(volta!)).toBe(chave);
  });

  it('o link de antes dos extras segue valendo, igual (o padrão é a mesma chave de sempre)', () => {
    expect(chaveDoEsquadrao(esq([{ papel: 'mech', persona: 'brabo' }, { papel: 'android' }, { papel: 'android' }, { papel: 'technician' }], [{ papel: 'mech' }, { papel: 'mech', arma: { id: 'emp', tier: 0 } }]))).toBe('q1.m:pb,a,a,t.m,m:wemp-0');
    expect(lerChaveDoEsquadrao('q1.m:conca:wblaster-1.-')).not.toBeNull();
  });

  it('recusa o texto inteiro se um encaixe não existe no chassi, a arma não serve ou o papel não é Mech', () => {
    for (const ruim of [
      `q1.m:conca:b${ombro}-0.-`, // costas: o Onça não as tem
      `q1.m:r${ombro}-0.-`, // ombro no Vector-09
      'q1.m:conca:rrockets-0.-', // munição
      `q1.m:conca:r${ombro}-3.-`, // nível 3
      `q1.a:r${ombro}-0.-`, // andróide
      `q1.m:conca:r${ombro}-0:r${ombro}-1.-`, // o mesmo encaixe duas vezes
    ]) {
      expect(lerChaveDoEsquadrao(ruim), ruim).toBeNull();
    }
  });
});

describe('o plano e a montagem de rede levam os encaixes extras', () => {
  it('o plano dá os extras ao robô (ou null)', () => {
    const plano = planejarEsquadrao(esq([onca({ extras: { rightShoulder: { id: ombro, tier: 1 } } }), onca()]), 'arena', DEFAULT_SETTINGS.names);
    expect(plano.inimigos.mechs.map((s) => s.extras)).toEqual([{ rightShoulder: { id: ombro, tier: 1 } }, null]);
  });

  it('a montagem que os outros jogadores veem leva os ombros do Onça (com uma arma leve, que cabe na carga) e continua uma montagem que o Hangar aceita', () => {
    const leve = armasDoExtraDoBot('onca', 'rightShoulder').reduce((a, b) => (weapon(b).mass < weapon(a).mass ? b : a));
    const spec = montagemDoBot({ chassi: 'onca', extras: { rightShoulder: { id: leve, tier: 0 }, leftShoulder: { id: leve, tier: 0 } } });
    expect(spec.rightShoulder).toEqual({ id: leve, tier: 0 });
    expect(spec.leftShoulder).toEqual({ id: leve, tier: 0 });
    expect(validateLoadout(spec).ok).toBe(true);
  });

  it('se os extras estouram a carga do chassi, eles saem primeiro: a montagem volta a ser válida (é só desenho)', () => {
    const pesada = armasDoExtraDoBot('onca', 'rightShoulder').at(-1)!;
    const spec = montagemDoBot({ chassi: 'onca' as ChassisId, extras: { rightShoulder: { id: pesada, tier: 2 }, leftShoulder: { id: pesada, tier: 2 } } });
    expect(validateLoadout(spec).ok).toBe(true);
  });
});
