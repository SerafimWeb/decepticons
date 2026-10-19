/**
 * Onde o servidor guarda o que não é código: o banco de contas (`contas.db`), os números das métricas (`telemetria.json`) e o
 * token do dono (`metricas-token.txt`). Em disco, fora do git (`.tmp/` é ignorado).
 *
 * Padrão: `<pasta do código>/.tmp/servidor/`, o que sempre foi. Em produção o código roda numa worktree descartável
 * (`.tmp/wt-servidor-prod`, que se apaga e recria no `git reset --hard`/`worktree remove`), então a tarefa do Windows define
 * `CYBERMECH_DADOS` apontando para uma pasta fixa do projeto (`scripts/servidor-windows.ps1`): trocar o código nunca leva o banco
 * junto. Vale G15: a pasta tem de ficar dentro do projeto.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const DADOS_VARIAVEL = 'CYBERMECH_DADOS';

/** A pasta de dados: a variável de ambiente (vazia ou só espaços não vale) ou `.tmp/servidor` ao lado do código. */
export function pastaDados(codigo: string, env: string | undefined = process.env[DADOS_VARIAVEL]): string {
  const dir = env?.trim();
  return dir ? resolve(dir) : resolve(codigo, '.tmp', 'servidor');
}

/**
 * A pasta de dados **para as ferramentas do dono** (`npm run admin`, `npm run email`): as mesmas regras de `pastaDados` e mais uma. Quem roda a ferramenta numa **worktree** (a de
 * produção, `.tmp/wt-servidor-prod`, que o atualizador mantém na `main`; ou a de um agente) quer os dados **de produção**, que ficam na pasta principal do projeto
 * (`<principal>/.tmp/servidor`), não numa pasta vazia dentro da worktree. A principal se acha lendo o arquivo `.git` da worktree (`gitdir: <principal>/.git/worktrees/<nome>`).
 * Isto vale **só para as ferramentas**: o servidor continua usando `pastaDados` (a variável da tarefa), e um servidor de teste numa worktree nunca encosta no banco de produção.
 * (Em 19/10 a pasta principal do Comandante estava 217 commits atrás, sem o `npm run email`; a worktree de produção está sempre em dia.)
 */
export function pastaDadosDasFerramentas(codigo: string, env: string | undefined = process.env[DADOS_VARIAVEL]): string {
  if (env?.trim()) return pastaDados(codigo, env);
  try {
    const arquivoGit = join(codigo, '.git');
    if (statSync(arquivoGit).isFile()) {
      const principal = /^gitdir:\s*(.*?)[\\/]\.git[\\/]worktrees[\\/]/m.exec(readFileSync(arquivoGit, 'utf8'))?.[1];
      const dados = principal ? join(resolve(principal), '.tmp', 'servidor') : null;
      if (dados && existsSync(dados)) return dados;
    }
  } catch {
    // não é uma worktree (ou não dá para ler): vale a pasta ao lado do código
  }
  return pastaDados(codigo, undefined);
}

export const bancoDeContas = (pasta: string): string => join(pasta, 'contas.db');
