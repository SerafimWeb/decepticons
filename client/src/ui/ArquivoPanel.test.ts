import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IDIOMAS } from '../i18n/i18n';
import { arquivosParaTentar, conteudoValido, type ConteudoDoArquivo } from './ArquivoPanel';

const RAIZ = resolve(__dirname, '../..');
const ler = (id: string): ConteudoDoArquivo => JSON.parse(readFileSync(resolve(RAIZ, `public/arquivo/${id}.json`), 'utf8')) as ConteudoDoArquivo;
const LINGUAS = IDIOMAS.map((i) => i.id);
const IDS = ['fascismo', 'rede', 'lucro', 'medo', 'midia', 'incoerencias'];

describe('o Arquivo (P179, camada 2): que arquivo abrir', () => {
  it('a língua primeiro, depois o inglês, depois o português (sem repetir)', () => {
    expect(arquivosParaTentar('ja')).toEqual(['ja', 'en', 'pt']);
    expect(arquivosParaTentar('en')).toEqual(['en', 'pt']);
    expect(arquivosParaTentar('pt')).toEqual(['pt']);
  });

  it('um JSON quebrado, vazio ou antigo não passa (a tela não pode cair com ele)', () => {
    const bom = ler('pt');
    expect(conteudoValido(bom)).toBe(true);
    expect(conteudoValido(null)).toBe(false);
    expect(conteudoValido({})).toBe(false);
    expect(conteudoValido({ ...bom, fichas: [] })).toBe(false);
    expect(conteudoValido({ ...bom, rotulos: { ...bom.rotulos, fontes: '' } })).toBe(false);
    expect(conteudoValido({ ...bom, fichas: [{ ...bom.fichas[0]!, comoAparece: [] }] })).toBe(false);
    expect(conteudoValido({ ...bom, fichas: [{ ...bom.fichas[0]!, fonte: ' ' }] })).toBe(false);
  });
});

describe('o conteúdo do Arquivo: uma ficha por tema, em cada uma das sete línguas', () => {
  it('há um arquivo por língua do jogo, todos válidos', () => {
    for (const id of LINGUAS) expect(conteudoValido(ler(id)), id).toBe(true);
  });

  it('as seis fichas, na mesma ordem em todas as línguas, com o mesmo número de sinais (a tradução não perde nem inventa um tema)', () => {
    const base = ler('pt');
    expect(base.fichas.map((f) => f.id)).toEqual(IDS);
    for (const id of LINGUAS) {
      const c = ler(id);
      expect(c.fichas.map((f) => f.id), id).toEqual(IDS);
      c.fichas.forEach((f, i) => {
        expect(f.comoAparece.length, `${id}/${f.id}`).toBe(base.fichas[i]!.comoAparece.length);
        expect(!!f.satira, `${id}/${f.id}`).toBe(!!base.fichas[i]!.satira);
      });
    }
  });

  it('a regra "sátira exagera, fato é fato": só as incoerências são sátira (e dizem), e toda ficha traz fonte', () => {
    for (const id of LINGUAS) {
      const c = ler(id);
      expect(c.fichas.filter((f) => f.satira).map((f) => f.id), id).toEqual(['incoerencias']);
      for (const f of c.fichas) expect(f.fonte.trim().length, `${id}/${f.id}`).toBeGreaterThan(10);
    }
  });

  it('cabe na tela sem rolagem em 1280×720: o texto de cada parte tem teto', () => {
    for (const id of LINGUAS) {
      for (const f of ler(id).fichas) {
        const onde = `${id}/${f.id}`;
        expect(f.oQueE.length, onde).toBeLessThanOrEqual(340);
        expect(f.comoSeDefender.length, onde).toBeLessThanOrEqual(300);
        expect(f.fonte.length, onde).toBeLessThanOrEqual(260);
        expect(f.comoAparece.length, onde).toBeLessThanOrEqual(6);
        for (const s of f.comoAparece) expect(s.length, `${onde}: ${s}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('só arquétipos: nenhum nome de político ou bilionário vivo em nenhuma língua (decisão #9 do UNIVERSO.md: "sátira exagera, fato é fato")', () => {
    const proibidos = /trump|bolsonaro|lula\b|putin|biden|netanyahu|\bmusk|milei|zuckerberg|bezos/i;
    for (const id of LINGUAS) expect(readFileSync(resolve(RAIZ, `public/arquivo/${id}.json`), 'utf8'), id).not.toMatch(proibidos);
  });
});

describe('a ligação do Arquivo (o que o navegador mostra)', () => {
  const html = readFileSync(resolve(RAIZ, 'index.html'), 'utf8');
  const css = readFileSync(resolve(RAIZ, 'src/styles.css'), 'utf8');
  const game = readFileSync(resolve(RAIZ, 'src/core/Game.ts'), 'utf8');
  const consola = readFileSync(resolve(RAIZ, 'src/ui/CommandConsole.ts'), 'utf8');

  it('o chip ARQUIVO mora no console completo, ao lado do selo do lado, e o Game baixa o painel só no clique (pedaço sob demanda, fora do JS de partida)', () => {
    expect(html).toMatch(/<button type="button" class="cc-chip cc-arquivo" id="cc-arquivo"[^>]*>ARQUIVO ▸<\/button>\s*<button type="button" class="cc-chip cc-lado"/);
    expect(game).toMatch(/getElementById\('cc-arquivo'\)\?\.addEventListener\('click'[\s\S]*import\('\.\.\/ui\/ArquivoPanel'\)\.then\(\(m\) => m\.abrirArquivo\(\)\)/);
    expect(game).not.toMatch(/^import .* from '\.\.\/ui\/ArquivoPanel'/m);
  });

  it('as teclas do console não valem com o painel por cima (Enter não vira "jogar")', () => {
    expect(consola).toMatch(/function algoPorCima[\s\S]*\.lado-modal/);
  });

  it('o CSS pinta a ficha marcada em barra dourada com chevron (a linha selecionada da referência)', () => {
    expect(css).toMatch(/\.arq-item\[aria-selected='true'\] \{ background: linear-gradient\(90deg, #6b3f00, #ffb31f/);
    expect(css).toMatch(/\.arq-item\[aria-selected='true'\]::before \{ content: '❯'/);
  });
});
