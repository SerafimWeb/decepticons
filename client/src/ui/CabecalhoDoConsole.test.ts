import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = resolve(__dirname, '../..');
const html = readFileSync(resolve(RAIZ, 'index.html'), 'utf8');
const css = readFileSync(resolve(RAIZ, 'src/styles.css'), 'utf8');
const game = readFileSync(resolve(RAIZ, 'src/core/Game.ts'), 'utf8');

/** O trecho de um grupo de botões do cabeçalho, do `<div class="cc-grupo …">` ao fechamento dele. */
const grupo = (classe: string): string => {
  const i = html.indexOf(`<div class="cc-grupo ${classe}"`);
  expect(i, classe).toBeGreaterThan(-1);
  return html.slice(i, html.indexOf('</div>', i));
};

describe('o cabeçalho do console (P279)', () => {
  it('os botões estão em dois grupos: do piloto (ARQUIVO, LADO, RELATÓRIO) e do Comandante (VISIBILIDADE, TELÕES, OUTDOORS, WARGAME e o SAIR), cada um com os mesmos ids de sempre', () => {
    const piloto = grupo('cc-grupo-piloto');
    for (const id of ['cc-arquivo', 'cc-lado', 'cc-relatorio']) expect(piloto).toContain(`id="${id}"`);
    const comando = grupo('cc-grupo-comando');
    for (const id of ['cc-visibilidade', 'cc-telao', 'cc-outdoors', 'cc-wargame', 'cc-chip-comandante']) expect(comando).toContain(`id="${id}"`);
    // Nenhum botão do cabeçalho fora de um grupo.
    const cabecalho = html.slice(html.indexOf('<header class="cc-top'), html.indexOf('</header>', html.indexOf('<header class="cc-top')));
    expect((cabecalho.match(/class="cc-chip /g) ?? []).length).toBe(8);
    expect((piloto.match(/class="cc-chip /g) ?? []).length + (comando.match(/class="cc-chip /g) ?? []).length).toBe(8);
  });

  it('o selo da sala online mora no cabeçalho (embaixo do nome da sala de comando) e o Game o escreve junto com o do HUD', () => {
    expect(html).toMatch(/<div class="cc-info">\s*<p class="cc-sala">[\s\S]*<\/p>\s*<p class="cc-online" id="cc-online" role="status" hidden><\/p>\s*<\/div>/);
    expect(game).toMatch(/private escreverStatusOnline\(texto: string, ruim: boolean\): void \{[\s\S]*getElementById\('cc-online'\)/);
    // As duas escritas do texto do selo passam pelo método (nenhuma escreve só no do HUD, que some com o console aberto).
    expect(game.match(/this\.netStatus\.textContent =/g) ?? []).toHaveLength(1);
  });

  it('o selo do HUD some com o console aberto, para não ficar por cima do cabeçalho, e fica abaixo do quadro da missão', () => {
    expect(css).toMatch(/body:has\(#overlay\.console:not\(\.hidden\)\) \.net-status \{ display: none; \}/);
    expect(css).toMatch(/\.net-status \{\s*position: fixed;\s*top: 52px;/);
  });
});
