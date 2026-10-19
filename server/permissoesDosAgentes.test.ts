import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARQUIVOS_DE_PERMISSOES, foraDaListaFechada, motivoDeRisco, normalizar, PERMITIDAS, permissoesPerigosas, TOLERADAS } from '../scripts/permissoesDosAgentes.mjs';

const RAIZ = resolve(__dirname, '..');
const lerAllow = (arquivo: string): string[] => {
  const j = JSON.parse(readFileSync(resolve(RAIZ, arquivo), 'utf8')) as { permissions?: { allow?: unknown } };
  const allow = j.permissions?.allow;
  expect(Array.isArray(allow), `${arquivo}: permissions.allow tem de ser uma lista`).toBe(true);
  expect((allow as unknown[]).every((p) => typeof p === 'string'), `${arquivo}: toda permissão é um texto`).toBe(true);
  return allow as string[];
};

/** A lista que apareceu no `.qwen/settings.json` em 19/10 e que o alerta de segurança apontou: o que ela tem de perigoso tem de reprovar. */
const ALARGADA_DE_19_10 = [
  'Bash(rmdir *)', 'Bash(git worktree *)', 'Bash(git fetch *)', 'Bash(git add *)', 'Bash(git commit *)', 'Bash(dir *)', 'Bash(@find *)', 'Bash(get-content *)', 'Bash(.count)', 'Bash(mklink *)', 'Bash(npm run *)', 'Bash(timeout *)',
  'Bash(git branch *)', 'Bash(powershell *)', 'Bash(type *)', 'Bash(cmd *)', 'Bash(git ls-remote *)', 'Bash(git merge *)', 'Bash(git *)', 'Bash(copy *)', 'Bash(cd *)', 'Bash(git checkout *)', 'Bash(echo *)', 'Bash(git status *)',
];

describe('as permissões dos agentes (P208): nada de interpretador nem família do git com coringa', () => {
  for (const arquivo of ARQUIVOS_DE_PERMISSOES) {
    it(`${arquivo}: dentro da regra (o arquivo que não existe é ignorado)`, () => {
      if (!existsSync(resolve(RAIZ, arquivo))) return;
      const achadas = permissoesPerigosas(lerAllow(arquivo), (TOLERADAS as Record<string, string[]>)[arquivo] ?? []);
      expect(achadas.map((a) => `${a.permissao}: ${a.motivo}`), `${arquivo} libera sem pedir o que não devia (scripts/permissoesDosAgentes.mjs diz o motivo)`).toEqual([]);
    });
  }

  it('o Qwen só tem o que está na lista fechada (acrescentar é uma decisão visível: o arquivo e esta lista mudam juntos)', () => {
    const allow = lerAllow('.qwen/settings.json');
    expect(foraDaListaFechada('.qwen/settings.json', allow)).toEqual([]);
    expect(new Set(allow).size, 'sem permissão repetida').toBe(allow.length);
    // e a lista fechada não cresceu escondida: nenhuma entrada dela é perigosa
    expect(permissoesPerigosas(PERMITIDAS['.qwen/settings.json']!)).toEqual([]);
  });

  it('a lista que apareceu em 19/10 reprova, e reprova exatamente pelo que é perigoso', () => {
    const perigosas = permissoesPerigosas(ALARGADA_DE_19_10).map((a) => a.permissao);
    expect(perigosas.sort()).toEqual(['Bash(cmd *)', 'Bash(git *)', 'Bash(git branch *)', 'Bash(git checkout *)', 'Bash(git fetch *)', 'Bash(git ls-remote *)', 'Bash(git merge *)', 'Bash(powershell *)', 'Bash(timeout *)'].sort());
    // o resto do padrão antigo (o fluxo de PR e a leitura de arquivos) segue permitido
    for (const ok of ['Bash(rmdir *)', 'Bash(git worktree *)', 'Bash(git add *)', 'Bash(git commit *)', 'Bash(dir *)', 'Bash(@find *)', 'Bash(get-content *)', 'Bash(.count)', 'Bash(mklink *)', 'Bash(npm run *)']) expect(motivoDeRisco(ok), ok).toBeNull();
    // e a lista alargada, inteira, fica fora da lista fechada do Qwen
    expect(foraDaListaFechada('.qwen/settings.json', ALARGADA_DE_19_10).length).toBeGreaterThan(8);
  });

  it('os interpretadores e os envoltórios com coringa são o mesmo risco, em qualquer grafia', () => {
    for (const p of ['Bash(powershell *)', 'Bash(PowerShell *)', 'Bash(pwsh -c *)', 'Bash(cmd /c *)', 'Bash(cmd:*)', 'Bash(bash *)', 'Bash(sh *)', 'Bash(node *)', 'Bash(npx *)', 'Bash(python *)', 'Bash(xargs *)', 'Bash(sudo *)', 'Bash(env *)', 'Bash(timeout *)', 'Bash(timeout 30 *)', 'Bash(nohup *)', 'Bash(time *)', 'Bash(*)', 'Bash(* *)', 'Bash(powershell)']) expect(motivoDeRisco(p), p).not.toBeNull();
  });

  it('o envoltório vale o que o comando de dentro vale: `timeout 600 npm run *` passa, `timeout 600 powershell *` não', () => {
    expect(motivoDeRisco('Bash(timeout 600 npm run *)')).toBeNull();
    expect(motivoDeRisco('Bash(timeout 600 powershell *)')).not.toBeNull();
    expect(motivoDeRisco('Bash(timeout --signal=KILL 5 git *)')).not.toBeNull();
  });

  it('git: a família inteira e os verbos que apagam, mudam ou executam, com coringa, reprovam; o comando específico passa', () => {
    for (const p of ['Bash(git *)', 'Bash(git:*)', 'Bash(git)', 'Bash(git checkout *)', 'Bash(git switch *)', 'Bash(git reset *)', 'Bash(git clean *)', 'Bash(git push *)', 'Bash(git push:*)', 'Bash(git branch *)', 'Bash(git merge *)', 'Bash(git rebase *)', 'Bash(git fetch *)', 'Bash(git ls-remote *)', 'Bash(git config *)', 'Bash(git -c core.sshCommand=x *)', 'Bash(git -C . *)', 'Bash(git stash *)', 'Bash(git remote *)']) expect(motivoDeRisco(p), p).not.toBeNull();
    for (const p of ['Bash(git status)', 'Bash(git status --short)', 'Bash(git branch --list)', 'Bash(git branch --show-current)', 'Bash(git ls-remote --heads origin)', 'Bash(git merge origin/main)', 'Bash(git fetch origin)', 'Bash(git diff --stat)', 'Bash(git add *)', 'Bash(git commit *)', 'Bash(git worktree *)']) expect(motivoDeRisco(p), p).toBeNull();
  });

  it('a sintaxe antiga com dois-pontos e as maiúsculas são normalizadas antes de comparar', () => {
    expect(normalizar('Bash(git push:*)')).toBe('git push *');
    expect(normalizar('  Bash(Git  Push   *)  ')).toBe('git push *');
    expect(normalizar('Bash(.count)')).toBe('.count');
  });

  it('a exceção do Comandante vale só para o texto exato e só no arquivo dele: o `git push:*` do Claude passa lá e reprova no Qwen', () => {
    expect(permissoesPerigosas(['Bash(git push:*)'], (TOLERADAS as Record<string, string[]>)['.claude/settings.json'])).toEqual([]);
    expect(permissoesPerigosas(['Bash(git push:*)'])).toHaveLength(1); // sem a exceção (o caso do Qwen e do Gemini)
    expect(permissoesPerigosas(['Bash(git push --force:*)'], (TOLERADAS as Record<string, string[]>)['.claude/settings.json'])).toHaveLength(1);
    expect((TOLERADAS as Record<string, string[]>)['.qwen/settings.json']).toBeUndefined();
  });
});
