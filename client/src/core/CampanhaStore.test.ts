import { describe, expect, it } from 'vitest';
import { campanhaPadrao, campanhasDeFabrica, type CampanhaSpec } from '../sim/campanha';
import { CAMPANHAS_STORAGE_KEY, CampanhaStore, LIMITE_DE_CAMPANHAS_SALVAS } from './CampanhaStore';

const armazem = (inicial?: string) => {
  const d = new Map<string, string>(inicial === undefined ? [] : [[CAMPANHAS_STORAGE_KEY, inicial]]);
  return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k), d };
};
const com = (nome: string | undefined, base: CampanhaSpec = campanhaPadrao()): CampanhaSpec => {
  const c = structuredClone(base);
  if (nome === undefined) delete c.nome;
  else c.nome = nome;
  return c;
};

describe('as campanhas salvas do Comandante', () => {
  it('começa vazia e guarda pelo nome; o que foi salvo volta igual em outra sessão', () => {
    const a = armazem();
    const s = new CampanhaStore(a);
    expect(s.list()).toEqual([]);
    const minha = com('NOITE LONGA', campanhasDeFabrica()[1]!);
    expect(s.save(minha)).toBe('ok');
    expect(new CampanhaStore(a).list()).toEqual([minha]);
  });

  it('salvar com um nome que já existe troca a campanha (sem diferença de maiúsculas); outro nome acrescenta', () => {
    const s = new CampanhaStore(armazem());
    s.save(com('Neon'));
    s.save(com('NEON', campanhasDeFabrica()[1]!));
    expect(s.list()).toHaveLength(1);
    expect(s.list()[0]!.etapas).toHaveLength(4);
    s.save(com('Outra'));
    expect(s.list().map((c) => c.nome)).toEqual(['NEON', 'Outra']);
  });

  it('sem nome não salva; os nomes das campanhas de fábrica são reservados; a lista tem teto', () => {
    const s = new CampanhaStore(armazem());
    expect(s.save(com(undefined))).toBe('sem-nome');
    expect(s.save(com('operação neon'))).toBe('reservado');
    expect(s.save(com('Sobrevivência'))).toBe('reservado');
    for (let i = 0; i < LIMITE_DE_CAMPANHAS_SALVAS; i++) expect(s.save(com(`C${i}`))).toBe('ok');
    expect(s.save(com('Nona'))).toBe('cheio');
    expect(s.save(com('C0', campanhasDeFabrica()[1]!))).toBe('ok'); // trocar uma que existe não é acrescentar
    expect(s.list()).toHaveLength(LIMITE_DE_CAMPANHAS_SALVAS);
  });

  it('apagar pelo nome; apagar a última limpa o armazenamento; nome que não existe devolve false', () => {
    const a = armazem();
    const s = new CampanhaStore(a);
    s.save(com('A'));
    s.save(com('B'));
    expect(s.remove('a')).toBe(true);
    expect(s.list().map((c) => c.nome)).toEqual(['B']);
    expect(s.remove('zzz')).toBe(false);
    s.remove('B');
    expect(a.d.has(CAMPANHAS_STORAGE_KEY)).toBe(false);
  });

  it('o que sai de list() é uma cópia: mudar não altera a lista guardada', () => {
    const s = new CampanhaStore(armazem());
    s.save(com('A'));
    s.list()[0]!.etapas.length = 0;
    expect(s.list()[0]!.etapas).toHaveLength(1);
  });

  it('guardado adulterado, de outra versão ou repetido não derruba nem vira a campanha padrão: some', () => {
    for (const lixo of ['', 'texto solto', '{"v":1}', '[1,null,"x"]', '[{"v":2,"nome":"Futuro","etapas":[]}]', '[{"v":1,"nome":"Sem etapa","etapas":[]}]']) {
      expect(new CampanhaStore(armazem(lixo)).list(), lixo).toEqual([]);
    }
    const boa = com('Boa');
    const repetida = JSON.stringify([boa, com('BOA'), { v: 1, etapas: boa.etapas }]); // o segundo repete o nome; o terceiro não tem nome
    expect(new CampanhaStore(armazem(repetida)).list().map((c) => c.nome)).toEqual(['Boa']);
  });

  it('sem armazenamento (aba anônima) ou com ele cheio: não salva e diz, sem lançar', () => {
    expect(new CampanhaStore(null).save(com('A'))).toBe('sem-armazenamento');
    const cheio = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => undefined };
    const s = new CampanhaStore(cheio);
    expect(s.save(com('A'))).toBe('sem-armazenamento');
    expect(s.list()).toEqual([]); // nada ficou na memória que o disco não tem
  });
});
