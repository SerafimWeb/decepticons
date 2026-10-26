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

  it('oferece a Arena, o Bunker, a Praia, a Amazônia e a Praça dos Três Poderes (o 8 DE JANEIRO), nessa ordem', () => {
    expect(MAPS.map((m) => m.id)).toEqual(['arena', 'bunker', 'praia', 'amazonia', 'janeiro']);
  });

  it('o link da Amazônia abre a Amazônia na missão do rio (P180 parte C) quando se joga offline', () => {
    const href = mapHref('https://exemplo.test/cybermech/jogar/?modo=ctf', 'amazonia');
    expect(abre(href)).toBe('amazonia');
    const url = new URL(href);
    expect(url.searchParams.get('modo'), 'o link leva direto à missão (Sobrevivência); o Deathmatch do mapa é escolha do seletor de modo').toBe('survival');
    // e abre o Deathmatch da Amazônia quando o jogador o escolhe no seletor de modo
    expect(abre('https://exemplo.test/jogar/?mapa=amazonia&modo=deathmatch')).toBe('amazonia');
  });

  it('o link do 8 DE JANEIRO abre a missão contra a multidão (P233) quando se joga offline, não o Deathmatch vazio da Praça', () => {
    const href = mapHref('https://exemplo.test/cybermech/jogar/?modo=ctf', 'janeiro');
    expect(abre(href)).toBe('janeiro');
    const url = new URL(href);
    expect(url.searchParams.get('modo'), 'achado 26/10: o link caía sem `modo`, e sem ele a missão (a multidão) nem monta').toBe('survival');
  });

  it('o link do Bunker abre o Bunker', () => {
    expect(abre(mapHref('https://exemplo.test/cybermech/jogar/', 'bunker'))).toBe('bunker');
  });

  it('o link da Praia abre a Praia (a ESTAÇÃO DE CABOS, P126), no treino livre', () => {
    const href = mapHref('https://exemplo.test/cybermech/jogar/?modo=ctf', 'praia');
    const u = new URL(href);
    expect(u.searchParams.get('mapa')).toBe('praia');
    expect(u.searchParams.has('modo')).toBe(false);
    expect(abre(href)).toBe('praia');
  });

  it('online (P218, etapa O1) todo mapa vale: o link fica na sala e no servidor, troca só o mapa e tira o modo (a sala online é o Deathmatch)', () => {
    const online = 'https://exemplo.test/jogar/?sala=ARENA&servidor=wss://jogo.test&modo=survival';
    for (const mapa of ['bunker', 'praia', 'amazonia'] as const) {
      const href = mapHref(online, mapa);
      const u = new URL(href);
      expect(u.searchParams.get('sala')).toBe('ARENA');
      expect(u.searchParams.get('servidor')).toBe('wss://jogo.test');
      expect(u.searchParams.has('modo')).toBe(false);
      expect(abre(href, true), mapa).toBe(mapa);
    }
  });

  it('online, o 8 DE JANEIRO também leva à missão (P251/P253: a mesma sala aceita `modo=survival`), diferente dos outros mapas que caem no Deathmatch', () => {
    const href = mapHref('https://exemplo.test/jogar/?sala=ARENA&servidor=wss://jogo.test&nome=PILOTO', 'janeiro');
    const u = new URL(href);
    expect(u.searchParams.get('sala'), 'o jogador fica na mesma sala: é assim que o amigo que já estava lá o encontra').toBe('ARENA');
    expect(u.searchParams.get('nome')).toBe('PILOTO');
    expect(u.searchParams.get('modo')).toBe('survival');
    expect(abre(href, true)).toBe('janeiro');
  });

  it('o link da Arena tira o mapa e preserva o resto do endereço', () => {
    const href = mapHref('https://exemplo.test/jogar/?mapa=bunker&build=abc', 'arena');
    const u = new URL(href);
    expect(u.searchParams.has('mapa')).toBe(false);
    expect(u.searchParams.get('build')).toBe('abc');
    expect(abre(href)).toBe('arena');
  });
});
