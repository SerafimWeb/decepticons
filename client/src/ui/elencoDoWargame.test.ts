import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { type BotSpec, ESQUADRAO_VERSAO, type EsquadraoSpec, esquadraoPadrao, planejarEsquadrao } from '../sim/esquadrao';
import type { BeatDoRoteiro } from '../sim/Roteiro';
import { afetadosPelaBatida, desenhoDoMapa, descreverPonto, elencoDoRoteiro, quemDaBatida, roboDaBatida } from './elencoDoWargame';

/**
 * O elenco do WARGAME (P290): quem é cada robô do episódio, onde nasce e o número que o Comandante vê. O número é a posição na lista do esquadrão do lado, o mesmo que a batida guarda como `alvo`.
 */

const NOMES = DEFAULT_SETTINGS.names;
const mech = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'mech', ...extra });
const esq = (inimigos: BotSpec[], aliados: BotSpec[] = []): EsquadraoSpec => ({ v: ESQUADRAO_VERSAO, inimigos, aliados });
const ordem = { tipo: 'hold', ponto: { x: 12, z: -30 } } as const;

describe('elencoDoRoteiro: quem é quem', () => {
  it('numera cada lado a partir de 1, na ordem da lista do esquadrão, inimigos primeiro; o índice (de 0) é o `alvo` da batida', () => {
    const e = elencoDoRoteiro(esquadraoPadrao(), 'arena', NOMES);
    const inimigos = e.filter((r) => r.lado === 'inimigo');
    const aliados = e.filter((r) => r.lado === 'aliado');
    expect(e.slice(0, inimigos.length).every((r) => r.lado === 'inimigo')).toBe(true);
    expect(inimigos.map((r) => r.numero)).toEqual(inimigos.map((_, i) => i + 1));
    expect(inimigos.map((r) => r.indice)).toEqual(inimigos.map((_, i) => i));
    expect(aliados.map((r) => r.numero)).toEqual(aliados.map((_, i) => i + 1));
  });

  it('cada robô tem o ponto onde a partida o faz nascer, ainda que a lista misture Mechs e andróides', () => {
    const spec = esq([{ papel: 'android' }, mech({ chassi: 'onca' }), { papel: 'technician' }, mech()], [mech(), { papel: 'android' }]);
    const plano = planejarEsquadrao(spec, 'arena', NOMES);
    const e = elencoDoRoteiro(spec, 'arena', NOMES);
    const pt = (r: { ponto: { x: number; z: number } }) => [r.ponto.x, r.ponto.z];
    const [a0, m1, t2, m3] = e.filter((r) => r.lado === 'inimigo');
    expect(pt(a0!)).toEqual([...plano.inimigos.androids[0]!.ponto]);
    expect(pt(m1!)).toEqual([...plano.inimigos.mechs[0]!.ponto]);
    expect(pt(t2!)).toEqual([...plano.inimigos.tecnicos[0]!.ponto]);
    expect(pt(m3!)).toEqual([...plano.inimigos.mechs[1]!.ponto]);
    const [am0, aa1] = e.filter((r) => r.lado === 'aliado');
    expect(pt(am0!)).toEqual([...plano.aliados.mechs[0]!.ponto]);
    expect(pt(aa1!)).toEqual([...plano.aliados.androids[0]!.ponto]);
  });

  it('diz o corpo (chassi, ANDRÓIDE, TÉCNICO), o nome que aparece na partida (com a personalidade) e quem pode receber ordem', () => {
    const e = elencoDoRoteiro(esq([mech({ chassi: 'onca', nome: 'ZEUS', persona: 'brabo' }), { papel: 'android' }, { papel: 'technician' }]), 'arena', NOMES);
    expect(e[0]).toMatchObject({ corpo: 'ONÇA-B2', nome: 'ZEUS·BRABO', papel: 'mech', ordenavel: true });
    expect(e[1]).toMatchObject({ corpo: 'ANDRÓIDE', papel: 'android', ordenavel: true });
    expect(e[2]).toMatchObject({ corpo: 'TÉCNICO', papel: 'technician', ordenavel: false }); // o técnico segue quem está avariado
  });

  it('uma lista vazia dá um elenco vazio', () => {
    expect(elencoDoRoteiro(esq([], []), 'arena', NOMES)).toEqual([]);
  });
});

describe('a batida e o elenco', () => {
  const e = elencoDoRoteiro(esq([mech({ chassi: 'onca', nome: 'ZEUS' }), mech(), { papel: 'technician' }], [mech(), mech()]), 'arena', NOMES);

  it('acha o robô de uma batida com alvo, e nenhum quando a ordem é do lado inteiro', () => {
    expect(roboDaBatida(e, { lado: 'inimigo', alvo: 1 })?.indice).toBe(1);
    expect(roboDaBatida(e, { lado: 'aliado', alvo: 1 })?.lado).toBe('aliado');
    expect(roboDaBatida(e, { lado: 'inimigo' })).toBeUndefined();
    expect(roboDaBatida(e, {})).toBeUndefined();
  });

  it('diz em palavras quem recebe: o lado inteiro (sem contar o técnico) ou o robô, com número, nome e chassi', () => {
    expect(quemDaBatida(e, { lado: 'inimigo' })).toBe('todos os inimigos (2)');
    expect(quemDaBatida(e, { lado: 'aliado' })).toBe('todos os aliados (2)');
    expect(quemDaBatida(e, { lado: 'inimigo', alvo: 0 })).toBe('INIMIGO 1 · ZEUS · ONÇA-B2');
    expect(quemDaBatida(e, {})).toBe('—');
  });

  it('os afetados: o alvo, ou todos do lado que recebem ordem; ninguém sem ordem; o técnico como alvo não recebe', () => {
    expect(afetadosPelaBatida(e, { lado: 'inimigo', ordem }).map((r) => r.indice)).toEqual([0, 1]);
    expect(afetadosPelaBatida(e, { lado: 'inimigo', alvo: 1, ordem }).map((r) => r.indice)).toEqual([1]);
    expect(afetadosPelaBatida(e, { lado: 'inimigo', alvo: 2, ordem })).toEqual([]);
    expect(afetadosPelaBatida(e, { lado: 'inimigo' })).toEqual([]);
    expect(afetadosPelaBatida(e, { ordem })).toEqual([]);
  });
});

describe('descreverPonto: onde, em palavras', () => {
  const marcos = [{ x: -28, z: -35, texto: 'VORCARIS' }, { x: 40, z: 40, texto: 'SERAFIM' }];

  it('"perto de" o marco mais próximo dentro do raio, com as coordenadas arredondadas; longe de tudo, só as coordenadas', () => {
    expect(descreverPonto({ x: -20.4, z: -30.2 }, marcos)).toBe('perto de VORCARIS (-20, -30)');
    expect(descreverPonto({ x: 35, z: 30 }, marcos)).toBe('perto de SERAFIM (35, 30)');
    expect(descreverPonto({ x: 100, z: 0 }, marcos)).toBe('(100, 0)');
    expect(descreverPonto({ x: 0, z: 0 }, undefined)).toBe('(0, 0)');
  });
});

describe('desenhoDoMapa: o que o mapa pinta', () => {
  const e = elencoDoRoteiro(esq([mech(), mech(), { papel: 'android' }], [mech()]), 'arena', NOMES);
  const beats: BeatDoRoteiro[] = [
    { tick: 0, lado: 'inimigo', alvo: 1, ordem },
    { tick: 60, lado: 'aliado', ordem: { tipo: 'follow', ponto: { x: -5, z: 5 } } },
    { tick: 120, legenda: { texto: 'só legenda', duracaoS: 3 } },
  ];

  it('cada robô aparece onde nasce, com o número dele, na cor do lado', () => {
    const d = desenhoDoMapa(e, beats, null);
    expect(d.inimigos).toHaveLength(3);
    expect(d.aliados).toHaveLength(1);
    expect(d.rotulos.map((r) => r.texto)).toEqual(['1', '2', '3', '1']);
    expect(d.rotulos[0]!.cor).not.toBe(d.rotulos[3]!.cor);
    expect(d.inimigos.map((i) => i.grande)).toEqual([true, true, false]); // Mech grande, andróide pequeno
  });

  it('cada ordem vira um anel com o número da batida; a batida só de legenda não tem anel; a em foco é destacada', () => {
    const d = desenhoDoMapa(e, beats, 1);
    expect(d.marcas!.map((m) => m.texto)).toEqual(['0', '1']);
    expect(d.marcas!.map((m) => m.destaque)).toEqual([false, true]);
  });

  it('as setas são só da batida em foco: do ponto onde cada robô nasce ao ponto da ordem; uma de um robô só, ou uma por robô do lado', () => {
    expect(desenhoDoMapa(e, beats, null).setas).toEqual([]);
    const um = desenhoDoMapa(e, beats, 0).setas!;
    expect(um).toHaveLength(1);
    expect(um[0]!.para).toEqual({ x: 12, z: -30 });
    expect(um[0]!.de).toEqual(e.find((r) => r.lado === 'inimigo' && r.indice === 1)!.ponto);
    expect(desenhoDoMapa(e, beats, 1).setas).toHaveLength(1); // o aliado único
    expect(desenhoDoMapa(e, beats, 2).setas).toEqual([]); // sem ordem
  });
});
