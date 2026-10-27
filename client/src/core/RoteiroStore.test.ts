import { describe, expect, it } from 'vitest';
import { roteiroPadrao, type RoteiroSpec } from '../sim/Roteiro';
import { LIMITE_DE_ROTEIROS_SALVOS, ROTEIROS_STORAGE_KEY, RoteiroStore } from './RoteiroStore';

const armazem = (inicial?: string) => {
  const d = new Map<string, string>(inicial === undefined ? [] : [[ROTEIROS_STORAGE_KEY, inicial]]);
  return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k), d };
};
const com = (nome: string | undefined, base: RoteiroSpec = roteiroPadrao()): RoteiroSpec => {
  const r = structuredClone(base);
  if (nome === undefined) delete r.nome;
  else r.nome = nome;
  return r;
};

describe('os roteiros do WARGAME salvos pelo Comandante', () => {
  it('começa vazio e guarda pelo nome; o que foi salvo volta igual em outra sessão', () => {
    const a = armazem();
    const s = new RoteiroStore(a);
    expect(s.list()).toEqual([]);
    const meu = com('EPISÓDIO 1');
    expect(s.save(meu)).toBe('ok');
    expect(new RoteiroStore(a).list()).toEqual([meu]);
  });

  it('salvar com um nome que já existe troca o roteiro (sem diferença de maiúsculas); outro nome acrescenta', () => {
    const s = new RoteiroStore(armazem());
    s.save(com('Ataque'));
    const trocado: RoteiroSpec = { ...com('ATAQUE'), beats: [{ tick: 0, legenda: { texto: 'novo', duracaoS: 2 } }] };
    s.save(trocado);
    expect(s.list()).toHaveLength(1);
    expect(s.list()[0]!.beats).toHaveLength(1);
    s.save(com('Outro'));
    expect(s.list().map((r) => r.nome)).toEqual(['ATAQUE', 'Outro']);
  });

  it('um roteiro com nome mas sem nenhuma batida ainda (só o elenco) também salva', () => {
    const s = new RoteiroStore(armazem());
    expect(s.save(com('Rascunho'))).toBe('ok');
    expect(s.list()[0]!.beats).toEqual([]);
  });

  it('sem nome não salva; a lista tem teto', () => {
    const s = new RoteiroStore(armazem());
    expect(s.save(com(undefined))).toBe('sem-nome');
    for (let i = 0; i < LIMITE_DE_ROTEIROS_SALVOS; i++) expect(s.save(com(`R${i}`))).toBe('ok');
    expect(s.save(com('Mais um'))).toBe('cheio');
    expect(s.save(com('R0', { ...roteiroPadrao(), beats: [{ tick: 1, legenda: { texto: 'x', duracaoS: 1 } }] }))).toBe('ok'); // trocar um que existe não é acrescentar
    expect(s.list()).toHaveLength(LIMITE_DE_ROTEIROS_SALVOS);
  });

  it('apagar pelo nome; apagar o último limpa o armazenamento; nome que não existe devolve false', () => {
    const a = armazem();
    const s = new RoteiroStore(a);
    s.save(com('A'));
    s.save(com('B'));
    expect(s.remove('a')).toBe(true);
    expect(s.list().map((r) => r.nome)).toEqual(['B']);
    expect(s.remove('zzz')).toBe(false);
    s.remove('B');
    expect(a.d.has(ROTEIROS_STORAGE_KEY)).toBe(false);
  });

  it('o que sai de list() é uma cópia: mudar não altera a lista guardada', () => {
    const s = new RoteiroStore(armazem());
    s.save({ ...com('A'), beats: [{ tick: 1, legenda: { texto: 'x', duracaoS: 1 } }] });
    s.list()[0]!.beats.length = 0;
    expect(s.list()[0]!.beats).toHaveLength(1);
  });

  it('guardado adulterado, de outra versão, sem nome ou repetido não derruba nem inventa nada: some', () => {
    for (const lixo of ['', 'texto solto', '{"v":1}', '[1,null,"x"]', '[{"v":2,"nome":"Futuro","mapa":"arena","beats":[]}]', '[{"v":1,"mapa":"arena","beats":[]}]']) {
      expect(new RoteiroStore(armazem(lixo)).list(), lixo).toEqual([]);
    }
    const boa = com('Boa');
    const repetida = JSON.stringify([boa, com('BOA'), { v: 1, mapa: 'arena', beats: [] }]); // o segundo repete o nome; o terceiro não tem nome
    expect(new RoteiroStore(armazem(repetida)).list().map((r) => r.nome)).toEqual(['Boa']);
  });

  it('sem armazenamento (aba anônima) ou com ele cheio: não salva e diz, sem lançar', () => {
    expect(new RoteiroStore(null).save(com('A'))).toBe('sem-armazenamento');
    const cheio = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => undefined };
    const s = new RoteiroStore(cheio);
    expect(s.save(com('A'))).toBe('sem-armazenamento');
    expect(s.list()).toEqual([]); // nada ficou na memória que o disco não tem
  });
});
