import { describe, expect, it } from 'vitest';
import { gameModeFromSearch, missaoFromSearch } from './gameMode';

describe('o modo missão no link (P314)', () => {
  it('?modo=missao é o modo de missão; o tipo vem em ?missao=', () => {
    expect(gameModeFromSearch('?modo=missao')).toBe('missao');
    expect(missaoFromSearch('?modo=missao&missao=destruicao')).toBe('destruicao');
    expect(missaoFromSearch('?modo=missao&missao=aniquilacao')).toBe('aniquilacao');
  });

  it('sem tipo, ou com um tipo que não existe, a missão é a caça', () => {
    expect(missaoFromSearch('?modo=missao')).toBe('caca');
    expect(missaoFromSearch('?modo=missao&missao=xyz')).toBe('caca');
  });

  it('os outros modos continuam como eram', () => {
    expect(gameModeFromSearch('?modo=survival')).toBe('survival');
    expect(gameModeFromSearch('?modo=dominio')).toBe('dominio');
    expect(gameModeFromSearch('')).toBe('deathmatch');
  });
});
