/**
 * Onde o servidor guarda o que não é código: o banco de contas (`contas.db`), os números das métricas (`telemetria.json`) e o
 * token do dono (`metricas-token.txt`). Em disco, fora do git (`.tmp/` é ignorado).
 *
 * Padrão: `<pasta do código>/.tmp/servidor/`, o que sempre foi. Em produção o código roda numa worktree descartável
 * (`.tmp/wt-servidor-prod`, que se apaga e recria no `git reset --hard`/`worktree remove`), então a tarefa do Windows define
 * `CYBERMECH_DADOS` apontando para uma pasta fixa do projeto (`scripts/servidor-windows.ps1`): trocar o código nunca leva o banco
 * junto. Vale G15: a pasta tem de ficar dentro do projeto.
 */
import { join, resolve } from 'node:path';

export const DADOS_VARIAVEL = 'CYBERMECH_DADOS';

/** A pasta de dados: a variável de ambiente (vazia ou só espaços não vale) ou `.tmp/servidor` ao lado do código. */
export function pastaDados(codigo: string, env: string | undefined = process.env[DADOS_VARIAVEL]): string {
  const dir = env?.trim();
  return dir ? resolve(dir) : resolve(codigo, '.tmp', 'servidor');
}

export const bancoDeContas = (pasta: string): string => join(pasta, 'contas.db');
