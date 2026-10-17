import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEAPON_IDS } from '../combat/weapons';

const RAIZ = resolve(__dirname, '../..');

describe('as dicas das armas no Hangar (public/dicas-do-hangar.json)', () => {
  const dicas = JSON.parse(readFileSync(resolve(RAIZ, 'public/dicas-do-hangar.json'), 'utf8')) as Record<string, unknown>;

  it('há uma dica para cada arma do jogo, e só delas (arma nova sem dica quebra aqui; o Record do TypeScript não vê o JSON)', () => {
    expect(Object.keys(dicas).sort()).toEqual([...WEAPON_IDS].sort());
  });

  it('cada dica é um texto de verdade, e nenhuma se repete', () => {
    const textos = Object.values(dicas);
    for (const t of textos) {
      expect(typeof t).toBe('string');
      expect((t as string).length).toBeGreaterThan(10);
    }
    expect(new Set(textos).size).toBe(textos.length);
  });
});
