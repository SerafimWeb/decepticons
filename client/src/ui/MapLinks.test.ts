import { describe, expect, it } from 'vitest';
import { mapFromSearch } from '../environment/Bunker';
import { MAPS, mapHref } from './MapLinks';

/** O link do seletor precisa levar a um endereço em que o jogo realmente abre o mapa escolhido. */
describe('mapHref: o link do seletor de mapa', () => {
  const abre = (href: string, online = false) => {
    const u = new URL(href);
    const modo = u.searchParams.get('modo') ?? 'deathmatch';
    return mapFromSearch(u.search, online, modo);
  };

  it('oferece a Arena e o Bunker, nessa ordem', () => {
    expect(MAPS.map((m) => m.id)).toEqual(['arena', 'bunker']);
  });

  it('o link do Bunker abre o Bunker', () => {
    expect(abre(mapHref('https://exemplo.test/cybermech/jogar/', 'bunker'))).toBe('bunker');
  });

  it('sai da sala online e do modo atual: sem isso o jogo ignora o mapa e continua na arena', () => {
    const online = 'https://exemplo.test/jogar/?sala=ARENA&servidor=wss://jogo.test&modo=survival';
    const href = mapHref(online, 'bunker');
    const u = new URL(href);
    expect(u.searchParams.has('sala')).toBe(false);
    expect(u.searchParams.has('servidor')).toBe(false);
    expect(u.searchParams.has('modo')).toBe(false);
    expect(abre(href)).toBe('bunker');
    expect(abre(online.replace('&modo=survival', '&mapa=bunker'), true)).toBe('arena'); // o contrário prova a trava: online ignora o mapa
  });

  it('o link da Arena tira o mapa e preserva o resto do endereço', () => {
    const href = mapHref('https://exemplo.test/jogar/?mapa=bunker&build=abc', 'arena');
    const u = new URL(href);
    expect(u.searchParams.has('mapa')).toBe(false);
    expect(u.searchParams.get('build')).toBe('abc');
    expect(abre(href)).toBe('arena');
  });
});
