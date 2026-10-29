import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_OPCOES_DO_PASSO, proximoIndice, rotuloDoPasso } from './Passo';

const RAIZ = resolve(__dirname, '../..');

describe('o passo do `‹ valor ›` (P182)', () => {
  it('avança e volta pelas opções, e dá a volta (depois do último, o primeiro; antes do primeiro, o último)', () => {
    expect(proximoIndice(0, 4, 1)).toBe(1);
    expect(proximoIndice(2, 4, 1)).toBe(3);
    expect(proximoIndice(3, 4, 1)).toBe(0);
    expect(proximoIndice(1, 4, -1)).toBe(0);
    expect(proximoIndice(0, 4, -1)).toBe(3);
  });

  it('uma só opção fica nela mesma; sem opções, não há para onde ir (-1)', () => {
    expect(proximoIndice(0, 1, 1)).toBe(0);
    expect(proximoIndice(0, 1, -1)).toBe(0);
    expect(proximoIndice(-1, 0, 1)).toBe(-1);
    expect(proximoIndice(0, 0, -1)).toBe(-1);
  });

  it('nada marcado (-1): o passo para a frente cai na primeira, o passo para trás cai na última', () => {
    expect(proximoIndice(-1, 3, 1)).toBe(0);
    expect(proximoIndice(-1, 3, -1)).toBe(2);
  });

  it('o rótulo é o texto da opção marcada, sem espaços nas pontas; sem marcada, vazio', () => {
    const opcoes = [{ textContent: ' Automática ' }, { textContent: 'Alta' }] as unknown as HTMLOptionsCollection;
    expect(rotuloDoPasso({ selectedIndex: 0, options: opcoes })).toBe('Automática');
    expect(rotuloDoPasso({ selectedIndex: 1, options: opcoes })).toBe('Alta');
    expect(rotuloDoPasso({ selectedIndex: -1, options: opcoes })).toBe('');
    expect(rotuloDoPasso({ selectedIndex: 5, options: opcoes })).toBe('');
  });

  it('só vira passo o select com poucas opções (a lista de idiomas e os números grandes ficam como lista)', () => {
    expect(MAX_OPCOES_DO_PASSO).toBeGreaterThanOrEqual(6); // as seis vozes do narrador cabem
    expect(MAX_OPCOES_DO_PASSO).toBeLessThan(10);
  });
});

describe('a ligação e o estilo (o que o navegador de verdade mostra)', () => {
  const css = readFileSync(resolve(RAIZ, 'src/styles.css'), 'utf8');

  it('o CSS tem o conjunto `‹ valor ›` e a linha em barra dourada com chevron (a referência dos jogos antigos)', () => {
    expect(css).toMatch(/\.passo-valor\s*\{/);
    expect(css).toMatch(/\.passo-seta\s*\{/);
    expect(css).toMatch(/\.settings-box \.setting-row:hover[^{]*\{[^}]*linear-gradient\(90deg, #6b3f00, #ffb31f/);
    expect(css).toMatch(/\.settings-box \.setting-row::before\s*\{[^}]*content: '❯'/);
  });

  it('as Configurações vestem a qualidade, a dificuldade, o narrador, o microfone e o efeito da voz', () => {
    const menu = readFileSync(resolve(RAIZ, 'src/ui/SettingsMenu.ts'), 'utf8');
    expect(menu).toMatch(/for \(const s of \[this\.selQuality, this\.selDiff, this\.selNarracao, this\.selVozModo, this\.selVozEfeito\]\) ligarPasso\(s\)/);
  });

  it('o seletor de idioma NÃO vira passo (sete línguas pedem a lista, e o select do canto é o da primeira tela)', () => {
    const menu = readFileSync(resolve(RAIZ, 'src/ui/SettingsMenu.ts'), 'utf8');
    expect(menu).not.toMatch(/ligarPasso\([^)]*[Ii]dioma/);
  });
});
