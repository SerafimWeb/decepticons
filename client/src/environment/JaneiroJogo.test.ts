import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABERTURA_DA_MISSAO } from './JaneiroJogo';

const RAIZ = resolve(__dirname, '../..');
const FICHA = readFileSync(resolve(RAIZ, '../.decepticons/fichas/fatos-8-de-janeiro.md'), 'utf8');

describe('a abertura da missão do 8 de Janeiro (P233): só o que a ficha de fatos libera', () => {
  it('o texto é a frase 🟢 que a ficha de fatos define para o briefing (§ 5, item 2), palavra por palavra', () => {
    expect(FICHA).toContain(ABERTURA_DA_MISSAO);
  });

  it('só papéis: nenhuma pessoa real é nomeada, e não afirma o que a ficha contesta ("os militares não aderiram")', () => {
    expect(ABERTURA_DA_MISSAO).not.toMatch(/bolsonaro|lula\b|moraes|trump|putin|biden|musk|milei/i);
    expect(ABERTURA_DA_MISSAO).not.toMatch(/militares/i);
  });

  it('cabe numa caixa pequena (a abertura não esconde o jogo): até 200 caracteres', () => {
    expect(ABERTURA_DA_MISSAO.length).toBeLessThanOrEqual(200);
  });
});
