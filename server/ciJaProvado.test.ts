import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { avaliar, decidirJaProvado } from '../scripts/ciJaProvado.mjs';

/**
 * O push na main só pula o check pesado quando a árvore já passou no PR (P222). O perigo é pular o que devia rodar: por isso cada condição tem o seu teste, e qualquer dúvida roda o check.
 */
const ok = { evento: 'push', arvore: 'a'.repeat(40), arvoreDoPai2: 'a'.repeat(40), rodadasVerdesDoPai2: 1 };

describe('decidirJaProvado: só com as quatro condições juntas', () => {
  it('push, junção, árvore igual e uma execução verde do PR: provado', () => {
    const d = decidirJaProvado(ok);
    expect(d.provado).toBe(true);
    expect(d.motivo).toContain('já passou no check do PR');
  });

  it('um PR (não é push): nunca pula, é onde o check roda de verdade', () => {
    expect(decidirJaProvado({ ...ok, evento: 'pull_request' }).provado).toBe(false);
    expect(decidirJaProvado({ ...ok, evento: '' }).provado).toBe(false);
  });

  it('sem segundo pai (squash ou rebase): roda o check', () => {
    expect(decidirJaProvado({ ...ok, arvoreDoPai2: '' }).provado).toBe(false);
    expect(decidirJaProvado({ ...ok, arvore: '' }).provado).toBe(false);
  });

  it('a árvore da main difere da do PR (a main andou): roda o check', () => {
    const d = decidirJaProvado({ ...ok, arvoreDoPai2: 'b'.repeat(40) });
    expect(d.provado).toBe(false);
    expect(d.motivo).toContain('difere');
  });

  it('o PR não tem execução verde (zero, ou lixo): roda o check', () => {
    for (const verdes of [0, -1, Number.NaN, undefined as unknown as number]) expect(decidirJaProvado({ ...ok, rodadasVerdesDoPai2: verdes }).provado, String(verdes)).toBe(false);
  });
});

describe('avaliar: junta git e gh, e na dúvida roda o check', () => {
  const sha = 'c'.repeat(40);
  const pai2 = 'd'.repeat(40);
  const git = (arvoreDoMerge: string, arvoreDoPr: string, temPai2 = true) => (args: string[]) => {
    const alvo = args.at(-1) ?? '';
    if (alvo.endsWith('^2')) return temPai2 ? pai2 : '';
    if (alvo === `${sha}^{tree}`) return arvoreDoMerge;
    if (alvo === `${pai2}^{tree}`) return arvoreDoPr;
    return '';
  };

  it('a árvore igual e uma execução verde do PR: provado, e o gh é consultado pelo commit do PR', () => {
    const chamadas: string[][] = [];
    const d = avaliar({ evento: 'push', sha }, { executarGit: git('T1', 'T1'), executarGh: (a) => (chamadas.push(a), '1') });
    expect(d.provado).toBe(true);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toEqual(expect.arrayContaining(['--commit', pai2, '--event', 'pull_request', '--status', 'success']));
  });

  it('árvore diferente: nem pergunta ao gh (poupa a chamada) e roda o check', () => {
    let chamou = false;
    const d = avaliar({ evento: 'push', sha }, { executarGit: git('T1', 'T2'), executarGh: () => ((chamou = true), '1') });
    expect(d.provado).toBe(false);
    expect(chamou).toBe(false);
  });

  it('sem segundo pai: roda o check', () => {
    expect(avaliar({ evento: 'push', sha }, { executarGit: git('T1', 'T1', false), executarGh: () => '1' }).provado).toBe(false);
  });

  it('o gh falha (vazio) ou devolve lixo: roda o check, sem lançar', () => {
    for (const saida of ['', 'não é número', '0']) expect(avaliar({ evento: 'push', sha }, { executarGit: git('T1', 'T1'), executarGh: () => saida }).provado, saida).toBe(false);
  });

  it('qualquer exceção vira "não provado", nunca derruba o job', () => {
    const d = avaliar({ evento: 'push', sha }, {
      executarGit: () => {
        throw new Error('git quebrou');
      },
      executarGh: () => '1',
    });
    expect(d.provado).toBe(false);
    expect(d.motivo).toContain('git quebrou');
  });

  it('evento que não é push, ou sem sha: roda o check', () => {
    expect(avaliar({ evento: 'pull_request', sha }, { executarGit: git('T1', 'T1'), executarGh: () => '1' }).provado).toBe(false);
    expect(avaliar({ evento: 'push', sha: '' }, { executarGit: git('T1', 'T1'), executarGh: () => '1' }).provado).toBe(false);
  });
});

describe('o script de verdade, num repositório de mentira', () => {
  const RAIZ = resolve('.tmp', `teste-ci-provado-${process.pid}`);
  afterAll(() => rmSync(RAIZ, { recursive: true, force: true }));

  it('num commit comum (sem segundo pai) escreve ja_provada=false em GITHUB_OUTPUT e sai com 0', () => {
    mkdirSync(RAIZ, { recursive: true });
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k];
    const git = (...a: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.invalido', '-c', 'commit.gpgsign=false', ...a], { cwd: RAIZ, encoding: 'utf8', env });
    git('init', '-q');
    git('commit', '-q', '--allow-empty', '-m', 'um');
    const sha = git('rev-parse', 'HEAD').stdout.trim();
    const saida = join(RAIZ, 'saida.txt');
    const r = spawnSync(process.execPath, [resolve('scripts/ciJaProvado.mjs')], { cwd: RAIZ, encoding: 'utf8', env: { ...env, GITHUB_EVENT_NAME: 'push', GITHUB_SHA: sha, GITHUB_OUTPUT: saida } });
    expect(r.status).toBe(0);
    expect(existsSync(saida)).toBe(true);
    expect(readFileSync(saida, 'utf8').trim()).toBe('ja_provada=false');
    expect(r.stdout).toContain('roda o check');
  });
});
