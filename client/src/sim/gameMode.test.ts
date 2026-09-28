import { describe, expect, it } from 'vitest';
import { gameModeFromSearch } from './gameMode';

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
