import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { carregarDicionario, idiomaInicial as idiomaInicialDoJogo, traduzir, type Dicionario } from '../client/src/i18n/i18n';
import { CHAVE_IDIOMA, IDIOMAS, criarTradutor, idiomaInicial } from '../scripts/site/idioma-landing.js';

/**
 * O idioma da landing (P178: "idioma tem que ficar logo no início da landing"). A landing é uma página estática sem build: o tradutor dela é JavaScript puro
 * (`scripts/site/idioma-landing.js`). O jogo tem o dele em TypeScript (`client/src/i18n/i18n.ts`). **Os dois fazem a mesma conta e este teste os compara**, para não se afastarem.
 */
const RAIZ = resolve(__dirname, '..');
const LOCALES = resolve(RAIZ, 'scripts/site/locales');
const OUTRAS = IDIOMAS.filter((i) => i.id !== 'pt').map((i) => i.id);
const ler = (id: string): Dicionario => JSON.parse(readFileSync(resolve(LOCALES, `${id}.json`), 'utf8')) as Dicionario;
const LACUNA = /\{\d+\}/g;

describe('o tradutor da landing faz a mesma conta que o do jogo', () => {
  const dic: Dicionario = {
    CALOR: 'HEAT',
    'ONDA {0}': 'WAVE {0}',
    'ONDA {0} ELIMINADA': 'WAVE {0} CLEARED',
    'DE {0} PARA {1}': 'TO {1} FROM {0}',
    'Pilotar {0}': 'Pilot {0}',
    ANDRÓIDE: 'ANDROID',
    'Tamanho {0} · {1}': 'Size {0} · {1}',
    'Pequeno e ágil': 'Small and agile',
    'Custa (R$ {0}) + taxa?': 'Costs ($ {0}) + fee?',
    'frase com quebra de linha': 'sentence with a line break',
    'faltam {0} · fim{1}': '{0} left · end{1}',
    '· +{0} pilotos': '· +{0} pilots',
  };
  const ENTRADAS = [
    'CALOR', '  CALOR \n', 'TEXTO NOVO', '', '   ', '00:42', '100%', 'ONDA 3', 'ONDA 4 ELIMINADA', 'DE Rio PARA Fortaleza', 'Pilotar ANDRÓIDE', 'Pilotar Fulano',
    'Tamanho 1 · Pequeno e ágil', 'Tamanho 2 · 5,3 m', 'Custa (R$ 5) + taxa?', 'Custa (R$ 5) + taxa', 'frase com\n   quebra   de linha', 'faltam 1:30 · fim · +3 pilotos', 'faltam 1:30 · fim',
  ];

  it('a mesma resposta para cada entrada (exata, padrões, lacunas traduzidas, margens, espaços quebrados, sem tradução)', () => {
    carregarDicionario(dic);
    const dojogo = ENTRADAS.map((t) => traduzir(t));
    const dalanding = ENTRADAS.map((t) => criarTradutor(dic)(t));
    expect(dalanding).toEqual(dojogo);
    expect(dalanding[ENTRADAS.indexOf('frase com\n   quebra   de linha')]).toBe('sentence with a line break');
    carregarDicionario(null);
  });

  it('sem dicionário a landing devolve o texto como veio (o português é o padrão)', () => {
    expect(criarTradutor(null)('CALOR')).toBe('CALOR');
    expect(criarTradutor({})('CALOR')).toBe('CALOR');
  });

  it('a escolha da língua é a mesma conta do jogo (link, salva, navegador, e o navegador de teste não detecta)', () => {
    const casos: Array<[string, string | null, string | undefined, boolean]> = [
      ['?lang=ja', 'en', 'fr-FR', false], ['', 'es', 'fr-FR', false], ['', null, 'fr-FR', false], ['?lang=ZH-CN', null, undefined, false],
      ['?lang=klingon', 'xx', 'de-DE', false], ['', null, undefined, false], ['', null, 'en-US', true], ['?lang=en', null, 'en-US', true], ['', 'ja', 'en-US', true],
    ];
    for (const [a, b, c, d] of casos) expect(idiomaInicial(a, b, c, d), JSON.stringify([a, b, c, d])).toBe(idiomaInicialDoJogo(a, b, c, d));
  });

  it('a landing e o jogo guardam a escolha na mesma chave (quem escolhe aqui entra no jogo na língua dele) e listam as mesmas sete línguas', () => {
    expect(CHAVE_IDIOMA).toBe('cybermech.lang');
    expect(IDIOMAS.map((i) => i.id)).toEqual(['pt', 'en', 'es', 'fr', 'ja', 'zh', 'ru']);
  });

  it('para cada dicionário da landing, as duas implementações traduzem cada chave igual', () => {
    for (const id of OUTRAS) {
      const d = ler(id);
      carregarDicionario(d);
      const t = criarTradutor(d);
      for (const chave of Object.keys(d)) expect(t(chave), `${id}: ${chave}`).toBe(traduzir(chave));
      carregarDicionario(null);
    }
  });
});

describe('os dicionários da landing (scripts/site/locales)', () => {
  it('um arquivo por língua, e só deles', () => {
    expect(readdirSync(LOCALES).sort()).toEqual(OUTRAS.map((i) => `${i}.json`).sort());
  });

  it('as seis línguas têm as mesmas chaves, sem tradução vazia, com as mesmas lacunas {n}', () => {
    const base = Object.keys(ler('en')).sort();
    expect(base.length).toBeGreaterThan(150);
    for (const id of OUTRAS) {
      const d = ler(id);
      expect(Object.keys(d).sort(), id).toEqual(base);
      for (const [chave, valor] of Object.entries(d)) {
        expect(valor.trim(), `${id}: ${chave}`).not.toBe('');
        expect((valor.match(LACUNA) ?? []).sort(), `${id}: lacunas de ${chave}`).toEqual((chave.match(LACUNA) ?? []).sort());
      }
    }
  });

  it('cada língua usa a escrita dela (a tradução não é o português copiado)', () => {
    const marca: Record<string, RegExp> = { ja: /[぀-ヿ一-鿿]/, zh: /[一-鿿]/, ru: /[Ѐ-ӿ]/ };
    for (const [id, re] of Object.entries(marca)) {
      const valores = Object.values(ler(id));
      expect(valores.filter((v) => re.test(v)).length / valores.length, id).toBeGreaterThan(0.85);
    }
  });
});

describe('a landing de verdade (montada pelo gerador): a faixa no topo e a cobertura do que o visitante lê', () => {
  const SAIDA = resolve(RAIZ, '.tmp/landing-teste');
  let html = '';
  beforeAll(() => {
    rmSync(SAIDA, { recursive: true, force: true });
    execFileSync('node', ['scripts/landing.mjs', '--out', resolve(SAIDA, 'index.html')], { cwd: RAIZ, stdio: 'ignore' });
    html = readFileSync(resolve(SAIDA, 'index.html'), 'utf8');
  }, 240_000);

  it('a faixa de idiomas é a PRIMEIRA coisa do corpo (antes da navegação), com as sete línguas pelo nome nativo', () => {
    const corpo = html.slice(html.indexOf('<div class="wrap">'));
    expect(corpo.indexOf('class="lang-strip"')).toBeGreaterThan(0);
    expect(corpo.indexOf('class="lang-strip"')).toBeLessThan(corpo.indexOf('class="hnav"'));
    for (const nome of ['Português', 'English', 'Español', 'Français', '日本語', '中文', 'Русский']) expect(corpo).toContain(`>${nome}</button>`);
    expect(corpo).toMatch(/<nav class="lang-strip"[^>]*data-i18n="nao"/); // os nomes das línguas nunca são traduzidos
  });

  it('o módulo e os dicionários vão ao lado da página', () => {
    expect(html).toContain('<script type="module" src="idioma.js"></script>');
    expect(existsSync(resolve(SAIDA, 'idioma.js'))).toBe(true);
    for (const id of OUTRAS) expect(existsSync(resolve(SAIDA, 'locales', `${id}.json`)), id).toBe(true);
  });

  it('a cobertura: 90% ou mais dos textos e das dicas de imagem da landing têm tradução (texto novo sem tradução aparece aqui antes de ir ao ar)', () => {
    const limpo = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|<svg[\s\S]*?<\/svg>/g, '');
    const textos = new Set<string>();
    for (const m of limpo.matchAll(/>([^<>]+)</g)) textos.add(m[1]!.replace(/\s+/g, ' ').trim());
    for (const m of limpo.matchAll(/\b(?:title|aria-label|alt)="([^"]+)"/g)) textos.add(m[1]!.replace(/\s+/g, ' ').trim());
    const dentroDaFaixa = /^(Português|English|Español|Français|日本語|中文|Русский)$/;
    const traduzivel = [...textos].filter((x) => /\p{L}{3,}/u.test(x) && !dentroDaFaixa.test(x) && !/Idioma · Language/.test(x));
    const d = ler('ja');
    carregarDicionario(d);
    const faltam = traduzivel.filter((x) => traduzir(x) === x && !d[x]);
    carregarDicionario(null);
    const cobertura = 1 - faltam.length / traduzivel.length;
    expect(cobertura, `faltam: ${faltam.slice(0, 12).join(' | ')}`).toBeGreaterThanOrEqual(0.9);
  });
});
