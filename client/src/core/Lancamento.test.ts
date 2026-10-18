import { afterEach, describe, expect, it } from 'vitest';
import { mapFromSearch } from '../environment/Bunker';
import { campanhasDeFabrica } from '../sim/campanha';
import { estadoDoTeatro, TEATROS } from '../ui/theater';
import { aplicarLancamento, mapaLiberado, MAPAS_DO_LANCAMENTO, TODOS_OS_MAPAS } from './Lancamento';

/** Os mapas do lançamento (P197): só a Cidade Neon e a Estação dos Cabos; o Bunker e a Terras Raras "em breve"; o Comandante abre tudo. */
describe('mapas do lançamento', () => {
  afterEach(() => aplicarLancamento(true)); // os outros testes do projeto contam com tudo aberto

  it('o padrão é tudo aberto (os testes e as bancadas não precisam saber de lançamento)', () => {
    expect(TODOS_OS_MAPAS.every((m) => mapaLiberado(m))).toBe(true);
  });

  it('no lançamento só a Cidade Neon (arena) e a Estação dos Cabos (praia) estão livres', () => {
    aplicarLancamento(false);
    expect([...MAPAS_DO_LANCAMENTO]).toEqual(['arena', 'praia']);
    expect(TODOS_OS_MAPAS.filter((m) => mapaLiberado(m))).toEqual(['arena', 'praia']);
  });

  it('um link para um mapa fechado cai na Cidade Neon; os livres abrem; o Comandante abre todos', () => {
    aplicarLancamento(false);
    expect(mapFromSearch('?mapa=amazonia&modo=survival', false, 'survival')).toBe('arena');
    expect(mapFromSearch('?mapa=bunker', false, 'deathmatch')).toBe('arena');
    expect(mapFromSearch('?mapa=praia', false, 'survival')).toBe('praia');
    expect(mapFromSearch('', false, 'deathmatch')).toBe('arena');
    aplicarLancamento(true);
    expect(mapFromSearch('?mapa=amazonia&modo=survival', false, 'survival')).toBe('amazonia');
    expect(mapFromSearch('?mapa=bunker', false, 'deathmatch')).toBe('bunker');
  });

  it('o teatro mostra o mapa fechado "em breve" (não leva a lugar nenhum), e o aberto continua disponível', () => {
    const rio = TEATROS.find((t) => t.mapa === 'amazonia')!;
    const bunker = TEATROS.find((t) => t.mapa === 'bunker')!;
    const cabos = TEATROS.find((t) => t.mapa === 'praia')!;
    aplicarLancamento(false);
    expect(estadoDoTeatro(rio, 'arena', 'deathmatch')).toBe('em-breve');
    expect(estadoDoTeatro(bunker, 'arena', 'deathmatch')).toBe('em-breve');
    expect(estadoDoTeatro(cabos, 'arena', 'deathmatch')).toBe('disponivel');
    aplicarLancamento(true);
    expect(estadoDoTeatro(rio, 'arena', 'deathmatch')).toBe('disponivel');
    expect(estadoDoTeatro(rio, 'amazonia', 'deathmatch')).toBe('aqui');
  });

  it('a Terras Raras (ex-Rio Vivo) tem o nome novo no teatro', () => {
    expect(TEATROS.find((t) => t.mapa === 'amazonia')!.nome).toBe('TERRAS RARAS');
  });

  it('as campanhas de fábrica perdem a etapa de mapa fechado (a Operação Neon abre no Bunker) e nenhuma ficha fica vazia', () => {
    const todas = campanhasDeFabrica().find((c) => c.nome === 'OPERAÇÃO NEON')!;
    expect(todas.etapas.some((e) => e.mapa === 'bunker')).toBe(true);
    aplicarLancamento(false);
    const abertas = campanhasDeFabrica();
    const neon = abertas.find((c) => c.nome === 'OPERAÇÃO NEON')!;
    expect(neon.etapas.length).toBe(todas.etapas.length - 1);
    expect(neon.etapas.every((e) => mapaLiberado(e.mapa))).toBe(true);
    expect(abertas.every((c) => c.etapas.length > 0)).toBe(true);
  });
});
