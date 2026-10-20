import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * O `bash` DO GIT (é o que o `git push` usa para rodar o hook). No Windows, `bash` solto no PATH pode ser o lançador do **WSL** (`C:\Windows\System32\bash.exe`): ele responde "ok" a `exit 0`, mas não enxerga
 * `D:\...` e devolve 127 ("No such file"). Foi o que **reverteu cada atualização de produção** (19/10: o site e o servidor ficaram 2 h sem publicar): no Git Bash do dono passava; na tarefa agendada, não.
 * Por isso se acha o `bash.exe` ao lado do `git` (`<raiz>/mingw64/libexec/git-core` → `<raiz>/bin/bash.exe`); sem ele, os testes de hook pulam. Compartilhado pelos testes do hook de push.
 */
export function acharBash(): string | null {
  if (process.platform !== 'win32') return 'bash';
  const g = spawnSync('git', ['--exec-path'], { encoding: 'utf8' });
  if (g.status !== 0) return null;
  const candidato = join(resolve(g.stdout.trim(), '..', '..', '..'), 'bin', 'bash.exe');
  return existsSync(candidato) ? candidato : null;
}

export const BASH = acharBash() ?? 'bash';
/** Há um bash que de fato roda um script aqui? (Os testes de hook se pulam sem ele.) */
export const temBash = acharBash() !== null && spawnSync(BASH, ['-c', 'exit 0']).status === 0;
