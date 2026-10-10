import { describe, expect, it } from 'vitest';
import { mapFromSearch } from '../environment/Bunker';
import { mapHref } from './MapLinks';

/** O link do botão precisa levar a um endereço em que o jogo realmente abre o Bunker (e de volta à arena). */
describe('mapHref: o link do botão do mapa', () => {
  const abre = (href: string, online = false) => {
    const u = new URL(href);
    const modo = u.searchParams.get('modo') ?? 'deathmatch';
    return mapFromSearch(u.search, online, modo);
  };

  it('da arena leva ao Bunker', () => {
    expect(abre(mapHref('https://exemplo.test/cybermech/jogar/', 'arena'))).toBe('bunker');
  });

  it('sai da sala online e do modo atual: sem isso o jogo ignora o mapa e continua na arena', () => {
    const online = 'https://exemplo.test/jogar/?sala=ARENA&servidor=wss://jogo.test&modo=survival';
    const href = mapHref(online, 'arena');
    const u = new URL(href);
    expect(u.searchParams.has('sala')).toBe(false);
    expect(u.searchParams.has('servidor')).toBe(false);
    expect(u.searchParams.has('modo')).toBe(false);
    expect(abre(href)).toBe('bunker');
    expect(abre(online.replace('&modo=survival', '&mapa=bunker'), true)).toBe('arena'); // o contrário prova a trava: online ignora o mapa
  });

  it('do Bunker volta à arena e preserva o resto do endereço', () => {
    const href = mapHref('https://exemplo.test/jogar/?mapa=bunker&build=abc', 'bunker');
    const u = new URL(href);
    expect(u.searchParams.has('mapa')).toBe(false);
    expect(u.searchParams.get('build')).toBe('abc');
    expect(abre(href)).toBe('arena');
  });
});
