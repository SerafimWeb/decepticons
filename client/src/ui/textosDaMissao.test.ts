import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CHAVES_DA_MISSAO, linhaDeStatus, motivoDoFim, objetivoDoBriefing, tituloDoFim } from './textosDaMissao';

const IDIOMAS = ['en', 'es', 'fr', 'ja', 'ru', 'zh'] as const;
const tabelaDo = (id: string): Record<string, string> =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../public/locales/${id}.json`, import.meta.url)), 'utf8'));

describe('os textos da missão de combate na tela (P314, corte 2)', () => {
  it('a linha de cima leva o tipo, os alvos caídos e o prazo que resta, arredondado para cima e nunca negativo', () => {
    expect(linhaDeStatus('caca', 0, 1, 149.2)).toBe('CAÇA · ALVOS 0/1 · 150 s');
    expect(linhaDeStatus('destruicao', 2, 3, 0)).toBe('DESTRUIÇÃO · ALVOS 2/3 · 0 s');
    expect(linhaDeStatus('aniquilacao', 4, 6, -3)).toBe('ANIQUILAÇÃO · ALVOS 4/6 · 0 s');
  });

  it('o fim diz como acabou: cumprida, prazo esgotado ou piloto caído', () => {
    expect(tituloDoFim('cumprida', 'caca')).toBe('CAÇA CUMPRIDA');
    expect(tituloDoFim('tempo', 'destruicao')).toBe('PRAZO ESGOTADO');
    expect(tituloDoFim('morte', 'aniquilacao')).toBe('VOCÊ CAIU');
    expect(motivoDoFim('cumprida', 'destruicao')).toBe('OS TRÊS ALVOS CAÍRAM DENTRO DO PRAZO');
    expect(motivoDoFim('tempo', 'caca')).toBe('O PRAZO ACABOU ANTES DO OBJETIVO');
    expect(motivoDoFim('morte', 'caca')).toBe('O PILOTO CAIU ANTES DO FIM');
  });

  it('o objetivo do briefing diz o que fazer em cada tipo', () => {
    expect(objetivoDoBriefing('caca')).toBe('DERRUBE O ALVO MARCADO ANTES DO PRAZO');
    expect(objetivoDoBriefing('destruicao')).toBe('DERRUBE OS TRÊS MECHS MARCADOS');
    expect(objetivoDoBriefing('aniquilacao')).toBe('NENHUM INIMIGO DE PÉ');
  });

  it('cada chave da missão tem tradução nos seis idiomas: a tela não mostra português num idioma escolhido', () => {
    for (const id of IDIOMAS) {
      const tabela = tabelaDo(id);
      for (const chave of CHAVES_DA_MISSAO) expect(tabela[chave], `${id}: ${chave}`).toBeTruthy();
    }
  });
});
