import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import {
  type BotSpec,
  chaveDoEsquadrao,
  ESQUADRAO_VERSAO,
  type EsquadraoSpec,
  esquadraoDeFoes,
  esquadraoPadrao,
  limitesDoMapa,
  resumoDoEsquadrao,
  sanearEsquadrao,
} from '../sim/esquadrao';
import { descreverBot, EsquadraoEditor, indicesNoPapel, LADOS, PREDEFINIDOS, rotuloDoPapel } from './esquadraoEditor';

const NOMES = DEFAULT_SETTINGS.names;
const mech = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'mech', ...extra });
const esq = (inimigos: BotSpec[], aliados: BotSpec[] = []): EsquadraoSpec => ({ v: ESQUADRAO_VERSAO, inimigos, aliados });
const editor = (inicial: EsquadraoSpec = esquadraoPadrao()) => new EsquadraoEditor(inicial);

describe('editor do esquadrão: o modelo', () => {
  it('começa no esquadrão pedido e devolve cópias: mexer na cópia não mexe no editor', () => {
    const e = editor();
    const copia = e.esquadrao;
    copia.inimigos.push(mech());
    copia.inimigos[0]!.persona = 'manso';
    // A arma é um objeto dentro do robô: a cópia tem a dela (o supressor aliado leva o EMP).
    copia.aliados[1]!.arma!.tier = 2;
    expect(e.esquadrao).toEqual(esquadraoPadrao());
    expect(e.lista('inimigo')).toHaveLength(4);
    expect(e.lista('aliado')).toHaveLength(2);
  });

  it('o que não é válido nunca entra: o esquadrão inicial passa pelo contrato', () => {
    const e = editor({ v: 1, inimigos: [mech(), { papel: 'tanque' } as unknown as BotSpec], aliados: [{ papel: 'technician' }] });
    expect(e.esquadrao).toEqual(esq([mech()], []));
  });

  it('"mudou" compara com o que a janela abriu: adicionar e remover de volta é não ter mudado', () => {
    const e = editor();
    expect(e.mudou).toBe(false);
    const i = e.adicionar('inimigo', 'mech');
    expect(i).toBe(4);
    expect(e.mudou).toBe(true);
    e.remover('inimigo', i);
    expect(e.mudou).toBe(false);
  });

  it('adicionar põe no fim do lado e devolve o lugar; remover tira e fecha a fila; fora da lista não faz nada', () => {
    const e = editor(esq([], []));
    expect(e.adicionar('inimigo', 'mech', { persona: 'brabo' })).toBe(0);
    expect(e.adicionar('inimigo', 'android')).toBe(1);
    expect(e.adicionar('aliado', 'mech')).toBe(0);
    expect(e.lista('inimigo').map((b) => b.papel)).toEqual(['mech', 'android']);
    e.remover('inimigo', 5);
    e.remover('inimigo', -1);
    expect(e.lista('inimigo')).toHaveLength(2);
    e.remover('inimigo', 0);
    expect(e.lista('inimigo').map((b) => b.papel)).toEqual(['android']);
  });

  it('o aliado não tem técnico, e a tela diz por quê', () => {
    const e = editor(esq([], []));
    expect(e.podeAdicionar('aliado', 'technician')).toMatch(/técnico/);
    expect(e.adicionar('aliado', 'technician')).toBe(-1);
    expect(e.podeAdicionar('inimigo', 'technician')).toBeNull();
  });

  it('os limites do mapa valem em cada lado, no total e nos técnicos, com o motivo em palavras', () => {
    const lim = limitesDoMapa('arena');
    const e = editor(esq([], []));
    for (let i = 0; i < lim.inimigos; i++) expect(e.adicionar('inimigo', 'mech')).toBe(i);
    expect(e.podeAdicionar('inimigo', 'mech')).toMatch(new RegExp(`${lim.inimigos} inimigos`));
    expect(e.adicionar('inimigo', 'mech')).toBe(-1);
    expect(e.resumo.inimigos).toBe(lim.inimigos);
    for (let i = 0; i < lim.total - lim.inimigos; i++) expect(e.adicionar('aliado', 'mech')).toBeGreaterThanOrEqual(0);
    expect(e.podeAdicionar('aliado', 'mech')).toMatch(/no total|aliados/);
    expect(e.resumo.total).toBe(lim.total);
    expect(e.excessos).toEqual([]);
    const t = editor(esq([], []));
    for (let i = 0; i < lim.tecnicos; i++) t.adicionar('inimigo', 'technician');
    expect(t.podeAdicionar('inimigo', 'technician')).toMatch(/técnicos/);
    expect(t.adicionar('inimigo', 'technician')).toBe(-1);
  });

  it('no Bunker o teto é o dos pontos livres (11), e o que passou disso é dito', () => {
    const e = new EsquadraoEditor(esq(Array.from({ length: 14 }, () => mech()), []), 'arena');
    expect(e.excessos).toEqual([]);
    e.setMapa('bunker');
    expect(e.limites.total).toBe(11);
    expect(e.excessos.join(' ')).toMatch(/inimigos: 14/);
    expect(e.podeAdicionar('aliado', 'mech')).not.toBeNull();
  });

  it('duplicar copia o robô logo depois dele, sem o apelido, e respeita o limite', () => {
    const e = editor(esq([mech({ nome: 'ALFA', persona: 'brabo', chassi: 'onca', arma: { id: 'cannon', tier: 1 } }), mech()], []));
    expect(e.duplicar('inimigo', 0)).toBe(1);
    const [a, b, c] = e.lista('inimigo');
    expect(b).toEqual({ papel: 'mech', persona: 'brabo', chassi: 'onca', arma: { id: 'cannon', tier: 1 } });
    expect(a!.nome).toBe('ALFA');
    expect(c).toEqual(mech());
    // A cópia é independente: mudar o nível dela não muda o do original.
    e.editarNivel('inimigo', 1, 2);
    expect(e.lista('inimigo')[0]!.arma!.tier).toBe(1);
    expect(e.lista('inimigo')[1]!.arma!.tier).toBe(2);
    expect(e.duplicar('inimigo', 9)).toBe(-1);
    const cheio = editor(esq(Array.from({ length: limitesDoMapa('arena').inimigos }, () => mech()), []));
    expect(cheio.duplicar('inimigo', 0)).toBe(-1);
  });

  it('editar: cada campo, e "undefined" volta ao padrão do campo', () => {
    const e = editor(esq([mech()], []));
    e.editar('inimigo', 0, { nome: '  VULCANO ', persona: 'fujao', chassi: 'lr7lBastion', arma: { id: 'arc', tier: 2 }, dificuldade: 'dificil' });
    expect(e.lista('inimigo')[0]).toEqual({ papel: 'mech', nome: 'VULCANO', persona: 'fujao', chassi: 'lr7lBastion', arma: { id: 'arc', tier: 2 }, dificuldade: 'dificil' });
    e.editar('inimigo', 0, { nome: undefined, persona: undefined, dificuldade: undefined });
    expect(e.lista('inimigo')[0]).toEqual({ papel: 'mech', chassi: 'lr7lBastion', arma: { id: 'arc', tier: 2 } });
    e.editar('inimigo', 0, { chassi: undefined, arma: undefined });
    expect(e.lista('inimigo')[0]).toEqual(mech());
  });

  it('trocar o chassi larga a arma que ele não aceita; a que ele aceita fica', () => {
    const e = editor(esq([mech({ chassi: 'onca', arma: { id: 'cannon', tier: 0 } }), mech({ chassi: 'onca', arma: { id: 'plasma', tier: 1 } })], []));
    e.editar('inimigo', 0, { chassi: 'vector09' });
    e.editar('inimigo', 1, { chassi: 'vector09' });
    // O canhão pesado só vai nos pesados; o plasma vai em todos (o chassi padrão não aparece: é o de sempre).
    expect(e.lista('inimigo')[0]).toEqual(mech());
    expect(e.lista('inimigo')[1]).toEqual(mech({ arma: { id: 'plasma', tier: 1 } }));
  });

  it('só o Mech tem personalidade, chassi e arma; o técnico não tem dificuldade; arma que o bot não usa não pega', () => {
    const e = editor(esq([{ papel: 'android' }, { papel: 'technician' }, mech()], []));
    e.editar('inimigo', 0, { persona: 'brabo', chassi: 'onca', arma: { id: 'plasma', tier: 0 }, dificuldade: 'facil' });
    e.editar('inimigo', 1, { persona: 'manso', dificuldade: 'dificil', nome: 'FIXA' });
    e.editar('inimigo', 2, { arma: { id: 'rotary', tier: 0 } });
    expect(e.lista('inimigo')).toEqual([{ papel: 'android', dificuldade: 'facil' }, { papel: 'technician', nome: 'FIXA' }, mech()]);
    e.editar('inimigo', 9, { nome: 'NINGUÉM' });
    expect(e.lista('inimigo')).toHaveLength(3);
  });

  it('o nível da arma muda sem mudar qual é; sem arma pedida, não faz nada', () => {
    const e = editor(esq([mech({ arma: { id: 'emp', tier: 0 } }), mech()], []));
    e.editarNivel('inimigo', 0, 2);
    e.editarNivel('inimigo', 1, 2);
    expect(e.lista('inimigo')[0]!.arma).toEqual({ id: 'emp', tier: 2 });
    expect(e.lista('inimigo')[1]!.arma).toBeUndefined();
  });

  it('limparLado esvazia só aquele lado', () => {
    const e = editor();
    e.limparLado('aliado');
    expect(e.lista('aliado')).toHaveLength(0);
    expect(e.lista('inimigo')).toHaveLength(4);
  });
});

describe('os esquadrões prontos', () => {
  it('cada um cabe inteiro na Arena e vale como está (nenhum corte, nenhum robô inválido)', () => {
    expect(PREDEFINIDOS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(PREDEFINIDOS.map((p) => p.id)).size).toBe(PREDEFINIDOS.length);
    for (const p of PREDEFINIDOS) {
      const pronto = p.esquadrao(esquadraoPadrao);
      expect(sanearEsquadrao(pronto), p.id).toEqual(pronto);
      expect(p.nome, p.id).toBe(p.nome.toUpperCase());
      expect(p.descricao.length, p.id).toBeGreaterThan(10);
    }
  });

  it('o PADRÃO é o que as Configurações mandam, não o de fábrica', () => {
    const das_configuracoes = esquadraoDeFoes({ ...DEFAULT_SETTINGS, enemyMechs: 3, enemyAndroids: 0, technician: false }, 0);
    const e = new EsquadraoEditor(esq([], []), 'arena', () => das_configuracoes);
    expect(e.usarPredefinido('padrao')).toBe(0);
    expect(e.esquadrao).toEqual(das_configuracoes);
    expect(e.ehOPadrao).toBe(true);
    e.adicionar('inimigo', 'android');
    expect(e.ehOPadrao).toBe(false);
  });

  it('trocar para um pronto substitui os dois lados; no Bunker o corte é dito', () => {
    const e = editor();
    expect(e.usarPredefinido('cerco')).toBe(0);
    expect(e.resumo).toMatchObject({ inimigos: 24, aliados: 8 });
    expect(e.carga.nivel).toBe('extrema');
    const bunker = new EsquadraoEditor(esq([], []), 'bunker');
    const cortados = bunker.usarPredefinido('cerco');
    expect(cortados).toBe(32 - 11);
    expect(bunker.resumo.total).toBe(11);
    expect(bunker.excessos).toEqual([]);
    expect(editor().usarPredefinido('nao-existe')).toBeNull();
  });

  it('o Duelo e o Só Aliados são esquadrões de verdade, de um lado só', () => {
    const e = editor();
    e.usarPredefinido('duelo');
    expect(e.resumo).toMatchObject({ inimigos: 1, aliados: 0 });
    e.usarPredefinido('aliados');
    expect(e.resumo).toMatchObject({ inimigos: 0, aliados: 6 });
  });
});

describe('o que a lista mostra', () => {
  it('o esquadrão de hoje tem os nomes de hoje, com a personalidade, como a etiqueta do robô', () => {
    const e = editor();
    expect(e.descricoes('inimigo', NOMES).map((d) => d.nome)).toEqual(['CLAWD·BRABO', 'KUEN', 'DIPSIK', 'ENTRÓPICO']);
    expect(e.descricoes('aliado', NOMES).map((d) => d.nome)).toEqual(['ESCOLTA·PLASMA', 'SUPRESSOR·EMP']);
  });

  it('a linha diz o papel e só o que o robô tem de próprio, com o nome do chassi e da arma como o Hangar escreve', () => {
    const l = (b: BotSpec, lado: 'inimigo' | 'aliado' = 'inimigo') => descreverBot(b, lado, 0, NOMES).linha;
    expect(l(mech())).toBe('MECH');
    expect(l({ papel: 'android' })).toBe('ANDRÓIDE');
    expect(l({ papel: 'technician' })).toBe('TÉCNICO');
    expect(l(mech({ persona: 'brabo', chassi: 'onca', arma: { id: 'cannon', tier: 1 }, dificuldade: 'dificil' }))).toBe('MECH · brabo · ONÇA-B2 · Canhão pesado MK II · difícil');
    expect(l({ papel: 'android', dificuldade: 'facil' }, 'aliado')).toBe('ANDRÓIDE · fácil');
  });

  it('o apelido próprio vale; sem ele, o da lista de Configurações e, passando dela, REBELDE-04…', () => {
    const e = editor(esq([mech({ nome: 'ZÉ' }), mech(), mech(), mech(), { papel: 'android' }], [mech(), mech(), mech()]));
    expect(e.descricoes('inimigo', NOMES).map((d) => d.nome)).toEqual(['ZÉ', 'GEMINAI', 'CHAD-GPT', 'REBELDE-04', 'KUEN']);
    expect(e.descricoes('aliado', NOMES).map((d) => d.nome)).toEqual(['ESCOLTA·PLASMA', 'SUPRESSOR·EMP', 'ALIADO-03']);
    expect(descreverBot(mech({ persona: 'manso', nome: 'LENTO' }), 'inimigo', 0, NOMES).nome).toBe('LENTO·MANSO');
  });

  it('a posição entre os do mesmo papel (de onde saem o nome padrão e o ponto de nascimento)', () => {
    expect(indicesNoPapel([mech(), { papel: 'android' }, mech(), { papel: 'android' }, { papel: 'technician' }, mech()])).toEqual([0, 0, 1, 1, 0, 2]);
    expect(indicesNoPapel([])).toEqual([]);
  });

  it('os rótulos dos papéis e os dois lados', () => {
    expect(rotuloDoPapel('mech')).toBe('MECH');
    expect(rotuloDoPapel('android')).toBe('ANDRÓIDE');
    expect(rotuloDoPapel('technician')).toBe('TÉCNICO');
    expect(LADOS).toEqual(['inimigo', 'aliado']);
  });
});

describe('a carga que a partida pesa', () => {
  it('sobe com o peso do esquadrão e o nível acompanha (o jogo de hoje é leve)', () => {
    const e = editor();
    expect(e.carga).toMatchObject({ nivel: 'leve', peso: resumoDoEsquadrao(esquadraoPadrao()).peso });
    for (let i = 0; i < 10; i++) e.adicionar('inimigo', 'mech');
    expect(e.carga.nivel).toBe('media');
    for (let i = 0; i < 8; i++) e.adicionar('inimigo', 'mech');
    expect(e.carga.nivel).toBe('alta');
    expect(e.carga.teto).toBe(limitesDoMapa('arena').total);
  });

  it('a chave do editor é a do esquadrão (o que "copiar link" entrega)', () => {
    const e = editor();
    expect(e.chave()).toBe(chaveDoEsquadrao(esquadraoPadrao()));
    e.adicionar('inimigo', 'mech', { persona: 'manso' });
    expect(e.chave()).toBe(chaveDoEsquadrao(e.esquadrao));
    expect(e.chave()).toContain('m:pm');
  });
});

describe('editor do esquadrão: os titãs (P108)', () => {
  it('trocar o chassi de um inimigo para titã vale, com a arma de fábrica do titã; o nome padrão já é o do chassi no plano', () => {
    const e = editor(esq([mech(), mech()]));
    expect(e.editar('inimigo', 0, { chassi: 'colossusv4' })).toBeNull();
    expect(e.lista('inimigo')[0]).toEqual({ papel: 'mech', chassi: 'colossusv4' });
    // Plasma não serve ao V4 (só o canhão de cerco): a troca de arma é descartada.
    e.editar('inimigo', 0, { arma: { id: 'plasma', tier: 0 } });
    expect(e.lista('inimigo')[0]!.arma).toBeUndefined();
  });

  it('o terceiro titã é recusado com o motivo, e o robô fica como estava', () => {
    const e = editor(esq([mech({ chassi: 'colossusv4' }), mech({ chassi: 'colossus01' }), mech({ nome: 'COMUM' })]));
    const recusa = e.editar('inimigo', 2, { chassi: 'colossusv4' });
    expect(recusa).toMatch(/Já há 2 titãs: o teto é 2/);
    expect(e.lista('inimigo')[2]).toEqual({ papel: 'mech', nome: 'COMUM' });
    // Trocar um titã por outro titã não conta como um a mais.
    expect(e.editar('inimigo', 0, { chassi: 'colossus01' })).toBeNull();
    expect(e.lista('inimigo')[0]!.chassi).toBe('colossus01');
  });

  it('no Bunker nenhum titã entra, e a recusa diz para escolher a Cidade Neon', () => {
    const e = new EsquadraoEditor(esq([mech()]), 'bunker');
    expect(e.editar('inimigo', 0, { chassi: 'colossus01' })).toMatch(/Cidade Neon/);
    expect(e.lista('inimigo')[0]).toEqual({ papel: 'mech' });
    expect(e.limites.titas).toBe(0);
  });

  it('do lado aliado o titã não pega (o contrato o troca por Vector-09)', () => {
    const e = editor(esq([], [mech()]));
    e.editar('aliado', 0, { chassi: 'colossusv4' });
    expect(e.lista('aliado')[0]).toEqual({ papel: 'mech' });
  });

  it('a conta de carga e o aviso de excesso enxergam o titã', () => {
    const sem = editor(esq([mech()])).carga.peso;
    const com = editor(esq([mech({ chassi: 'colossusv4' })])).carga.peso;
    expect(com).toBeGreaterThan(sem);
    expect(new EsquadraoEditor(esq([mech({ chassi: 'colossusv4' })]), 'bunker').excessos.join(' ')).toMatch(/titãs/);
  });
});
