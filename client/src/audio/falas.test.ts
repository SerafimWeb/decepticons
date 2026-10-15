import { describe, expect, it } from 'vitest';
import catalogo from './falas.json';
import geradas from './vozesGeradas.json';
import { caminhoDaFala, chaveDaRodada, chaveDaSequencia, FALAS, falaDe, falaGerada, NARRACOES, narracaoDaUrl, ROTULO_DA_NARRACAO, SOTAQUES } from './falas';

describe('catálogo de falas (P146)', () => {
  it('toda fala tem chave única, um estilo conhecido e texto não vazio nos quatro sotaques', () => {
    expect(new Set(FALAS.map((f) => f.chave)).size).toBe(FALAS.length);
    for (const f of FALAS) {
      expect(Object.keys(catalogo.estilos), f.chave).toContain(f.estilo);
      for (const s of SOTAQUES) expect(f.texto[s].trim().length, `${f.chave}/${s}`).toBeGreaterThan(0);
    }
  });

  it('o texto brasileiro está em português e o dos outros sotaques em inglês (o sotaque é da voz)', () => {
    for (const f of FALAS) {
      expect(f.texto.ru, f.chave).toBe(f.texto.en);
      expect(f.texto.cn, f.chave).toBe(f.texto.en);
    }
    expect(falaDe('combate')!.texto).toMatchObject({ br: 'Combate!', en: 'Fight!' });
    expect(falaDe('voce_morreu')!.texto.en).toBe('You die.');
  });

  it('as rodadas de 1 a 9 e as sequências de 2 a 6 têm fala; fora disso não há', () => {
    for (let n = 1; n <= 9; n++) expect(falaDe(chaveDaRodada(n)!), `rodada ${n}`).toBeDefined();
    for (const n of [0, 10, -1, 1.5, NaN]) expect(chaveDaRodada(n), String(n)).toBeNull();
    for (let n = 2; n <= 6; n++) expect(falaDe(chaveDaSequencia(n)!), `sequência ${n}`).toBeDefined();
    expect(chaveDaSequencia(1)).toBeNull();
    expect(chaveDaSequencia(0)).toBeNull();
    expect(chaveDaSequencia(7)).toBe('abate_6');
    expect(chaveDaSequencia(40)).toBe('abate_6');
  });

  it('o catálogo inteiro cabe na cota gratuita do gerador: poucos caracteres por sotaque', () => {
    for (const s of SOTAQUES) {
      const caracteres = FALAS.reduce((n, f) => n + f.texto[s].length, 0);
      expect(caracteres, s).toBeLessThan(500);
    }
  });

  it('cada sotaque tem um rótulo; o mix e o off existem', () => {
    for (const n of NARRACOES) expect(ROTULO_DA_NARRACAO[n].length).toBeGreaterThan(2);
    expect(NARRACOES).toContain('mix');
    expect(NARRACOES).toContain('off');
  });

  it('o caminho do clipe é audio/vozes/<sotaque>/<chave>.mp3', () => {
    expect(caminhoDaFala('ru', 'combate')).toBe('audio/vozes/ru/combate.mp3');
  });

  it('o manifesto só lista falas que existem no catálogo, e falaGerada responde por ele', () => {
    for (const s of SOTAQUES) for (const chave of geradas[s]) expect(falaDe(chave), `${s}/${chave}`).toBeDefined();
    expect(falaGerada('br', 'combate', { br: ['combate'] })).toBe(true);
    expect(falaGerada('en', 'combate', { br: ['combate'] })).toBe(false);
    expect(falaGerada('br', 'rodada_1', { br: ['combate'] })).toBe(false);
  });

  it('?narrador= na URL força a voz; valor inválido ou ausente é ignorado', () => {
    expect(narracaoDaUrl('?narrador=ru')).toBe('ru');
    expect(narracaoDaUrl('?mapa=praia&narrador=mix')).toBe('mix');
    expect(narracaoDaUrl('?narrador=off')).toBe('off');
    expect(narracaoDaUrl('?narrador=klingon')).toBeNull();
    expect(narracaoDaUrl('?mapa=praia')).toBeNull();
    expect(narracaoDaUrl('')).toBeNull();
  });
});
