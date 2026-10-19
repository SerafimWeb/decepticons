/**
 * AS PERMISSÕES DOS AGENTES (P208, 19/10): os arquivos `.qwen/settings.json`, `.claude/settings.json` e `.gemini/settings.json` dizem o que cada agente roda **sem pedir**. Um interpretador
 * com coringa (`powershell *`, `cmd *`, `node *`, `timeout *`) ou um `git *` solto vale por **qualquer comando**: o agente passa a rodar o que quiser sem que ninguém aprove, inclusive apagar
 * branch, trocar de branch com trabalho não salvo (`git checkout`) ou empurrar à força. O alerta automático de segurança apontou isso no Qwen duas vezes; o Comandante mandou resolver de vez
 * (19/10): esta regra roda no `npm run check` (`server/permissoesDosAgentes.test.ts`), então a permissão alargada **não passa mais despercebida**.
 *
 * Duas camadas: (1) a regra de **forma**, para todo agente (nada de interpretador ou família do git com coringa); (2) para o Qwen, uma **lista fechada**: o que não está em `PERMITIDAS` reprova,
 * então acrescentar uma permissão é uma decisão visível no PR (arquivo e teste mudam juntos), não um clique. O que o agente precisar além disso, ele pede a cada vez.
 */

/** Programas que executam qualquer coisa: com coringa, liberam tudo. */
export const INTERPRETADORES = ['powershell', 'pwsh', 'cmd', 'bash', 'sh', 'zsh', 'wsl', 'node', 'npx', 'python', 'python3', 'py', 'perl', 'ruby', 'deno', 'bun', 'env', 'start', 'invoke-expression', 'iex', 'xargs', 'sudo', 'runas', 'forfiles'];

/** Envoltórios: rodam o comando que vem depois (`timeout 600 npm run x`). Valem o que o comando de dentro vale; `timeout *` sozinho executa qualquer coisa. */
export const ENVOLTORIOS = ['timeout', 'time', 'nohup', 'command', 'call', 'exec'];

/**
 * Verbos do git que, com coringa, deixam passar o que muda ou apaga trabalho (`-D`, `--force`, `--hard`) ou **executa comando** (`fetch --upload-pack=`, `config alias.x=!cmd`, `rebase --exec`).
 * Ficam de fora (liberados no padrão do Qwen): `add`, `commit`, `worktree`.
 */
export const VERBOS_PERIGOSOS_DO_GIT = ['checkout', 'switch', 'merge', 'reset', 'clean', 'rebase', 'push', 'restore', 'stash', 'branch', 'pull', 'rm', 'mv', 'cherry-pick', 'revert', 'tag', 'am', 'apply', 'gc', 'prune', 'update-ref', 'fetch', 'ls-remote', 'clone', 'config', 'remote', 'submodule', 'bisect', 'filter-branch'];

/** Os arquivos de permissões versionados (o que não existir é ignorado). */
export const ARQUIVOS_DE_PERMISSOES = ['.qwen/settings.json', '.claude/settings.json', '.gemini/settings.json'];

/** Exceções do Comandante, **por arquivo e por texto exato**. O `publicar` empurra o branch do Claude; sem isto cada `git push` pediria aprovação. */
export const TOLERADAS = Object.freeze({
  '.claude/settings.json': ['Bash(git push:*)'],
});

/**
 * A lista fechada do Qwen (19/10): o fluxo de branch e PR do `AGENTS.md` (worktree, add, commit, `npm run`), ler arquivos, e **só os comandos específicos** de olhar o git. Mudou? Mude aqui e no arquivo,
 * no mesmo PR, dizendo por quê no `HISTORICO_DE_DECISOES.md`.
 */
export const PERMITIDAS = Object.freeze({
  '.qwen/settings.json': [
    'Bash(rmdir *)',
    'Bash(git worktree *)',
    'Bash(git fetch origin)',
    'Bash(git add *)',
    'Bash(git commit *)',
    'Bash(dir *)',
    'Bash(@find *)',
    'Bash(get-content *)',
    'Bash(.count)',
    'Bash(mklink *)',
    'Bash(npm run *)',
    'Bash(timeout 600 npm run *)',
    'Bash(git status)',
    'Bash(git status --short)',
    'Bash(git branch --list)',
    'Bash(git branch --show-current)',
    'Bash(git ls-remote --heads origin)',
    'Bash(git diff --stat)',
    'Bash(git diff --name-only)',
    'Bash(git merge origin/main)',
  ],
});

/** "Bash(git push:*)" e "Bash(git push *)" são a mesma permissão (sintaxe antiga com dois-pontos): tira o envelope, junta os espaços e põe em minúsculas. */
export function normalizar(permissao) {
  const m = /^\s*Bash\((.*)\)\s*$/is.exec(permissao);
  return (m ? m[1] : permissao).replace(/:\*/g, ' *').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** O comando de dentro de um envoltório: pula as opções e o número (`timeout 600 npm run x` → `npm run x`). */
function internoDoEnvoltorio(resto) {
  let i = 0;
  while (i < resto.length && (resto[i].startsWith('-') || /^\d+[smhd]?$/.test(resto[i]))) i++;
  return resto.slice(i).join(' ');
}

/** Por que esta permissão é perigosa, ou `null` se está dentro da regra. */
export function motivoDeRisco(permissao) {
  const p = normalizar(permissao);
  if (p === '*' || /^\*(\s|$)/.test(p)) return 'libera qualquer comando';
  const [programa = '', ...resto] = p.split(' ');
  const comCoringa = p.includes('*');
  if (INTERPRETADORES.includes(programa) && (comCoringa || resto.length === 0)) return `"${programa}" com coringa executa qualquer coisa`;
  if (ENVOLTORIOS.includes(programa)) {
    const dentro = internoDoEnvoltorio(resto);
    if (!dentro) return `"${programa}" sem um comando fixo executa qualquer coisa`;
    if (dentro.startsWith('*')) return `"${programa} *" executa qualquer comando`;
    return motivoDeRisco(dentro);
  }
  if (programa === 'git') {
    if (resto.length === 0 || (resto.length === 1 && resto[0] === '*')) return '"git *" libera toda a família do git';
    if (resto[0].startsWith('-') && comCoringa) return 'opção global do git com coringa (`-c`, `-C`) roda comando de configuração';
    if (comCoringa && VERBOS_PERIGOSOS_DO_GIT.includes(resto[0])) return `"git ${resto[0]} *" deixa passar -D, --force, --hard, --exec e afins`;
  }
  return null;
}

/** As permissões perigosas de uma lista `allow`, com o motivo. `toleradas`: textos exatos que o Comandante liberou. */
export function permissoesPerigosas(allow, toleradas = []) {
  const ok = new Set(toleradas);
  const achadas = [];
  for (const p of allow) {
    if (ok.has(p)) continue;
    const motivo = motivoDeRisco(p);
    if (motivo) achadas.push({ permissao: p, motivo });
  }
  return achadas;
}

/** O que sobra da lista fora da lista fechada do arquivo (vazio se o arquivo não tem lista fechada). */
export function foraDaListaFechada(arquivo, allow) {
  const fechada = PERMITIDAS[arquivo];
  if (!fechada) return [];
  const ok = new Set(fechada);
  return allow.filter((p) => !ok.has(p));
}
