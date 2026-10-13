import { describe, expect, it } from 'vitest';
import { campanhasDeFabrica, linkDaEtapa } from '../sim/campanha';
import { ESQUADRAO_VERSAO, type EsquadraoSpec, chaveDoEsquadrao, esquadraoPadrao } from '../sim/esquadrao';
import { ESQUADRAO_STORAGE_KEY, EsquadraoStore } from './EsquadraoStore';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), data };
}

const GRANDE: EsquadraoSpec = {
  v: ESQUADRAO_VERSAO,
  inimigos: [{ papel: 'mech', persona: 'brabo', nome: 'ZÉ' }, { papel: 'mech' }, { papel: 'android' }, { papel: 'technician' }],
  aliados: [{ papel: 'mech' }, { papel: 'mech', chassi: 'arara' }, { papel: 'android' }],
};

describe('esquadrão salvo no aparelho e por link', () => {
  it('sem nada salvo, não há esquadrão personalizado: valem as configurações', () => {
    const s = new EsquadraoStore(memory(), '');
    expect(s.current).toBeNull();
    expect(s.custom).toBe(false);
    expect(s.key()).toBe(chaveDoEsquadrao(esquadraoPadrao()));
  });

  it('salva e volta: o esquadrão sobrevive a recarregar a página', () => {
    const disco = memory();
    new EsquadraoStore(disco, '').save(GRANDE);
    const de_novo = new EsquadraoStore(disco, '');
    expect(de_novo.current).toEqual(GRANDE);
    expect(de_novo.custom).toBe(true);
  });

  it('salvar `null` apaga e volta às configurações', () => {
    const disco = memory();
    const s = new EsquadraoStore(disco, '');
    s.save(GRANDE);
    expect(disco.data.has(ESQUADRAO_STORAGE_KEY)).toBe(true);
    s.save(null);
    expect(disco.data.has(ESQUADRAO_STORAGE_KEY)).toBe(false);
    expect(new EsquadraoStore(disco, '').current).toBeNull();
  });

  it('o link entra e fica salvo para as próximas partidas; o link ruim é ignorado', () => {
    const disco = memory();
    const doLink = new EsquadraoStore(disco, `?esquadrao=${chaveDoEsquadrao(GRANDE)}`);
    expect(doLink.current).toEqual(GRANDE);
    expect(new EsquadraoStore(disco, '').current).toEqual(GRANDE);
    expect(new EsquadraoStore(memory(), '?esquadrao=hack').current).toBeNull();
    // Link ruim não apaga nem troca o que já estava salvo.
    expect(new EsquadraoStore(disco, '?esquadrao=hack').current).toEqual(GRANDE);
  });

  it('uma etapa de campanha usa o esquadrão do link só nesta partida: o que o Comandante tinha salvo continua salvo', () => {
    const disco = memory();
    new EsquadraoStore(disco).save(GRANDE);
    const op = campanhasDeFabrica()[1]!;
    const etapa = new EsquadraoStore(disco, linkDaEtapa(op, 2));
    expect(etapa.current).toEqual(op.etapas[1]!.esquadrao);
    expect(new EsquadraoStore(disco, '').current).toEqual(GRANDE); // a próxima partida comum volta ao dele
    // Sem a campanha no link, o comportamento é o de sempre: o link vira o salvo.
    new EsquadraoStore(disco, `?esquadrao=${chaveDoEsquadrao(op.etapas[1]!.esquadrao)}`);
    expect(new EsquadraoStore(disco, '').current).toEqual(op.etapas[1]!.esquadrao);
  });

  it('`?esquadrao=padrao` apaga o salvo (o link de "voltar ao padrão")', () => {
    const disco = memory();
    new EsquadraoStore(disco, '').save(GRANDE);
    const volta = new EsquadraoStore(disco, '?esquadrao=padrao');
    expect(volta.current).toBeNull();
    expect(new EsquadraoStore(disco, '').current).toBeNull();
  });

  it('salvo adulterado, de outra versão ou quebrado é como não ter nada (e nunca vira o padrão calado)', () => {
    expect(new EsquadraoStore(memory({ [ESQUADRAO_STORAGE_KEY]: '{quebrado' }), '').current).toBeNull();
    expect(new EsquadraoStore(memory({ [ESQUADRAO_STORAGE_KEY]: JSON.stringify({ v: 2, inimigos: [], aliados: [] }) }), '').current).toBeNull();
    expect(new EsquadraoStore(memory({ [ESQUADRAO_STORAGE_KEY]: '42' }), '').current).toBeNull();
    expect(new EsquadraoStore(memory({ [ESQUADRAO_STORAGE_KEY]: 'null' }), '').current).toBeNull();
  });

  it('o que está salvo passa pelo saneamento: robô inválido sai, o excesso é cortado', () => {
    const sujo = { v: 1, inimigos: [{ papel: 'mech' }, { papel: 'tanque' }, ...Array.from({ length: 80 }, () => ({ papel: 'mech' }))], aliados: [{ papel: 'technician' }] };
    const s = new EsquadraoStore(memory({ [ESQUADRAO_STORAGE_KEY]: JSON.stringify(sujo) }), '');
    expect(s.current!.inimigos.length).toBeLessThanOrEqual(24);
    expect(s.current!.inimigos.every((b) => b.papel === 'mech')).toBe(true);
    expect(s.current!.aliados).toEqual([]);
  });

  it('sem armazenamento (aba anônima), vale o link e nada quebra', () => {
    const quebrado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); }, removeItem: () => { throw new Error('bloqueado'); } };
    expect(new EsquadraoStore(quebrado, '').current).toBeNull();
    const s = new EsquadraoStore(quebrado, `?esquadrao=${chaveDoEsquadrao(GRANDE)}`);
    expect(s.current).toEqual(GRANDE);
    expect(() => s.save(GRANDE)).not.toThrow();
    expect(new EsquadraoStore(null, '').current).toBeNull();
  });
});
