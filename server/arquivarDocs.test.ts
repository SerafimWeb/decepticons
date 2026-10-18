import { describe, expect, it } from 'vitest';
import { acrescentar, agrupar, dataDoTitulo, dividirEstado, dividirHistorico, quinzena } from '../scripts/arquivar-docs.mjs';

/**
 * `npm run arquivar` move texto antigo do ESTADO e do HISTÓRICO para `.decepticons/arquivo/`. O erro que custa caro aqui é perder
 * linha (o arquivo é a única cópia que sobra) ou arquivar o que o painel e o ritual de sessão leem pelo nome.
 */
const CORTE = '2026-10-17';
const ESTADO = [
  '# ESTADO ATUAL — CYBERMECH',
  '',
  '## DE HOJE — Claude, 18/10 (branch `a`)',
  'linha de hoje',
  '',
  '## DE ANTEONTEM — Claude, 15/10 (branch `b`)',
  'linha de anteontem',
  '',
  '## CONTINUAÇÃO DO 11/10 — Claude, 18/10 (branch `c`)',
  'o título cita um dia velho, mas é de hoje',
  '',
  '## SEM DATA NENHUMA',
  'seção sem data fica',
  '',
  '## EM BRANCH — NÃO ESTÁ NO AR',
  '| Branch | PR |',
  '|---|---|',
  '| `x` | #1 |',
  '',
  '---',
  '',
  '- entrega antiga que já está na main',
  '',
  '## DIVISÃO DE TRABALHO ENTRE AGENTES (de 09/10)',
  '| **Claude** | x | y |',
  '',
  '## ÚLTIMA SESSÃO FEZ (09/10, Claude: x)',
  'sessão velha em baixo do arquivo',
  '',
].join('\n');

describe('arquivar o ESTADO_ATUAL', () => {
  const { fica, saem } = dividirEstado(ESTADO, CORTE);

  it('arquiva só a seção com data anterior ao corte (e a velha do pé do arquivo)', () => {
    expect(fica).not.toContain('linha de anteontem');
    expect(fica).not.toContain('sessão velha em baixo');
    const titulos = saem.filter((s) => s.chave !== 'em-branch').map((s) => s.texto.split('\n')[0]);
    expect(titulos).toEqual(['## DE ANTEONTEM — Claude, 15/10 (branch `b`)', '## ÚLTIMA SESSÃO FEZ (09/10, Claude: x)']);
  });

  it('mantém o de hoje, o que cita dia velho mas é de hoje e o que não tem data', () => {
    expect(fica).toContain('linha de hoje');
    expect(fica).toContain('o título cita um dia velho, mas é de hoje');
    expect(fica).toContain('seção sem data fica');
  });

  it('nunca arquiva uma seção fixa, mesmo com data no título (o painel as lê pelo nome)', () => {
    expect(fica).toContain('## DIVISÃO DE TRABALHO ENTRE AGENTES (de 09/10)');
    expect(fica).toContain('| **Claude** | x | y |');
  });

  it('de EM BRANCH fica a tabela e sai só o histórico de entregas, que vai para o arquivo próprio', () => {
    expect(fica).toContain('| `x` | #1 |');
    expect(fica).not.toContain('entrega antiga que já está na main');
    expect(saem.find((s) => s.chave === 'em-branch')?.texto).toContain('entrega antiga que já está na main');
  });

  it('não perde nenhuma linha: tudo que havia está no que ficou ou no que saiu', () => {
    const todas = new Set([...fica.split('\n'), ...saem.flatMap((s) => s.texto.split('\n'))]);
    for (const l of ESTADO.split('\n').filter((x) => x.trim())) expect(todas.has(l), `perdeu: ${l}`).toBe(true);
  });

  it('é idempotente: arquivar de novo o que já ficou não move nada nem repete o aviso', () => {
    const outra = dividirEstado(fica, CORTE);
    expect(outra.saem).toEqual([]);
    expect(outra.fica).toBe(fica);
    expect(fica.match(/\*\*Arquivo:\*\*/g)).toHaveLength(1);
  });
});

describe('arquivar o HISTORICO_DE_DECISOES', () => {
  const HIST = ['## [2026-10-18] hoje', 'corpo de hoje', '', '## [2026-10-16] antes do corte', 'corpo velho', '', '## [2026-09-24] bem velha', 'corpo muito velho', ''].join('\n');

  it('sai o que é anterior ao corte, entra o aviso no topo e o resto fica na ordem', () => {
    const { fica, saem } = dividirHistorico(HIST, CORTE);
    expect(fica).toContain('## [2026-10-18] hoje');
    expect(fica).not.toContain('corpo velho');
    expect(fica.split('\n')[0]).toContain('**Arquivo:**');
    expect(saem.map((s) => s.chave)).toEqual(['2026-10-b', '2026-09-b']);
  });

  it('um título fora do formato (`## 06/10 — Codex: …`) segue a entrada de colchetes que vem antes: sai e fica junto com ela', () => {
    const h = ['## [2026-10-18] hoje', 'c1', '', '## 2026-10-10 — Codex: legado colado em hoje', 'c2', '', '## [2026-10-05] velha', 'c3', '', '## 06/10 — Codex: legado colado na velha', 'c4', ''].join('\n');
    const { fica, saem } = dividirHistorico(h, CORTE);
    expect(fica).toContain('legado colado em hoje');
    expect(fica).not.toContain('legado colado na velha');
    const saiu = saem.map((s) => s.texto).join('\n');
    expect(saiu).toContain('## [2026-10-05] velha');
    expect(saiu).toContain('legado colado na velha');
    expect(fica.split(/^## \[/m).slice(1)).toHaveLength(1);
  });

  it('o painel continua achando as entradas: o aviso fica antes da primeira e não vira entrada', () => {
    const { fica } = dividirHistorico(HIST, CORTE);
    expect(fica.split(/^## \[/m).slice(1)).toHaveLength(1);
  });
});

describe('as peças', () => {
  it('a data do título é a mais recente dele, com o ano do corte', () => {
    expect(dataDoTitulo('X — Claude, 18/10 (continua 11/10)', CORTE)).toBe('2026-10-18');
    expect(dataDoTitulo('sem data', CORTE)).toBeNull();
    expect(dataDoTitulo('G11/G12 e P137/P139', CORTE)).toBeNull();
    expect(dataDoTitulo('de 30/12', '2026-01-05')).toBe('2025-12-30');
  });

  it('a quinzena separa 1 a 15 de 16 em diante', () => {
    expect(quinzena('2026-10-15')).toBe('2026-10-a');
    expect(quinzena('2026-10-16')).toBe('2026-10-b');
  });

  it('o que sai depois vai logo abaixo do cabeçalho do arquivo, antes do que já estava', () => {
    const cab = '# ARQUIVO';
    const primeiro = acrescentar('', agrupar([{ chave: 'k', texto: '## velho\nv' }]).get('k')!, cab);
    const segundo = acrescentar(primeiro, '## novo\nn\n', cab);
    expect(segundo.indexOf('## novo')).toBeLessThan(segundo.indexOf('## velho'));
    expect(segundo.match(/<!-- arquivo -->/g)).toHaveLength(1);
  });
});
