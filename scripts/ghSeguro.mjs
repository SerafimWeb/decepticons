/**
 * `gh` que não trava o envio quando o token do `gh` morre.
 *
 * Em 10/10 os tokens das duas contas do `gh` ficaram inválidos de uma hora para a outra (o login novo do dono não tem validade), e nenhum agente
 * conseguiu abrir PR: o `git push` seguia funcionando, porque usa OUTRA credencial (o gerenciador do Git). O dono: "a minha credencial é
 * justamente para você acessar o git e enviar automaticamente". Então: roda o `gh` normal; **só se a falha for de autenticação**, repete a
 * chamada com `GH_TOKEN` = a credencial que o Git já usa para o GitHub, **no ambiente do processo filho**. O token nunca vai para a saída
 * (a saída é filtrada), nem para argumento de linha de comando, nem para arquivo.
 */
import { spawnSync } from 'node:child_process';

/** O que o `gh` diz quando o token não vale. */
const AUTENTICACAO = /HTTP 401|Bad credentials|gh auth login|token in .* is invalid|authentication required|Requires authentication/i;

/** A credencial que o Git guarda para o GitHub (o `git push` usa esta), ou `null`. Não interage: sem credencial guardada, devolve `null`. */
export function tokenDoGit(executar = spawnSync) {
  const r = executar('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'false' },
  });
  if (r.status !== 0) return null;
  const m = /^password=(.+)$/m.exec(r.stdout ?? '');
  return m && m[1].trim() ? m[1].trim() : null;
}

/** A chamada falhou porque o token do `gh` não vale (e não por outro motivo: PR inexistente, rede, regra do GitHub). */
export function falhouPorAutenticacao(r) {
  return r.status !== 0 && AUTENTICACAO.test(`${r.stderr ?? ''}\n${r.stdout ?? ''}`);
}

/** Troca toda ocorrência do token por `***`. */
export function esconder(texto, token) {
  return token ? String(texto ?? '').split(token).join('***') : String(texto ?? '');
}

/**
 * Roda `gh <args>`. Devolve `{ status, stdout, stderr, viaGit }`; `viaGit` = true quando foi preciso usar a credencial do Git.
 * `executar(args, env)` e `token()` são injetáveis para teste.
 */
export function gh(args, { executar = (a, env) => spawnSync('gh', a, { encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 }), token = tokenDoGit } = {}) {
  const primeira = executar(args, process.env);
  if (!falhouPorAutenticacao(primeira)) return { status: primeira.status ?? 1, stdout: primeira.stdout ?? '', stderr: primeira.stderr ?? '', viaGit: false };
  const t = token();
  if (!t) return { status: primeira.status ?? 1, stdout: primeira.stdout ?? '', stderr: primeira.stderr ?? '', viaGit: false, semCredencial: true };
  const segunda = executar(args, { ...process.env, GH_TOKEN: t });
  return { status: segunda.status ?? 1, stdout: esconder(segunda.stdout, t), stderr: esconder(segunda.stderr, t), viaGit: true };
}
