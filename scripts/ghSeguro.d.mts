export interface RespostaGh {
  status: number;
  stdout: string;
  stderr: string;
  /** Foi preciso usar a credencial do Git (o token do `gh` não valia). */
  viaGit: boolean;
  /** O `gh` falhou por autenticação e não havia credencial do Git para tentar. */
  semCredencial?: boolean;
}

export function tokenDoGit(executar?: (comando: string, args: string[], opcoes: object) => { status: number | null; stdout?: string }): string | null;
export function falhouPorAutenticacao(r: { status: number | null; stdout?: string; stderr?: string }): boolean;
export function esconder(texto: unknown, token: string | null): string;
export function gh(
  args: string[],
  ops?: {
    executar?: (args: string[], env: NodeJS.ProcessEnv) => { status: number | null; stdout?: string; stderr?: string };
    token?: () => string | null;
    /** O ambiente da primeira chamada (padrão: process.env). */
    ambiente?: NodeJS.ProcessEnv;
  },
): RespostaGh;
