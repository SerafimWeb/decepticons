import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error módulos .mjs de script, sem tipos
import { salaSite } from '../scripts/site/sala.mjs';
// @ts-expect-error módulo .mjs de script, sem tipos
import { TERMOS_PROIBIDOS, textoVisivel, vazamentos } from '../scripts/site/vitrine.mjs';

/**
 * A VITRINE (21/10, ordem do Comandante: "divulgando só o superficial … não ensinamos a clonarem nossas ideias e processos"). Naquele dia a `/sala-de-controle/` publicava a hospedagem, o túnel, o protocolo, os
 * títulos de todos os PRs e a confissão de uma queda; a oficina publicava as dívidas do código e o mapa da arquitetura. Aqui se prova que o que é de dentro **não sai** na versão pública.
 */
const RAIZ = resolve(import.meta.dirname, '..');

describe('a guarda da vitrine (scripts/site/vitrine.mjs)', () => {
  it('pega cada termo de infraestrutura, segurança ou processo no texto visível, sem diferenciar maiúscula', () => {
    for (const termo of TERMOS_PROIBIDOS as string[]) {
      expect(vazamentos(`<main><p>Nós usamos ${termo.toUpperCase()} aqui.</p></main>`), termo).toContain(termo);
    }
  });

  it('só olha o que a pessoa lê: script, estilo, comentário e atributo não contam; o título e a descrição contam', () => {
    expect(vazamentos('<script>const token = 1; // Cloudflare</script><style>.hook{}</style><!-- worktree --><a data-x="túnel">oi</a>')).toEqual([]);
    expect(vazamentos('<title>Painel do atualizador</title><p>oi</p>')).toEqual(['atualizador']);
    expect(vazamentos('<meta name="description" content="Rodamos na Hostinger"><p>oi</p>')).toEqual(['Hostinger']);
  });

  it('palavra inteira: "backups" e "committed" não são "backup" nem "commit", mas "commit." é', () => {
    expect(vazamentos('<p>fazemos backups; committed</p>')).toEqual([]);
    expect(vazamentos('<p>cada commit. Cada merge!</p>').sort()).toEqual(['commit', 'merge']);
  });

  it('o `site.mjs --check` roda a guarda nas páginas servidas (apagar a chamada deixaria o vazamento voltar em silêncio)', () => {
    const site = readFileSync(resolve(RAIZ, 'scripts/site.mjs'), 'utf8');
    expect(site).toContain("import { vazamentos } from './site/vitrine.mjs'");
    expect(site).toMatch(/vazamentos\(html\)/);
    for (const pagina of ["['/', homeText]", "['oficina/', shopHtml]", "['sala-de-controle/', controlHtml]"]) expect(site, pagina).toContain(pagina);
  });

  it('o texto visível ignora marcação mas guarda as palavras', () => {
    expect(textoVisivel('<h1>Olá <b>mundo</b></h1><script>x()</script>')).toContain('Olá mundo');
  });
});

describe('a página do esquadrão: pública só o superficial, interna a completa', () => {
  const SEGREDO = 'SEGREDO-INTERNO';
  const equipe = [
    { key: 'dono', name: 'DAN', role: `${SEGREDO} papel do dono (revisão cruzada)` },
    { key: 'claude', name: 'CLAUDE', role: `${SEGREDO} papel do claude (CI, deploy, hooks)` },
  ];
  const secao = (id: string, texto: string) => `<section aria-labelledby="${id}"><h2 id="${id}">${texto}</h2><p>${SEGREDO} ${texto}</p></section>`;
  const bodyLocal = [
    '<nav class="combat-nav"><a href="#validar-build">x</a></nav>',
    // A única seção do markup antigo que a versão pública mantém: é orientação ao jogador, sem o texto-isca.
    '<section aria-labelledby="validar-build"><h2 id="validar-build">O que observar ao jogar</h2><p>Confira a mira.</p></section>',
    ...['proximas-decisoes', 'novidades', 'fichas', 'protocolo', 'evolucao', 'ritmo', 'rota', 'gestao', 'frentes', 'diario', 'entregas'].map((id) => secao(id, `Seção ${id}`)),
  ].join('\n');
  const entrada = (modo: 'publico' | 'interno') => ({
    BASE: '../',
    TEAM: equipe,
    act: { commits: [{ merge: false, agent: 'claude', subject: `${SEGREDO} corrige o túnel`, t: '2026-10-21T12:00:00Z' }], byAgent: { claude: 7 }, total: 7, merges: 3 },
    prs: [{ n: 436, title: `${SEGREDO} o online não derruba o servidor`, agents: ['claude'], fronts: ['servidor'], add: 100 }],
    log: [{ date: '2026-10-21', title: 'decisão' }],
    asked: 5,
    last: { tests: 3857, loc: 73016 },
    stats: { pct: 50, done: 5, total: 10 },
    estado: {},
    fronts: [{ tag: 'servidor', name: 'Servidor' }],
    fromGithub: true,
    nf: (n: number) => String(n),
    when: () => '21/10 09:00',
    flow: [['PASSO', `${SEGREDO} o ciclo`, 'amostra']],
    bodyLocal,
    m: { day: 30, first: '2026-09-21', version: 'v0.1' },
    modo,
  });

  it('a pública leva a equipe (com a frase curada) e o guia ao jogador; nada do processo, dos números nem das seções internas', () => {
    const { body, css, js } = salaSite(entrada('publico')) as { body: string; css: string; js: string };
    expect(body).toContain('O ESQUADRÃO');
    expect(body).toContain('O que observar ao jogar');
    expect(body).toContain('Direção de produto e game design. Define a visão do jogo'); // a frase curada, não o `role` do ESTADO_ATUAL
    expect(body).not.toContain(SEGREDO);
    for (const proibido of ['Atividade', 'Como um pedido vira jogo', 'Linhas de código', 'Commits', 'Entregas', 'Seção diario', 'Seção protocolo', 'Seção gestao', 'Seção entregas', 'Testes']) expect(body, proibido).not.toContain(proibido);
    expect(vazamentos(body)).toEqual([]);
    expect(css).toContain('.sq-grid');
    expect(css).not.toContain('.logbox'); // nem CSS nem JS do que a página não tem
    expect(js).toBe('');
  });

  it('a interna leva tudo: números, atividade, fluxo e as seções de processo', () => {
    const { body, css, js } = salaSite(entrada('interno')) as { body: string; css: string; js: string };
    expect(body).toContain('SALA DE CONTROLE');
    expect(body).toContain(`${SEGREDO} papel do dono`);
    for (const dentro of ['Atividade', 'Como um pedido vira jogo', 'Linhas de código', 'Seção diario', 'Seção protocolo', 'Seção gestao', 'Seção entregas']) expect(body, dentro).toContain(dentro);
    expect(css).toContain('.logbox');
    expect(js).toContain('.logbox');
  });
});
