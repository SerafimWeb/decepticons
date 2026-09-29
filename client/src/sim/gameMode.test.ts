import { describe, expect, it } from 'vitest';
import { gameModeFromSearch, waveFromSearch } from './gameMode';

describe('modo da partida', () => {
  it('aceita os dois nomes do modo sobrevivência no link', () => {
    expect(gameModeFromSearch('?modo=survival')).toBe('survival');
    expect(gameModeFromSearch('?modo=sobrevivencia')).toBe('survival');
  });

  it('mantém deathmatch como padrão seguro', () => {
    expect(gameModeFromSearch('')).toBe('deathmatch');
    expect(gameModeFromSearch('?modo=inventado')).toBe('deathmatch');
  });

  it('aceita o modo CTF', () => {
    expect(gameModeFromSearch('?modo=ctf')).toBe('ctf');
  });
});

describe('atalho de bancada ?onda=', () => {
  it('começa a missão na onda pedida, dentro do intervalo', () => {
    expect(waveFromSearch('?onda=6', 6)).toBe(6);
    expect(waveFromSearch('?onda=3', 6)).toBe(3);
  });

  it('sem o parâmetro (ou com lixo) começa na primeira onda', () => {
    expect(waveFromSearch('', 6)).toBe(1);
    expect(waveFromSearch('?onda=abc', 6)).toBe(1);
    expect(waveFromSearch('?onda=0', 6)).toBe(1);
    expect(waveFromSearch('?onda=-3', 6)).toBe(1);
  });

  it('não passa do fim da missão nem inventa onda fracionária', () => {
    expect(waveFromSearch('?onda=99', 6)).toBe(6);
    expect(waveFromSearch('?onda=4.7', 6)).toBe(4);
  });
});
